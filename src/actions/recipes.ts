"use server";

import { and, asc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { recipeIngredients, recipes } from "@/db/schema";
import { getSession } from "@/lib/get-session";

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

const recipeBaseSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
  instructions: z.string().optional().nullable(),
  servings: z.coerce.number().int().min(1).default(1),
  prepTimeMinutes: z.coerce.number().int().optional().nullable(),
  caloriesPerServing: z.coerce.number().int().optional().nullable(),
  proteinGPerServing: z
    .string()
    .optional()
    .nullable()
    .transform((s) => (s && s !== "" ? String(Number(s)) : null)),
});

const ingredientLineSchema = z.object({
  pantryItemName: z.string().min(1).max(255),
  quantity: z
    .string()
    .optional()
    .nullable()
    .transform((s) => (s && s !== "" ? String(Number(s)) : null)),
  unit: z.string().max(50).optional().nullable(),
  optional: z.coerce.boolean().optional().default(false),
});

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
  let ingredients: z.infer<typeof ingredientLineSchema>[] = [];
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
  const db = getDb();
  const v = base.data;
  const [r] = await db
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
    })
    .returning({ id: recipes.id });
  if (ingredients.length) {
    await db.insert(recipeIngredients).values(
      ingredients.map((i) => ({
        recipeId: r.id,
        pantryItemName: i.pantryItemName,
        quantity: i.quantity,
        unit: i.unit || null,
        optional: i.optional ?? false,
      })),
    );
  }
  revalidatePath("/plan");
  revalidatePath("/home");
  return { ok: true as const, id: r.id };
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
  let ingredients: z.infer<typeof ingredientLineSchema>[] = [];
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
  const db = getDb();
  const own = await db
    .select()
    .from(recipes)
    .where(and(eq(recipes.id, recipeId), eq(recipes.userId, userId)))
    .limit(1);
  if (!own[0]) return { ok: false as const, error: "Not found" };
  const v = base.data;
  await db
    .update(recipes)
    .set({
      title: v.title,
      description: v.description || null,
      instructions: v.instructions || null,
      servings: v.servings,
      prepTimeMinutes: v.prepTimeMinutes ?? null,
      caloriesPerServing: v.caloriesPerServing ?? null,
      proteinGPerServing: v.proteinGPerServing,
      updatedAt: new Date(),
    })
    .where(eq(recipes.id, recipeId));
  await db.delete(recipeIngredients).where(eq(recipeIngredients.recipeId, recipeId));
  if (ingredients.length) {
    await db.insert(recipeIngredients).values(
      ingredients.map((i) => ({
        recipeId,
        pantryItemName: i.pantryItemName,
        quantity: i.quantity,
        unit: i.unit || null,
        optional: i.optional ?? false,
      })),
    );
  }
  revalidatePath("/plan");
  revalidatePath("/home");
  return { ok: true as const };
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
