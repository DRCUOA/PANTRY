"use client";

import { useDraggable } from "@dnd-kit/core";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { PantryPickerRow } from "@/actions/pantry";
import {
  addMissingToShoppingList,
  deleteMealPlanEntry,
  duplicateMealPlanEntryToDate,
  markMealCooked,
  updateMealPlanEntryDetails,
} from "@/actions/meal-plan";
import { RecipeInlineEditForm } from "@/components/RecipeInlineEditForm";
import { SheetModal } from "@/components/ui/SheetModal";
import type { PlanRecipeDetail } from "@/lib/plan-recipe";
import { formatMealTypeLabel } from "@/lib/recipe-meal-types";

export type { PlanRecipeDetail };

export type PlanMealTileData = {
  entryId: number;
  plannedDate: string;
  mealType: string;
  status: string;
  recipeTitle: string | null;
  recipeId: number | null;
  recipeDetail: PlanRecipeDetail | null;
  plannedServings: string;
  mealNotes: string | null;
  pantryOptions: PantryPickerRow[];
  /** e.g. "3/5" matched/total ingredients */
  pantryRatio: string | null;
  /** Count of required missing ingredients */
  missingRequired: number | null;
  /** Full pantry line for modal */
  missingSummary: string | null;
  showPlannedActions: boolean;
};

