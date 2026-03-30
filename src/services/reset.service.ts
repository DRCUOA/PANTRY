import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { getDb } from "@/db";
import { mealPlanEntries, pantryItems, recipeIngredients, recipes } from "@/db/schema";
import { addDaysIso, toIsoDate } from "@/lib/week";
import { computeVarietyRule, listRecipeRecencyByUser } from "@/services/meal-plan.service";
import { generateFromMealPlanRange, listShoppingItemsReadModel } from "@/services/shopping.service";
import { rankSundayBestMatches } from "@/services/suggestion.engine";

const RESET_MEAL_TYPES = ["breakfast", "lunch", "dinner"] as const;

export interface SundayResetSummary {
  window: { startDate: string; endDate: string; slotCount: number; gapsFound: number };
  mealsPrioritized: Array<{
    plannedDate: string;
    mealType: string;
    recipeId: number;
    recipeTitle: string;
    top3RecipeIds: number[];
    created: boolean;
  }>;
  shoppingItemsGenerated: {
    inserted: number;
    updated: number;
    skipped: number;
    generated: number;
    items: Array<{ name: string; quantity: string | null; unit: string | null; subtitle: string }>;
  };
  varietyGuardOutcomes: { safe: number; flagged: number; total: number };
}

export async function runSundayResetService(
  userId: number,
  options?: { startDate?: string; days?: number },
): Promise<SundayResetSummary> {
  const db = getDb();
  const startDate = options?.startDate ?? toIsoDate(new Date());
  const days = Math.max(1, options?.days ?? 7);
  const endDate = addDaysIso(startDate, days - 1);

  const [plannedRows, pantryRows, recipeRows, recencyRows] = await Promise.all([
    db
      .select({ plannedDate: mealPlanEntries.plannedDate, mealType: mealPlanEntries.mealType })
      .from(mealPlanEntries)
      .where(
        and(
          eq(mealPlanEntries.userId, userId),
          gte(mealPlanEntries.plannedDate, startDate),
          lte(mealPlanEntries.plannedDate, endDate),
          inArray(mealPlanEntries.status, ["planned", "cooked"]),
        ),
      ),
    db
      .select({
        name: pantryItems.name,
        expirationDate: pantryItems.expirationDate,
        quantity: pantryItems.quantity,
        lowStockThreshold: pantryItems.lowStockThreshold,
      })
      .from(pantryItems)
      .where(eq(pantryItems.userId, userId)),
    db
      .select({
        id: recipes.id,
        title: recipes.title,
        mealType: recipes.mealType,
        servings: recipes.servings,
      })
      .from(recipes)
      .where(eq(recipes.userId, userId))
      .orderBy(asc(recipes.title)),
    listRecipeRecencyByUser(userId),
  ]);

  const recipeIds = recipeRows.map((recipe) => recipe.id);
  const ingredientRows =
    recipeIds.length === 0
      ? []
      : await db.select().from(recipeIngredients).where(inArray(recipeIngredients.recipeId, recipeIds));

  const ingredientsByRecipe = new Map<number, (typeof ingredientRows)[number][]>();
  for (const ingredient of ingredientRows) {
    const bucket = ingredientsByRecipe.get(ingredient.recipeId) ?? [];
    bucket.push(ingredient);
    ingredientsByRecipe.set(ingredient.recipeId, bucket);
  }

  const recipesForRank = recipeRows.map((recipe) => ({
    id: recipe.id,
    title: recipe.title,
    mealType: recipe.mealType,
    ingredients: (ingredientsByRecipe.get(recipe.id) ?? []).map((ingredient) => ({
      pantryItemName: ingredient.pantryItemName,
      optional: ingredient.optional,
    })),
  }));

  const varietyByRecipeId = new Map(recencyRows.map((row) => [row.recipeId, row]));
  const occupiedSlots = new Set(plannedRows.map((row) => `${row.plannedDate}::${row.mealType}`));
  const mealsPrioritized: SundayResetSummary["mealsPrioritized"] = [];

  for (let dayOffset = 0; dayOffset < days; dayOffset += 1) {
    const plannedDate = addDaysIso(startDate, dayOffset);
    for (const mealType of RESET_MEAL_TYPES) {
      const slotKey = `${plannedDate}::${mealType}`;
      if (occupiedSlots.has(slotKey)) continue;

      const recipesForMealType = recipesForRank.filter((recipe) => recipe.mealType === mealType);
      const top3 = rankSundayBestMatches({
        userId,
        slotContext: { slotDate: plannedDate, mealType },
        pantry: pantryRows.map((row) => ({
          name: row.name,
          expirationDate: row.expirationDate,
          quantity: row.quantity != null ? Number(row.quantity) : undefined,
          lowStockThreshold: row.lowStockThreshold != null ? Number(row.lowStockThreshold) : null,
        })),
        recipes: recipesForMealType.length > 0 ? recipesForMealType : recipesForRank,
        varietyMetadata: recencyRows
          .filter((row) => row.daysSinceLastHad != null)
          .map((row) => ({ recipeId: row.recipeId, daysSinceLastHad: row.daysSinceLastHad ?? 0 })),
      });
      if (top3.length === 0) continue;

      const primary = top3[0]!;
      await db.insert(mealPlanEntries).values({
        userId,
        recipeId: primary.id,
        plannedDate,
        mealType,
        servings: "1",
        status: "planned",
        notes: "Sunday reset",
      });
      occupiedSlots.add(slotKey);

      mealsPrioritized.push({
        plannedDate,
        mealType,
        recipeId: primary.id,
        recipeTitle: primary.title,
        top3RecipeIds: top3.map((candidate) => candidate.id),
        created: true,
      });
    }
  }

  const shoppingDelta = await generateFromMealPlanRange(userId, startDate, endDate);
  const shoppingRows = await listShoppingItemsReadModel(userId);
  const shoppingItems = shoppingRows
    .filter((row) => row.status === "needed")
    .map((row) => ({
      name: row.name,
      quantity: row.quantity == null ? null : String(row.quantity),
      unit: row.unit ?? null,
      subtitle: row.sourceRecipeTitle ? `From ${row.sourceRecipeTitle}` : "Manual item",
    }));

  const varietyGuardOutcomes = mealsPrioritized.reduce(
    (acc, meal) => {
      const daysSince = varietyByRecipeId.get(meal.recipeId)?.daysSinceLastHad ?? null;
      const variety = computeVarietyRule(daysSince);
      if (variety.isVarietySafe) acc.safe += 1;
      else acc.flagged += 1;
      acc.total += 1;
      return acc;
    },
    { safe: 0, flagged: 0, total: 0 },
  );

  const slotCount = days * RESET_MEAL_TYPES.length;
  return {
    window: {
      startDate,
      endDate,
      slotCount,
      gapsFound: slotCount - plannedRows.length,
    },
    mealsPrioritized,
    shoppingItemsGenerated: {
      ...shoppingDelta,
      items: shoppingItems,
    },
    varietyGuardOutcomes,
  };
}
