"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deletePantryItem, markPantryItemUsedUp, updatePantryItem } from "@/actions/pantry";

export type PantryItemDTO = {
  id: number;
  name: string;
  quantity: string;
  unit: string;
  category: string | null;
  location: string | null;
  barcode: string | null;
  expirationDate: string | null;
  lowStockThreshold: string | null;
  productId: number | null;
  notes: string | null;
};

export function PantryEditSheet({ item }: { item: PantryItemDTO }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<void>) {
    startTransition(() => {
      void (async () => {
        await fn();
        setOpen(false);
        router.refresh();
      })();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3 text-left text-sm hover:border-[var(--accent)]"
      >
        <div className="flex justify-between gap-2">
          <span className="font-medium">{item.name}</span>
          <span className="shrink-0 text-[var(--muted)]">
            {item.quantity} {item.unit}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
          {item.location && <span>{item.location}</span>}
          {item.expirationDate && (
            <span className="text-[var(--warn)]">Exp {item.expirationDate}</span>
          )}
        </div>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-lg sm:rounded-2xl"
            role="dialog"
            aria-modal
            aria-labelledby="edit-title"
          >
            <h2 id="edit-title" className="font-serif text-lg font-semibold">
              Edit item
            </h2>
            <form
              className="mt-4 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                run(async () => {
                  await updatePantryItem(fd);
                });
              }}
            >
              <input type="hidden" name="id" value={item.id} />
              <input type="hidden" name="productId" value={item.productId ?? ""} />
              <input type="hidden" name="barcode" value={item.barcode ?? ""} />
              <input type="hidden" name="category" value={item.category ?? ""} />
              <input type="hidden" name="notes" value={item.notes ?? ""} />
              <div>
                <label className="mb-1 block text-xs font-medium">Name</label>
                <input
                  name="name"
                  defaultValue={item.name}
                  required
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-medium">Quantity</label>
                  <input
                    name="quantity"
                    defaultValue={item.quantity}
                    required
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium">Unit</label>
                  <input
                    name="unit"
                    defaultValue={item.unit}
                    required
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Expiry</label>
                <input
                  name="expirationDate"
                  type="date"
                  defaultValue={item.expirationDate ?? ""}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Location</label>
                <input
                  name="location"
                  defaultValue={item.location ?? ""}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Low stock threshold</label>
                <input
                  name="lowStockThreshold"
                  defaultValue={item.lowStockThreshold ?? ""}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={pending}
                className="mt-2 w-full rounded-xl bg-[var(--accent)] py-3 text-sm font-medium text-white disabled:opacity-50"
              >
                Save
              </button>
            </form>
            <div className="mt-4 flex flex-col gap-2 border-t border-[var(--border)] pt-4">
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  run(async () => {
                    await markPantryItemUsedUp(item.id);
                  })
                }
                className="w-full rounded-xl border border-[var(--border)] py-3 text-sm disabled:opacity-50"
              >
                Mark used up
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (!confirm("Remove this item from the pantry?")) return;
                  run(async () => {
                    await deletePantryItem(item.id);
                  });
                }}
                className="w-full rounded-xl py-3 text-sm text-[var(--danger)] disabled:opacity-50"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-full rounded-xl py-3 text-sm text-[var(--muted)]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
