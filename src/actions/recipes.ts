"use server";

import { and, asc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { pantryItems, recipeIngredients, recipes } from "@/db/schema";
import { getSession } from "@/lib/get-session";
import { normalizeIngredientAmount } from "@/lib/ingredient-amount";
import { parseMealTypeFromForm, type RecipeMealTypeValue } from "@/lib/recipe-meal-types";
import {
  type IngredientLineInput,
  ingredientLineSchema,
  type RecipeBaseInput,
  recipeBaseSchema,
} from "@/lib/recipe-schemas";

async function requireUserId(): Promise<number> {
  const session = await getSession();
  if (!session.isLoggedIn || session.userId == null) throw new Error("Unauthorized");
  return session.userId;
}

export async function listRecipes() {
  const userId = await requireUserId();
  const db = getDb();
  const list = await db
    .select()
    .from(recipes)
    .where(eq(recipes.userId, userId))
    .orderBy(asc(recipes.title));
  const ids = list.map((r) => r.id);
  if (!ids.length) return [];
  const ings = await db
    .select()
    .from(recipeIngredients)
    .where(inArray(recipeIngredients.recipeId, ids));
  const byRecipe = new Map<number, typeof ings>();
  for (const ing of ings) {
    const arr = byRecipe.get(ing.recipeId) ?? [];
    arr.push(ing);
    byRecipe.set(ing.recipeId, arr);
  }
  return list.map((r) => ({ ...r, ingredients: byRecipe.get(r.id) ?? [] }));
}

async function resolveRecipeIngredients(
  userId: number,
  ingredients: IngredientLineInput[],
): Promise<
  | { ok: true; rows: { pantryItemName: string; quantity: string | null; unit: string | null; optional: boolean }[] }
  | { ok: false; error: string }
> {
  const db = getDb();
  const ids = [...new Set(ingredients.map((i) => i.pantryItemId).filter((x): x is number => x != null))];
  let idToName = new Map<number, string>();
  if (ids.length) {
    const rows = await db
      .select({ id: pantryItems.id, name: pantryItems.name })
      .from(pantryItems)
      .where(and(eq(pantryItems.userId, userId), inArray(pantryItems.id, ids)));
    idToName = new Map(rows.map((r) => [r.id, r.name]));
    if (idToName.size !== ids.length) {
      return { ok: false, error: "One or more pantry items are invalid" };
    }
  }
  const rows: {
    pantryItemName: string;
    quantity: string | null;
    unit: string | null;
    optional: boolean;
  }[] = [];
  for (const i of ingredients) {
    let name: string;
    if (i.pantryItemId != null) {
      const n = idToName.get(i.pantryItemId);
      if (!n) return { ok: false, error: "Unknown pantry item" };
      name = n;
    } else {
      name = i.pantryItemName?.trim() ?? "";
      if (!name) continue;
    }
    const amount = normalizeIngredientAmount(i.quantity, i.unit);
    rows.push({
      pantryItemName: name,
      quantity: amount.quantity,
      unit: amount.unit,
      optional: i.optional ?? false,
    });
  }
  return { ok: true, rows };
}

async function insertRecipe(
  userId: number,
  base: RecipeBaseInput,
  ingredients: IngredientLineInput[],
  mealType: RecipeMealTypeValue,
): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const resolved = await resolveRecipeIngredients(userId, ingredients);
  if (!resolved.ok) {
    return { ok: false, error: resolved.error };
  }
  const db = getDb();
  const v = base;
  try {
    const recipeId = await db.transaction(async (tx) => {
      const [insertedRecipe] = await tx
        .insert(recipes)
        .values({
          userId,
          title: v.title,
          description: v.description || null,
          instructions: v.instructions || null,
          servings: v.servings,
          prepTimeMinutes: v.prepTimeMinutes ?? null,
          caloriesPerServing: v.caloriesPerServing ?? null,
          proteinGPerServing: v.proteinGPerServing,
          mealType,
        })
        .returning({ id: recipes.id });

      if (resolved.rows.length) {
        await tx.insert(recipeIngredients).values(
          resolved.rows.map((ingredient) => ({
            recipeId: insertedRecipe.id,
            pantryItemName: ingredient.pantryItemName,
            quantity: ingredient.quantity,
            unit: ingredient.unit || null,
            optional: ingredient.optional,
          })),
        );
      }

      return insertedRecipe.id;
    });

    revalidatePath("/plan");
    revalidatePath("/home");
    return { ok: true, id: recipeId };
  } catch {
    return { ok: false, error: "Could not save recipe" };
  }
}

