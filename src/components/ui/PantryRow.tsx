"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deletePantryItem, markPantryItemUsedUp, updatePantryItem } from "@/actions/pantry";
import type { PantryItemDTO } from "@/components/PantryEditSheet";
import {
  ChipSelect,
  DEFAULT_LOCATION_OPTIONS,
  DEFAULT_UNIT_OPTIONS,
  mergeChipOptions,
} from "./ChipSelect";
import { ExpiryQuickPicker } from "./ExpiryQuickPicker";
import { IconCheck, IconTrash } from "./icons";
import { SheetModal } from "./SheetModal";
import { Stepper } from "./Stepper";
import { SwipeRow } from "./SwipeRow";
import { UndoSnackbar } from "./UndoSnackbar";

function parseDate(d: string | null) {
  if (!d) return null;
  const [y, m, day] = d.split("-").map(Number);
  if (!y || !m || !day) return null;
  return new Date(y, m - 1, day);
}

function daysUntil(iso: string | null): number | null {
  const d = parseDate(iso);
  if (!d) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const MS = 86400000;
  return Math.round((d.getTime() - now.getTime()) / MS);
}

function formatExpiry(iso: string | null) {
  const days = daysUntil(iso);
  if (days == null) return null;
  if (days < 0) return { label: `${Math.abs(days)}d past`, tone: "danger" as const };
  if (days === 0) return { label: "Today", tone: "warn" as const };
  if (days === 1) return { label: "Tomorrow", tone: "warn" as const };
  if (days <= 3) return { label: `${days}d left`, tone: "warn" as const };
  if (days <= 14) return { label: `${days}d left`, tone: "muted" as const };
  return { label: iso!, tone: "muted" as const };
}

