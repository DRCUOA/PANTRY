import { describe, expect, it } from "vitest";
import { rankSundayBestMatches } from "@/services/suggestion.engine";

describe("rankSundayBestMatches", () => {
  it("prioritizes expiring coverage and returns only top 3", () => {
    const ranked = rankSundayBestMatches({
      userId: 42,
      slotContext: { slotDate: "2026-03-29", mealType: "dinner" },
      pantry: [
        { name: "spinach", expirationDate: "2026-03-30", quantity: 3, lowStockThreshold: 1 },
        { name: "chicken", expirationDate: "2026-04-02", quantity: 4, lowStockThreshold: 1 },
        { name: "rice", expirationDate: "2026-05-01", quantity: 2, lowStockThreshold: 1 },
        { name: "tomato", expirationDate: "2026-04-01", quantity: 2, lowStockThreshold: 1 },
      ],
      recipes: [
        {
          id: 1,
          title: "Spinach Chicken Bowl",
          ingredients: [
            { pantryItemName: "spinach" },
            { pantryItemName: "chicken" },
            { pantryItemName: "rice" },
          ],
        },
        {
          id: 2,
          title: "Tomato Rice",
          ingredients: [{ pantryItemName: "tomato" }, { pantryItemName: "rice" }],
        },
        {
          id: 3,
          title: "Chicken Salad",
          ingredients: [{ pantryItemName: "chicken" }, { pantryItemName: "spinach" }],
        },
        {
          id: 4,
          title: "Toast",
          ingredients: [{ pantryItemName: "bread" }],
        },
      ],
      varietyMetadata: [{ recipeId: 2, daysSinceLastHad: 45 }],
    });

    expect(ranked).toHaveLength(3);
    expect(ranked.map((item) => item.id)).toEqual([1, 3, 2]);
    expect(ranked[0]?.explainabilityTags).toContain("Uses 2 expiring items");
    expect(ranked[0]?.explainabilityTags).toContain("High overstock reduction");
    expect(ranked[2]?.explainabilityTags).toContain("Variety boost (>28 days)");
  });

  it("uses required ingredients when optional lines exist", () => {
    const ranked = rankSundayBestMatches({
      userId: 42,
      slotContext: { slotDate: "2026-03-29", mealType: "breakfast" },
      pantry: [{ name: "eggs", expirationDate: "2026-03-29" }],
      recipes: [
        {
          id: 10,
          title: "Egg Plate",
          ingredients: [
            { pantryItemName: "eggs", optional: false },
            { pantryItemName: "chives", optional: true },
          ],
        },
      ],
    });

    expect(ranked[0]?.score).toBeGreaterThan(0);
    expect(ranked[0]?.explainabilityTags).toContain("Uses 1 expiring item");
    expect(ranked[0]?.explainabilityTags).toContain("Pantry match 100%");
  });
});
