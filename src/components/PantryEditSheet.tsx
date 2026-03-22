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

export function PantryEditSheet({
  item,
  locationSuggestions = [],
}: {
  item: PantryItemDTO;
  locationSuggestions?: string[];
}) {
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
        className="receipt-card w-full min-h-[52px] py-3 text-left text-sm active:bg-[var(--surface-inset)]"
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
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border-2 border-[var(--border-strong)] bg-[var(--surface)] p-5 shadow-[0_-8px_40px_rgba(0,0,0,0.5)] sm:rounded-2xl sm:border-[var(--border-accent)]"
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
                  className="input-touch w-full border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)]"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-medium">Quantity</label>
                  <input
                    name="quantity"
                    defaultValue={item.quantity}
                    required
                    className="input-touch w-full border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium">Unit</label>
                  <input
                    name="unit"
                    defaultValue={item.unit}
                    required
                    className="input-touch w-full border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)]"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Expiry</label>
                <input
                  name="expirationDate"
                  type="date"
                  defaultValue={item.expirationDate ?? ""}
                  className="input-touch w-full border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Location</label>
                <datalist id={`pantry-loc-${item.id}`}>
                  {locationSuggestions.map((loc) => (
                    <option key={loc} value={loc} />
                  ))}
                </datalist>
                <input
                  name="location"
                  list={`pantry-loc-${item.id}`}
                  defaultValue={item.location ?? ""}
                  autoComplete="off"
                  className="input-touch w-full border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Low stock threshold</label>
                <input
                  name="lowStockThreshold"
                  defaultValue={item.lowStockThreshold ?? ""}
                  className="input-touch w-full border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)]"
                />
              </div>
              <button
                type="submit"
                disabled={pending}
                className="btn-primary-touch mt-2 w-full bg-[var(--accent)] font-semibold text-white disabled:opacity-50"
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
                className="btn-primary-touch w-full border-2 border-[var(--border-strong)] bg-[var(--surface-elevated)] text-[var(--foreground)] disabled:opacity-50"
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
                className="tap-target w-full text-base font-semibold text-[var(--danger)] disabled:opacity-50"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="tap-target w-full text-[var(--muted)]"
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
