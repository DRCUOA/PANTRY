"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { PantryPickerRow } from "@/actions/pantry";
import { deleteRecipe } from "@/actions/recipes";
import { RecipeInlineEditForm } from "@/components/RecipeInlineEditForm";
import type { PlanRecipeDetail } from "@/lib/plan-recipe";
import { formatMealTypeLabel } from "@/lib/recipe-meal-types";

function IconClose({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M18 6L6 18M6 6l12 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

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
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState(false);
  const [recipeEditKey, setRecipeEditKey] = useState(0);
  const [deletePending, setDeletePending] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setEditingRecipe(false);
    setRecipeEditKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

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

  const modal =
    mounted &&
    open &&
    createPortal(
      <div
        className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4"
        role="presentation"
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
      >
        <div
          className="absolute inset-0 cursor-pointer bg-black/70"
          onClick={close}
          aria-hidden
        />
        <div
          className="relative z-10 max-h-[min(92vh,800px)] w-full max-w-2xl overflow-y-auto rounded-t-2xl border-2 border-[var(--border-strong)] bg-[var(--surface)] p-5 shadow-[0_-8px_40px_rgba(0,0,0,0.5)] sm:rounded-2xl sm:border-[var(--border-accent)]"
          role="dialog"
          aria-modal
          aria-labelledby={`recipe-lib-modal-${recipeId}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="receipt-card-muted text-[0.7rem] uppercase tracking-wide">Recipe</p>
              <h2
                id={`recipe-lib-modal-${recipeId}`}
                className="mt-1 font-serif text-xl font-semibold leading-snug"
              >
                {detail.title}
              </h2>
              <p className="mt-1 text-xs text-[var(--muted)]">{formatMealTypeLabel(detail.mealType)}</p>
            </div>
            <button
              type="button"
              onClick={close}
              className="tap-target shrink-0 rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--surface-inset)] hover:text-[var(--foreground)]"
              aria-label="Close"
            >
              <IconClose />
            </button>
          </div>

          {editingRecipe && (
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
          )}

          {!editingRecipe && (
            <div className="mt-4 space-y-4 border-t border-[var(--border)] pt-4">
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
        </div>
      </div>,
      document.body,
    );

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
      {modal}
    </>
  );
}