function toNumber(raw: string | null | undefined, fallback = 0) {
  if (raw == null || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export function PantryRow({
  item,
  locationSuggestions = [],
  unitSuggestions = [],
  onShoppingList = false,
}: {
  item: PantryItemDTO;
  locationSuggestions?: string[];
  unitSuggestions?: string[];
  onShoppingList?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<null | {
    kind: "used" | "deleted";
    snapshot: PantryItemDTO;
  }>(null);

  // Tap-first edit state. Seeded from `item` when the sheet opens.
  const [editLocation, setEditLocation] = useState(item.location ?? "");
  const [editUnit, setEditUnit] = useState(item.unit);
  const [editExpiry, setEditExpiry] = useState(item.expirationDate ?? "");
  const [editName, setEditName] = useState(item.name);
  const [editQty, setEditQty] = useState<number>(toNumber(item.quantity));
  const [editLowThreshold, setEditLowThreshold] = useState(
    item.lowStockThreshold ?? "",
  );

  function openEdit() {
    // Refresh sheet state from the current item whenever it re-opens.
    setEditName(item.name);
    setEditQty(toNumber(item.quantity));
    setEditUnit(item.unit);
    setEditLocation(item.location ?? "");
    setEditExpiry(item.expirationDate ?? "");
    setEditLowThreshold(item.lowStockThreshold ?? "");
    setOpen(true);
  }

  const locationOptions = mergeChipOptions(
    DEFAULT_LOCATION_OPTIONS,
    locationSuggestions,
  );
  const unitOptions = mergeChipOptions(DEFAULT_UNIT_OPTIONS, unitSuggestions);

  const qty = toNumber(item.quantity);
  const lowThreshold = item.lowStockThreshold != null ? Number(item.lowStockThreshold) : null;
  const isOut = qty <= 0;
  const isOnList = isOut && onShoppingList;
  const isLow = !isOut && lowThreshold != null && qty <= lowThreshold;
  const expiry = formatExpiry(item.expirationDate);

  function submitField(updates: Partial<PantryItemDTO>) {
    const fd = new FormData();
    const merged = { ...item, ...updates };
    fd.set("id", String(merged.id));
    fd.set("name", merged.name);
    fd.set("quantity", merged.quantity);
    fd.set("unit", merged.unit);
    fd.set("category", merged.category ?? "");
    fd.set("location", merged.location ?? "");
    fd.set("barcode", merged.barcode ?? "");
    fd.set("expirationDate", merged.expirationDate ?? "");
    fd.set("lowStockThreshold", merged.lowStockThreshold ?? "");
    fd.set("productId", merged.productId == null ? "" : String(merged.productId));
    fd.set("notes", merged.notes ?? "");
    startTransition(async () => {
      await updatePantryItem(fd);
      router.refresh();
    });
  }

  function doUsedUp() {
    setToast({ kind: "used", snapshot: item });
    startTransition(async () => {
      await markPantryItemUsedUp(item.id);
      router.refresh();
    });
  }

  function doDelete() {
    setToast({ kind: "deleted", snapshot: item });
    startTransition(async () => {
      await deletePantryItem(item.id);
      router.refresh();
    });
  }

  const metaBits: string[] = [];
  if (isOnList) metaBits.push("On shopping list");
  if (item.location) metaBits.push(item.location);
  if (expiry) metaBits.push(expiry.label);

  return (
    <>
      <SwipeRow
        leftAction={{
          label: "Used up",
          icon: <IconCheck size={16} />,
          onAction: doUsedUp,
        }}
        rightAction={{
          label: "Delete",
          icon: <IconTrash size={16} />,
          onAction: () => {
            if (confirm(`Remove ${item.name}?`)) doDelete();
          },
        }}
      >
        <div
          className={`ui-item-row${isOut && !isOnList ? " opacity-70" : ""}`}
          style={
            isOnList
              ? { borderColor: "var(--stock-on-list-fg)", boxShadow: "inset 3px 0 0 var(--stock-on-list-fg)" }
              : isLow
                ? { borderColor: "var(--stock-low-fg)", boxShadow: "inset 3px 0 0 var(--stock-low-fg)" }
                : isOut
                  ? { borderColor: "var(--stock-out-fg)", boxShadow: "inset 3px 0 0 var(--stock-out-fg)" }
                  : undefined
          }
        >
          <button
            type="button"
            onClick={openEdit}
            className="min-w-0 flex-1 text-left"
            aria-label={`Edit ${item.name}`}
            data-no-swipe
          >
            <div className="ui-item-row__title">{item.name}</div>
            <div className="ui-item-row__meta">
              {item.quantity} {item.unit}
              {metaBits.length > 0 && (
                <>
                  {" · "}
                  <span
                    className={
                      expiry?.tone === "danger"
                        ? "text-[var(--danger)] font-semibold"
                        : expiry?.tone === "warn"
                          ? "text-[var(--warn)] font-semibold"
                          : ""
                    }
                  >
                    {metaBits.join(" · ")}
                  </span>
                </>
              )}
            </div>
          </button>
          <div className="ui-item-row__trailing" data-no-swipe>
            <Stepper
              value={qty}
              step={guessStep(item.unit)}
              min={0}
              size="sm"
              disabled={pending}
              ariaLabel={`${item.name} quantity`}
              onChange={(next) => submitField({ quantity: String(next) })}
            />
          </div>
        </div>
      </SwipeRow>

      <SheetModal
        open={open}
        onClose={() => setOpen(false)}
        title={item.name}
        description={`${item.quantity} ${item.unit}${item.location ? " · " + item.location : ""}`}
        footer={
          <div className="flex gap-2">
            <button
              type="button"
              className="ui-btn ui-btn--danger flex-1"
              disabled={pending}
              onClick={() => {
                if (confirm(`Remove ${item.name}?`)) {
                  setOpen(false);
                  doDelete();
                }
              }}
            >
              <IconTrash size={18} /> Delete
            </button>
            <button
              type="submit"
              form={`pantry-edit-${item.id}`}
              className="ui-btn ui-btn--primary flex-[2]"
              disabled={pending}
            >
              Save
            </button>
          </div>
        }
      >
        <form
          id={`pantry-edit-${item.id}`}
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            startTransition(async () => {
              await updatePantryItem(fd);
              setOpen(false);
              router.refresh();
            });
          }}
        >
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="productId" value={item.productId ?? ""} />
          <input type="hidden" name="barcode" value={item.barcode ?? ""} />
          <input type="hidden" name="category" value={item.category ?? ""} />
          <input type="hidden" name="notes" value={item.notes ?? ""} />
          <input type="hidden" name="quantity" value={String(editQty)} readOnly />
          <input
            type="hidden"
            name="lowStockThreshold"
            value={editLowThreshold}
            readOnly
          />

          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
              Name
            </span>
            <input
              name="name"
              required
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="input-touch w-full rounded-lg border border-[var(--border-strong)] bg-[var(--background)]"
            />
          </label>

          <div>
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
              Quantity
            </span>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-inset)] px-3 py-2">
              <Stepper
                value={editQty}
                step={guessStep(editUnit)}
                min={0}
                unit={editUnit}
                ariaLabel={`${item.name} quantity`}
                onChange={setEditQty}
              />
            </div>
          </div>

          <div>
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
              Unit
            </span>
            <ChipSelect
              name="unit"
              options={unitOptions}
              value={editUnit}
              onChange={setEditUnit}
              ariaLabel="Unit"
              emptyLabel="—"
            />
          </div>

          <div>
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
              Location
            </span>
            <ChipSelect
              name="location"
              options={locationOptions}
              value={editLocation}
              onChange={setEditLocation}
              ariaLabel="Location"
              emptyLabel="Unsorted"
            />
          </div>

          <div>
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
              Expiry
            </span>
            <ExpiryQuickPicker
              name="expirationDate"
              value={editExpiry}
              onChange={setEditExpiry}
            />
          </div>

          <details className="rounded-xl border border-[var(--border)] bg-[var(--surface-inset)]">
            <summary className="tap-target cursor-pointer select-none list-none px-3 text-sm font-medium text-[var(--muted)]">
              More options
            </summary>
            <div className="px-3 pb-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                  Low stock at
                </span>
                <input
                  inputMode="decimal"
                  value={editLowThreshold}
                  onChange={(e) => setEditLowThreshold(e.target.value)}
                  placeholder="e.g. 1"
                  className="input-touch w-full rounded-lg border border-[var(--border-strong)] bg-[var(--background)]"
                />
              </label>
            </div>
          </details>

          <button
            type="button"
            className="ui-btn ui-btn--ghost w-full"
            disabled={pending}
            onClick={() => {
              setOpen(false);
              doUsedUp();
            }}
          >
            <IconCheck size={18} /> Mark used up
          </button>
        </form>
      </SheetModal>

      {toast && (
        <UndoSnackbar
          message={
            toast.kind === "used"
              ? `${toast.snapshot.name} marked used up`
              : `${toast.snapshot.name} deleted`
          }
          action={{
            label: "Undo",
            onAction: () => {
              const fd = new FormData();
              const snap = toast.snapshot;
              fd.set("id", String(snap.id));
              fd.set("name", snap.name);
              fd.set("quantity", snap.quantity);
              fd.set("unit", snap.unit);
              fd.set("category", snap.category ?? "");
              fd.set("location", snap.location ?? "");
              fd.set("barcode", snap.barcode ?? "");
              fd.set("expirationDate", snap.expirationDate ?? "");
              fd.set("lowStockThreshold", snap.lowStockThreshold ?? "");
              fd.set("productId", snap.productId == null ? "" : String(snap.productId));
              fd.set("notes", snap.notes ?? "");
              startTransition(async () => {
                await updatePantryItem(fd);
                router.refresh();
              });
            },
          }}
          onDismiss={() => setToast(null)}
        />
      )}
    </>
  );
}

function guessStep(unit: string): number {
  const u = unit.trim().toLowerCase();
  if (["each", "unit", "pc", "piece", "pack", "tin", "can", "box", "bottle"].some((x) => u.includes(x))) return 1;
  if (["kg", "lb", "l"].some((x) => u === x)) return 0.1;
  if (["g", "ml", "oz"].some((x) => u === x)) return 25;
  return 1;
}

// `pantrySectionFor` lives in `@/lib/pantry-section` so it can be imported from
// Server Components. Don't re-export it from this `"use client"` module.