export async function createRecipeFromStructuredInput(
  base: RecipeBaseInput,
  ingredients: IngredientLineInput[],
  mealType: RecipeMealTypeValue,
): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const userId = await requireUserId();
  return insertRecipe(userId, base, ingredients, mealType);
}

/** Create a recipe from validated base + ingredient lines (e.g. file import). */
export async function createRecipeFromImport(
  base: RecipeBaseInput,
  ingredients: IngredientLineInput[],
  mealType: RecipeMealTypeValue,
): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  return createRecipeFromStructuredInput(base, ingredients, mealType);
}

export async function createRecipe(formData: FormData) {
  const userId = await requireUserId();
  const base = recipeBaseSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    instructions: formData.get("instructions"),
    servings: formData.get("servings") || 1,
    prepTimeMinutes: formData.get("prepTimeMinutes"),
    caloriesPerServing: formData.get("caloriesPerServing"),
    proteinGPerServing: formData.get("proteinGPerServing"),
  });
  if (!base.success) {
    return { ok: false as const, error: base.error.issues[0]?.message ?? "Invalid" };
  }
  const ingRaw = formData.get("ingredients_json");
  let ingredients: IngredientLineInput[] = [];
  if (typeof ingRaw === "string" && ingRaw.trim()) {
    try {
      const arr = JSON.parse(ingRaw) as unknown[];
      ingredients = arr
        .map((x) => ingredientLineSchema.safeParse(x))
        .filter((r) => r.success)
        .map((r) => r.data!);
    } catch {
      return { ok: false as const, error: "Invalid ingredients JSON" };
    }
  }
  const mealType = parseMealTypeFromForm(formData);
  const result = await insertRecipe(userId, base.data, ingredients, mealType);
  if (!result.ok) {
    return { ok: false as const, error: result.error };
  }
  return { ok: true as const, id: result.id };
}

export async function updateRecipe(recipeId: number, formData: FormData) {
  const userId = await requireUserId();
  const base = recipeBaseSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    instructions: formData.get("instructions"),
    servings: formData.get("servings") || 1,
    prepTimeMinutes: formData.get("prepTimeMinutes"),
    caloriesPerServing: formData.get("caloriesPerServing"),
    proteinGPerServing: formData.get("proteinGPerServing"),
  });
  if (!base.success) {
    return { ok: false as const, error: base.error.issues[0]?.message ?? "Invalid" };
  }
  const ingRaw = formData.get("ingredients_json");
  let ingredients: IngredientLineInput[] = [];
  if (typeof ingRaw === "string" && ingRaw.trim()) {
    try {
      const arr = JSON.parse(ingRaw) as unknown[];
      ingredients = arr
        .map((x) => ingredientLineSchema.safeParse(x))
        .filter((r) => r.success)
        .map((r) => r.data!);
    } catch {
      return { ok: false as const, error: "Invalid ingredients JSON" };
    }
  }
  const resolved = await resolveRecipeIngredients(userId, ingredients);
  if (!resolved.ok) {
    return { ok: false as const, error: resolved.error };
  }
  const db = getDb();
  const own = await db
    .select()
    .from(recipes)
    .where(and(eq(recipes.id, recipeId), eq(recipes.userId, userId)))
    .limit(1);
  if (!own[0]) return { ok: false as const, error: "Not found" };
  const v = base.data;
  const mealType = parseMealTypeFromForm(formData);
  try {
    await db.transaction(async (tx) => {
      await tx
        .update(recipes)
        .set({
          title: v.title,
          description: v.description || null,
          instructions: v.instructions || null,
          servings: v.servings,
          prepTimeMinutes: v.prepTimeMinutes ?? null,
          caloriesPerServing: v.caloriesPerServing ?? null,
          proteinGPerServing: v.proteinGPerServing,
          mealType,
          updatedAt: new Date(),
        })
        .where(eq(recipes.id, recipeId));
      await tx.delete(recipeIngredients).where(eq(recipeIngredients.recipeId, recipeId));
      if (resolved.rows.length) {
        await tx.insert(recipeIngredients).values(
          resolved.rows.map((ingredient) => ({
            recipeId,
            pantryItemName: ingredient.pantryItemName,
            quantity: ingredient.quantity,
            unit: ingredient.unit || null,
            optional: ingredient.optional,
          })),
        );
      }
    });

    revalidatePath("/plan");
    revalidatePath("/home");
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "Could not update recipe" };
  }
}

export async function deleteRecipe(recipeId: number): Promise<void> {
  const userId = await requireUserId();
  const db = getDb();
  await db
    .delete(recipes)
    .where(and(eq(recipes.id, recipeId), eq(recipes.userId, userId)));
  revalidatePath("/plan");
  revalidatePath("/home");
}
