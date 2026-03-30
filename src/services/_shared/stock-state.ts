export type StockState = "handled" | "low" | "out";

const EPSILON = 0.000001;

function toNumber(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function getPantryStockState(
  quantity: number | string,
  lowStockThreshold: number | string | null | undefined,
): StockState {
  const quantityValue = toNumber(quantity) ?? 0;
  if (quantityValue <= EPSILON) return "out";

  const thresholdValue = toNumber(lowStockThreshold);
  if (thresholdValue != null && quantityValue <= thresholdValue) {
    return "low";
  }

  return "handled";
}

export function getShoppingStockState(status: string): StockState {
  return status === "bought" ? "handled" : "out";
}
