"use client";

import {
  RECIPE_MEAL_TYPE_VALUES,
  formatMealTypeLabel,
  type RecipeMealTypeValue,
} from "@/lib/recipe-meal-types";

export function RecipeMealTypePicker({
  value,
  onChange,
  idPrefix = "meal",
}: {
  value: RecipeMealTypeValue;
  onChange: (next: RecipeMealTypeValue) => void;
  idPrefix?: string;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 block text-sm font-medium">Meal type</legend>
      <p className="text-xs text-[var(--muted)]">
        Recipe library tabs filter by this. Each recipe appears only under its meal type.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {RECIPE_MEAL_TYPE_VALUES.map((m) => (
          <label
            key={m}
            className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--border-strong)] px-3 py-2 text-sm has-[:checked]:border-[var(--accent)] has-[:checked]:bg-[var(--accent-subtle)]"
          >
            <input
              id={`${idPrefix}-${m}`}
              type="radio"
              checked={value === m}
              onChange={() => onChange(m)}
              className="h-4 w-4 border-[var(--border-strong)]"
            />
            {formatMealTypeLabel(m)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
