"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/get-session";
import { isoDateSchema, parseMealPlanFormData, type AddMealPlanEntryDto } from "@/actions/payload-schemas";
import {
  addMissingToShoppingListService,
  createMealPlanEntryService,
  deleteMealPlanEntryService,
  duplicateMealPlanEntryToDateService,
  listMealPlanRangeService,
  markMealCookedService,
  moveMealPlanEntryToDateService,
  updateMealPlanEntryDetailsService,
} from "@/services/meal-plan.service";

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

export async function addMealPlanEntry(formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = parseMealPlanFormData(formData);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid meal plan payload",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
    };
  }

  return createMealPlanEntry(userId, parsed.data);
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

export async function markMealCooked(mealPlanId: number): Promise<void> {
  const userId = await requireUserId();
  await markMealCookedService(userId, mealPlanId);
  revalidatePath("/plan");
  revalidatePath("/home");
  revalidatePath("/pantry");
}