function IconCheckCook({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 12.5l2.5 2.5L16 9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCartPlus({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 6h15l-1.5 9h-12L6 6zm0 0L5 3H2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 20a1 1 0 100-2 1 1 0 000 2zm8 0a1 1 0 100-2 1 1 0 000 2zM12 11v4M10 13h4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconTrash({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14zM10 11v6M14 11v6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconGrip({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="18" viewBox="0 0 14 18" fill="currentColor" aria-hidden>
      <circle cx="4" cy="4" r="1.35" />
      <circle cx="10" cy="4" r="1.35" />
      <circle cx="4" cy="9" r="1.35" />
      <circle cx="10" cy="9" r="1.35" />
      <circle cx="4" cy="14" r="1.35" />
      <circle cx="10" cy="14" r="1.35" />
    </svg>
  );
}

export function PlanMealTile(data: PlanMealTileData) {
  const {
    entryId,
    plannedDate,
    mealType,
    status,
    recipeTitle,
    recipeId,
    recipeDetail,
    plannedServings,
    mealNotes,
    pantryOptions,
    pantryRatio,
    missingRequired,
    missingSummary,
    showPlannedActions,
  } = data;

  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<null | "cooked" | "missing" | "remove" | "duplicate">(null);
  const [editingRecipe, setEditingRecipe] = useState(false);
  const [recipeEditKey, setRecipeEditKey] = useState(0);
  const [editingPlan, setEditingPlan] = useState(false);
  const [planServings, setPlanServings] = useState(() => String(plannedServings));
  const [planNotes, setPlanNotes] = useState(() => mealNotes ?? "");
  const [duplicateDate, setDuplicateDate] = useState(plannedDate);
  const [planPending, setPlanPending] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setEditingRecipe(false);
    setEditingPlan(false);
    setPlanError(null);
    setDuplicateError(null);
    setDuplicateDate(plannedDate);
    setRecipeEditKey((k) => k + 1);
  }, [plannedDate]);

  useEffect(() => {
    if (!open) return;
    setPlanServings(String(plannedServings));
    setPlanNotes(mealNotes ?? "");
    setDuplicateDate(plannedDate);
  }, [open, plannedDate, plannedServings, mealNotes]);

  async function run(
    kind: "cooked" | "missing" | "remove" | "duplicate",
    fn: () => Promise<void>,
  ) {
    setPending(kind);
    try {
      await fn();
      close();
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  const titleLine = recipeTitle ?? "No recipe";
  const statusLower = status.toLowerCase();
  const hasRecipe = recipeDetail != null && recipeId != null;

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `meal-${entryId}`,
    data: {
      entryId,
      sourceDate: plannedDate,
      label: titleLine,
      mealType,
    },
  });

  async function savePlanDetails() {
    setPlanError(null);
    const n = Number(planServings);
    setPlanPending(true);
    try {
      const r = await updateMealPlanEntryDetails(entryId, n, planNotes.trim() || null);
      if (!r.ok) {
        setPlanError(r.error);
        return;
      }
      setEditingPlan(false);
      router.refresh();
    } finally {
      setPlanPending(false);
    }
  }

  async function duplicateMeal() {
    setDuplicateError(null);
    setPending("duplicate");
    try {
      const r = await duplicateMealPlanEntryToDate(entryId, duplicateDate);
      if (!r.ok) {
        setDuplicateError(r.error);
        return;
      }
      close();
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  return (
    <>
      <div className={`plan-meal-compact-wrap ${isDragging ? "plan-meal-compact-wrap--dragging" : ""}`}>
        <button
          type="button"
          ref={setNodeRef}
          {...listeners}
          {...attributes}
          onClick={(ev) => ev.stopPropagation()}
          className="plan-meal-compact__drag tap-target"
          title="Drag to another day (press and hold on touch screens)"
          aria-label="Drag meal to another day"
        >
          <IconGrip />
        </button>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="plan-meal-compact tap-target text-left"
        >
          <div className="plan-meal-compact__row">
            <span className="plan-meal-compact__meal">{mealType}</span>
            {statusLower !== "planned" && (
              <span className="plan-meal-compact__pill">{status}</span>
            )}
          </div>
          <p className="plan-meal-compact__title">{titleLine}</p>
          {pantryRatio != null && (
            <p className="plan-meal-compact__meta">
              <span>{pantryRatio}</span>
              {missingRequired != null && missingRequired > 0 && (
                <span className="plan-meal-compact__warn"> · {missingRequired} missing</span>
              )}
            </p>
          )}
        </button>
      </div>

      <SheetModal
        open={open}
        onClose={close}
        title={titleLine}
        description={`${mealType} · ${plannedDate}`}
      >
        {missingSummary && !editingRecipe && (
          <p className="receipt-card-muted border-t border-[var(--border)] pt-3 text-sm">
            {missingSummary}
          </p>
        )}

        {hasRecipe && editingRecipe && recipeDetail && (
          <RecipeInlineEditForm
            key={`${recipeId}-${recipeEditKey}`}
            recipeId={recipeId}
            detail={recipeDetail}
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

        {hasRecipe && !editingRecipe && recipeDetail && (
          <div className="mt-4 space-y-4 border-t border-[var(--border)] pt-4">
            <p className="text-xs text-[var(--muted)]">
              Meal type: {formatMealTypeLabel(recipeDetail.mealType)}
            </p>
            <details>
              <summary className="tap-target inline-flex cursor-pointer items-center rounded-md border border-[var(--border-strong)] px-3 py-2 text-sm font-semibold text-[var(--foreground)]">
                More
              </summary>
              <div className="mt-3 space-y-4 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-inset)] p-3">
                {recipeDetail.description && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                      Description
                    </h3>
                    <p className="mt-1 text-sm text-[var(--foreground)]">{recipeDetail.description}</p>
                  </div>
                )}
                {recipeDetail.instructions && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                      Instructions
                    </h3>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--foreground)]">
                      {recipeDetail.instructions}
                    </p>
                  </div>
                )}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--muted)]">
                  <span>
                    Recipe servings (base):{" "}
                    <strong className="text-[var(--foreground)]">{recipeDetail.servings ?? 1}</strong>
                  </span>
                  {recipeDetail.prepTimeMinutes != null && (
                    <span>
                      Prep:{" "}
                      <strong className="text-[var(--foreground)]">{recipeDetail.prepTimeMinutes} min</strong>
                    </span>
                  )}
                  {recipeDetail.caloriesPerServing != null && (
                    <span>
                      Cal/serving:{" "}
                      <strong className="text-[var(--foreground)]">{recipeDetail.caloriesPerServing}</strong>
                    </span>
                  )}
                  {recipeDetail.proteinGPerServing != null && recipeDetail.proteinGPerServing !== "" && (
                    <span>
                      Protein:{" "}
                      <strong className="text-[var(--foreground)]">{recipeDetail.proteinGPerServing} g</strong>
                    </span>
                  )}
                </div>
                {recipeDetail.ingredients.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                      Ingredients
                    </h3>
                    <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-[var(--foreground)]">
                      {recipeDetail.ingredients.map((ing, idx) => (
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
              </div>
            </details>
            <button
              type="button"
              disabled={pending !== null}
              onClick={() => {
                setEditingRecipe(true);
                setRecipeEditKey((k) => k + 1);
              }}
              className="tap-target rounded-lg border border-[var(--border-accent)] bg-[var(--accent-subtle)] px-3 py-2 text-sm font-semibold text-[var(--accent)] disabled:opacity-50"
            >
              Edit recipe
            </button>
          </div>
        )}

        {!editingRecipe && (
          <div className="mt-4 space-y-3 border-t border-[var(--border-strong)] pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              This plan entry
            </h3>
            <p className="text-sm text-[var(--muted)]">Status: {status}</p>
            {editingPlan ? (
              <div className="space-y-3 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-inset)] p-3">
                {planError && <p className="text-sm text-[var(--danger)]">{planError}</p>}
                <div>
                  <label className="mb-1 block text-xs font-medium">Planned servings</label>
                  <input
                    type="number"
                    min={0.5}
                    step={0.5}
                    value={planServings}
                    onChange={(e) => setPlanServings(e.target.value)}
                    className="input-touch w-full border border-[var(--border-strong)] bg-[var(--background)]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium">Notes</label>
                  <textarea
                    value={planNotes}
                    onChange={(e) => setPlanNotes(e.target.value)}
                    rows={2}
                    className="input-touch min-h-[72px] w-full resize-y border border-[var(--border-strong)] bg-[var(--background)]"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={planPending}
                    onClick={() => void savePlanDetails()}
                    className="btn-primary-touch rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {planPending ? "Saving…" : "Save"}
                  </button>
                  <button
                    type="button"
                    disabled={planPending}
                    onClick={() => {
                      setEditingPlan(false);
                      setPlanServings(String(plannedServings));
                      setPlanNotes(mealNotes ?? "");
                      setPlanError(null);
                    }}
                    className="tap-target rounded-lg px-3 py-2 text-sm text-[var(--muted)]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm">
                  <span className="text-[var(--muted)]">Planned servings: </span>
                  <strong className="text-[var(--foreground)]">{plannedServings}</strong>
                </p>
                {mealNotes && (
                  <p className="text-sm">
                    <span className="text-[var(--muted)]">Notes: </span>
                    <span className="text-[var(--foreground)]">{mealNotes}</span>
                  </p>
                )}
                <button
                  type="button"
                  disabled={pending !== null}
                  onClick={() => setEditingPlan(true)}
                  className="tap-target rounded-lg border border-[var(--border-strong)] px-3 py-2 text-sm font-semibold text-[var(--foreground)] disabled:opacity-50"
                >
                  Edit meal details
                </button>
              </>
            )}

            <div className="space-y-3 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-inset)] p-3">
              <div>
                <h4 className="text-sm font-semibold text-[var(--foreground)]">Duplicate meal</h4>
                <p className="text-xs text-[var(--muted)]">
                  Create a copy of this meal on another day.
                </p>
              </div>
              {duplicateError && <p className="text-sm text-[var(--danger)]">{duplicateError}</p>}
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="date"
                  value={duplicateDate}
                  onChange={(e) => setDuplicateDate(e.target.value)}
                  className="input-touch w-full border border-[var(--border-strong)] bg-[var(--background)]"
                />
                <button
                  type="button"
                  disabled={pending !== null || !duplicateDate}
                  onClick={() => void duplicateMeal()}
                  className="btn-primary-touch rounded-lg border border-[var(--border-strong)] bg-[var(--background)] px-4 text-[var(--foreground)] disabled:opacity-50"
                >
                  {pending === "duplicate" ? "Duplicating…" : "Duplicate"}
                </button>
              </div>
            </div>
          </div>
        )}


        {!editingRecipe && (
          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-dashed border-[var(--border)] pt-4">
            {showPlannedActions && (
              <>
                <button
                  type="button"
                  disabled={pending !== null}
                  onClick={() => run("cooked", () => markMealCooked(entryId))}
                  className="tap-target inline-flex items-center justify-center rounded-xl border-2 border-[var(--accent)] bg-[var(--accent)] p-3 text-white disabled:opacity-50"
                  title="Mark cooked"
                  aria-label="Mark cooked"
                >
                  <IconCheckCook className="shrink-0" />
                </button>
                <button
                  type="button"
                  disabled={pending !== null}
                  onClick={() => run("missing", () => addMissingToShoppingList(entryId))}
                  className="tap-target inline-flex items-center justify-center rounded-xl border-2 border-[var(--border-strong)] bg-[var(--surface-elevated)] p-3 text-[var(--foreground)] disabled:opacity-50"
                  title="Add missing ingredients to shopping list"
                  aria-label="Add missing ingredients to shopping list"
                >
                  <IconCartPlus className="shrink-0" />
                </button>
              </>
            )}
            <button
              type="button"
              disabled={pending !== null}
              onClick={() => {
                if (!confirm("Remove this meal from the plan?")) return;
                void run("remove", () => deleteMealPlanEntry(entryId));
              }}
              className="tap-target inline-flex items-center justify-center rounded-xl border-2 border-[var(--danger)]/40 p-3 text-[var(--danger)] disabled:opacity-50"
              title="Remove from plan"
              aria-label="Remove from plan"
            >
              <IconTrash className="shrink-0" />
            </button>
          </div>
        )}

        {pending && (
          <p className="mt-3 text-center text-sm text-[var(--muted)]" aria-live="polite">
            Updating…
          </p>
        )}
      </SheetModal>
    </>
  );
}
