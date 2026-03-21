import { normalizePantryName } from "./pantry-match";

export type RecipeForScore = {
  id: number;
  title: string;
  ingredients: { pantryItemName: string; optional: boolean }[];
};

export type PantryForScore = { name: string; expirationDate: string | null };

const MS_PER_DAY = 86400000;

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T12:00:00");
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / MS_PER_DAY);
}

/** Rank recipes: more matched non-optional ingredients wins; boost if match expires within `expiringWithinDays`. */
export function scoreRecipes(
  recipes: RecipeForScore[],
  pantry: PantryForScore[],
  expiringWithinDays = 7,
): { recipe: RecipeForScore; score: number; matched: number; total: number }[] {
  const pantryNorm = new Map<string, PantryForScore>();
  for (const p of pantry) {
    pantryNorm.set(normalizePantryName(p.name), p);
  }
  const scored = recipes.map((recipe) => {
    const required = recipe.ingredients.filter((i) => !i.optional);
    const total = required.length || recipe.ingredients.length || 1;
    let matched = 0;
    let score = 0;
    const pool = required.length ? required : recipe.ingredients;
    for (const ing of pool) {
      const key = normalizePantryName(ing.pantryItemName);
      const row = pantryNorm.get(key);
      if (row) {
        matched += 1;
        score += 2;
        const days = daysUntil(row.expirationDate);
        if (days != null && days >= 0 && days <= expiringWithinDays) {
          score += 1;
        }
      } else {
        const fuzzy = [...pantryNorm.entries()].find(
          ([k]) => k.includes(key) || key.includes(k),
        );
        if (fuzzy) {
          matched += 1;
          score += 1;
          const days = daysUntil(fuzzy[1].expirationDate);
          if (days != null && days >= 0 && days <= expiringWithinDays) {
            score += 1;
          }
        }
      }
    }
    return { recipe, score, matched, total };
  });
  return scored.sort((a, b) => b.score - a.score || b.matched - a.matched);
}

export function recipePantryStatus(
  recipe: RecipeForScore,
  pantry: PantryForScore[],
): { missing: { name: string; optional: boolean }[]; matchedCount: number } {
  const pantryNorm = new Set(pantry.map((p) => normalizePantryName(p.name)));
  const missing: { name: string; optional: boolean }[] = [];
  let matchedCount = 0;
  for (const ing of recipe.ingredients) {
    const key = normalizePantryName(ing.pantryItemName);
    const has =
      pantryNorm.has(key) ||
      [...pantryNorm].some((k) => k.includes(key) || key.includes(k));
    if (has) matchedCount += 1;
    else missing.push({ name: ing.pantryItemName, optional: ing.optional });
  }
  return { missing, matchedCount };
}
