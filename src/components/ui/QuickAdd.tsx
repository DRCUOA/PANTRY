"use client";

import Link from "next/link";
import { useState } from "react";
import { addShoppingItem } from "@/actions/shopping";
import { createPantryItem } from "@/actions/pantry";
import { IconBarcode, IconKeyboard, IconPlus, IconShop } from "./icons";
import { SheetModal } from "./SheetModal";

/**
 * Global quick-add: floating action button that offers Scan / Type item / Add to shopping.
 * Type and shopping submit a server action inline; Scan just links to /scan.
 */
export function QuickAdd() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"root" | "type" | "shop">("root");

  return (
    <>
      <button
        type="button"
        aria-label="Quick add"
        onClick={() => {
          setMode("root");
          setOpen(true);
        }}
        className="fixed z-[45] inline-flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-2xl active:scale-95"
        style={{
          right: "max(1rem, env(safe-area-inset-right))",
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 5.25rem)",
          boxShadow: "0 10px 24px rgba(0,0,0,0.28), 0 0 32px var(--accent-glow)",
        }}
      >
        <IconPlus size={28} />
      </button>
      <SheetModal
        open={open}
        onClose={() => setOpen(false)}
        title={mode === "root" ? "Add something" : mode === "type" ? "Add pantry item" : "Add to shopping list"}
        description={mode === "root" ? "Scan a barcode, type it, or add to the shopping list." : undefined}
      >
        {mode === "root" && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Link
              href="/scan"
              onClick={() => setOpen(false)}
              className="ui-card flex flex-col items-start gap-2 p-4 active:bg-[var(--surface-inset)]"
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent-subtle)] text-[var(--accent)]">
                <IconBarcode />
              </span>
              <span className="font-semibold">Scan barcode</span>
              <span className="text-sm text-[var(--muted)]">
                Open the camera and drop it in your pantry.
              </span>
            </Link>
            <button
              type="button"
              onClick={() => setMode("type")}
              className="ui-card flex flex-col items-start gap-2 p-4 text-left active:bg-[var(--surface-inset)]"
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent-subtle)] text-[var(--accent)]">
                <IconKeyboard />
              </span>
              <span className="font-semibold">Type a pantry item</span>
              <span className="text-sm text-[var(--muted)]">Quick add without a barcode.</span>
            </button>
            <button
              type="button"
              onClick={() => setMode("shop")}
              className="ui-card flex flex-col items-start gap-2 p-4 text-left active:bg-[var(--surface-inset)]"
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent-subtle)] text-[var(--accent)]">
                <IconShop />
              </span>
              <span className="font-semibold">Add to shopping</span>
              <span className="text-sm text-[var(--muted)]">
                Remember to buy it next time.
              </span>
            </button>
          </div>
        )}
        {mode === "type" && (
          <form
            action={async (fd: FormData) => {
              await createPantryItem(fd);
              setOpen(false);
            }}
            className="space-y-3"
          >
            <input
              name="name"
              required
              autoFocus
              placeholder="Item name (e.g. Black beans)"
              className="input-touch w-full rounded-lg border border-[var(--border-strong)] bg-[var(--background)]"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                name="quantity"
                required
                inputMode="decimal"
                defaultValue="1"
                className="input-touch w-full rounded-lg border border-[var(--border-strong)] bg-[var(--background)]"
                aria-label="Quantity"
              />
              <input
                name="unit"
                required
                defaultValue="each"
                className="input-touch w-full rounded-lg border border-[var(--border-strong)] bg-[var(--background)]"
                aria-label="Unit"
              />
            </div>
            <input
              name="category"
              placeholder="Category (optional)"
              className="input-touch w-full rounded-lg border border-[var(--border-strong)] bg-[var(--background)]"
            />
            <input
              name="location"
              placeholder="Location (pantry / fridge / freezer)"
              className="input-touch w-full rounded-lg border border-[var(--border-strong)] bg-[var(--background)]"
            />
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
              setOpen(false);
            }}
            className="space-y-3"
          >
            <input
              name="name"
              required
              autoFocus
              placeholder="Item (e.g. Milk)"
              className="input-touch w-full rounded-lg border border-[var(--border-strong)] bg-[var(--background)]"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                name="quantity"
                inputMode="decimal"
                placeholder="Qty (optional)"
                className="input-touch w-full rounded-lg border border-[var(--border-strong)] bg-[var(--background)]"
                aria-label="Quantity"
              />
              <input
                name="unit"
                placeholder="Unit (optional)"
                className="input-touch w-full rounded-lg border border-[var(--border-strong)] bg-[var(--background)]"
                aria-label="Unit"
              />
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
