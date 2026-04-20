import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { getDb } from "@/db";
import { mealPlanEntries, pantryItems, recipeIngredients, recipes, shoppingListItems } from "@/db/schema";
import { normalizePantryName, scaledIngredientAmount } from "@/lib/pantry-match";
import { recipePantryStatus } from "@/lib/recipe-score";
import type { ServiceResult } from "@/services/_shared/result";

export interface AddShoppingItemInput {
  userId: number;
  input: {
    name: string;
    quantity: string | null;
    unit: string | null;
    pantryItemId: number | null;
  };
}

type ShoppingSourceReadRow = typeof shoppingListItems.$inferSelect & {
  sourceRecipeTitle: string | null;
};

type MergedMissingIngredient = {
  name: string;
  quantity: number;
  unit: string | null;
  sourceRecipeId: number;
  sourceRecipeTitles: string[];
};

function normalizeUnit(unit: string | null | undefined) {
  return (unit ?? "").trim().toLowerCase();
}

function mergeKey(name: string, unit: string | null, sourceRecipeId: number) {
  return `${normalizePantryName(name)}::${normalizeUnit(unit)}::${sourceRecipeId}`;
}

function formatQuantity(value: number): string | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  return String(Number(value.toFixed(2)));
}

export async function listShoppingItemsReadModel(userId: number): Promise<ShoppingSourceReadRow[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: shoppingListItems.id,
      userId: shoppingListItems.userId,
      name: shoppingListItems.name,
      quantity: shoppingListItems.quantity,
      unit: shoppingListItems.unit,
      status: shoppingListItems.status,
      sourceRecipeId: shoppingListItems.sourceRecipeId,
      createdAt: shoppingListItems.createdAt,
      updatedAt: shoppingListItems.updatedAt,
      sourceRecipeTitle: recipes.title,
    })
    .from(shoppingListItems)
    .leftJoin(recipes, eq(shoppingListItems.sourceRecipeId, recipes.id))
    .where(eq(shoppingListItems.userId, userId))
    .orderBy(asc(shoppingListItems.status), asc(shoppingListItems.name));

  return rows;
}

