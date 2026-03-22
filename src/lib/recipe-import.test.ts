import { describe, expect, it } from "vitest";
import {
  autoMapCsvHeaders,
  draftToIngredientLines,
  parseCsv,
  parseRecipeJson,
} from "./recipe-import";

describe("parseRecipeJson", () => {
  it("parses template-shaped JSON", () => {
    const j = JSON.stringify({
      title: "T",
      ingredients: [{ pantryItemName: "flour", quantity: "2", unit: "cups", optional: false }],
    });
    const { draft, warnings } = parseRecipeJson(j);
    expect(draft.title).toBe("T");
    expect(draft.ingredients).toHaveLength(1);
    expect(draft.ingredients[0]!.rawName).toBe("flour");
    expect(draft.mealType).toBeNull();
    expect(warnings).toEqual([]);
  });

  it("warns on multiple recipes in array", () => {
    const j = JSON.stringify([{ title: "A", ingredients: [] }, { title: "B", ingredients: [] }]);
    const { draft, warnings } = parseRecipeJson(j);
    expect(draft.title).toBe("A");
    expect(warnings.some((w) => /first/i.test(w))).toBe(true);
  });
});

describe("parseCsv", () => {
  it("parses comma-separated header and row", () => {
    const { headers, rows } = parseCsv("a,b,c\n1,2,3\n");
    expect(headers).toEqual(["a", "b", "c"]);
    expect(rows).toEqual([["1", "2", "3"]]);
  });

  it("parses quoted fields", () => {
    const { headers, rows } = parseCsv('title,ingredients\n"Hearty soup","[{""pantryItemName"":""salt""}]"');
    expect(headers).toEqual(["title", "ingredients"]);
    expect(rows[0]![0]).toBe("Hearty soup");
    expect(rows[0]![1]).toBe('[{"pantryItemName":"salt"}]');
  });
});

describe("autoMapCsvHeaders", () => {
  it("maps common synonyms", () => {
    const m = autoMapCsvHeaders(["Recipe Name", "ingredients_json", "prep_min"]);
    expect(m.title).toBe("Recipe Name");
    expect(m.ingredients).toBe("ingredients_json");
    expect(m.prepTimeMinutes).toBe("prep_min");
  });
});

describe("draftToIngredientLines", () => {
  const pantry = [
    { id: 1, name: "Whole milk" },
    { id: 2, name: "Almond milk" },
  ];
  const validIds = new Set([1, 2]);

  it("requires an answer when multiple pantry matches exist", () => {
    const draft = {
      title: "x",
      description: null,
      instructions: null,
      servings: null,
      prepTimeMinutes: null,
      caloriesPerServing: null,
      proteinGPerServing: null,
      mealType: null,
      ingredients: [
        {
          key: "ing-0",
          rawName: "milk",
          quantity: "1",
          unit: "cup",
          optional: false,
          pantryItemId: null,
        },
      ],
    };
    const r = draftToIngredientLines(draft, pantry, validIds, {});
    expect(r.ok).toBe(false);
  });

  it("applies answer id", () => {
    const draft = {
      title: "x",
      description: null,
      instructions: null,
      servings: null,
      prepTimeMinutes: null,
      caloriesPerServing: null,
      proteinGPerServing: null,
      mealType: null,
      ingredients: [
        {
          key: "ing-0",
          rawName: "milk",
          quantity: "1",
          unit: "cup",
          optional: false,
          pantryItemId: null,
        },
      ],
    };
    const r = draftToIngredientLines(draft, pantry, validIds, { "ing-0": "2" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.lines[0]!.pantryItemId).toBe(2);
    }
  });
});
