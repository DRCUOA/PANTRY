import { describe, expect, it } from "vitest";
import { buildRecipeRecency, computeVarietyRule } from "@/services/meal-plan.service";

describe("meal plan recipe recency", () => {
  const now = new Date("2026-03-30T00:00:00.000Z");

  it("computes days since recipe was seen in plan history", () => {
    const recency = buildRecipeRecency(
      [
        { id: 1, title: "Seen 7", lastHadDate: "2026-03-23" },
        { id: 2, title: "Seen 14", lastHadDate: "2026-03-16" },
        { id: 3, title: "Seen 27", lastHadDate: "2026-03-03" },
        { id: 4, title: "Seen 28", lastHadDate: "2026-03-02" },
        { id: 5, title: "Seen 32", lastHadDate: "2026-02-26" },
      ],
      now,
    );

    expect(recency.find((item) => item.recipeId === 1)?.daysSinceLastHad).toBe(7);
    expect(recency.find((item) => item.recipeId === 2)?.daysSinceLastHad).toBe(14);
    expect(recency.find((item) => item.recipeId === 3)?.daysSinceLastHad).toBe(27);
    expect(recency.find((item) => item.recipeId === 4)?.daysSinceLastHad).toBe(28);
    expect(recency.find((item) => item.recipeId === 5)?.daysSinceLastHad).toBe(32);
  });

  it("applies 28-day variety rule and never-seen fallback", () => {
    expect(computeVarietyRule(7)).toEqual({
      isVarietySafe: false,
      label: "Last had this 7 days ago",
    });

    expect(computeVarietyRule(27)).toEqual({
      isVarietySafe: false,
      label: "Last had this 27 days ago",
    });

    expect(computeVarietyRule(28)).toEqual({
      isVarietySafe: true,
      label: "Not seen in last 28 days",
    });

    expect(computeVarietyRule(32)).toEqual({
      isVarietySafe: true,
      label: "Not seen in last 28 days",
    });

    expect(computeVarietyRule(null)).toEqual({
      isVarietySafe: true,
      label: "Not seen in last 28 days",
    });
  });
});
