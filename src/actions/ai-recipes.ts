"use server";

import { asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { IngredientLineInput, RecipeBaseInput } from "@/lib/recipe-schemas";
import { getDb } from "@/db";
import { mealPlanEntries, pantryItems, recipes, userSettings } from "@/db/schema";
import { getSession } from "@/lib/get-session";
import { createRecipeFromStructuredInput } from "@/actions/recipes";
import {
  aiRecipeDraftSchema,
  type AiRecipeDraft,
  type PantryAiContext,
} from "@/lib/ai-recipe-schema";
import { generateAiRecipeDraftBatchWithOpenAI, OpenAIConfigError, OpenAIResponseError } from "@/lib/openai";
import { normalizeMealType, type RecipeMealTypeValue } from "@/lib/recipe-meal-types";

async function requireUserId(): Promise<number> {
  const session = await getSession();
  if (!session.isLoggedIn || session.userId == null) throw new Error("Unauthorized");
  return session.userId;
}

function toTodayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateIso: string, days: number) {
  const [year, month, day] = dateIso.split("-").map(Number);
  const next = new Date(year!, month! - 1, day! + days);
  const y = next.getFullYear();
  const m = String(next.getMonth() + 1).padStart(2, "0");
  const d = String(next.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function buildPantryAiContext(userId: number): Promise<PantryAiContext> {
  const db = getDb();
  const today = toTodayIso();
  const weekAhead = addDays(today, 7);

  const [pantryRows, settingsRows, recipeRows] = await Promise.all([
    db
      .select({
        name: pantryItems.name,
        quantity: pantryItems.quantity,
        unit: pantryItems.unit,
        location: pantryItems.location,
        expirationDate: pantryItems.expirationDate,
      })
      .from(pantryItems)
      .where(eq(pantryItems.userId, userId))
      .orderBy(asc(pantryItems.name)),
    db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1),
    db.select({ title: recipes.title }).from(recipes).where(eq(recipes.userId, userId)).orderBy(asc(recipes.title)),
  ]);

  const pantry = pantryRows.map((row) => {
    const expirationDate = row.expirationDate ?? null;
    const isExpiringSoon =
      expirationDate != null && expirationDate >= today && expirationDate <= weekAhead;
    return {
      name: row.name,
      quantity: String(row.quantity),
      unit: row.unit,
      location: row.location,
      expirationDate,
      isExpiringSoon,
    };
  });

  return {
    dietaryPreferences: settingsRows[0]?.dietaryPreferences ?? null,
    existingRecipeTitles: recipeRows.map((row) => row.title),
    pantryItems: pantry,
    expiringSoon: pantry
      .filter((item) => item.isExpiringSoon && item.expirationDate != null)
      .map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        expirationDate: item.expirationDate!,
      })),
  };
}

function draftToRecipeInput(draft: AiRecipeDraft): {
  base: RecipeBaseInput;
  ingredients: IngredientLineInput[];
  mealType: RecipeMealTypeValue;
} {
  return {
    base: {
      title: draft.title,
      description: draft.description,
      instructions: draft.instructions,
      servings: draft.servings,
      prepTimeMinutes: draft.prepTimeMinutes ?? null,
      caloriesPerServing: null,
      proteinGPerServing: null,
    },
    ingredients: draft.ingredients.map((ingredient) => ({
      pantryItemId: null,
      pantryItemName: ingredient.pantryItemName,
      quantity: ingredient.quantity,
      unit: ingredient.unit,
      optional: ingredient.optional,
    })),
    mealType: draft.mealType,
  };
}

export async function generateAiRecipeDrafts() {
  const userId = await requireUserId();
  const context = await buildPantryAiContext(userId);

  if (context.pantryItems.length === 0) {
    return {
      ok: false as const,
      error: "Add pantry items first so AI can draft recipes from your current stock.",
    };
  }

  try {
    const draftBatch = await generateAiRecipeDraftBatchWithOpenAI(context);
    return {
      ok: true as const,
      drafts: draftBatch.drafts,
      pantryCount: context.pantryItems.length,
      expiringCount: context.expiringSoon.length,
    };
  } catch (error) {
    if (error instanceof OpenAIConfigError || error instanceof OpenAIResponseError) {
      return { ok: false as const, error: error.message };
    }
    return {
      ok: false as const,
      error: "Could not generate recipe drafts right now. Try again in a moment.",
    };
  }
}

export async function saveAiRecipeDraft(draftInput: AiRecipeDraft) {
  const parsed = aiRecipeDraftSchema.safeParse(draftInput);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid draft" };
  }

  const recipeInput = draftToRecipeInput(parsed.data);
  return createRecipeFromStructuredInput(
    recipeInput.base,
    recipeInput.ingredients,
    recipeInput.mealType,
  );
}

export async function saveAiRecipeDraftToPlan(
  draftInput: AiRecipeDraft,
  plannedDate: string,
  mealTypeRaw?: string,
) {
  const parsed = aiRecipeDraftSchema.safeParse(draftInput);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid draft" };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(plannedDate)) {
    return { ok: false as const, error: "Choose a valid planned date" };
  }

  const mealType = normalizeMealType(mealTypeRaw ?? parsed.data.mealType);
  const userId = await requireUserId();
  const recipeInput = draftToRecipeInput(parsed.data);
  const created = await createRecipeFromStructuredInput(
    recipeInput.base,
    recipeInput.ingredients,
    recipeInput.mealType,
  );

  if (!created.ok) {
    return created;
  }

  const db = getDb();
  await db.insert(mealPlanEntries).values({
    userId,
    recipeId: created.id,
    plannedDate,
    mealType,
    servings: String(parsed.data.servings),
    status: "planned",
    notes: `AI draft: ${parsed.data.whyThisFits}`,
  });

  revalidatePath("/plan");
  revalidatePath("/home");
  return { ok: true as const, id: created.id };
}
