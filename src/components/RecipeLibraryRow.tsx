"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import type { PantryPickerRow } from "@/actions/pantry";
import { deleteRecipe } from "@/actions/recipes";
import { MobileSheet } from "@/components/MobileSheet";
import { RecipeInlineEditForm } from "@/components/RecipeInlineEditForm";
import type { PlanRecipeDetail } from "@/lib/plan-recipe";
import { formatMealTypeLabel } from "@/lib/recipe-meal-types";

/**
 * Plan page “Recipes” list row: tap title to open the same style of modal as plan meal tiles
 * (full recipe + edit), with delete at the bottom.
 */
export function RecipeLibraryRow({
  detail,
  pantryOptions,
}: {
  detail: PlanRecipeDetail;
  pantryOptions: PantryPickerRow[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState(false);
  const [recipeEditKey, setRecipeEditKey] = useState(0);
  const [deletePending, setDeletePending] = useState(false);

  const close = useCallback(() => {
    setOpen(false);
    setEditingRecipe(false);
    setRecipeEditKey((k) => k + 1);
  }, []);

  const recipeId = detail.id;

  async function onDelete() {
    if (!confirm(`Delete recipe “${detail.title}”? This cannot be undone.`)) return;
    setDeletePending(true);
    try {
      await deleteRecipe(recipeId);
      close();
      router.refresh();
    } finally {
      setDeletePending(false);
    }
  }

  return (
    <>
      <li className="receipt-card flex items-stretch gap-1 p-0">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="tap-target min-w-0 flex-1 rounded-lg px-3 py-2.5 text-left"
        >
          <span className="font-medium text-[var(--foreground)]">{detail.title}</span>
          <span className="mt-0.5 block text-xs text-[var(--muted)]">Tap for details</span>
        </button>
      </li>
      <MobileSheet
        open={open}
        onClose={close}
        title={detail.title}
        eyebrow="Recipe"
        subtitle={formatMealTypeLabel(detail.mealType)}
      >
        {editingRecipe ? (
          <RecipeInlineEditForm
            key={`${recipeId}-${recipeEditKey}`}
            recipeId={recipeId}
            detail={detail}
            pantryOptions={pantryOptions}
            onSaved={() => {
              setEditingRecipe(false);
              setRecipeEditKey((k) => k + 1);
              router.refresh();
            }}
            onCancel={() => {
              setEditingRecipe(false);
              setRecipeEditKey((k) => k + 1);
            }}
          />
        ) : (
          <div className="space-y-4 border-t border-[var(--border)] pt-4">
            {detail.description && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Description
                </h3>
                <p className="mt-1 text-sm text-[var(--foreground)]">{detail.description}</p>
              </div>
            )}
            {detail.instructions && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Instructions
                </h3>
                <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--foreground)]">
                  {detail.instructions}
                </p>
              </div>
            )}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--muted)]">
              <span>
                Recipe servings (base):{" "}
                <strong className="text-[var(--foreground)]">{detail.servings ?? 1}</strong>
              </span>
              {detail.prepTimeMinutes != null && (
                <span>
                  Prep:{" "}
                  <strong className="text-[var(--foreground)]">{detail.prepTimeMinutes} min</strong>
                </span>
              )}
              {detail.caloriesPerServing != null && (
                <span>
                  Cal/serving:{" "}
                  <strong className="text-[var(--foreground)]">{detail.caloriesPerServing}</strong>
                </span>
              )}
              {detail.proteinGPerServing != null && detail.proteinGPerServing !== "" && (
                <span>
                  Protein:{" "}
                  <strong className="text-[var(--foreground)]">{detail.proteinGPerServing} g</strong>
                </span>
              )}
            </div>
            {detail.ingredients.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Ingredients
                </h3>
                <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-[var(--foreground)]">
                  {detail.ingredients.map((ing, idx) => (
                    <li key={idx}>
                      {ing.pantryItemName}
                      {(ing.quantity != null && ing.quantity !== "") || ing.unit ? (
                        <span className="text-[var(--muted)]">
                          {" "}
                          — {ing.quantity ?? ""}
                          {ing.unit ? ` ${ing.unit}` : ""}
                        </span>
                      ) : null}
                      {ing.optional && (
                        <span className="text-xs text-[var(--muted)]"> (optional)</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex flex-wrap gap-2 border-t border-dashed border-[var(--border)] pt-4">
              <button
                type="button"
                disabled={deletePending}
                onClick={() => {
                  setEditingRecipe(true);
                  setRecipeEditKey((k) => k + 1);
                }}
                className="tap-target rounded-lg border border-[var(--border-accent)] bg-[var(--accent-subtle)] px-3 py-2 text-sm font-semibold text-[var(--accent)] disabled:opacity-50"
              >
                Edit recipe
              </button>
              <button
                type="button"
                disabled={deletePending}
                onClick={() => void onDelete()}
                className="tap-target rounded-lg border border-[var(--danger)]/40 px-3 py-2 text-sm font-semibold text-[var(--danger)] disabled:opacity-50"
              >
                {deletePending ? "Deleting…" : "Delete recipe"}
              </button>
            </div>
          </div>
        )}
      </MobileSheet>
    </>
  );
}
