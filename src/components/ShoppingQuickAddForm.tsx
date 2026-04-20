"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addShoppingItem } from "@/actions/shopping";
import {
  ChipSelect,
  DEFAULT_UNIT_OPTIONS,
  mergeChipOptions,
} from "@/components/ui/ChipSelect";
import { IconPlus } from "@/components/ui/icons";

/**
 * Replacement for the inline "Add item…" input on /shop.
 *
 * Keeps the one-line "type and tap Add" flow for common cases, but reveals
 * optional quantity + unit chips inline so users never have to type a unit.
 */
export function ShoppingQuickAddForm({
  unitSuggestions = [],
  recentNames = [],
}: {
  unitSuggestions?: string[];
  recentNames?: string[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [pending, startTransition] = useTransition();

  const unitOptions = mergeChipOptions(DEFAULT_UNIT_OPTIONS, unitSuggestions);

  function submit(formData: FormData) {
    startTransition(async () => {
      await addShoppingItem(formData);
      setName("");
      setQty("");
      setUnit("");
      setShowDetails(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <form
        action={submit}
        className="flex items-center gap-2 rounded-full border border-[var(--border-strong)] bg-[var(--surface)] px-2 py-1"
      >
        <input
          name="name"
          required
          placeholder="Add item…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="min-w-0 flex-1 bg-transparent px-3 py-3 text-base outline-none"
          autoComplete="off"
        />
        <input type="hidden" name="quantity" value={qty} readOnly />
        <input type="hidden" name="unit" value={unit} readOnly />
        <button
          type="button"
          onClick={() => setShowDetails((v) => !v)}
          aria-pressed={showDetails}
          className="tap-target rounded-full px-3 text-sm font-medium text-[var(--muted)]"
        >
          {showDetails ? "Hide" : "Details"}
        </button>
        <button
          type="submit"
          disabled={pending || !name.trim()}
          className="ui-btn ui-btn--primary h-11 px-4 text-sm disabled:opacity-50"
        >
          {pending ? "…" : "Add"}
        </button>
      </form>

      {/* One-tap add from recent items — zero typing for repeat buys */}
      {recentNames.length > 0 && (
        <div className="ui-chip-row flex-wrap !overflow-visible">
          <span className="mr-1 self-center text-xs uppercase tracking-wide text-[var(--muted)]">
            Recent:
          </span>
          {recentNames.slice(0, 8).map((n) => (
            <button
              key={n}
              type="button"
              className="ui-chip ui-chip--compact"
              onClick={() => {
                const fd = new FormData();
                fd.set("name", n);
                fd.set("quantity", "");
                fd.set("unit", "");
                submit(fd);
              }}
              disabled={pending}
              title={`Add ${n}`}
            >
              <IconPlus size={14} /> {n}
            </button>
          ))}
        </div>
      )}

      {showDetails && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-inset)] p-3">
          <div className="flex items-center gap-2">
            <input
              inputMode="decimal"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="Qty"
              className="input-touch w-24 rounded-lg border border-[var(--border-strong)] bg-[var(--background)]"
              aria-label="Quantity"
            />
            <div className="min-w-0 flex-1">
              <ChipSelect
                options={unitOptions}
                value={unit}
                onChange={setUnit}
                ariaLabel="Unit"
                emptyLabel="No unit"
              />
            </div>
          </div>
          <p className="mt-2 text-xs text-[var(--muted)]">
            Qty and unit are optional — most entries don&apos;t need them.
          </p>
        </div>
      )}
    </div>
  );
}
