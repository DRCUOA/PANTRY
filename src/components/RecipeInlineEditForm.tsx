"use client";

import { useState } from "react";
import { updateRecipe } from "@/actions/recipes";
import type { PantryPickerRow } from "@/actions/pantry";
import { findBestPantryItemId } from "@/lib/pantry-match";
import { RecipeMealTypePicker } from "@/components/RecipeMealTypePicker";
import type { PlanRecipeDetail } from "@/lib/plan-recipe";
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

function linesFromDetail(detail: PlanRecipeDetail, pantryOptions: PantryPickerRow[]): Line[] {
  const pantryIds = pantryOptions.map((p) => ({ id: p.id, name: p.name }));
  if (!detail.ingredients.length) return [emptyLine()];
  return detail.ingredients.map((ing) => {
    const matchId = findBestPantryItemId(pantryIds, ing.pantryItemName);
    if (matchId != null) {
      return {
        pickId: String(matchId),
        customName: "",
        quantity: ing.quantity ?? "",
        unit: ing.unit ?? "",
        optional: ing.optional,
      };
    }
    return {
      pickId: "custom",
      customName: ing.pantryItemName,
      quantity: ing.quantity ?? "",
      unit: ing.unit ?? "",
      optional: ing.optional,
    };
  });
}

export function RecipeInlineEditForm({
  recipeId,
  detail,
  pantryOptions,
  onSaved,
  onCancel,
}: {
  recipeId: number;
  detail: PlanRecipeDetail;
  pantryOptions: PantryPickerRow[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [lines, setLines] = useState<Line[]>(() => linesFromDetail(detail, pantryOptions));
  const [mealType, setMealType] = useState<RecipeMealTypeValue>(() => detail.mealType);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const defServings = detail.servings ?? 1;
  const defPrep = detail.prepTimeMinutes ?? "";
  const defCal = detail.caloriesPerServing ?? "";
  const defProt = detail.proteinGPerServing ?? "";

  return (
    <form
      className="mt-4 space-y-3 border-t border-[var(--border-strong)] pt-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
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
          const r = await updateRecipe(recipeId, fd);
          if (!r.ok) {
            setError(r.error);
            return;
          }
          onSaved();
        } finally {
          setPending(false);
        }
      }}
    >
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      <input type="hidden" name="meal_type" value={mealType} readOnly />
      <RecipeMealTypePicker value={mealType} onChange={setMealType} idPrefix={`edit-${recipeId}`} />
      <div>
        <label className="mb-1 block text-xs font-medium">Title</label>
        <input
          name="title"
          required
          defaultValue={detail.title}
          className="input-touch w-full border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)]"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium">Description</label>
        <textarea
          name="description"
          rows={2}
          defaultValue={detail.description ?? ""}
          className="input-touch min-h-[72px] w-full resize-y border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)]"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium">Instructions</label>
        <textarea
          name="instructions"
          rows={4}
          defaultValue={detail.instructions ?? ""}
          className="input-touch min-h-[120px] w-full resize-y border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)]"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-[0.65rem] font-medium">Servings (base)</label>
          <input
            name="servings"
            type="number"
            min={1}
            defaultValue={defServings}
            className="input-touch w-full border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)]"
          />
        </div>
        <div>
          <label className="mb-1 block text-[0.65rem] font-medium">Prep min</label>
          <input
            name="prepTimeMinutes"
            type="number"
            min={0}
            defaultValue={defPrep === "" ? "" : defPrep}
            className="input-touch w-full border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)]"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-[0.65rem] font-medium">Cal / serving</label>
          <input
            name="caloriesPerServing"
            type="number"
            min={0}
            defaultValue={defCal === "" ? "" : defCal}
            className="input-touch w-full border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)]"
          />
        </div>
        <div>
          <label className="mb-1 block text-[0.65rem] font-medium">Protein g / serving</label>
          <input
            name="proteinGPerServing"
            type="text"
            defaultValue={defProt}
            className="input-touch w-full border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)]"
          />
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium">Ingredients</span>
          <button
            type="button"
            onClick={addLine}
            className="tap-target rounded-lg px-2 text-xs font-semibold text-[var(--accent)]"
          >
            + Add line
          </button>
        </div>
        <ul className="max-h-[40vh] space-y-2 overflow-y-auto pr-1">
          {lines.map((line, i) => (
            <li key={i} className="receipt-card p-2">
              <label className="mb-1 block text-[0.65rem] font-medium text-[var(--muted)]">Pantry item</label>
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
                  className="input-touch w-20 border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)]"
                />
                <input
                  placeholder="Unit"
                  value={line.unit}
                  onChange={(e) => {
                    const v = e.target.value;
                    setLines((L) => L.map((x, j) => (j === i ? { ...x, unit: v } : x)));
                  }}
                  className="input-touch min-w-[5rem] flex-1 border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)]"
                />
                <label className="flex items-center gap-1 text-[0.65rem] text-[var(--muted)]">
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

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending}
          className="btn-primary-touch flex-1 rounded-lg bg-[var(--accent)] py-2.5 font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save recipe"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onCancel}
          className="tap-target rounded-lg border border-[var(--border-strong)] px-4 py-2.5 text-sm font-medium"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
