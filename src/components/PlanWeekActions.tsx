"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { addAllMissingForRange, clearPlanWeek } from "@/actions/meal-plan";
import { IconBasket, IconTrash } from "@/components/ui/icons";
import { UndoSnackbar } from "@/components/ui/UndoSnackbar";

type Toast = {
  message: ReactNode;
  tone: "info" | "warn" | "danger";
};

/**
 * Bulk plan-week actions: top up the shopping list with everything missing for
 * planned meals in the visible week, and clear the plan for that same window.
 *
 * Both actions surface a toast (UndoSnackbar) on completion. The destructive
 * "Clear plan" button gates on a `confirm()` prompt and the resulting toast
 * uses the `danger` tone to make the destructive nature unmistakable.
 */
export function PlanWeekActions({
  startDate,
  endDate,
  weekLabel,
  hasPlannedMeals,
}: {
  startDate: string;
  endDate: string;
  weekLabel: string;
  hasPlannedMeals: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<Toast | null>(null);

  function runAddMissing() {
    startTransition(async () => {
      const result = await addAllMissingForRange(startDate, endDate);
      if (!result.ok) {
        setToast({ message: result.error, tone: "warn" });
        return;
      }
      const { inserted, updated, skipped, generated } = result;
      let message: string;
      if (generated === 0) {
        message = "No planned meals had missing ingredients.";
      } else if (inserted === 0 && updated === 0) {
        message = `Already covered — ${skipped} item${skipped === 1 ? "" : "s"} were already on the list.`;
      } else {
        const parts: string[] = [];
        if (inserted > 0) parts.push(`${inserted} added`);
        if (updated > 0) parts.push(`${updated} updated`);
        if (skipped > 0) parts.push(`${skipped} unchanged`);
        message = `Shopping list topped up — ${parts.join(", ")}.`;
      }
      setToast({ message, tone: "info" });
      router.refresh();
    });
  }

  function runClearPlan() {
    const confirmed = window.confirm(
      `Remove every planned meal in ${weekLabel.toLowerCase()}? This can't be undone.`,
    );
    if (!confirmed) return;
    startTransition(async () => {
      const result = await clearPlanWeek(startDate, endDate);
      if (!result.ok) {
        setToast({ message: result.error, tone: "warn" });
        return;
      }
      if (result.deleted === 0) {
        setToast({ message: "Nothing to clear — no planned meals in this week.", tone: "info" });
      } else {
        setToast({
          message: (
            <span>
              <strong>Plan cleared</strong> — removed {result.deleted} meal
              {result.deleted === 1 ? "" : "s"}. This can&apos;t be undone.
            </span>
          ),
          tone: "danger",
        });
      }
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending || !hasPlannedMeals}
          onClick={runAddMissing}
          className="ui-btn ui-btn--ghost flex-1 text-sm disabled:opacity-50"
          title="Review planned meals and add missing ingredients to the shopping list"
        >
          <IconBasket size={16} /> Add missing to shopping
        </button>
        <button
          type="button"
          disabled={pending || !hasPlannedMeals}
          onClick={runClearPlan}
          className="ui-btn ui-btn--ghost flex-1 text-sm text-[var(--danger)] disabled:opacity-50"
          title="Delete every planned meal in the visible week"
        >
          <IconTrash size={16} /> Clear plan
        </button>
      </div>

      {toast && (
        <UndoSnackbar
          message={
            <span
              className={
                toast.tone === "danger"
                  ? "text-[var(--danger)]"
                  : toast.tone === "warn"
                    ? "text-[var(--warn)]"
                    : undefined
              }
            >
              {toast.message}
            </span>
          }
          duration={toast.tone === "danger" ? 6000 : 4000}
          onDismiss={() => setToast(null)}
        />
      )}
    </>
  );
}
