"use client";

import { useMemo, useState } from "react";
import type { PantryPickerRow } from "@/actions/pantry";
import { RecipeLibraryRow } from "@/components/RecipeLibraryRow";
import type { RecipeListRow } from "@/lib/plan-recipe";
import { toPlanRecipeDetail } from "@/lib/plan-recipe";
import {
  normalizeMealType,
  recipeMatchesMealTab,
  RECIPE_MEAL_KEYS,
  formatMealTypeLabel,
  type RecipeMealKey,
} from "@/lib/recipe-meal-types";

const TABS: { id: RecipeMealKey; label: string }[] = RECIPE_MEAL_KEYS.map((id) => ({
  id,
  label: formatMealTypeLabel(id),
}));

export function RecipeLibrarySection({
  recipes,
  pantryOptions,
}: {
  recipes: RecipeListRow[];
  pantryOptions: PantryPickerRow[];
}) {
  const [tab, setTab] = useState<RecipeMealKey>("breakfast");

  const filtered = useMemo(() => {
    return recipes.filter((r) => recipeMatchesMealTab(normalizeMealType(r.mealType), tab));
  }, [recipes, tab]);

  return (
    <div>
      <div className="mt-3 overflow-x-auto pb-1">
        <div
          className="inline-flex min-w-full gap-1 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-inset)] p-1"
          role="tablist"
          aria-label="Filter recipes by meal"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`tap-target min-w-[110px] flex-1 rounded-md px-3 py-2 text-center text-sm font-semibold ${
                tab === t.id
                  ? "bg-[var(--background)] text-[var(--accent)] shadow-sm"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {recipes.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--muted)]">No recipes yet.</p>
      ) : filtered.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--muted)]">
          No recipes for {formatMealTypeLabel(tab)}. Try another tab or change a recipe’s meal type.
        </p>
      ) : (
        <ul className="mt-4 space-y-2" role="tabpanel">
          {filtered.map((r) => (
            <RecipeLibraryRow key={r.id} detail={toPlanRecipeDetail(r)} pantryOptions={pantryOptions} />
          ))}
        </ul>
      )}
    </div>
  );
}
