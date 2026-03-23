import { afterEach, describe, expect, it, vi } from "vitest";
import { aiRecipeDraftBatchFixture, pantryAiContextFixtures } from "./ai-recipe-fixtures";
import {
  generateAiRecipeDraftBatchWithOpenAI,
  OpenAIConfigError,
  OpenAIResponseError,
} from "./openai";

const ORIGINAL_API_KEY = process.env.OPENAI_API_KEY;
const ORIGINAL_MODEL = process.env.OPENAI_MODEL;

describe("generateAiRecipeDraftBatchWithOpenAI", () => {
  afterEach(() => {
    if (ORIGINAL_API_KEY === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = ORIGINAL_API_KEY;
    }

    if (ORIGINAL_MODEL === undefined) {
      delete process.env.OPENAI_MODEL;
    } else {
      process.env.OPENAI_MODEL = ORIGINAL_MODEL;
    }
  });

  it("throws when the API key is missing", async () => {
    delete process.env.OPENAI_API_KEY;
    await expect(
      generateAiRecipeDraftBatchWithOpenAI(pantryAiContextFixtures.small, vi.fn()),
    ).rejects.toBeInstanceOf(OpenAIConfigError);
  });

  it("parses structured draft JSON from the Responses API payload", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.OPENAI_MODEL = "gpt-5-mini";
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.store).toBe(false);
      expect(body.model).toBe("gpt-5-mini");
      expect(body.text.format.type).toBe("json_schema");
      expect(body.text.format.strict).toBe(true);
      return new Response(
        JSON.stringify({
          output: [
            {
              type: "message",
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify(aiRecipeDraftBatchFixture),
                },
              ],
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    const result = await generateAiRecipeDraftBatchWithOpenAI(
      pantryAiContextFixtures.expiring,
      fetchMock,
    );
    expect(result.drafts[0]!.title).toBe("Creamy Mushroom Pasta");
  });

  it("throws a controlled error when the provider returns malformed JSON", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          output_text: "{not-json}",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    await expect(
      generateAiRecipeDraftBatchWithOpenAI(pantryAiContextFixtures.medium, fetchMock),
    ).rejects.toBeInstanceOf(OpenAIResponseError);
  });
});
