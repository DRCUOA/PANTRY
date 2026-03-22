/** Recipe library tabs and stored `recipes.meal_type` — mutually exclusive slots. */
export const RECIPE_MEAL_KEYS = ["breakfast", "lunch", "dinner", "snack"] as const;
export type RecipeMealKey = (typeof RECIPE_MEAL_KEYS)[number];

export const RECIPE_MEAL_TYPE_VALUES = RECIPE_MEAL_KEYS;
export type RecipeMealTypeValue = RecipeMealKey;

const SLOT_SET = new Set<string>(RECIPE_MEAL_KEYS);
const VALUE_SET = new Set<string>(RECIPE_MEAL_TYPE_VALUES);

const DEFAULT_MEAL_TYPE: RecipeMealTypeValue = "breakfast";

export function normalizeMealType(raw: unknown): RecipeMealTypeValue {
  if (typeof raw !== "string" || !raw.trim()) return DEFAULT_MEAL_TYPE;
  const s = raw.trim().toLowerCase();
  if (s === "all") return DEFAULT_MEAL_TYPE;
  if (VALUE_SET.has(s)) return s as RecipeMealTypeValue;
  return DEFAULT_MEAL_TYPE;
}

/** Legacy import: array of slots → single column (any multi-slot or unknown → default). */
export function mealTypeFromLegacyArray(arr: unknown): RecipeMealTypeValue {
  if (arr == null) return DEFAULT_MEAL_TYPE;
  if (!Array.isArray(arr)) return DEFAULT_MEAL_TYPE;
  const slots = arr.filter((x): x is string => typeof x === "string" && SLOT_SET.has(x));
  const uniq = [...new Set(slots)];
  if (uniq.length === 1) return uniq[0] as RecipeMealKey;
  return DEFAULT_MEAL_TYPE;
}

export function parseMealTypeFromForm(formData: FormData): RecipeMealTypeValue {
  const raw = formData.get("meal_type");
  if (typeof raw !== "string" || !raw.trim()) return DEFAULT_MEAL_TYPE;
  return normalizeMealType(raw);
}

export function recipeMatchesMealTab(
  mealType: RecipeMealTypeValue,
  tab: RecipeMealKey,
): boolean {
  return mealType === tab;
}

export function formatMealTypeLabel(mealType: RecipeMealTypeValue): string {
  const labels: Record<RecipeMealTypeValue, string> = {
    breakfast: "Breakfast",
    lunch: "Lunch",
    dinner: "Dinner",
    snack: "Snack",
  };
  return labels[mealType];
}
