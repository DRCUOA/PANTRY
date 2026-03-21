import { describe, expect, it } from "vitest";
import { findBestPantryItemId, normalizePantryName, scaledIngredientAmount } from "./pantry-match";

describe("normalizePantryName", () => {
  it("trims and lowercases", () => {
    expect(normalizePantryName("  Brown Rice  ")).toBe("brown rice");
  });
});

describe("findBestPantryItemId", () => {
  const pantry = [
    { id: 1, name: "Milk" },
    { id: 2, name: "Brown Rice" },
  ];

  it("matches exact normalized", () => {
    expect(findBestPantryItemId(pantry, "milk")).toBe(1);
  });

  it("matches partial", () => {
    expect(findBestPantryItemId(pantry, "rice")).toBe(2);
  });
});

describe("scaledIngredientAmount", () => {
  it("scales by servings", () => {
    expect(scaledIngredientAmount("2", 2, 1)).toBe(1);
    expect(scaledIngredientAmount("4", 2, 2)).toBe(4);
  });

  it("returns 0 for missing qty", () => {
    expect(scaledIngredientAmount(null, 2, 1)).toBe(0);
  });
});
