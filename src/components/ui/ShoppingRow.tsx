"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteShoppingItem, toggleShoppingItemBought } from "@/actions/shopping";
import { IconCheck, IconTrash } from "./icons";
import { SwipeRow } from "./SwipeRow";

export type ShoppingRowItem = {
  id: number;
  name: string;
  quantity: string | null;
  unit: string | null;
  status: string;
  sourceRecipeTitle: string | null;
};

export function ShoppingRow({ item }: { item: ShoppingRowItem }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [localStatus, setLocalStatus] = useState(item.status);
  const bought = localStatus === "bought";

  function toggle() {
    const next = bought ? "needed" : "bought";
    setLocalStatus(next);
    startTransition(async () => {
      await toggleShoppingItemBought(item.id);
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      await deleteShoppingItem(item.id);
      router.refresh();
    });
  }

  return (
    <SwipeRow
      leftAction={{
        label: bought ? "Un-check" : "Got it",
        icon: <IconCheck size={16} />,
        onAction: toggle,
      }}
      rightAction={{
        label: "Delete",
        icon: <IconTrash size={16} />,
        onAction: remove,
      }}
    >
      <div className="ui-item-row" style={bought ? { opacity: 0.65 } : undefined}>
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          className={`ui-check ${bought ? "ui-check--on" : ""}`}
          aria-pressed={bought}
          aria-label={bought ? "Mark as not bought" : "Mark as bought"}
          data-no-swipe
        >
          <IconCheck size={18} />
        </button>
        <div className="ui-item-row__body" data-no-swipe>
          <p
            className="ui-item-row__title"
            style={bought ? { textDecoration: "line-through", color: "var(--muted)" } : undefined}
          >
            {item.name}
          </p>
          <p className="ui-item-row__meta">
            {item.quantity != null && item.quantity !== "" && (
              <span>
                {item.quantity}
                {item.unit ? ` ${item.unit}` : ""}
              </span>
            )}
            {item.sourceRecipeTitle && (
              <span className="ml-1">· from {item.sourceRecipeTitle}</span>
            )}
          </p>
        </div>
      </div>
    </SwipeRow>
  );
}
