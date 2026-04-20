"use client";

import Link from "next/link";
import { useState } from "react";
import { addShoppingItem } from "@/actions/shopping";
import { createPantryItem } from "@/actions/pantry";
import {
  ChipSelect,
  DEFAULT_LOCATION_OPTIONS,
  DEFAULT_UNIT_OPTIONS,
  mergeChipOptions,
} from "./ChipSelect";
import { ExpiryQuickPicker } from "./ExpiryQuickPicker";
import { IconBarcode, IconKeyboard, IconShop } from "./icons";
import { SheetModal } from "./SheetModal";
import { Stepper } from "./Stepper";

/**
 * Center FAB: rounded-square basket icon that opens the quick-add sheet.
 * Designed to sit in the center slot of the TabBar grid.
 */
export function QuickAdd({
  locationSuggestions = [],
  unitSuggestions = [],
  defaultLocation = "",
}: {
  locationSuggestions?: string[];
  unitSuggestions?: string[];
  defaultLocation?: string;
} = {}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"root" | "type" | "shop">("root");
  // Pantry quick-add state (controlled so chip pickers can drive it).
  const [pLocation, setPLocation] = useState(defaultLocation);
  const [pUnit, setPUnit] = useState("each");
  const [pQty, setPQty] = useState(1);
  const [pExpiry, setPExpiry] = useState("");
  // Shopping quick-add state.
  const [sUnit, setSUnit] = useState("");
  const [sQty, setSQty] = useState("");

  const locationOptions = mergeChipOptions(
    DEFAULT_LOCATION_OPTIONS,
    locationSuggestions,
  );
  const unitOptions = mergeChipOptions(DEFAULT_UNIT_OPTIONS, unitSuggestions);

  function resetQuickForms() {
    setPLocation(defaultLocation);
    setPUnit("each");
    setPQty(1);
    setPExpiry("");
    setSUnit("");
    setSQty("");
  }

  return (
    <>
      <button
        type="button"
        aria-label="Quick add"
        onClick={() => {
          setMode("root");
          setOpen(true);
        }}
        className="relative -top-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent)] text-white active:scale-95"
        style={{
          boxShadow: "0 4px 20px rgba(0,0,0,0.25), 0 0 24px var(--accent-glow)",
        }}
      >
        {/* Inline basket+fork icon matching app logo */}
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M5.2 11h13.6l-1.2 8H6.4z" />
          <path d="M8 11 12 3l4 8" />
          <path d="M15 15l2-1" strokeWidth="1.8" />
          <path d="M15 17l1.5 1" strokeWidth="1.8" />
          <path d="M14.5 14.5l2.5 4" strokeWidth="1.8" />
        </svg>
      </button>
      <SheetModal
        open={open}
        onClose={() => setOpen(false)}
        title={mode === "root" ? "Add something" : mode === "type" ? "Add pantry item" : "Add to shopping list"}
      >
        {mode === "root" && (
          <div className="space-y-2">
            <Link
              href="/scan"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-xl px-4 py-3 active:bg-[var(--surface-inset)]"
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent-subtle)] text-[var(--accent)]">
                <IconBarcode size={20} />
              </span>
              <div>
                <p className="font-semibold">Scan barcode</p>
                <p className="text-sm text-[var(--muted)]">Add with your camera</p>
              </div>
            </Link>
            <button
              type="button"
              onClick={() => setMode("type")}
              className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left active:bg-[var(--surface-inset)]"
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent-subtle)] text-[var(--accent)]">
                <IconKeyboard size={20} />
              </span>
              <div>
                <p className="font-semibold">Type a pantry item</p>
                <p className="text-sm text-[var(--muted)]">Quick add without scanning</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setMode("shop")}
              className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left active:bg-[var(--surface-inset)]"
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent-subtle)] text-[var(--accent)]">
                <IconShop size={20} />
              </span>
              <div>
                <p className="font-semibold">Add to shopping</p>
                <p className="text-sm text-[var(--muted)]">Remember to buy it next time</p>
              </div>
            </button>
          </div>
        )}
        {mode === "type" && (
          <form
            action={async (fd: FormData) => {
              await createPantryItem(fd);
              resetQuickForms();
              setOpen(false);
            }}
            className="space-y-4"
          >
            <input type="hidden" name="category" value="" />
            <input type="hidden" name="quantity" value={String(pQty)} readOnly />
            <input
              type="hidden"
              name="expirationDate"
              value={pExpiry}
              readOnly
            />
            <input
              name="name"
              required
              autoFocus
              placeholder="Item name (e.g. Black beans)"
              className="input-touch w-full rounded-lg border border-[var(--border-strong)] bg-[var(--background)]"
            />
            <div>
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                Quantity
              </span>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-inset)] px-3 py-2">
                <Stepper
                  value={pQty}
                  step={pUnit === "g" || pUnit === "ml" ? 25 : 1}
                  min={0}
                  unit={pUnit}
                  onChange={setPQty}
                  ariaLabel="Quantity"
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
                value={pUnit}
                onChange={setPUnit}
                ariaLabel="Unit"
              />
            </div>
            <div>
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                Location
              </span>
              <ChipSelect
                name="location"
                options={locationOptions}
                value={pLocation}
                onChange={setPLocation}
                ariaLabel="Location"
                emptyLabel="Unsorted"
              />
            </div>
            <details className="rounded-xl border border-[var(--border)] bg-[var(--surface-inset)]">
              <summary className="tap-target cursor-pointer select-none list-none px-3 text-sm font-medium text-[var(--muted)]">
                Set expiry
              </summary>
              <div className="px-3 pb-3">
                <ExpiryQuickPicker value={pExpiry} onChange={setPExpiry} />
              </div>
            </details>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setMode("root")}
                className="ui-btn ui-btn--ghost flex-1"
              >
                Back
              </button>
              <button type="submit" className="ui-btn ui-btn--primary flex-[2]">
                Save to pantry
              </button>
            </div>
          </form>
        )}
        {mode === "shop" && (
          <form
            action={async (fd: FormData) => {
              await addShoppingItem(fd);
              resetQuickForms();
              setOpen(false);
            }}
            className="space-y-4"
          >
            <input type="hidden" name="quantity" value={sQty} readOnly />
            <input
              name="name"
              required
              autoFocus
              placeholder="Item (e.g. Milk)"
              className="input-touch w-full rounded-lg border border-[var(--border-strong)] bg-[var(--background)]"
            />
            <div className="flex items-center gap-2">
              <input
                inputMode="decimal"
                value={sQty}
                onChange={(e) => setSQty(e.target.value)}
                placeholder="Qty (optional)"
                className="input-touch w-24 rounded-lg border border-[var(--border-strong)] bg-[var(--background)]"
                aria-label="Quantity"
              />
              <div className="min-w-0 flex-1">
                <ChipSelect
                  name="unit"
                  options={unitOptions}
                  value={sUnit}
                  onChange={setSUnit}
                  ariaLabel="Unit"
                  emptyLabel="No unit"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setMode("root")}
                className="ui-btn ui-btn--ghost flex-1"
              >
                Back
              </button>
              <button type="submit" className="ui-btn ui-btn--primary flex-[2]">
                Add to list
              </button>
            </div>
          </form>
        )}
      </SheetModal>
    </>
  );
}
