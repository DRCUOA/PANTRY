import type { StockState } from "@/services/_shared/stock-state";

const STOCK_STATE_META: Record<StockState, { icon: string; label: string }> = {
  out: { icon: "⛔", label: "Out of stock" },
  low: { icon: "⚠", label: "Low stock" },
  handled: { icon: "✓", label: "Handled" },
};

export function StockStateBadge({ state }: { state: StockState }) {
  const meta = STOCK_STATE_META[state];

  return (
    <span className={`stock-state-badge stock-state-badge--${state}`} aria-label={meta.label}>
      <span aria-hidden="true" className="stock-state-badge__icon">
        {meta.icon}
      </span>
      <span>{meta.label}</span>
    </span>
  );
}
