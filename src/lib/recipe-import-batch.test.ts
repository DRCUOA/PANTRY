import { describe, expect, it } from "vitest";
import {
  annotateBatchItems,
  canAutoMapCsv,
  parseRecipeCsvBatch,
  parseRecipeJsonBatch,
  validateBatchImportSize,
} from "./recipe-import-batch";

describe("parseRecipeJsonBatch", () => {
  it("parses a top-level array of recipes", () => {
    const text = JSON.stringify([
      { title: "A", ingredients: [{ pantryItemName: "flour" }] },
      { title: "B", ingredients: [{ pantryItemName: "salt" }] },
    ]);
    const { items, errors, warnings } = parseRecipeJsonBatch(text);
    expect(items).toHaveLength(2);
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
    expect(items[0]!.draft.title).toBe("A");
    expect(items[1]!.draft.title).toBe("B");
    expect(items[0]!.sourceLabel).toBe("Item 1");
    expect(items[1]!.sourceLabel).toBe("Item 2");
  });

  it("parses an object with a `recipes` array", () => {
    const text = JSON.stringify({
      recipes: [
        { title: "A", ingredients: [{ pantryItemName: "flour" }] },
        { title: "B", ingredients: [{ pantryItemName: "salt" }] },
      ],
    });
    const { items, errors } = parseRecipeJsonBatch(text);
    expect(items).toHaveLength(2);
    expect(errors).toEqual([]);
  });

  it("accepts a single recipe object as a one-item batch with warning", () => {
    const text = JSON.stringify({ title: "Solo", ingredients: [{ pantryItemName: "x" }] });
    const { items, warnings } = parseRecipeJsonBatch(text);
    expect(items).toHaveLength(1);
    expect(warnings.some((w) => /single recipe/i.test(w))).toBe(true);
  });

  it("records per-item errors and continues", () => {
    const text = JSON.stringify([
      { title: "Good", ingredients: [{ pantryItemName: "flour" }] },
      null,
      "bogus",
    ]);
    const { items, errors } = parseRecipeJsonBatch(text);
    expect(items).toHaveLength(1);
    expect(errors).toHaveLength(2);
    expect(errors[0]!.sourceIndex).toBe(1);
    expect(errors[1]!.sourceIndex).toBe(2);
  });

  it("throws on invalid JSON", () => {
    expect(() => parseRecipeJsonBatch("not json")).toThrow(/invalid json/i);
  });

  it("throws on an empty array", () => {
    expect(() => parseRecipeJsonBatch("[]")).toThrow(/no recipes/i);
  });
});

describe("parseRecipeCsvBatch", () => {
  const header =
    'title,ingredients,servings,meal_type\n';

  it("builds one draft per data row", () => {
    const text =
      header +
      '"Pasta","[{""pantryItemName"":""pasta""}]",4,dinner\n' +
      '"Omelet","[{""pantryItemName"":""eggs""}]",2,breakfast\n';
    const { items, errors } = parseRecipeCsvBatch(text, {
      title: "title",
      ingredients: "ingredients",
      servings: "servings",
      mealType: "meal_type",
    });
    expect(items).toHaveLength(2);
    expect(errors).toEqual([]);
    expect(items[0]!.draft.title).toBe("Pasta");
    expect(items[0]!.draft.mealType).toBe("dinner");
    expect(items[1]!.draft.title).toBe("Omelet");
    expect(items[0]!.sourceLabel).toBe("Row 2");
    expect(items[1]!.sourceLabel).toBe("Row 3");
  });

  it("reports rows missing title as errors and skips them", () => {
    const text =
      header +
      ',"[{""pantryItemName"":""x""}]",4,dinner\n' +
      '"Good","[{""pantryItemName"":""y""}]",2,breakfast\n';
    const { items, errors } = parseRecipeCsvBatch(text, {
      title: "title",
      ingredients: "ingredients",
      servings: "servings",
      mealType: "meal_type",
    });
    expect(items).toHaveLength(1);
    expect(items[0]!.draft.title).toBe("Good");
    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toMatch(/title/i);
  });

  it("reports rows with empty ingredients as errors", () => {
    const text = header + '"NoIngredients","",1,dinner\n';
    const { items, errors } = parseRecipeCsvBatch(text, {
      title: "title",
      ingredients: "ingredients",
      servings: "servings",
      mealType: "meal_type",
    });
    expect(items).toEqual([]);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toMatch(/ingredients/i);
  });

  it("throws when required column map is missing", () => {
    expect(() =>
      parseRecipeCsvBatch("x\n1\n", { ingredients: "x" }),
    ).toThrow(/title.*ingredients/i);
  });
});

describe("canAutoMapCsv", () => {
  it("returns ok when both title and ingredients are detected", () => {
    const r = canAutoMapCsv(["title", "ingredients", "servings"]);
    expect(r.ok).toBe(true);
    expect(r.map.title).toBe("title");
    expect(r.map.ingredients).toBe("ingredients");
  });

  it("returns not-ok if either required column is missing", () => {
    const r = canAutoMapCsv(["name", "servings"]);
    expect(r.ok).toBe(false);
  });
});

describe("annotateBatchItems", () => {
  const pantryRows = [
    { id: 1, name: "Whole milk" },
    { id: 2, name: "Almond milk" },
  ];
  const validIds = new Set([1, 2]);

  it("clears invalid pantryItemIds and emits a warning", () => {
    const { items } = parseRecipeJsonBatch(
      JSON.stringify([
        {
          title: "Bad id",
          ingredients: [{ pantryItemId: 999, pantryItemName: "milk" }],
        },
      ]),
    );
    const annotated = annotateBatchItems(items, pantryRows, validIds);
    expect(annotated).toHaveLength(1);
    expect(annotated[0]!.draft.ingredients[0]!.pantryItemId).toBeNull();
    expect(
      annotated[0]!.warnings.some((w) => /not in your pantry/i.test(w)),
    ).toBe(true);
  });

  it("generates questions for ambiguous ingredient names", () => {
    const { items } = parseRecipeJsonBatch(
      JSON.stringify([{ title: "Shake", ingredients: [{ pantryItemName: "milk" }] }]),
    );
    const annotated = annotateBatchItems(items, pantryRows, validIds);
    expect(annotated[0]!.questions).toHaveLength(1);
    expect(annotated[0]!.questions[0]!.candidates).toHaveLength(2);
  });
});

describe("validateBatchImportSize", () => {
  it("rejects strings larger than 2 MB", () => {
    const big = "x".repeat(2 * 1024 * 1024 + 1);
    expect(validateBatchImportSize(big)).toMatch(/too large/i);
  });
  it("accepts small strings", () => {
    expect(validateBatchImportSize("small")).toBeNull();
  });
});
