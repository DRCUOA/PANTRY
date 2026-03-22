"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createRecipe } from "@/actions/recipes";
import type { PantryPickerRow } from "@/actions/pantry";
import { RecipeMealTypePicker } from "@/components/RecipeMealTypePicker";
import type { RecipeMealTypeValue } from "@/lib/recipe-meal-types";

type Line = {
  pickId: string;
  customName: string;
  quantity: string;
  unit: string;
  optional: boolean;
};

function emptyLine(): Line {
  return { pickId: "", customName: "", quantity: "", unit: "", optional: false };
}

export function RecipeNewForm({ pantryOptions }: { pantryOptions: PantryPickerRow[] }) {
  const router = useRouter();
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [mealType, setMealType] = useState<RecipeMealTypeValue>("breakfast");
  const [pending, setPending] = useState(false);

  function addLine() {
    setLines((L) => [...L, emptyLine()]);
  }

  function setPick(i: number, idStr: string) {
    setLines((L) =>
      L.map((x, j) => {
        if (j !== i) return x;
        if (idStr === "" || idStr === "custom") {
          return {
            ...x,
            pickId: idStr,
            customName: idStr === "custom" ? x.customName : "",
          };
        }
        const p = pantryOptions.find((o) => String(o.id) === idStr);
        return {
          ...x,
          pickId: idStr,
          customName: "",
          unit: x.unit || p?.unit || "",
          quantity: x.quantity || p?.quantity || "",
        };
      }),
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const payload = lines
          .map((l) => {
            if (l.pickId !== "" && l.pickId !== "custom") {
              return {
                pantryItemId: Number(l.pickId),
                pantryItemName: null as string | null,
                quantity: l.quantity || null,
                unit: l.unit || null,
                optional: l.optional,
              };
            }
            const n = l.customName.trim();
            if (!n) return null;
            return {
              pantryItemId: null as number | null,
              pantryItemName: n,
              quantity: l.quantity || null,
              unit: l.unit || null,
              optional: l.optional,
            };
          })
          .filter((x): x is NonNullable<typeof x> => x != null);
        fd.set("ingredients_json", JSON.stringify(payload));
        setPending(true);
        try {
          const r = await createRecipe(fd);
          if (r.ok) router.push("/plan");
        } finally {
          setPending(false);
        }
      }}
    >
      <div>
        <label className="mb-1 block text-sm font-medium">Title</label>
        <input
          name="title"
          required
          className="input-touch w-full border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)]"
        />
      </div>
      <input type="hidden" name="meal_type" value={mealType} readOnly />
      <RecipeMealTypePicker value={mealType} onChange={setMealType} idPrefix="new-recipe-meal" />
      <div>
        <label className="mb-1 block text-sm font-medium">Description</label>
        <textarea
          name="description"
          rows={2}
          className="input-touch min-h-[88px] w-full resize-y border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)]"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Instructions</label>
        <textarea
          name="instructions"
          rows={4}
          className="input-touch min-h-[140px] w-full resize-y border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)]"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-xs font-medium">Servings (base)</label>
          <input
            name="servings"
            type="number"
            min={1}
            defaultValue={1}
            className="input-touch w-full border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)]"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Prep min</label>
          <input
            name="prepTimeMinutes"
            type="number"
            min={0}
            className="input-touch w-full border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)]"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-xs font-medium">Cal / serving</label>
          <input
            name="caloriesPerServing"
            type="number"
            min={0}
            className="input-touch w-full border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)]"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Protein g / serving</label>
          <input
            name="proteinGPerServing"
            type="text"
            className="input-touch w-full border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)]"
          />
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium">Ingredients</span>
          <button
            type="button"
            onClick={addLine}
            className="tap-target rounded-lg px-3 text-sm font-semibold text-[var(--accent)]"
          >
            + Add line
          </button>
        </div>
        <ul className="space-y-2">
          {lines.map((line, i) => (
            <li key={i} className="receipt-card p-3">
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Pantry item</label>
              <select
                value={line.pickId}
                onChange={(e) => setPick(i, e.target.value)}
                className="input-touch mb-2 w-full border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)]"
              >
                <option value="">Select from pantry…</option>
                {pantryOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.quantity} {p.unit})
                  </option>
                ))}
                <option value="custom">Other (not in pantry)…</option>
              </select>
              {(line.pickId === "custom" || (line.pickId === "" && pantryOptions.length === 0)) && (
                <input
                  placeholder="Ingredient name"
                  value={line.customName}
                  onChange={(e) => {
                    const v = e.target.value;
                    setLines((L) => L.map((x, j) => (j === i ? { ...x, customName: v, pickId: "custom" } : x)));
                  }}
                  className="input-touch mb-2 w-full border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted)]"
                />
              )}
              <div className="flex flex-wrap items-center gap-2">
                <input
                  placeholder="Qty"
                  value={line.quantity}
                  onChange={(e) => {
                    const v = e.target.value;
                    setLines((L) => L.map((x, j) => (j === i ? { ...x, quantity: v } : x)));
                  }}
                  className="input-touch w-24 border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)]"
                />
                <input
                  placeholder="Unit"
                  value={line.unit}
                  onChange={(e) => {
                    const v = e.target.value;
                    setLines((L) => L.map((x, j) => (j === i ? { ...x, unit: v } : x)));
                  }}
                  className="input-touch min-w-[6rem] flex-1 border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)]"
                />
                <label className="flex items-center gap-1 text-xs text-[var(--muted)]">
                  <input
                    type="checkbox"
                    checked={line.optional}
                    onChange={(e) => {
                      const v = e.target.checked;
                      setLines((L) => L.map((x, j) => (j === i ? { ...x, optional: v } : x)));
                    }}
                  />
                  Optional
                </label>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="btn-primary-touch w-full bg-[var(--accent)] font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save recipe"}
      </button>
    </form>
  );
}
