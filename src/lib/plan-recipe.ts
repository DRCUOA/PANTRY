import type { RecipeMealTypeValue } from "@/lib/recipe-meal-types";
import { normalizeMealType } from "@/lib/recipe-meal-types";

/** Serializable recipe payload for plan meal modal (from server). */
export type PlanRecipeDetail = {
  id: number;
  title: string;
  description: string | null;
  instructions: string | null;
  servings: number | null;
  prepTimeMinutes: number | null;
  caloriesPerServing: number | null;
  proteinGPerServing: string | null;
  mealType: RecipeMealTypeValue;
  ingredients: {
    pantryItemName: string;
    quantity: string | null;
    unit: string | null;
    optional: boolean;
  }[];
};

/** Shape returned by `listRecipes()` (ingredient rows from DB). */
export type RecipeListRow = {
  id: number;
  title: string;
  description: string | null;
  instructions: string | null;
  servings: number | null;
  prepTimeMinutes: number | null;
  caloriesPerServing: number | null;
  proteinGPerServing: string | null;
  mealType: string;
  ingredients: {
    pantryItemName: string;
    quantity: string | null;
    unit: string | null;
    optional: boolean;
  }[];
};

export function toPlanRecipeDetail(recipe: RecipeListRow): PlanRecipeDetail {
  return {
    id: recipe.id,
    title: recipe.title,
    description: recipe.description,
    instructions: recipe.instructions,
    servings: recipe.servings,
    prepTimeMinutes: recipe.prepTimeMinutes,
    caloriesPerServing: recipe.caloriesPerServing,
    proteinGPerServing:
      recipe.proteinGPerServing != null ? String(recipe.proteinGPerServing) : null,
    mealType: normalizeMealType(recipe.mealType),
    ingredients: recipe.ingredients.map((i) => ({
      pantryItemName: i.pantryItemName,
      quantity: i.quantity != null ? String(i.quantity) : null,
      unit: i.unit,
      optional: i.optional,
    })),
  };
}
