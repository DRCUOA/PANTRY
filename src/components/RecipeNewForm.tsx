"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createRecipe } from "@/actions/recipes";

type Line = { pantryItemName: string; quantity: string; unit: string; optional: boolean };

export function RecipeNewForm() {
  const router = useRouter();
  const [lines, setLines] = useState<Line[]>([
    { pantryItemName: "", quantity: "", unit: "", optional: false },
  ]);
  const [pending, setPending] = useState(false);

  function addLine() {
    setLines((L) => [...L, { pantryItemName: "", quantity: "", unit: "", optional: false }]);
  }

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const payload = lines
          .filter((l) => l.pantryItemName.trim())
          .map((l) => ({
            pantryItemName: l.pantryItemName.trim(),
            quantity: l.quantity || null,
            unit: l.unit || null,
            optional: l.optional,
          }));
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
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Description</label>
        <textarea
          name="description"
          rows={2}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Instructions</label>
        <textarea
          name="instructions"
          rows={4}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
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
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Prep min</label>
          <input
            name="prepTimeMinutes"
            type="number"
            min={0}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
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
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Protein g / serving</label>
          <input
            name="proteinGPerServing"
            type="text"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium">Ingredients</span>
          <button type="button" onClick={addLine} className="text-sm text-[var(--accent)]">
            + Add line
          </button>
        </div>
        <ul className="space-y-2">
          {lines.map((line, i) => (
            <li key={i} className="rounded-lg border border-[var(--border)] p-2">
              <input
                placeholder="Name (match pantry item)"
                value={line.pantryItemName}
                onChange={(e) => {
                  const v = e.target.value;
                  setLines((L) => L.map((x, j) => (j === i ? { ...x, pantryItemName: v } : x)));
                }}
                className="mb-2 w-full rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm"
              />
              <div className="flex gap-2">
                <input
                  placeholder="Qty"
                  value={line.quantity}
                  onChange={(e) => {
                    const v = e.target.value;
                    setLines((L) => L.map((x, j) => (j === i ? { ...x, quantity: v } : x)));
                  }}
                  className="w-20 rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm"
                />
                <input
                  placeholder="Unit"
                  value={line.unit}
                  onChange={(e) => {
                    const v = e.target.value;
                    setLines((L) => L.map((x, j) => (j === i ? { ...x, unit: v } : x)));
                  }}
                  className="w-24 flex-1 rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm"
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
        className="w-full rounded-xl bg-[var(--accent)] py-3 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save recipe"}
      </button>
    </form>
  );
}
