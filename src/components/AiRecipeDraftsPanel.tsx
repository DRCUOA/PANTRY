"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { generateAiRecipeDrafts, saveAiRecipeDraft, saveAiRecipeDraftToPlan } from "@/actions/ai-recipes";
import { MobileSheet } from "@/components/MobileSheet";
import { splitAiRecipeIngredients, type AiRecipeDraft } from "@/lib/ai-recipe-schema";
import {
  formatMealTypeLabel,
  RECIPE_MEAL_TYPE_VALUES,
  type RecipeMealTypeValue,
} from "@/lib/recipe-meal-types";
import { useLocalIsoToday } from "@/lib/use-local-iso-today";

type DraftView = AiRecipeDraft & {
  clientId: string;
};

function makeClientId(index: number) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `draft-${Date.now()}-${index}`;
}

function toDraftViews(drafts: AiRecipeDraft[]): DraftView[] {
  return drafts.map((draft, index) => ({
    ...draft,
    clientId: makeClientId(index),
  }));
}

function withoutClientId(draft: DraftView): AiRecipeDraft {
  const { clientId, ...recipeDraft } = draft;
  void clientId;
  return recipeDraft;
}

export function AiRecipeDraftsPanel() {
  const router = useRouter();
  const today = useLocalIsoToday();
  const [drafts, setDrafts] = useState<DraftView[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [pendingGenerate, setPendingGenerate] = useState(false);
  const [pendingAction, setPendingAction] = useState<null | "save" | "plan">(null);
  const [error, setError] = useState<string | null>(null);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ pantryCount: number; expiringCount: number } | null>(null);
  const [planDate, setPlanDate] = useState("");
  const [planMealType, setPlanMealType] = useState<RecipeMealTypeValue>("dinner");

  const activeDraft = useMemo(
    () => drafts.find((draft) => draft.clientId === openId) ?? null,
    [drafts, openId],
  );

  useEffect(() => {
    if (!today || planDate) return;
    setPlanDate(today);
  }, [today, planDate]);

  useEffect(() => {
    if (!activeDraft) return;
    setPlanMealType(activeDraft.mealType);
    setPlanDate(today ?? "");
    setSheetError(null);
  }, [activeDraft, today]);

  async function requestDrafts() {
    setPendingGenerate(true);
    setError(null);
    try {
      const result = await generateAiRecipeDrafts();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMeta({ pantryCount: result.pantryCount, expiringCount: result.expiringCount });
      setDrafts(toDraftViews(result.drafts));
      setOpenId(null);
      setSheetError(null);
    } finally {
      setPendingGenerate(false);
    }
  }

  function dismissDraft(clientId: string) {
    setDrafts((current) => current.filter((draft) => draft.clientId !== clientId));
    if (openId === clientId) {
      setOpenId(null);
    }
  }

  async function persistDraft(mode: "save" | "plan") {
    if (!activeDraft) return;
    const payload = withoutClientId(activeDraft);
    setPendingAction(mode);
    setSheetError(null);
    try {
      const result =
        mode === "save"
          ? await saveAiRecipeDraft(payload)
          : await saveAiRecipeDraftToPlan(payload, planDate, planMealType);

      if (!result.ok) {
        setSheetError(result.error);
        return;
      }

      dismissDraft(activeDraft.clientId);
      router.refresh();
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <section id="ai-recipe-drafts" className="panel-bordered border-dashed border-[var(--border-accent)] bg-[var(--surface-inset)]">
      <div className="flex flex-col gap-3 border-b border-[var(--border-strong)] pb-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-serif text-lg font-semibold text-[var(--accent)]">
            Draft recipes from pantry
          </h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Generate a few reviewable ideas from your current stock, then save only the ones that look real.
          </p>
          {meta && (
            <p className="mt-2 text-xs text-[var(--muted)]">
              Last run used {meta.pantryCount} pantry items
              {meta.expiringCount > 0 ? ` and ${meta.expiringCount} expiring-soon items` : ""}.
            </p>
          )}
        </div>
        <button
          type="button"
          disabled={pendingGenerate}
          onClick={() => void requestDrafts()}
          className="btn-primary-touch w-full bg-[var(--accent)] text-white disabled:opacity-50 sm:w-auto"
        >
          {pendingGenerate ? "Drafting…" : drafts.length > 0 ? "Refresh drafts" : "Suggest recipes"}
        </button>
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      )}

      {drafts.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--muted)]">
          Nothing generated yet. Use Suggest recipes to turn your pantry into reviewable recipe drafts.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {drafts.map((draft) => {
            const { pantry, missing } = splitAiRecipeIngredients(draft);
            return (
              <li key={draft.clientId} className="receipt-card space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                      {formatMealTypeLabel(draft.mealType)}
                    </p>
                    <h4 className="mt-1 font-semibold leading-snug text-[var(--foreground)]">
                      {draft.title}
                    </h4>
                    <p className="mt-1 text-sm text-[var(--muted)]">{draft.whyThisFits}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => dismissDraft(draft.clientId)}
                    className="tap-target shrink-0 rounded-lg px-2 text-sm font-medium text-[var(--muted)]"
                  >
                    Dismiss
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-[var(--muted)]">
                  <span>{pantry.length} in pantry</span>
                  <span>{missing.length} missing</span>
                  <span>{draft.servings} servings</span>
                  {draft.prepTimeMinutes != null && <span>{draft.prepTimeMinutes} min</span>}
                </div>
                <button
                  type="button"
                  onClick={() => setOpenId(draft.clientId)}
                  className="tap-target rounded-lg border border-[var(--border-strong)] bg-[var(--background)] px-3 py-2 text-sm font-semibold text-[var(--foreground)]"
                >
                  Review draft
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <MobileSheet
        open={activeDraft != null}
        onClose={() => {
          setOpenId(null);
          setSheetError(null);
        }}
        title={activeDraft?.title ?? "AI recipe draft"}
        eyebrow={activeDraft ? formatMealTypeLabel(activeDraft.mealType) : "Recipe draft"}
        subtitle={
          activeDraft ? (
            <div className="flex flex-wrap gap-2">
              <span>{activeDraft.servings} servings</span>
              {activeDraft.prepTimeMinutes != null && <span>{activeDraft.prepTimeMinutes} min</span>}
            </div>
          ) : null
        }
        maxWidthClassName="max-w-3xl"
        footer={
          activeDraft ? (
            <div className="flex flex-col gap-3">
              {sheetError && (
                <p className="rounded-lg border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
                  {sheetError}
                </p>
              )}
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                    Planned date
                  </label>
                  <input
                    type="date"
                    value={planDate}
                    onChange={(event) => setPlanDate(event.target.value)}
                    className="input-touch w-full border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                    Meal slot
                  </label>
                  <select
                    value={planMealType}
                    onChange={(event) => setPlanMealType(event.target.value as RecipeMealTypeValue)}
                    className="input-touch w-full border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)]"
                  >
                    {RECIPE_MEAL_TYPE_VALUES.map((mealType) => (
                      <option key={mealType} value={mealType}>
                        {formatMealTypeLabel(mealType)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  disabled={pendingAction !== null}
                  onClick={() => void persistDraft("save")}
                  className="btn-primary-touch flex-1 border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)] disabled:opacity-50"
                >
                  {pendingAction === "save" ? "Saving…" : "Save recipe"}
                </button>
                <button
                  type="button"
                  disabled={pendingAction !== null || !planDate}
                  onClick={() => void persistDraft("plan")}
                  className="btn-primary-touch flex-1 bg-[var(--accent)] text-white disabled:opacity-50"
                >
                  {pendingAction === "plan" ? "Saving…" : "Save + add to plan"}
                </button>
              </div>
            </div>
          ) : null
        }
      >
        {activeDraft && (
          <div className="space-y-4 border-t border-[var(--border)] pt-4">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Why this fits
              </h3>
              <p className="mt-1 text-sm text-[var(--foreground)]">{activeDraft.whyThisFits}</p>
            </div>

            {activeDraft.description && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Description
                </h3>
                <p className="mt-1 text-sm text-[var(--foreground)]">{activeDraft.description}</p>
              </div>
            )}

            {activeDraft.usesExpiringItems.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Uses expiring soon
                </h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {activeDraft.usesExpiringItems.map((itemName) => (
                    <span
                      key={itemName}
                      className="rounded-full bg-[var(--warn-bg)] px-2 py-1 text-xs font-semibold text-[var(--warn)]"
                    >
                      {itemName}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              {(() => {
                const { pantry, missing } = splitAiRecipeIngredients(activeDraft);
                return (
                  <>
                    <div className="rounded-xl border border-[var(--border-strong)] bg-[var(--surface-inset)] p-3">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                        In pantry
                      </h3>
                      {pantry.length === 0 ? (
                        <p className="mt-2 text-sm text-[var(--muted)]">No direct pantry matches.</p>
                      ) : (
                        <ul className="mt-2 space-y-2 text-sm text-[var(--foreground)]">
                          {pantry.map((ingredient) => (
                            <li key={`${ingredient.source}-${ingredient.pantryItemName}`}>
                              <span className="font-medium">{ingredient.pantryItemName}</span>
                              {(ingredient.quantity || ingredient.unit) && (
                                <span className="text-[var(--muted)]">
                                  {" "}
                                  · {ingredient.quantity ?? ""}
                                  {ingredient.unit ? ` ${ingredient.unit}` : ""}
                                </span>
                              )}
                              {ingredient.optional && (
                                <span className="text-[var(--muted)]"> (optional)</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="rounded-xl border border-[var(--border-strong)] bg-[var(--surface-inset)] p-3">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                        Still needed
                      </h3>
                      {missing.length === 0 ? (
                        <p className="mt-2 text-sm text-[var(--muted)]">Nothing extra needed.</p>
                      ) : (
                        <ul className="mt-2 space-y-2 text-sm text-[var(--foreground)]">
                          {missing.map((ingredient) => (
                            <li key={`${ingredient.source}-${ingredient.pantryItemName}`}>
                              <span className="font-medium">{ingredient.pantryItemName}</span>
                              {(ingredient.quantity || ingredient.unit) && (
                                <span className="text-[var(--muted)]">
                                  {" "}
                                  · {ingredient.quantity ?? ""}
                                  {ingredient.unit ? ` ${ingredient.unit}` : ""}
                                </span>
                              )}
                              {ingredient.optional && (
                                <span className="text-[var(--muted)]"> (optional)</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Instructions
              </h3>
              <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--foreground)]">
                {activeDraft.instructions}
              </p>
            </div>
          </div>
        )}
      </MobileSheet>
    </section>
  );
}
