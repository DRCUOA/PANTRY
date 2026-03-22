import { z } from "zod";

export const recipeBaseSchema = z.object({
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

export const ingredientLineSchema = z.object({
  pantryItemId: z.preprocess((val) => {
    if (val === null || val === undefined || val === "") return null;
    const n = Number(val);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, z.number().int().positive().nullable()),
  pantryItemName: z.string().max(255).optional().nullable(),
  quantity: z
    .string()
    .optional()
    .nullable()
    .transform((s) => (s && s !== "" ? String(Number(s)) : null)),
  unit: z.string().max(50).optional().nullable(),
  optional: z.coerce.boolean().optional().default(false),
});

export type RecipeBaseInput = z.infer<typeof recipeBaseSchema>;
export type IngredientLineInput = z.infer<typeof ingredientLineSchema>;
