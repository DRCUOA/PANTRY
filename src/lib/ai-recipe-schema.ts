import { z } from "zod";
import { RECIPE_MEAL_TYPE_VALUES } from "@/lib/recipe-meal-types";

const nullableTrimmedString = z
  .string()
  .trim()
  .max(4000)
  .optional()
  .nullable()
  .transform((value) => {
    if (value == null) return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  });

const nullableShortString = z
  .string()
  .trim()
  .max(50)
  .optional()
  .nullable()
  .transform((value) => {
    if (value == null) return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  });

export const aiRecipeIngredientSchema = z.object({
  pantryItemName: z.string().trim().min(1).max(255),
  quantity: nullableShortString,
  unit: nullableShortString,
  optional: z.boolean().default(false),
  source: z.enum(["pantry", "missing"]),
});

export const aiRecipeDraftSchema = z.object({
  title: z.string().trim().min(1).max(255),
  description: nullableTrimmedString,
  instructions: z.string().trim().min(1).max(8000),
  mealType: z.enum(RECIPE_MEAL_TYPE_VALUES),
  servings: z.coerce.number().int().min(1).max(24),
  prepTimeMinutes: z.coerce.number().int().min(0).max(1440).optional().nullable(),
  whyThisFits: z.string().trim().min(1).max(1200),
  usesExpiringItems: z.array(z.string().trim().min(1).max(255)).max(12).default([]),
  ingredients: z.array(aiRecipeIngredientSchema).min(1).max(24),
});

export const aiRecipeDraftBatchSchema = z.object({
  drafts: z.array(aiRecipeDraftSchema).min(1).max(5),
});

export type AiRecipeIngredient = z.infer<typeof aiRecipeIngredientSchema>;
export type AiRecipeDraft = z.infer<typeof aiRecipeDraftSchema>;
export type AiRecipeDraftBatch = z.infer<typeof aiRecipeDraftBatchSchema>;

export type PantryAiContext = {
  dietaryPreferences: string | null;
  existingRecipeTitles: string[];
  pantryItems: {
    name: string;
    quantity: string;
    unit: string;
    location: string | null;
    expirationDate: string | null;
    isExpiringSoon: boolean;
  }[];
  expiringSoon: {
    name: string;
    quantity: string;
    unit: string;
    expirationDate: string;
  }[];
};

export function buildAiRecipeJsonSchema() {
  return {
    type: "object",
    properties: {
      drafts: {
        type: "array",
        minItems: 1,
        maxItems: 5,
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: ["string", "null"] },
            instructions: { type: "string" },
            mealType: { type: "string", enum: [...RECIPE_MEAL_TYPE_VALUES] },
            servings: { type: "integer", minimum: 1, maximum: 24 },
            prepTimeMinutes: { type: ["integer", "null"], minimum: 0, maximum: 1440 },
            whyThisFits: { type: "string" },
            usesExpiringItems: {
              type: "array",
              items: { type: "string" },
              maxItems: 12,
            },
            ingredients: {
              type: "array",
              minItems: 1,
              maxItems: 24,
              items: {
                type: "object",
                properties: {
                  pantryItemName: { type: "string" },
                  quantity: { type: ["string", "null"] },
                  unit: { type: ["string", "null"] },
                  optional: { type: "boolean" },
                  source: { type: "string", enum: ["pantry", "missing"] },
                },
                required: ["pantryItemName", "quantity", "unit", "optional", "source"],
                additionalProperties: false,
              },
            },
          },
          required: [
            "title",
            "description",
            "instructions",
            "mealType",
            "servings",
            "prepTimeMinutes",
            "whyThisFits",
            "usesExpiringItems",
            "ingredients",
          ],
          additionalProperties: false,
        },
      },
    },
    required: ["drafts"],
    additionalProperties: false,
  } as const;
}

export function buildAiRecipeInstructions() {
  return [
    "You are a practical household meal planner.",
    "Generate pantry-aware recipe drafts from the provided pantry JSON.",
    "Treat only the listed pantry items as in stock.",
    "If an ingredient is not clearly in stock, include it with source=\"missing\" rather than pretending it is available.",
    "Prefer recipes that use expiring-soon ingredients when possible.",
    "Use plain numeric quantities whenever possible, for example 0.5 instead of 1/2.",
    "If an ingredient amount is qualitative such as to taste, leave quantity descriptive but keep the wording short.",
    "Keep recipes realistic for a normal home kitchen and avoid brand names or unnecessary complexity.",
    "Return between 3 and 5 distinct recipe drafts.",
    "Keep titles concise and instructions usable without extra explanation outside the schema.",
    "Do not include markdown, commentary, or keys outside the schema.",
  ].join(" ");
}

export function buildAiRecipeUserPrompt(context: PantryAiContext) {
  return JSON.stringify(
    {
      pantry: context.pantryItems,
      expiringSoon: context.expiringSoon,
      dietaryPreferences: context.dietaryPreferences,
      existingRecipeTitles: context.existingRecipeTitles,
      request: "Suggest recipe drafts that make strong use of current stock and clearly separate missing ingredients.",
    },
    null,
    2,
  );
}

export function splitAiRecipeIngredients(draft: AiRecipeDraft) {
  const pantry = draft.ingredients.filter((ingredient) => ingredient.source === "pantry");
  const missing = draft.ingredients.filter((ingredient) => ingredient.source === "missing");
  return { pantry, missing };
}
