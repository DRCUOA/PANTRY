import { describe, expect, it } from "vitest";
import { isoDateSchema, parseMealPlanFormData, parseShoppingFormData } from "../payload-schemas";

function formDataFrom(values: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(values)) {
    fd.set(key, value);
  }
  return fd;
}

describe("parseMealPlanFormData", () => {
  it("coerces servings from decimal text", () => {
    const parsed = parseMealPlanFormData(
      formDataFrom({
        plannedDate: "2026-03-29",
        mealType: "dinner",
        servings: "2.5",
        recipeId: "none",
        notes: "",
      }),
    );

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.servings).toBe(2.5);
      expect(parsed.data.recipeId).toBeNull();
    }
  });

  it("treats empty and none recipe ids as null", () => {
    const emptyParsed = parseMealPlanFormData(
      formDataFrom({
        plannedDate: "2026-03-29",
        mealType: "breakfast",
        servings: "1",
        recipeId: "",
        notes: "ok",
      }),
    );
    const noneParsed = parseMealPlanFormData(
      formDataFrom({
        plannedDate: "2026-03-29",
        mealType: "breakfast",
        servings: "1",
        recipeId: "none",
        notes: "ok",
      }),
    );

    expect(emptyParsed.success).toBe(true);
    expect(noneParsed.success).toBe(true);
    if (emptyParsed.success && noneParsed.success) {
      expect(emptyParsed.data.recipeId).toBeNull();
      expect(noneParsed.data.recipeId).toBeNull();
    }
  });

  it("rejects non-numeric servings", () => {
    const parsed = parseMealPlanFormData(
      formDataFrom({
        plannedDate: "2026-03-29",
        mealType: "lunch",
        servings: "abc",
        recipeId: "1",
        notes: "",
      }),
    );

    expect(parsed.success).toBe(false);
  });
});

describe("parseShoppingFormData", () => {
  it("coerces quantity from decimal text", () => {
    const parsed = parseShoppingFormData(
      formDataFrom({
        name: "Milk",
        quantity: "2.5",
        unit: "L",
        pantryItemId: "none",
      }),
    );

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.quantity).toBe(2.5);
      expect(parsed.data.pantryItemId).toBeNull();
    }
  });

  it("treats empty pantryItemId as null", () => {
    const parsed = parseShoppingFormData(
      formDataFrom({
        name: "Rice",
        quantity: "",
        unit: "kg",
        pantryItemId: "",
      }),
    );

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.pantryItemId).toBeNull();
      expect(parsed.data.quantity).toBeNull();
    }
  });

  it("rejects non-numeric quantity", () => {
    const parsed = parseShoppingFormData(
      formDataFrom({
        name: "Rice",
        quantity: "two",
        unit: "kg",
        pantryItemId: "1",
      }),
    );

    expect(parsed.success).toBe(false);
  });
});

describe("isoDateSchema", () => {
  it("rejects impossible calendar dates", () => {
    expect(isoDateSchema.safeParse("2026-02-31").success).toBe(false);
    expect(isoDateSchema.safeParse("2026-02-28").success).toBe(true);
  });
});
