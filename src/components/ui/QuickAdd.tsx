"use client";

import Link from "next/link";
import { useState } from "react";
import { addShoppingItem } from "@/actions/shopping";
import { createPantryItem } from "@/actions/pantry";
import { IconBarcode, IconKeyboard, IconShop } from "./icons";
import { SheetModal } from "./SheetModal";

/**
 * Center FAB: rounded-square basket icon that opens the quick-add sheet.
 * Designed to sit in the center slot of the TabBar grid.
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
