import { z } from "zod";

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

function isValidIsoDate(value: string): boolean {
  if (!isoDateRegex.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  return (
    utc.getUTCFullYear() === year &&
    utc.getUTCMonth() === month - 1 &&
    utc.getUTCDate() === day
  );
}

export const isoDateSchema = z
  .string()
  .regex(isoDateRegex, "Date must be YYYY-MM-DD")
  .refine(isValidIsoDate, "Date must be a real calendar date");

const optionalFormIdSchema = z.preprocess(
  (value) => {
    if (value == null) return null;
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed === "" || trimmed.toLowerCase() === "none") return null;
      return trimmed;
    }
    return value;
  },
  z.coerce.number().int().positive().nullable(),
);

export const mealPlanFormSchema = z.object({
  plannedDate: isoDateSchema,
  mealType: z.enum(["breakfast", "lunch", "dinner"]),
  servings: z.coerce.number().positive(),
  notes: z.preprocess(
    (value) => {
      if (typeof value !== "string") return null;
      const trimmed = value.trim();
      return trimmed === "" ? null : trimmed;
    },
    z.string().max(4000).nullable(),
  ),
  recipeId: optionalFormIdSchema,
});

export type AddMealPlanEntryDto = z.output<typeof mealPlanFormSchema>;

export function parseMealPlanFormData(formData: FormData) {
  return mealPlanFormSchema.safeParse({
    plannedDate: formData.get("plannedDate"),
    mealType: formData.get("mealType"),
    servings: formData.get("servings"),
    notes: formData.get("notes"),
    recipeId: formData.get("recipeId"),
  });
}

export const shoppingFormSchema = z.object({
  name: z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().min(1).max(255)),
  quantity: z.preprocess(
    (value) => {
      if (value == null) return null;
      if (typeof value === "string") {
        const trimmed = value.trim();
        return trimmed === "" ? null : trimmed;
      }
      return value;
    },
    z.coerce.number().positive().nullable(),
  ),
  unit: z.preprocess(
    (value) => {
      if (typeof value !== "string") return null;
      const trimmed = value.trim();
      return trimmed === "" ? null : trimmed;
    },
    z.string().max(50).nullable(),
  ),
  pantryItemId: optionalFormIdSchema,
});

export type AddShoppingItemDto = z.output<typeof shoppingFormSchema>;

export function parseShoppingFormData(formData: FormData) {
  return shoppingFormSchema.safeParse({
    name: formData.get("name"),
    quantity: formData.get("quantity"),
    unit: formData.get("unit"),
    pantryItemId: formData.get("pantryItemId"),
  });
}