export async function generateFromMealPlanRange(userId: number, startDate: string, endDate: string) {
  const db = getDb();

  const planned = await db
    .select({ recipeId: mealPlanEntries.recipeId, servings: mealPlanEntries.servings })
    .from(mealPlanEntries)
    .where(
      and(
        eq(mealPlanEntries.userId, userId),
        gte(mealPlanEntries.plannedDate, startDate),
        lte(mealPlanEntries.plannedDate, endDate),
      ),
    );

  const recipeIds = [...new Set(planned.map((row) => row.recipeId).filter((id): id is number => id != null))];
  if (recipeIds.length === 0) {
    return { inserted: 0, updated: 0, skipped: 0, generated: 0 };
  }

  const [recipeRows, ingredientRows, pantryRows, existingRows] = await Promise.all([
    db
      .select({ id: recipes.id, title: recipes.title, servings: recipes.servings })
      .from(recipes)
      .where(and(eq(recipes.userId, userId), inArray(recipes.id, recipeIds))),
    db.select().from(recipeIngredients).where(inArray(recipeIngredients.recipeId, recipeIds)),
    db.select({ name: pantryItems.name }).from(pantryItems).where(eq(pantryItems.userId, userId)),
    db
      .select()
      .from(shoppingListItems)
      .where(and(eq(shoppingListItems.userId, userId), eq(shoppingListItems.status, "needed"))),
  ]);

  const recipesById = new Map(recipeRows.map((row) => [row.id, row]));
  const ingredientsByRecipeId = new Map<number, (typeof ingredientRows)[number][]>();
  for (const ingredient of ingredientRows) {
    const bucket = ingredientsByRecipeId.get(ingredient.recipeId) ?? [];
    bucket.push(ingredient);
    ingredientsByRecipeId.set(ingredient.recipeId, bucket);
  }

  const mergedMissing = new Map<string, MergedMissingIngredient>();

  for (const entry of planned) {
    if (entry.recipeId == null) continue;
    const recipe = recipesById.get(entry.recipeId);
    if (!recipe) continue;
    const recipeIngredientsRows = ingredientsByRecipeId.get(entry.recipeId) ?? [];

    const { missing } = recipePantryStatus(
      {
        id: recipe.id,
        title: recipe.title,
        ingredients: recipeIngredientsRows.map((ingredient) => ({
          pantryItemName: ingredient.pantryItemName,
          optional: ingredient.optional,
        })),
      },
      pantryRows.map((pantry) => ({ name: pantry.name, expirationDate: null })),
    );

    for (const missingIngredient of missing) {
      if (missingIngredient.optional) continue;
      const ingredient = recipeIngredientsRows.find(
        (row) => normalizePantryName(row.pantryItemName) === normalizePantryName(missingIngredient.name),
      );

      const scaledQuantity = scaledIngredientAmount(
        ingredient?.quantity == null ? null : String(ingredient.quantity),
        recipe.servings,
        entry.servings,
      );

      const key = mergeKey(missingIngredient.name, ingredient?.unit ?? null, recipe.id);
      const existingMerged = mergedMissing.get(key);
      if (existingMerged) {
        existingMerged.quantity += scaledQuantity;
        if (!existingMerged.sourceRecipeTitles.includes(recipe.title)) {
          existingMerged.sourceRecipeTitles.push(recipe.title);
        }
        continue;
      }

      mergedMissing.set(key, {
        name: missingIngredient.name,
        quantity: scaledQuantity,
        unit: ingredient?.unit ?? null,
        sourceRecipeId: recipe.id,
        sourceRecipeTitles: [recipe.title],
      });
    }
  }

  const existingByKey = new Map<string, (typeof existingRows)>();
  for (const row of existingRows) {
    if (row.sourceRecipeId == null) continue;
    const key = mergeKey(row.name, row.unit, row.sourceRecipeId);
    const bucket = existingByKey.get(key) ?? [];
    bucket.push(row);
    existingByKey.set(key, bucket);
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const [key, generated] of mergedMissing.entries()) {
    const quantity = formatQuantity(generated.quantity);
    const existing = existingByKey.get(key) ?? [];
    const primary = existing[0];

    if (!primary) {
      await db.insert(shoppingListItems).values({
        userId,
        name: generated.name,
        quantity,
        unit: generated.unit,
        status: "needed",
        sourceRecipeId: generated.sourceRecipeId,
      });
      inserted += 1;
      continue;
    }

    const unchanged =
      primary.name === generated.name &&
      (primary.unit ?? null) === (generated.unit ?? null) &&
      (primary.quantity == null ? null : String(primary.quantity)) === quantity;

    if (unchanged) {
      skipped += 1;
    } else {
      await db
        .update(shoppingListItems)
        .set({ name: generated.name, quantity, unit: generated.unit, updatedAt: new Date() })
        .where(eq(shoppingListItems.id, primary.id));
      updated += 1;
    }

    if (existing.length > 1) {
      for (const duplicate of existing.slice(1)) {
        await db.delete(shoppingListItems).where(eq(shoppingListItems.id, duplicate.id));
      }
    }
  }

  return { inserted, updated, skipped, generated: mergedMissing.size };
}

export async function addShoppingItemService(
  _params: AddShoppingItemInput,
): Promise<ServiceResult<{ shoppingItemId: number }>> {
  return { ok: false, error: "Not implemented" };
}

/**
 * Permanently delete every shopping list item belonging to the user (regardless
 * of status). Returns the number of rows that were removed so callers can
 * surface meaningful confirmation toasts.
 */
export async function clearShoppingListService(userId: number): Promise<{ deleted: number }> {
  const db = getDb();
  const existing = await db
    .select({ id: shoppingListItems.id })
    .from(shoppingListItems)
    .where(eq(shoppingListItems.userId, userId));
  if (existing.length === 0) return { deleted: 0 };
  await db.delete(shoppingListItems).where(eq(shoppingListItems.userId, userId));
  return { deleted: existing.length };
}
