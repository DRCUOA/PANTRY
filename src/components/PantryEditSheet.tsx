"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deletePantryItem, markPantryItemUsedUp, updatePantryItem } from "@/actions/pantry";
import { MobileSheet } from "@/components/MobileSheet";
import { StockStateBadge } from "@/components/StockStateBadge";
import { getPantryStockState } from "@/services/_shared/stock-state";

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
  const [error, setError] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);

  const stockState = getPantryStockState(item.quantity, item.lowStockThreshold);

  function close() {
    setOpen(false);
    setError(null);
    setShowMore(false);
  }

  function run(
    fn: () => Promise<{ ok: true } | { ok: false; error: string }>,
    options?: { closeOnSuccess?: boolean },
  ) {
    startTransition(() => {
      void (async () => {
        const result = await fn();
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setError(null);
        if (options?.closeOnSuccess !== false) {
          close();
        }
        router.refresh();
      })();
    });
  }

  return (
    <>
      <div className="receipt-card flex min-h-[52px] items-center gap-2 py-2 text-sm">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="min-w-0 flex-1 text-left active:opacity-80"
        >
          <div className="flex justify-between gap-2">
            <span className="font-medium">{item.name}</span>
            <span className="shrink-0 text-[var(--muted)]">
              {item.quantity} {item.unit}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
            <StockStateBadge state={stockState} />
            {item.location && <span>{item.location}</span>}
            {item.expirationDate && (
              <span className="text-[var(--warn)]">Exp {item.expirationDate}</span>
            )}
          </div>
        </button>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => markPantryItemUsedUp(item.id))}
            className="tap-target inline-flex items-center justify-center rounded-xl border-2 border-[var(--accent)] bg-[var(--accent)] p-2.5 text-white disabled:opacity-50"
            title="Mark used up"
            aria-label="Mark used up"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M8 12.5l2.5 2.5L16 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="tap-target inline-flex items-center justify-center rounded-xl border-2 border-[var(--border-strong)] bg-[var(--surface-elevated)] p-2.5 text-[var(--foreground)] disabled:opacity-50"
            title="Edit item"
            aria-label="Edit item"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!confirm("Remove this item from the pantry?")) return;
              run(() => deletePantryItem(item.id));
            }}
            className="tap-target inline-flex items-center justify-center rounded-xl border-2 border-[var(--danger)]/40 p-2.5 text-[var(--danger)] disabled:opacity-50"
            title="Delete item"
            aria-label="Delete item"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14zM10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      <MobileSheet
        open={open}
        onClose={close}
        title={item.name}
        eyebrow="Pantry item"
        subtitle={
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-[var(--muted)]">
              {item.quantity} {item.unit}
            </span>
            {item.location && <span>{item.location}</span>}
            {item.expirationDate && <span className="text-[var(--warn)]">Exp {item.expirationDate}</span>}
          </div>
        }
        maxWidthClassName="max-w-lg"
        footer={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="submit"
              form={`pantry-edit-${item.id}`}
              disabled={pending}
              className="btn-primary-touch flex-1 bg-[var(--accent)] font-semibold text-white disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={close}
              className="tap-target text-sm font-medium text-[var(--muted)] sm:px-3"
            >
              Cancel
            </button>
          </div>
        }
      >
        <div className="space-y-4 border-t border-[var(--border)] pt-4">
          {error && (
            <p className="rounded-lg border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
              {error}
            </p>
          )}
          <form
            id={`pantry-edit-${item.id}`}
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              run(() => updatePantryItem(fd));
            }}
          >
            <input type="hidden" name="id" value={item.id} />
            <input type="hidden" name="productId" value={item.productId ?? ""} />
            <input type="hidden" name="barcode" value={item.barcode ?? ""} />
            <input type="hidden" name="category" value={item.category ?? ""} />
            <input type="hidden" name="notes" value={item.notes ?? ""} />
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                Name
              </label>
              <input
                name="name"
                defaultValue={item.name}
                required
                className="input-touch w-full border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)]"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                  Quantity
                </label>
                <input
                  name="quantity"
                  defaultValue={item.quantity}
                  required
                  className="input-touch w-full border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                  Unit
                </label>
                <input
                  name="unit"
                  defaultValue={item.unit}
                  required
                  className="input-touch w-full border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)]"
                />
              </div>
            </div>
          </form>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => markPantryItemUsedUp(item.id))}
              className="btn-primary-touch border-2 border-[var(--border-strong)] bg-[var(--surface-elevated)] text-[var(--foreground)] disabled:opacity-50"
            >
              Mark used up
            </button>
            <button
              type="button"
              onClick={() => setShowMore((v) => !v)}
              className="btn-primary-touch border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)]"
            >
              {showMore ? "Hide details" : "More details"}
            </button>
          </div>
          {showMore && (
            <div className="space-y-3 rounded-xl border border-[var(--border-strong)] bg-[var(--surface-inset)] p-3">
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                  Expiry
                </label>
                <input
                  form={`pantry-edit-${item.id}`}
                  name="expirationDate"
                  type="date"
                  defaultValue={item.expirationDate ?? ""}
                  className="input-touch w-full border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                  Location
                </label>
                <datalist id={`pantry-loc-${item.id}`}>
                  {locationSuggestions.map((loc) => (
                    <option key={loc} value={loc} />
                  ))}
                </datalist>
                <input
                  form={`pantry-edit-${item.id}`}
                  name="location"
                  list={`pantry-loc-${item.id}`}
                  defaultValue={item.location ?? ""}
                  autoComplete="off"
                  className="input-touch w-full border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                  Low stock threshold
                </label>
                <input
                  form={`pantry-edit-${item.id}`}
                  name="lowStockThreshold"
                  defaultValue={item.lowStockThreshold ?? ""}
                  className="input-touch w-full border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)]"
                />
              </div>
            </div>
          )}
          <div className="border-t border-dashed border-[var(--border)] pt-4">
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (!confirm("Remove this item from the pantry?")) return;
                run(() => deletePantryItem(item.id));
              }}
              className="tap-target w-full justify-start text-base font-semibold text-[var(--danger)] disabled:opacity-50"
            >
              Delete item
            </button>
          </div>
        </div>
      </MobileSheet>
    </>
  );
}
