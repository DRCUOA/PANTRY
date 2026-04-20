"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/get-session";
import { isoDateSchema, parseMealPlanFormData, type AddMealPlanEntryDto } from "@/actions/payload-schemas";
import {
  addMissingToShoppingListService,
  clearMealPlanRangeService,
  createMealPlanEntryService,
  deleteMealPlanEntryService,
  duplicateMealPlanEntryToDateService,
  listMealPlanRangeService,
  markMealCookedService,
  moveMealPlanEntryToDateService,
  updateMealPlanEntryDetailsService,
} from "@/services/meal-plan.service";
import { runSundayResetService } from "@/services/reset.service";
import { generateFromMealPlanRange } from "@/services/shopping.service";

async function requireUserId(): Promise<number> {
  const session = await getSession();
  if (!session.isLoggedIn || session.userId == null) throw new Error("Unauthorized");
  return session.userId;
}

export async function listMealPlanRange(startDate: string, endDate: string) {
  const userId = await requireUserId();
  return listMealPlanRangeService(userId, startDate, endDate);
}

type ActionError = {
  code: "VALIDATION_ERROR" | "NOT_FOUND";
  message: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

type ActionResult = { ok: true } | { ok: false; error: ActionError };

async function createMealPlanEntry(userId: number, payload: AddMealPlanEntryDto): Promise<ActionResult> {
  const result = await createMealPlanEntryService(userId, payload);
  if (!result.ok) {
    return result;
  }
  revalidatePath("/plan");
  revalidatePath("/home");
  return { ok: true };
}

export async function addMealPlanEntry(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const parsed = parseMealPlanFormData(formData);
  if (!parsed.success) {
    return;
  }

  await createMealPlanEntry(userId, parsed.data);
}

export async function deleteMealPlanEntry(id: number): Promise<void> {
  const userId = await requireUserId();
  await deleteMealPlanEntryService(userId, id);
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
  const result = await updateMealPlanEntryDetailsService(userId, entryId, servings, notes);
  if (result.ok) {
    revalidatePath("/plan");
    revalidatePath("/home");
  }
  return result;
}

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
  const result = await moveMealPlanEntryToDateService(userId, entryId, newPlannedDate);
  if (result.ok) {
    revalidatePath("/plan");
    revalidatePath("/home");
  }
  return result;
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
  const result = await duplicateMealPlanEntryToDateService(userId, entryId, newPlannedDate);
  if (result.ok) {
    revalidatePath("/plan");
    revalidatePath("/home");
  }
  return result;
}

export async function addMissingToShoppingList(mealPlanId: number): Promise<void> {
  const userId = await requireUserId();
  await addMissingToShoppingListService(userId, mealPlanId);
  revalidatePath("/plan");
}

export type BulkMissingResult =
  | {
      ok: true;
      inserted: number;
      updated: number;
      skipped: number;
      generated: number;
    }
  | { ok: false; error: string };

/**
 * Walk every planned meal in the inclusive date window and push any missing
 * non-optional ingredients onto the shopping list, merging by recipe + name +
 * unit. Wraps `generateFromMealPlanRange` so the Plan page can offer one-tap
 * top-up for the whole week.
 */
export async function addAllMissingForRange(
  startDate: string,
  endDate: string,
): Promise<BulkMissingResult> {
  const userId = await requireUserId();
  const startParsed = isoDateSchema.safeParse(startDate);
  const endParsed = isoDateSchema.safeParse(endDate);
  if (!startParsed.success || !endParsed.success) {
    return { ok: false, error: "Invalid date range" };
  }
  try {
    const summary = await generateFromMealPlanRange(userId, startDate, endDate);
    revalidatePath("/plan");
    revalidatePath("/shop");
    revalidatePath("/home");
    return { ok: true, ...summary };
  } catch {
    return { ok: false, error: "Could not update the shopping list. Try again." };
  }
}

export type ClearPlanWeekResult =
  | { ok: true; deleted: number }
  | { ok: false; error: string };

/**
 * Wipe every meal-plan entry inside the inclusive [startDate, endDate] window.
 * Destructive — the UI wraps this in a confirm prompt and a toast warning.
 */
export async function clearPlanWeek(
  startDate: string,
  endDate: string,
): Promise<ClearPlanWeekResult> {
  const userId = await requireUserId();
  const startParsed = isoDateSchema.safeParse(startDate);
  const endParsed = isoDateSchema.safeParse(endDate);
  if (!startParsed.success || !endParsed.success) {
    return { ok: false, error: "Invalid date range" };
  }
  try {
    const result = await clearMealPlanRangeService(userId, startDate, endDate);
    revalidatePath("/plan");
    revalidatePath("/home");
    return { ok: true, deleted: result.deleted };
  } catch {
    return { ok: false, error: "Could not clear the plan. Try again." };
  }
}

export async function markMealCooked(mealPlanId: number): Promise<void> {
  const userId = await requireUserId();
  await markMealCookedService(userId, mealPlanId);
  revalidatePath("/plan");
  revalidatePath("/home");
  revalidatePath("/pantry");
}

export type SundayResetActionResult = { ok: true; message: string } | { ok: false; error: string };

export async function runSundayReset(
  _prev: SundayResetActionResult | undefined,
): Promise<SundayResetActionResult> {
  try {
    const userId = await requireUserId();
    const summary = await runSundayResetService(userId);
    revalidatePath("/plan");
    revalidatePath("/home");
    const count = summary.mealsPrioritized.length;
    if (count === 0) {
      return { ok: true, message: "All meal slots are already filled — nothing to add." };
    }
    return { ok: true, message: `Planned ${count} meal${count === 1 ? "" : "s"} for the week.` };
  } catch {
    return { ok: false, error: "Something went wrong running the reset. Please try again." };
  }
}
