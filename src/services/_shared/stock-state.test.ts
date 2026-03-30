import { describe, expect, it } from "vitest";
import { getPantryStockState, getShoppingStockState } from "@/services/_shared/stock-state";

describe("stock-state helper", () => {
  it("returns out for empty pantry quantities", () => {
    expect(getPantryStockState("0", "2")).toBe("out");
    expect(getPantryStockState(-1, null)).toBe("out");
  });

  it("returns low when quantity is positive and at/below threshold", () => {
    expect(getPantryStockState("2", "2")).toBe("low");
    expect(getPantryStockState("1", "2")).toBe("low");
  });

  it("returns handled for adequately stocked pantry items", () => {
    expect(getPantryStockState("3", "2")).toBe("handled");
    expect(getPantryStockState("5", null)).toBe("handled");
  });

  it("maps bought shopping items to handled and others to out", () => {
    expect(getShoppingStockState("bought")).toBe("handled");
    expect(getShoppingStockState("needed")).toBe("out");
  });
});
