"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { clearShoppingList } from "@/actions/shopping";
import { IconTrash } from "@/components/ui/icons";
import { UndoSnackbar } from "@/components/ui/UndoSnackbar";

type Toast = { message: React.ReactNode; tone: "info" | "warn" | "danger" };

/**
 * Destructive bulk clear of the shopping list. Always gated by a confirm()
 * prompt and surfaces a danger-tone toast on completion to underline that the
 * action can't be undone.
 */
export function ClearShoppingButton({ totalCount }: { totalCount: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<Toast | null>(null);

  function run() {
    if (totalCount === 0) return;
    const confirmed = window.confirm(
      `Remove all ${totalCount} item${totalCount === 1 ? "" : "s"} from the shopping list? This can't be undone.`,
    );
    if (!confirmed) return;
    startTransition(async () => {
      const result = await clearShoppingList();
      if (!result.ok) {
        setToast({ message: result.error, tone: "warn" });
        return;
      }
      if (result.deleted === 0) {
        setToast({ message: "List was already empty.", tone: "info" });
      } else {
        setToast({
          message: (
            <span>
              <strong>Shopping list cleared</strong> — removed {result.deleted} item
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
      <button
        type="button"
        onClick={run}
        disabled={pending || totalCount === 0}
        className="ui-btn ui-btn--ghost text-sm text-[var(--danger)] disabled:opacity-50"
        title="Delete every item on the shopping list"
      >
        <IconTrash size={16} /> Clear shopping
      </button>

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
