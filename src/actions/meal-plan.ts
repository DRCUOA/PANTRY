"use server";

import { and, asc, eq, gte, lte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { inventoryLog, mealPlanEntries, pantryItems, recipeIngredients, recipes, shoppingListItems } from "@/db/schema";
import { getSession } from "@/lib/get-session";
import { findBestPantryItemId, scaledIngredientAmount } from "@/lib/pantry-match";
import { recipePantryStatus } from "@/lib/recipe-score";

async function requireUserId(): Promise<number> {
  const session = await getSession();
  if (!session.isLoggedIn || session.userId == null) throw new Error("Unauthorized");
  return session.userId;
}

export async function listMealPlanRange(startDate: string, endDate: string) {
  const userId = await requireUserId();
  const db = getDb();
  const rows = await db
    .select()
    .from(mealPlanEntries)
    .where(
      and(
        eq(mealPlanEntries.userId, userId),
        gte(mealPlanEntries.plannedDate, startDate),
        lte(mealPlanEntries.plannedDate, endDate),
      ),
    )
    .orderBy(asc(mealPlanEntries.plannedDate), asc(mealPlanEntries.mealType));
  return rows;
}

export async function addMealPlanEntry(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const ridRaw = formData.get("recipeId");
  let recipeId: number | null = null;
  if (typeof ridRaw === "string" && ridRaw !== "" && ridRaw !== "none") {
    const n = Number(ridRaw);
    if (Number.isFinite(n)) recipeId = n;
  }
  const schema = z.object({
    plannedDate: z.string().min(8),
    mealType: z.enum(["breakfast", "lunch", "dinner"]),
    servings: z.coerce.number().positive().default(1),
    notes: z.string().optional().nullable(),
  });
  const parsed = schema.safeParse({
    plannedDate: formData.get("plannedDate"),
    mealType: formData.get("mealType"),
    servings: formData.get("servings") || 1,
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return;
  }
  const v = parsed.data;
  const db = getDb();
  if (recipeId != null) {
    const r = await db
      .select()
      .from(recipes)
      .where(and(eq(recipes.id, recipeId), eq(recipes.userId, userId)))
      .limit(1);
    if (!r[0]) return;
  }
  await db.insert(mealPlanEntries).values({
    userId,
    plannedDate: v.plannedDate,
    mealType: v.mealType,
    recipeId,
    servings: String(v.servings),
    status: "planned",
    notes: v.notes || null,
  });
  revalidatePath("/plan");
  revalidatePath("/home");
}

export async function deleteMealPlanEntry(id: number): Promise<void> {
  const userId = await requireUserId();
  const db = getDb();
  await db
    .delete(mealPlanEntries)
    .where(and(eq(mealPlanEntries.id, id), eq(mealPlanEntries.userId, userId)));
  revalidatePath("/plan");
  revalidatePath("/home");
}

export async function updateMealPlanEntryDetails(
  entryId: number,
  servings: number,
  notes: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const userId = await requireUserId();
  if (!(Number.isFinite(servings) && servings > 0)) {
    return { ok: false, error: "Servings must be a positive number" };
  }
  const db = getDb();
  const rows = await db
    .select()
    .from(mealPlanEntries)
    .where(and(eq(mealPlanEntries.id, entryId), eq(mealPlanEntries.userId, userId)))
    .limit(1);
  if (!rows[0]) return { ok: false, error: "Meal not found" };
  await db
    .update(mealPlanEntries)
    .set({
      servings: String(servings),
      notes: notes?.trim() ? notes.trim() : null,
      updatedAt: new Date(),
    })
    .where(eq(mealPlanEntries.id, entryId));
  revalidatePath("/plan");
  revalidatePath("/home");
  return { ok: true };
}

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Change which calendar day this meal is on (same slot fields otherwise). */
export async function moveMealPlanEntryToDate(
  entryId: number,
  newPlannedDate: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const userId = await requireUserId();
  const dateParsed = isoDateSchema.safeParse(newPlannedDate);
  if (!dateParsed.success) {
    return { ok: false, error: "Invalid date" };
  }
  const db = getDb();
  const rows = await db
    .select()
    .from(mealPlanEntries)
    .where(and(eq(mealPlanEntries.id, entryId), eq(mealPlanEntries.userId, userId)))
    .limit(1);
  const row = rows[0];
  if (!row) return { ok: false, error: "Meal not found" };
  if (row.plannedDate === newPlannedDate) {
    return { ok: true };
  }
  await db
    .update(mealPlanEntries)
    .set({ plannedDate: newPlannedDate, updatedAt: new Date() })
    .where(eq(mealPlanEntries.id, entryId));
  revalidatePath("/plan");
  revalidatePath("/home");
  return { ok: true };
}

/**
 * Add another planned meal on `newPlannedDate` with the same recipe, meal type, and servings
 * as manual “Add meal” (always status planned).
 */
export async function duplicateMealPlanEntryToDate(
  entryId: number,
  newPlannedDate: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const userId = await requireUserId();
  const dateParsed = isoDateSchema.safeParse(newPlannedDate);
  if (!dateParsed.success) {
    return { ok: false, error: "Invalid date" };
  }
  const db = getDb();
  const rows = await db
    .select()
    .from(mealPlanEntries)
    .where(and(eq(mealPlanEntries.id, entryId), eq(mealPlanEntries.userId, userId)))
    .limit(1);
  const row = rows[0];
  if (!row) return { ok: false, error: "Meal not found" };
  if (row.recipeId != null) {
    const r = await db
      .select()
      .from(recipes)
      .where(and(eq(recipes.id, row.recipeId), eq(recipes.userId, userId)))
      .limit(1);
    if (!r[0]) return { ok: false, error: "Recipe not found" };
  }
  await db.insert(mealPlanEntries).values({
    userId,
    recipeId: row.recipeId,
    plannedDate: newPlannedDate,
    mealType: row.mealType,
    servings: row.servings,
    status: "planned",
    notes: row.notes ?? null,
  });
  revalidatePath("/plan");
  revalidatePath("/home");
  return { ok: true };
}

export async function addMissingToShoppingList(mealPlanId: number): Promise<void> {
  const userId = await requireUserId();
  const db = getDb();
  const entry = await db
    .select()
    .from(mealPlanEntries)
    .where(and(eq(mealPlanEntries.id, mealPlanId), eq(mealPlanEntries.userId, userId)))
    .limit(1);
  const e = entry[0];
  if (!e?.recipeId) return;
  const recipeRow = await db
    .select()
    .from(recipes)
    .where(and(eq(recipes.id, e.recipeId), eq(recipes.userId, userId)))
    .limit(1);
  if (!recipeRow[0]) return;
  const ings = await db
    .select()
    .from(recipeIngredients)
    .where(eq(recipeIngredients.recipeId, e.recipeId));
  const pantry = await db
    .select({ name: pantryItems.name })
    .from(pantryItems)
    .where(eq(pantryItems.userId, userId));
  const { missing } = recipePantryStatus(
    {
      id: e.recipeId,
      title: recipeRow[0].title,
      ingredients: ings.map((i) => ({
        pantryItemName: i.pantryItemName,
        optional: i.optional,
      })),
    },
    pantry.map((p) => ({ name: p.name, expirationDate: null })),
  );
  for (const m of missing) {
    if (m.optional) continue;
    const ing = ings.find((i) => i.pantryItemName === m.name);
    await db.insert(shoppingListItems).values({
      userId,
      name: m.name,
      quantity: ing?.quantity ?? null,
      unit: ing?.unit ?? null,
      status: "needed",
      sourceRecipeId: e.recipeId,
    });
  }
  revalidatePath("/plan");
}

export async function markMealCooked(mealPlanId: number): Promise<void> {
  const userId = await requireUserId();
  const db = getDb();
  const entry = await db
    .select()
    .from(mealPlanEntries)
    .where(and(eq(mealPlanEntries.id, mealPlanId), eq(mealPlanEntries.userId, userId)))
    .limit(1);
  const e = entry[0];
  if (!e?.recipeId) return;
  const recipeRow = await db
    .select()
    .from(recipes)
    .where(and(eq(recipes.id, e.recipeId), eq(recipes.userId, userId)))
    .limit(1);
  if (!recipeRow[0]) return;
  const ings = await db
    .select()
    .from(recipeIngredients)
    .where(eq(recipeIngredients.recipeId, e.recipeId));
  const pantryRows = await db
    .select({ id: pantryItems.id, name: pantryItems.name, quantity: pantryItems.quantity })
    .from(pantryItems)
    .where(eq(pantryItems.userId, userId));
  const recipeServings = recipeRow[0].servings ?? 1;
  const mealServings = e.servings;

  for (const ing of ings) {
    if (ing.optional) continue;
    const pid = findBestPantryItemId(
      pantryRows.map((p) => ({ id: p.id, name: p.name })),
      ing.pantryItemName,
    );
    if (pid == null) continue;
    const deduct = scaledIngredientAmount(ing.quantity ?? null, recipeServings, mealServings);
    if (deduct <= 0) continue;
    const row = pantryRows.find((p) => p.id === pid);
    if (!row) continue;
    const current = Number(row.quantity);
    const next = Math.max(0, current - deduct);
    await db
      .update(pantryItems)
      .set({ quantity: String(next), updatedAt: new Date() })
      .where(eq(pantryItems.id, pid));
    await db.insert(inventoryLog).values({
      pantryItemId: pid,
      action: "meal_deduction",
      quantityChange: String(-(current - next)),
      note: `meal ${mealPlanId} recipe ${e.recipeId}`,
    });
    row.quantity = String(next);
  }

  await db
    .update(mealPlanEntries)
    .set({ status: "cooked", updatedAt: new Date() })
    .where(eq(mealPlanEntries.id, mealPlanId));
  revalidatePath("/plan");
  revalidatePath("/home");
  revalidatePath("/pantry");
}
