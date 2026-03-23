import {
  aiRecipeDraftBatchSchema,
  buildAiRecipeInstructions,
  buildAiRecipeJsonSchema,
  buildAiRecipeUserPrompt,
  type AiRecipeDraftBatch,
  type PantryAiContext,
} from "@/lib/ai-recipe-schema";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_OPENAI_MODEL = "gpt-5-mini";

type FetchLike = typeof fetch;

type OpenAIResponsesPayload = {
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  error?: {
    message?: string;
  };
};

export class OpenAIConfigError extends Error {}
export class OpenAIResponseError extends Error {}

function getOpenAIConfig() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new OpenAIConfigError("OPENAI_API_KEY is not configured");
  }
  return {
    apiKey,
    model: process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL,
  };
}

function extractOutputText(payload: OpenAIResponsesPayload): string {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text;
  }

  for (const item of payload.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && typeof content.text === "string" && content.text.trim()) {
        return content.text;
      }
    }
  }

  if (payload.error?.message) {
    throw new OpenAIResponseError(payload.error.message);
  }

  throw new OpenAIResponseError("OpenAI returned no structured text output");
}

export async function generateAiRecipeDraftBatchWithOpenAI(
  context: PantryAiContext,
  fetchImpl: FetchLike = fetch,
): Promise<AiRecipeDraftBatch> {
  const { apiKey, model } = getOpenAIConfig();
  const response = await fetchImpl(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      store: false,
      input: [
        {
          role: "system",
          content: buildAiRecipeInstructions(),
        },
        {
          role: "user",
          content: buildAiRecipeUserPrompt(context),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "pantry_recipe_drafts",
          description: "Recipe drafts generated from a household pantry snapshot",
          schema: buildAiRecipeJsonSchema(),
          strict: true,
        },
      },
    }),
  });

  const payload = (await response.json()) as OpenAIResponsesPayload;
  if (!response.ok) {
    throw new OpenAIResponseError(payload.error?.message || `OpenAI request failed (${response.status})`);
  }

  const outputText = extractOutputText(payload);
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(outputText);
  } catch {
    throw new OpenAIResponseError("OpenAI returned invalid JSON for recipe drafts");
  }

  const parsed = aiRecipeDraftBatchSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new OpenAIResponseError(parsed.error.issues[0]?.message || "OpenAI recipe drafts did not match the required schema");
  }

  return parsed.data;
}
