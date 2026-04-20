"use client";

import { useState } from "react";

/**
 * Tap-first expiry picker.
 *
 * Most pantry items fall into a few buckets (Today, a few days, a week or
 * two, a month). A native `<input type="date">` forces the user into a
 * 3-tap calendar dialog every time. This component offers one-tap presets
 * that resolve to an ISO-YYYY-MM-DD date relative to the current local
 * day, plus a "Custom" fallback that still exposes the native picker.
 *
 * `value` / `onChange` trade in the same ISO string (`""` for "no expiry")
 * that the server action expects.
 */

function isoAddDays(n: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isoAddMonths(n: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setMonth(d.getMonth() + n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const PRESETS: { label: string; resolve: () => string }[] = [
  { label: "Today", resolve: () => isoAddDays(0) },
  { label: "3 days", resolve: () => isoAddDays(3) },
  { label: "1 week", resolve: () => isoAddDays(7) },
  { label: "2 weeks", resolve: () => isoAddDays(14) },
  { label: "1 month", resolve: () => isoAddMonths(1) },
  { label: "3 months", resolve: () => isoAddMonths(3) },
];

function parseIso(iso: string): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function summarize(iso: string): string {
  const d = parseIso(iso);
  if (!d) return "No expiry";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days > 0 && days < 7) return `${days} days`;
  if (days > 0 && days < 32) return `${days} days`;
  return iso;
}

export function ExpiryQuickPicker({
  value,
  onChange,
  name,
  ariaLabel = "Expiry",
}: {
  value: string;
  onChange: (next: string) => void;
  /** Optional hidden input name for native form submits. */
  name?: string;
  ariaLabel?: string;
}) {
  const [customOpen, setCustomOpen] = useState(false);

  // Which preset (if any) currently matches the selected value?
  const presetMatch = PRESETS.find((p) => p.resolve() === value);
  const isNone = value === "";
  const isCustom = !isNone && !presetMatch;

  return (
    <div className="ui-chip-picker" aria-label={ariaLabel}>
      {name !== undefined && (
        <input type="hidden" name={name} value={value} readOnly />
      )}
      <div className="ui-chip-row flex-wrap !overflow-visible" role="radiogroup">
        <button
          type="button"
          role="radio"
          aria-checked={isNone}
          className="ui-chip ui-chip--compact"
          data-active={isNone ? "true" : undefined}
          onClick={() => {
            onChange("");
            setCustomOpen(false);
          }}
        >
          No expiry
        </button>
        {PRESETS.map((preset) => {
          const active = presetMatch?.label === preset.label;
          return (
            <button
              key={preset.label}
              type="button"
              role="radio"
              aria-checked={active}
              className="ui-chip ui-chip--compact"
              data-active={active ? "true" : undefined}
              onClick={() => {
                onChange(preset.resolve());
                setCustomOpen(false);
              }}
            >
              {preset.label}
            </button>
          );
        })}
        <button
          type="button"
          role="radio"
          aria-checked={isCustom || customOpen}
          className="ui-chip ui-chip--compact"
          data-active={isCustom || customOpen ? "true" : undefined}
          onClick={() => setCustomOpen((v) => !v || !isCustom)}
        >
          {isCustom ? `Custom: ${summarize(value)}` : "Custom…"}
        </button>
      </div>
      {(customOpen || isCustom) && (
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input-touch w-full rounded-lg border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)]"
          aria-label="Custom expiry date"
        />
      )}
    </div>
  );
}
