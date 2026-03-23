import { describe, expect, it } from "vitest";
import { normalizeIngredientAmount } from "./ingredient-amount";

describe("normalizeIngredientAmount", () => {
  it("keeps simple numeric quantities", () => {
    expect(normalizeIngredientAmount("2", "cups")).toEqual({
      quantity: "2",
      unit: "cups",
    });
  });

  it("parses fractional quantities", () => {
    expect(normalizeIngredientAmount("1/2", "cup")).toEqual({
      quantity: "0.5",
      unit: "cup",
    });
    expect(normalizeIngredientAmount("1 1/2", "tbsp")).toEqual({
      quantity: "1.5",
      unit: "tbsp",
    });
  });

  it("moves non-numeric descriptors into unit when unit is otherwise empty", () => {
    expect(normalizeIngredientAmount("to taste", null)).toEqual({
      quantity: null,
      unit: "to taste",
    });
  });

  it("drops invalid quantity text when a separate unit already exists", () => {
    expect(normalizeIngredientAmount("about two", "cups")).toEqual({
      quantity: null,
      unit: "cups",
    });
  });
});
