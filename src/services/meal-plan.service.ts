import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { mealPlanEntries, recipes } from "@/db/schema";
import type { ServiceResult } from "@/services/_shared/result";

const MS_PER_DAY = 86_400_000;
export const VARIETY_LOOKBACK_DAYS = 28;

export interface AddMealPlanEntryInput {
  userId: number;
  input: {
    plannedDate: string;
    mealType: "breakfast" | "lunch" | "dinner";
    recipeId: number | null;
    servings: number;
    notes: string | null;
  };
}

export interface RecipeRecency {
  recipeId: number;
  title: string;
  lastHadDate: string | null;
  daysSinceLastHad: number | null;
}

export interface VarietyRuleResult {
  isVarietySafe: boolean;
  label: string;
}

function isoDayDiff(fromIso: string, toDate: Date) {
  const from = new Date(`${fromIso}T12:00:00.000Z`);
  const to = new Date(`${toDate.toISOString().slice(0, 10)}T12:00:00.000Z`);
  return Math.floor((to.getTime() - from.getTime()) / MS_PER_DAY);
}

export function computeVarietyRule(daysSinceLastHad: number | null): VarietyRuleResult {
  if (daysSinceLastHad == null || daysSinceLastHad >= VARIETY_LOOKBACK_DAYS) {
    return {
      isVarietySafe: true,
      label: `Not seen in last ${VARIETY_LOOKBACK_DAYS} days`,
    };
  }

  return {
    isVarietySafe: false,
    label: `Last had this ${daysSinceLastHad} days ago`,
  };
}

export function buildRecipeRecency(
  input: { id: number; title: string; lastHadDate?: string | null }[],
  now = new Date(),
): Array<RecipeRecency & { variety: VarietyRuleResult }> {
  return input.map((row) => {
    const daysSinceLastHad = row.lastHadDate ? Math.max(0, isoDayDiff(row.lastHadDate, now)) : null;
    return {
      recipeId: row.id,
      title: row.title,
      lastHadDate: row.lastHadDate ?? null,
      daysSinceLastHad,
      variety: computeVarietyRule(daysSinceLastHad),
    };
  });
}

export async function listRecipeRecencyByUser(
  userId: number,
  now = new Date(),
): Promise<Array<RecipeRecency & { variety: VarietyRuleResult }>> {
  const db = getDb();

  const recipeRows = await db
    .select({ id: recipes.id, title: recipes.title })
    .from(recipes)
    .where(eq(recipes.userId, userId));

  if (recipeRows.length === 0) return [];

  const recipeIds = recipeRows.map((recipe) => recipe.id);
  const historyRows = await db
    .select({ recipeId: mealPlanEntries.recipeId, plannedDate: mealPlanEntries.plannedDate })
    .from(mealPlanEntries)
    .where(
      and(
        eq(mealPlanEntries.userId, userId),
        inArray(mealPlanEntries.status, ["planned", "cooked"]),
        inArray(mealPlanEntries.recipeId, recipeIds),
      ),
    )
    .orderBy(desc(mealPlanEntries.plannedDate));

  const latestByRecipeId = new Map<number, string>();
  for (const row of historyRows) {
    if (row.recipeId == null || latestByRecipeId.has(row.recipeId)) continue;
    latestByRecipeId.set(row.recipeId, row.plannedDate);
  }

  return buildRecipeRecency(
    recipeRows.map((recipe) => ({
      id: recipe.id,
      title: recipe.title,
      lastHadDate: latestByRecipeId.get(recipe.id) ?? null,
    })),
    now,
  );
}

export async function addMealPlanEntryService(
  _params: AddMealPlanEntryInput,
): Promise<ServiceResult<{ mealPlanEntryId: number }>> {
  return { ok: false, error: "Not implemented" };
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { getDb } from "@/db";
import {
  inventoryLog,
  mealPlanEntries,
  pantryItems,
  recipeIngredients,
  recipes,
  shoppingListItems,
} from "@/db/schema";
import { findBestPantryItemId, scaledIngredientAmount } from "@/lib/pantry-match";
import { recipePantryStatus } from "@/lib/recipe-score";
import type { AddMealPlanEntryDto } from "@/actions/payload-schemas";

export type MealPlanActionResult = { ok: true } | { ok: false; error: string };

export type AddMealPlanEntryResult =
  | { ok: true }
  | { ok: false; error: { code: "NOT_FOUND"; message: "Recipe not found" } };

export async function listMealPlanRangeService(userId: number, startDate: string, endDate: string) {
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

export async function createMealPlanEntryService(
  userId: number,
  payload: AddMealPlanEntryDto,
): Promise<AddMealPlanEntryResult> {
  const db = getDb();
  if (payload.recipeId != null) {
    const r = await db
      .select()
      .from(recipes)
      .where(and(eq(recipes.id, payload.recipeId), eq(recipes.userId, userId)))
      .limit(1);
    if (!r[0]) {
      return {
        ok: false,
        error: { code: "NOT_FOUND", message: "Recipe not found" },
      };
    }
  }
  await db.insert(mealPlanEntries).values({
    userId,
    plannedDate: payload.plannedDate,
    mealType: payload.mealType,
    recipeId: payload.recipeId,
    servings: String(payload.servings),
    status: "planned",
    notes: payload.notes,
  });
  return { ok: true };
}

export async function deleteMealPlanEntryService(userId: number, id: number): Promise<void> {
  const db = getDb();
  await db
    .delete(mealPlanEntries)
    .where(and(eq(mealPlanEntries.id, id), eq(mealPlanEntries.userId, userId)));
}

export async function updateMealPlanEntryDetailsService(
  userId: number,
  entryId: number,
  servings: number,
  notes: string | null,
): Promise<MealPlanActionResult> {
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
  return { ok: true };
}

export async function moveMealPlanEntryToDateService(
  userId: number,
  entryId: number,
  newPlannedDate: string,
): Promise<MealPlanActionResult> {
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
  return { ok: true };
}

export async function duplicateMealPlanEntryToDateService(
  userId: number,
  entryId: number,
  newPlannedDate: string,
): Promise<MealPlanActionResult> {
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
  return { ok: true };
}

export async function addMissingToShoppingListService(userId: number, mealPlanId: number): Promise<void> {
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
  const ings = await db.select().from(recipeIngredients).where(eq(recipeIngredients.recipeId, e.recipeId));
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
}

export async function markMealCookedService(userId: number, mealPlanId: number): Promise<void> {
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
  const ings = await db.select().from(recipeIngredients).where(eq(recipeIngredients.recipeId, e.recipeId));
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
}
