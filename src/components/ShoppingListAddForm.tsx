"use client";

import { useState } from "react";
import { addShoppingItem } from "@/actions/shopping";
import type { PantryPickerRow } from "@/actions/pantry";

export function ShoppingListAddForm({ pantryOptions }: { pantryOptions: PantryPickerRow[] }) {
  const [pickId, setPickId] = useState("");
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [pending, setPending] = useState(false);

  const fromPantry = pickId !== "" && pickId !== "custom";

  function applyPantrySelection(idStr: string) {
    setPickId(idStr);
    if (idStr && idStr !== "custom") {
      const p = pantryOptions.find((x) => String(x.id) === idStr);
      if (p) {
        setName(p.name);
        setQuantity(p.quantity);
        setUnit(p.unit);
      }
      return;
    }
    if (idStr === "custom") {
      setName("");
      setQuantity("");
      setUnit("");
    }
  }

  return (
    <form
      className="mt-3 flex flex-col gap-3"
      action={async (fd) => {
        setPending(true);
        try {
          await addShoppingItem(fd);
          setPickId("");
          setName("");
          setQuantity("");
          setUnit("");
        } finally {
          setPending(false);
        }
      }}
    >
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
          Item
        </label>
        <select
          value={pickId}
          disabled={pending}
          onChange={(e) => applyPantrySelection(e.target.value)}
          className="input-touch w-full border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)]"
          aria-label="Choose pantry item or custom"
        >
          <option value="">Select from pantry…</option>
          {pantryOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.quantity} {p.unit})
            </option>
          ))}
          <option value="custom">Custom (type name)…</option>
        </select>
      </div>
      {(pickId === "custom" || pickId === "") && (
        <input
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Item name"
          disabled={pending}
          className="input-touch w-full border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted)]"
        />
      )}
      {pickId !== "" && pickId !== "custom" && <input type="hidden" name="name" value={name} readOnly />}
      <input
        type="hidden"
        name="pantryItemId"
        value={pickId && pickId !== "custom" ? pickId : ""}
      />
      <div className="flex flex-wrap gap-2">
        <input
          name="quantity"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="Qty"
          disabled={pending}
          className="input-touch min-w-[100px] flex-1 border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted)]"
        />
        <input
          name="unit"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          placeholder="Unit"
          disabled={pending}
          className="input-touch w-28 border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted)]"
        />
        <button
          type="submit"
          disabled={pending || (!fromPantry && !name.trim())}
          className="btn-primary-touch bg-[var(--accent)] text-white disabled:opacity-50"
        >
          {pending ? "…" : "Add"}
        </button>
      </div>
    </form>
  );
}
