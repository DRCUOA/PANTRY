"use client";

import { useId, useState, type ReactNode } from "react";

export type ChipOption = {
  value: string;
  label: string;
  icon?: ReactNode;
  hint?: string;
};

/**
 * Tap-first segmented chip selector.
 *
 * Mobile-friendly replacement for `<input list>` and free-text fields where the
 * common answers are short (Location, Unit, Category). Tapping a chip commits
 * immediately; "Other…" reveals a free-text fallback for rare values.
 *
 * The parent owns `value`/`onChange` so the same input can be used with
 * controlled React state or a plain form `<input type="hidden">` mirror.
 */
export function ChipSelect({
  options,
  value,
  onChange,
  allowCustom = true,
  customPlaceholder = "Type to add…",
  ariaLabel,
  name,
  emptyLabel = "—",
  compact = false,
}: {
  options: ChipOption[];
  value: string;
  onChange: (next: string) => void;
  allowCustom?: boolean;
  customPlaceholder?: string;
  ariaLabel?: string;
  /** Optional hidden input name so the value is included in native form submits. */
  name?: string;
  emptyLabel?: string;
  compact?: boolean;
}) {
  const customInputId = useId();
  const knownValues = new Set(options.map((o) => o.value.trim().toLowerCase()));
  const valueTrim = value.trim();
  const isCustom =
    valueTrim !== "" && !knownValues.has(valueTrim.toLowerCase());
  const [typing, setTyping] = useState(isCustom);

  const chipCls = compact ? "ui-chip ui-chip--compact" : "ui-chip";

  return (
    <div className="ui-chip-picker" role="radiogroup" aria-label={ariaLabel}>
      {name !== undefined && (
        <input type="hidden" name={name} value={value} readOnly />
      )}
      <div className="ui-chip-row flex-wrap !overflow-visible">
        <button
          type="button"
          role="radio"
          aria-checked={valueTrim === ""}
          className={chipCls}
          data-active={valueTrim === "" ? "true" : undefined}
          onClick={() => {
            onChange("");
            setTyping(false);
          }}
        >
          {emptyLabel}
        </button>
        {options.map((opt) => {
          const active = valueTrim.toLowerCase() === opt.value.trim().toLowerCase();
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              className={chipCls}
              data-active={active ? "true" : undefined}
              onClick={() => {
                onChange(opt.value);
                setTyping(false);
              }}
              title={opt.hint}
            >
              {opt.icon}
              {opt.label}
            </button>
          );
        })}
        {allowCustom && (
          <button
            type="button"
            role="radio"
            aria-checked={isCustom || typing}
            className={chipCls}
            data-active={isCustom || typing ? "true" : undefined}
            onClick={() => setTyping((t) => !t || !isCustom)}
          >
            {isCustom ? `Other: ${valueTrim}` : "Other…"}
          </button>
        )}
      </div>
      {allowCustom && typing && (
        <input
          id={customInputId}
          autoFocus
          value={isCustom ? valueTrim : ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={customPlaceholder}
          className="input-touch mt-2 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)]"
          aria-label={ariaLabel ? `${ariaLabel}: custom` : "Custom value"}
        />
      )}
    </div>
  );
}

/** Common location options mirror the filter chips used on /pantry. */
export const DEFAULT_LOCATION_OPTIONS: ChipOption[] = [
  { value: "Pantry", label: "Pantry" },
  { value: "Fridge", label: "Fridge" },
  { value: "Freezer", label: "Freezer" },
  { value: "Counter", label: "Counter" },
  { value: "Cupboard", label: "Cupboard" },
  { value: "Spice rack", label: "Spice rack" },
];

/** Common unit options — covers >95% of single-household entries. */
export const DEFAULT_UNIT_OPTIONS: ChipOption[] = [
  { value: "each", label: "each" },
  { value: "pack", label: "pack" },
  { value: "can", label: "can" },
  { value: "bottle", label: "bottle" },
  { value: "jar", label: "jar" },
  { value: "g", label: "g" },
  { value: "kg", label: "kg" },
  { value: "ml", label: "ml" },
  { value: "l", label: "L" },
  { value: "tbsp", label: "tbsp" },
  { value: "tsp", label: "tsp" },
  { value: "cup", label: "cup" },
];

/**
 * Merge a server-provided list of seen values with the curated defaults.
 * De-duped case-insensitively, defaults first, then the user's custom values.
 */
export function mergeChipOptions(
  defaults: ChipOption[],
  extras: readonly string[],
): ChipOption[] {
  const seen = new Set(defaults.map((d) => d.value.trim().toLowerCase()));
  const merged: ChipOption[] = [...defaults];
  for (const raw of extras) {
    const v = raw?.trim();
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push({ value: v, label: v });
  }
  return merged;
}
