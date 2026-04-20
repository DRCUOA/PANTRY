"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createRecipe } from "@/actions/recipes";
import type { PantryPickerRow } from "@/actions/pantry";
import { RecipeMealTypePicker } from "@/components/RecipeMealTypePicker";
import {
  ChipSelect,
  DEFAULT_UNIT_OPTIONS,
  mergeChipOptions,
} from "@/components/ui/ChipSelect";
import { IconTrash } from "@/components/ui/icons";
import { SwipeRow } from "@/components/ui/SwipeRow";
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

export function RecipeNewForm({
  pantryOptions,
  unitSuggestions = [],
}: {
  pantryOptions: PantryPickerRow[];
  unitSuggestions?: string[];
}) {
  const router = useRouter();
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [mealType, setMealType] = useState<RecipeMealTypeValue>("breakfast");
  const [pending, setPending] = useState(false);
  const unitOptions = mergeChipOptions(DEFAULT_UNIT_OPTIONS, unitSuggestions);

  function addLine() {
    setLines((L) => [...L, emptyLine()]);
  }

  function removeLine(i: number) {
    setLines((L) => (L.length > 1 ? L.filter((_, j) => j !== i) : L));
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
      <details className="rounded-xl border border-[var(--border)] bg-[var(--surface-inset)]">
        <summary className="tap-target cursor-pointer select-none list-none px-3 text-sm font-medium text-[var(--muted)]">
          Nutrition (optional)
        </summary>
        <div className="grid grid-cols-2 gap-2 p-3 pt-0">
          <div>
            <label className="mb-1 block text-xs font-medium">Cal / serving</label>
            <input
              name="caloriesPerServing"
              type="number"
              min={0}
              inputMode="numeric"
              className="input-touch w-full border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Protein g / serving</label>
            <input
              name="proteinGPerServing"
              type="text"
              inputMode="decimal"
              className="input-touch w-full border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)]"
            />
          </div>
        </div>
      </details>

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
            <li key={i}>
              <SwipeRow
                rightAction={{
                  label: "Remove",
                  icon: <IconTrash size={16} />,
                  onAction: () => removeLine(i),
                }}
              >
                <div className="receipt-card space-y-2 p-3">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
                        Pantry item
                      </label>
                      <select
                        value={line.pickId}
                        onChange={(e) => setPick(i, e.target.value)}
                        className="input-touch w-full border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)]"
                        data-no-swipe
                      >
                        <option value="">Select from pantry…</option>
                        {pantryOptions.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.quantity} {p.unit})
                          </option>
                        ))}
                        <option value="custom">Other (not in pantry)…</option>
                      </select>
                    </div>
                    {lines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeLine(i)}
                        aria-label="Remove ingredient"
                        className="tap-target mt-5 shrink-0 rounded-lg border border-[var(--border)] text-[var(--muted)] active:bg-[var(--surface-inset)]"
                        data-no-swipe
                      >
                        <IconTrash size={18} />
                      </button>
                    )}
                  </div>
                  {(line.pickId === "custom" ||
                    (line.pickId === "" && pantryOptions.length === 0)) && (
                    <input
                      placeholder="Ingredient name"
                      value={line.customName}
                      onChange={(e) => {
                        const v = e.target.value;
                        setLines((L) =>
                          L.map((x, j) =>
                            j === i ? { ...x, customName: v, pickId: "custom" } : x,
                          ),
                        );
                      }}
                      className="input-touch w-full border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted)]"
                      data-no-swipe
                    />
                  )}
                  <div className="flex items-center gap-2" data-no-swipe>
                    <input
                      placeholder="Qty"
                      inputMode="decimal"
                      value={line.quantity}
                      onChange={(e) => {
                        const v = e.target.value;
                        setLines((L) =>
                          L.map((x, j) => (j === i ? { ...x, quantity: v } : x)),
                        );
                      }}
                      className="input-touch w-20 border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)]"
                    />
                    <div className="min-w-0 flex-1">
                      <ChipSelect
                        options={unitOptions}
                        value={line.unit}
                        onChange={(v) =>
                          setLines((L) =>
                            L.map((x, j) => (j === i ? { ...x, unit: v } : x)),
                          )
                        }
                        ariaLabel="Unit"
                        emptyLabel="—"
                      />
                    </div>
                  </div>
                  <label
                    className="flex items-center gap-2 text-xs text-[var(--muted)]"
                    data-no-swipe
                  >
                    <input
                      type="checkbox"
                      checked={line.optional}
                      onChange={(e) => {
                        const v = e.target.checked;
                        setLines((L) =>
                          L.map((x, j) => (j === i ? { ...x, optional: v } : x)),
                        );
                      }}
                    />
                    Optional ingredient
                  </label>
                </div>
              </SwipeRow>
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
