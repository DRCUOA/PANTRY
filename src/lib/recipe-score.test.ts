import { describe, expect, it } from "vitest";
import { scoreRecipes } from "./recipe-score";

describe("scoreRecipes", () => {
  it("prefers recipes with more pantry matches", () => {
    const recipes = [
      {
        id: 1,
        title: "A",
        ingredients: [{ pantryItemName: "eggs", optional: false }],
      },
      {
        id: 2,
        title: "B",
        ingredients: [
          { pantryItemName: "eggs", optional: false },
          { pantryItemName: "milk", optional: false },
        ],
      },
    ];
    const pantry = [
      { name: "Eggs", expirationDate: null },
      { name: "Milk", expirationDate: null },
    ];
    const ranked = scoreRecipes(recipes, pantry, 7);
    expect(ranked[0]!.recipe.id).toBe(2);
  });
});
