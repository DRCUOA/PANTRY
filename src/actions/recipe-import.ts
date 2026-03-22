"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { createRecipeFromImport } from "@/actions/recipes";
import { normalizeMealType } from "@/lib/recipe-meal-types";
import { ingredientLineSchema, recipeBaseSchema } from "@/lib/recipe-schemas";
import { getDb } from "@/db";
import { pantryItems } from "@/db/schema";
import { getSession } from "@/lib/get-session";
import {
  autoMapCsvHeaders,
  buildDraftFromCsv,
  buildImportQuestions,
  draftToIngredientLines,
  importDraftSchema,
  parseCsv,
  parseRecipeJson,
  rekeyIngredients,
  sniffFormat,
  validateDraftForCommit,
  validateImportSize,
  type ColumnMapAnswers,
  type ImportAnswers,
  type ImportDraft,
  type PreAnalyzeResult,
} from "@/lib/recipe-import";

async function requireUserId(): Promise<number> {
  const session = await getSession();
  if (!session.isLoggedIn || session.userId == null) throw new Error("Unauthorized");
  return session.userId;
}

async function loadPantryForImport(userId: number) {
  const db = getDb();
  const rows = await db
    .select({ id: pantryItems.id, name: pantryItems.name })
    .from(pantryItems)
    .where(eq(pantryItems.userId, userId));
  const validIds = new Set(rows.map((r) => r.id));
  return { pantryRows: rows, validIds };
}

function sanitizeDraftIds(draft: ImportDraft, validIds: Set<number>): { draft: ImportDraft; warnings: string[] } {
  const warnings: string[] = [];
  const ingredients = draft.ingredients.map((ing) => {
    if (ing.pantryItemId != null && !validIds.has(ing.pantryItemId)) {
      warnings.push(`Pantry item id ${ing.pantryItemId} is not in your pantry; "${ing.rawName}" will be matched by name.`);
      return { ...ing, pantryItemId: null };
    }
    return ing;
  });
  return { draft: { ...draft, ingredients }, warnings };
}

async function readUploadFile(formData: FormData): Promise<{ ok: true; text: string; filename: string } | { ok: false; error: string }> {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "Missing file" };
  }
  if (file.size > 512 * 1024) {
    return { ok: false, error: "File is too large (max 512 KB)" };
  }
  const text = await file.text();
  const sizeErr = validateImportSize(text);
  if (sizeErr) return { ok: false, error: sizeErr };
  return { ok: true, text, filename: file.name || "upload" };
}

