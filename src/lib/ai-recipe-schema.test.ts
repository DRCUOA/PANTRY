import { describe, expect, it } from "vitest";
import { aiRecipeDraftBatchFixture, pantryAiContextFixtures } from "./ai-recipe-fixtures";
import {
  aiRecipeDraftBatchSchema,
  buildAiRecipeUserPrompt,
  splitAiRecipeIngredients,
} from "./ai-recipe-schema";

describe("aiRecipeDraftBatchSchema", () => {
  it("accepts a valid pantry-aware draft batch", () => {
    const parsed = aiRecipeDraftBatchSchema.safeParse(aiRecipeDraftBatchFixture);
    expect(parsed.success).toBe(true);
  });

  it("rejects drafts with unsupported ingredient source", () => {
    const invalid = {
      drafts: [
        {
          ...aiRecipeDraftBatchFixture.drafts[0],
          ingredients: [
            {
              pantryItemName: "Eggs",
              quantity: "2",
              unit: "each",
              optional: false,
              source: "unknown",
            },
          ],
        },
      ],
    };
    const parsed = aiRecipeDraftBatchSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });
});

describe("splitAiRecipeIngredients", () => {
  it("separates pantry ingredients from missing ingredients", () => {
    const draft = aiRecipeDraftBatchFixture.drafts[0]!;
    const split = splitAiRecipeIngredients(draft);
    expect(split.pantry).toHaveLength(3);
    expect(split.missing).toHaveLength(1);
    expect(split.missing[0]!.pantryItemName).toBe("Parmesan");
  });
});

describe("buildAiRecipeUserPrompt", () => {
  it("includes expiring fixtures and pantry names in the prompt payload", () => {
    const prompt = buildAiRecipeUserPrompt(pantryAiContextFixtures.expiring);
    expect(prompt).toContain("Mushrooms");
    expect(prompt).toContain("Cream");
    expect(prompt).toContain("vegetarian");
  });
});
