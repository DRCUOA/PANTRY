/** Normalize pantry / recipe ingredient names for matching (§13). */
export function normalizePantryName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function findBestPantryItemId(
  pantryRows: { id: number; name: string }[],
  ingredientName: string,
): number | null {
  const n = normalizePantryName(ingredientName);
  if (!n) return null;
  const exact = pantryRows.find((p) => normalizePantryName(p.name) === n);
  if (exact) return exact.id;
  const partial = pantryRows.find((p) => {
    const pn = normalizePantryName(p.name);
    return pn.includes(n) || n.includes(pn);
  });
  return partial?.id ?? null;
}

/**
 * Scale recipe ingredient quantity by planned meal servings vs recipe base servings.
 */
export function scaledIngredientAmount(
  ingredientQty: string | null | undefined,
  recipeServings: number | null | undefined,
  mealServings: number | string | null | undefined,
): number {
  const base = ingredientQty != null && ingredientQty !== "" ? Number(ingredientQty) : 0;
  if (!Number.isFinite(base) || base <= 0) return 0;
  const rs = recipeServings && recipeServings > 0 ? recipeServings : 1;
  const ms = Number(mealServings);
  const m = Number.isFinite(ms) && ms > 0 ? ms : 1;
  return (base / rs) * m;
}
