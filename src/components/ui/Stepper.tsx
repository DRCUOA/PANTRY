"use client";

import { IconMinus, IconPlus } from "./icons";

export function Stepper({
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  size = "md",
  unit,
  disabled,
  ariaLabel,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
  size?: "sm" | "md";
  unit?: string | null;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const dec = () => {
    const next = Math.max(min, round(value - step));
    if (next !== value) onChange(next);
  };
  const inc = () => {
    const next = max == null ? round(value + step) : Math.min(max, round(value + step));
    if (next !== value) onChange(next);
  };
  return (
    <div className="ui-stepper" role="group" aria-label={ariaLabel ?? "Quantity"}>
      <button
        type="button"
        className="ui-stepper__btn"
        onClick={dec}
        disabled={disabled || value <= min}
        aria-label="Decrease"
        style={size === "sm" ? { width: 36, height: 36 } : undefined}
      >
        <IconMinus size={size === "sm" ? 18 : 20} />
      </button>
      <span className="ui-stepper__value" aria-live="polite">
        {formatVal(value)}
        {unit ? <span className="ml-1 text-xs font-normal opacity-70">{unit}</span> : null}
      </span>
      <button
        type="button"
        className="ui-stepper__btn"
        onClick={inc}
        disabled={disabled || (max != null && value >= max)}
        aria-label="Increase"
        style={size === "sm" ? { width: 36, height: 36 } : undefined}
      >
        <IconPlus size={size === "sm" ? 18 : 20} />
      </button>
    </div>
  );
}

function round(n: number) {
  return Math.round(n * 1000) / 1000;
}

function formatVal(n: number) {
  if (!Number.isFinite(n)) return "0";
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(n < 1 ? 2 : 1).replace(/\.?0+$/, "");
}
