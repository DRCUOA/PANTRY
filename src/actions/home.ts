"use server";

import { and, asc, eq, gte, inArray, isNotNull, lte, sql } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import { getDb } from "@/db";
import {
  mealPlanEntries,
  pantryItems,
  recipeIngredients,
  recipes,
  userSettings,
} from "@/db/schema";
import { getSession } from "@/lib/get-session";
import { scoreRecipes } from "@/lib/recipe-score";
import { listRecipeRecencyByUser } from "@/services/meal-plan.service";

async function requireUserId(): Promise<number> {
  const session = await getSession();
  if (!session.isLoggedIn || session.userId == null) throw new Error("Unauthorized");
  return session.userId;
}

export async function getHomeSnapshot() {
  const userId = await requireUserId();
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  const weekAhead = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const expiring = await db
    .select()
    .from(pantryItems)
    .where(
      and(
        eq(pantryItems.userId, userId),
        isNotNull(pantryItems.expirationDate),
        lte(pantryItems.expirationDate, weekAhead),
        gte(pantryItems.expirationDate, today),
      ),
    )
    .orderBy(asc(pantryItems.expirationDate))
    .limit(12);

  const low = await db
    .select()
    .from(pantryItems)
    .where(
      and(
        eq(pantryItems.userId, userId),
        sql`(${pantryItems.lowStockThreshold} IS NOT NULL AND ${pantryItems.quantity}::numeric <= ${pantryItems.lowStockThreshold}::numeric AND ${pantryItems.quantity}::numeric > 0)`,
      ),
    )
    .orderBy(asc(pantryItems.name))
    .limit(12);

  const pantryForScore = await db
    .select({ name: pantryItems.name, expirationDate: pantryItems.expirationDate })
    .from(pantryItems)
    .where(eq(pantryItems.userId, userId));

  const recipeList = await db
    .select()
    .from(recipes)
    .where(eq(recipes.userId, userId))
    .orderBy(asc(recipes.title));
  const rids = recipeList.map((r) => r.id);
  const ingredientsByRecipe = new Map<number, { pantryItemName: string; optional: boolean }[]>();
  if (rids.length) {
    const ings = await db
      .select()
      .from(recipeIngredients)
      .where(inArray(recipeIngredients.recipeId, rids));
    for (const ing of ings) {
      const arr = ingredientsByRecipe.get(ing.recipeId) ?? [];
      arr.push({ pantryItemName: ing.pantryItemName, optional: ing.optional });
      ingredientsByRecipe.set(ing.recipeId, arr);
    }
  }
  const forScore = recipeList.map((r) => ({
    id: r.id,
    title: r.title,
    ingredients: ingredientsByRecipe.get(r.id) ?? [],
  }));
  const ranked = scoreRecipes(forScore, pantryForScore, 7).slice(0, 6);
  const recency = await listRecipeRecencyByUser(userId);
  const recencyByRecipeId = new Map(recency.map((item) => [item.recipeId, item]));
  const rankedWithVariety = ranked.map((item) => {
    const meta = recencyByRecipeId.get(item.recipe.id);
    return {
      ...item,
      variety: meta
        ? {
            ...meta.variety,
            daysSinceLastHad: meta.daysSinceLastHad,
          }
        : undefined,
    };
  });

  const nextMeals = await db
    .select()
    .from(mealPlanEntries)
    .where(
      and(
        eq(mealPlanEntries.userId, userId),
        eq(mealPlanEntries.status, "planned"),
        gte(mealPlanEntries.plannedDate, today),
      ),
    )
    .orderBy(asc(mealPlanEntries.plannedDate), asc(mealPlanEntries.mealType))
    .limit(1);

  const first = nextMeals[0];
  type MealRow = InferSelectModel<typeof mealPlanEntries>;
  let nextMeal: (MealRow & { recipeTitle: string | null }) | null = null;
  if (first) {
    let recipeTitle: string | null = null;
    if (first.recipeId) {
      const rt = await db
        .select({ title: recipes.title })
        .from(recipes)
        .where(eq(recipes.id, first.recipeId))
        .limit(1);
      recipeTitle = rt[0]?.title ?? null;
    }
    nextMeal = { ...first, recipeTitle };
  }

  const settingsRow = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);

  return {
    expiring,
    low,
    cookIdeas: rankedWithVariety,
    nextMeal,
    settings: settingsRow[0] ?? null,
  };
}
