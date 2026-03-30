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
}
