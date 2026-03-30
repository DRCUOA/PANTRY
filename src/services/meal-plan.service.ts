import type { ServiceResult } from "@/services/_shared/result";

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

export async function addMealPlanEntryService(
  _params: AddMealPlanEntryInput,
): Promise<ServiceResult<{ mealPlanEntryId: number }>> {
  return { ok: false, error: "Not implemented" };
}