export async function preAnalyzeRecipeImport(formData: FormData): Promise<PreAnalyzeResult> {
  try {
    const userId = await requireUserId();
    const up = await readUploadFile(formData);
    if (!up.ok) return { ok: false, error: up.error };
    const { pantryRows, validIds } = await loadPantryForImport(userId);
    const fmt = sniffFormat(up.filename, up.text);

    if (fmt === "json") {
      try {
        const { draft: rawDraft, warnings: w0 } = parseRecipeJson(up.text);
        const { draft, warnings: w1 } = sanitizeDraftIds(rawDraft, validIds);
        const allWarnings = [...w0, ...w1];
        const draftFixed = rekeyIngredients(draft);
        const questions = buildImportQuestions(draftFixed, pantryRows, validIds);
        return {
          ok: true,
          phase: "resolve",
          format: "json",
          draft: draftFixed,
          questions,
          warnings: allWarnings,
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Could not read file";
        return { ok: false, error: msg };
      }
    }

    try {
      const { headers, rows } = parseCsv(up.text);
      if (headers.length === 0) return { ok: false, error: "CSV has no headers" };
      if (rows.length === 0) return { ok: false, error: "CSV has no data rows" };
      const auto = autoMapCsvHeaders(headers);
      const hasTitle = Boolean(auto.title);
      const hasIng = Boolean(auto.ingredients);
      if (!hasTitle || !hasIng) {
        const previewRows = rows.slice(0, 8);
        return {
          ok: true,
          phase: "csv_map",
          format: "csv",
          headers,
          previewRows,
          dataRowCount: rows.length,
          suggestedColumnMap: auto,
          warnings: [
            !hasTitle || !hasIng
              ? "Could not detect title and/or ingredients columns; map them below."
              : "",
          ].filter(Boolean),
        };
      }
      const colMap = auto as ColumnMapAnswers;
      const { draft: rawDraft, warnings: w0 } = buildDraftFromCsv(up.text, colMap, 0);
      const { draft, warnings: w1 } = sanitizeDraftIds(rawDraft, validIds);
      const allWarnings = [...w0, ...w1];
      const draftFixed = rekeyIngredients(draft);
      const questions = buildImportQuestions(draftFixed, pantryRows, validIds);
      return {
        ok: true,
        phase: "resolve",
        format: "csv",
        draft: draftFixed,
        questions,
        warnings: allWarnings,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not read CSV";
      return { ok: false, error: msg };
    }
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
}

export async function applyRecipeCsvColumnMap(formData: FormData) {
  try {
    const userId = await requireUserId();
    const up = await readUploadFile(formData);
    if (!up.ok) return { ok: false as const, error: up.error };
    const mapRaw = formData.get("columnMap");
    if (typeof mapRaw !== "string" || !mapRaw.trim()) {
      return { ok: false as const, error: "Missing column map" };
    }
    let columnMap: ColumnMapAnswers;
    try {
      columnMap = JSON.parse(mapRaw) as ColumnMapAnswers;
    } catch {
      return { ok: false as const, error: "Invalid column map JSON" };
    }
    const rowIndex = Math.max(0, Number(formData.get("csvRowIndex")) || 0);
    const { pantryRows, validIds } = await loadPantryForImport(userId);
    try {
      const { draft: rawDraft, warnings: w0 } = buildDraftFromCsv(up.text, columnMap, rowIndex);
      const { draft, warnings: w1 } = sanitizeDraftIds(rawDraft, validIds);
      const draftFixed = rekeyIngredients(draft);
      const questions = buildImportQuestions(draftFixed, pantryRows, validIds);
      return {
        ok: true as const,
        draft: draftFixed,
        questions,
        warnings: [...w0, ...w1],
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not build recipe from CSV";
      return { ok: false as const, error: msg };
    }
  } catch {
    return { ok: false as const, error: "Unauthorized" };
  }
}

const answersSchema = z.record(z.string(), z.string());

export async function commitRecipeImport(formData: FormData) {
  try {
    const userId = await requireUserId();
    const draftRaw = formData.get("draftJson");
    const answersRaw = formData.get("answersJson");
    if (typeof draftRaw !== "string" || !draftRaw.trim()) {
      return { ok: false as const, error: "Missing draft" };
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(draftRaw);
    } catch {
      return { ok: false as const, error: "Invalid draft JSON" };
    }
    const draftParsed = importDraftSchema.safeParse(parsed);
    if (!draftParsed.success) {
      return { ok: false as const, error: draftParsed.error.issues[0]?.message ?? "Invalid draft" };
    }
    const draft = draftParsed.data as ImportDraft;

    let answers: ImportAnswers = {};
    if (typeof answersRaw === "string" && answersRaw.trim()) {
      try {
        const a = JSON.parse(answersRaw);
        const ar = answersSchema.safeParse(a);
        if (!ar.success) {
          return { ok: false as const, error: "Invalid answers" };
        }
        answers = ar.data;
      } catch {
        return { ok: false as const, error: "Invalid answers JSON" };
      }
    }

    const err = validateDraftForCommit(draft);
    if (err) return { ok: false as const, error: err };

    const { pantryRows, validIds } = await loadPantryForImport(userId);
    const merged = draftToIngredientLines(draft, pantryRows, validIds, answers);
    if (!merged.ok) return { ok: false as const, error: merged.error };

    const ingZ = z.array(ingredientLineSchema).safeParse(merged.lines);
    if (!ingZ.success) {
      return { ok: false as const, error: ingZ.error.issues[0]?.message ?? "Invalid ingredients" };
    }

    const base = recipeBaseSchema.safeParse({
      title: draft.title,
      description: draft.description ?? "",
      instructions: draft.instructions ?? "",
      servings: draft.servings ?? 1,
      prepTimeMinutes: draft.prepTimeMinutes,
      caloriesPerServing: draft.caloriesPerServing,
      proteinGPerServing: draft.proteinGPerServing ?? "",
    });
    if (!base.success) {
      return { ok: false as const, error: base.error.issues[0]?.message ?? "Invalid recipe fields" };
    }

    const mealType = normalizeMealType(draft.mealType);
    return createRecipeFromImport(base.data, ingZ.data, mealType);
  } catch {
    return { ok: false as const, error: "Unauthorized" };
  }
}
