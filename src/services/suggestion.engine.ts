const EXPIRY_WEIGHT = 5;
const OVERSTOCK_WEIGHT = 3;
const MATCH_RATIO_WEIGHT = 2;
const VARIETY_WEIGHT = 1;

export type SlotContext = {
  slotDate: string;
  mealType: string;
};

export type SuggestionPantryItem = {
  name: string;
  expirationDate?: string | null;
  quantity?: number;
  lowStockThreshold?: number | null;
  overstockScore?: number;
};

export type SuggestionRecipe = {
  id: number;
  title: string;
  mealType?: string;
  ingredients: { pantryItemName: string; optional?: boolean }[];
};

export type VarietyMetadata = {
  recipeId: number;
  daysSinceLastHad: number;
};

export interface RankedSuggestion {
  id: number;
  title: string;
  score: number;
  explainabilityTags: string[];
}

export type SundayRankingInput = {
  userId: number;
  slotContext: SlotContext;
  pantry: SuggestionPantryItem[];
  recipes: SuggestionRecipe[];
  varietyMetadata?: VarietyMetadata[];
};

const MS_PER_DAY = 86400000;

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function daysUntil(fromIso: string, targetIso?: string | null): number | null {
  if (!targetIso) return null;
  const from = new Date(`${fromIso}T12:00:00Z`);
  const target = new Date(`${targetIso}T12:00:00Z`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(target.getTime())) return null;
  return Math.floor((target.getTime() - from.getTime()) / MS_PER_DAY);
}

function isExpiringSoon(slotDate: string, expirationDate?: string | null): boolean {
  const delta = daysUntil(slotDate, expirationDate);
  return delta != null && delta >= 0 && delta <= 7;
}

function resolveOverstockScore(item: SuggestionPantryItem): number {
  if (item.overstockScore != null) return Math.max(0, item.overstockScore);
  if (item.lowStockThreshold == null || item.lowStockThreshold <= 0 || item.quantity == null) return 0;
  return Math.max(0, item.quantity / item.lowStockThreshold - 1);
}

export function rankSundayBestMatches({
  slotContext,
  pantry,
  recipes,
  varietyMetadata = [],
}: SundayRankingInput): RankedSuggestion[] {
  const pantryByName = new Map(pantry.map((item) => [normalize(item.name), item]));
  const varietyByRecipe = new Map(varietyMetadata.map((item) => [item.recipeId, item.daysSinceLastHad]));

  const ranked = recipes
    .map((recipe) => {
      const requiredIngredients = recipe.ingredients.filter((ingredient) => !ingredient.optional);
      const ingredients = requiredIngredients.length > 0 ? requiredIngredients : recipe.ingredients;
      const totalIngredients = Math.max(ingredients.length, 1);

      let matchedIngredients = 0;
      let expiringUsed = 0;
      let overstockReduction = 0;

      for (const ingredient of ingredients) {
        const pantryItem = pantryByName.get(normalize(ingredient.pantryItemName));
        if (!pantryItem) continue;
        matchedIngredients += 1;
        if (isExpiringSoon(slotContext.slotDate, pantryItem.expirationDate)) {
          expiringUsed += 1;
        }
        overstockReduction += resolveOverstockScore(pantryItem);
      }

      const pantryMatchRatio = matchedIngredients / totalIngredients;
      const daysSinceLastHad = varietyByRecipe.get(recipe.id);
      const varietyBonus = daysSinceLastHad != null && daysSinceLastHad > 28 ? 1 : 0;

      const score =
        expiringUsed * EXPIRY_WEIGHT +
        overstockReduction * OVERSTOCK_WEIGHT +
        pantryMatchRatio * MATCH_RATIO_WEIGHT +
        varietyBonus * VARIETY_WEIGHT;

      const explainabilityTags: string[] = [];
      if (expiringUsed > 0) {
        explainabilityTags.push(`Uses ${expiringUsed} expiring item${expiringUsed === 1 ? "" : "s"}`);
      }
      if (overstockReduction >= 1) {
        explainabilityTags.push("High overstock reduction");
      }
      if (pantryMatchRatio >= 0.75) {
        explainabilityTags.push(`Pantry match ${(pantryMatchRatio * 100).toFixed(0)}%`);
      }
      if (varietyBonus > 0) {
        explainabilityTags.push("Variety boost (>28 days)");
      }

      return {
        id: recipe.id,
        title: recipe.title,
        score: Number(score.toFixed(3)),
        explainabilityTags,
      };
    })
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));

  return ranked.slice(0, 3);
}
