import { z } from "zod";
import {
  autoMapCsvHeaders,
  buildImportQuestions,
  importDraftSchema,
  parseCsv,
  parseRecipeJson,
  rekeyIngredients,
  rowToDraft,
  validateDraftForCommit,
  type ColumnMapAnswers,
  type ImportAnswers,
  type ImportDraft,
  type ImportQuestion,
} from "@/lib/recipe-import";

const MAX_BATCH_BYTES = 2 * 1024 * 1024; // 2 MB
const MAX_BATCH_RECIPES = 200;

export type BatchItemSuccess = {
  sourceIndex: number;
  sourceLabel: string;
  draft: ImportDraft;
  questions: ImportQuestion[];
  warnings: string[];
};

export type BatchItemFailure = {
  sourceIndex: number;
  sourceLabel: string;
  message: string;
};

export const batchItemSuccessSchema = z.object({
  sourceIndex: z.number().int().min(0),
  sourceLabel: z.string(),
  draft: importDraftSchema,
});

export type BatchAnalyzeResolve = {
  ok: true;
  phase: "resolve";
  format: "csv" | "json";
  items: BatchItemSuccess[];
  errors: BatchItemFailure[];
  warnings: string[];
};

export type BatchAnalyzeCsvMap = {
  ok: true;
  phase: "csv_map";
  format: "csv";
  headers: string[];
  previewRows: string[][];
  dataRowCount: number;
  suggestedColumnMap: ColumnMapAnswers;
  warnings: string[];
};

export type BatchPreAnalyzeResult =
  | BatchAnalyzeResolve
  | BatchAnalyzeCsvMap
  | { ok: false; error: string };

export type BatchCommitOutcome =
  | { sourceIndex: number; sourceLabel: string; ok: true; id: number; title: string }
  | { sourceIndex: number; sourceLabel: string; ok: false; title: string | null; error: string };

export type BatchCommitResult =
  | { ok: true; results: BatchCommitOutcome[] }
  | { ok: false; error: string };

export function validateBatchImportSize(text: string): string | null {
  if (text.length > MAX_BATCH_BYTES) {
    return "File is too large for batch import (max 2 MB)";
  }
  return null;
}

/**
 * Accepts a top-level JSON array, or an object with a `recipes` array, or (for
 * convenience) a single recipe object — which is treated as a one-item batch.
 */
export function parseRecipeJsonBatch(text: string): {
  items: BatchItemSuccess[];
  errors: BatchItemFailure[];
  warnings: string[];
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON");
  }
  const warnings: string[] = [];
  let entries: unknown[];
  if (Array.isArray(parsed)) {
    entries = parsed;
  } else if (parsed && typeof parsed === "object") {
    const r = (parsed as Record<string, unknown>).recipes;
    if (Array.isArray(r)) {
      entries = r;
    } else {
      entries = [parsed];
      warnings.push("File contained a single recipe object; importing it as a one-item batch.");
    }
  } else {
    throw new Error("JSON must be an object or array of recipes");
  }

  if (entries.length === 0) {
    throw new Error("No recipes found in JSON");
  }
  if (entries.length > MAX_BATCH_RECIPES) {
    throw new Error(`Batch has too many recipes (max ${MAX_BATCH_RECIPES})`);
  }

  const items: BatchItemSuccess[] = [];
  const errors: BatchItemFailure[] = [];

  entries.forEach((entry, i) => {
    const label = `Item ${i + 1}`;
    try {
      const { draft, warnings: entryWarnings } = parseRecipeJson(JSON.stringify(entry));
      const fixed = rekeyIngredients(draft);
      items.push({
        sourceIndex: i,
        sourceLabel: label,
        draft: fixed,
        questions: [],
        warnings: entryWarnings,
      });
    } catch (e) {
      errors.push({
        sourceIndex: i,
        sourceLabel: label,
        message: e instanceof Error ? e.message : "Could not parse recipe",
      });
    }
  });

  return { items, errors, warnings };
}

/**
 * Build drafts from every data row in a CSV using a column map. Rows that fail
 * validation (e.g. missing title) go into `errors` so they can be reported and
 * skipped.
 */
export function parseRecipeCsvBatch(
  text: string,
  colMap: ColumnMapAnswers,
): {
  items: BatchItemSuccess[];
  errors: BatchItemFailure[];
  warnings: string[];
} {
  if (!colMap.title || !colMap.ingredients) {
    throw new Error("Title and ingredients columns are required");
  }
  const { headers, rows } = parseCsv(text);
  if (headers.length === 0) throw new Error("CSV has no headers");
  if (rows.length === 0) throw new Error("CSV has no data rows");
  if (rows.length > MAX_BATCH_RECIPES) {
    throw new Error(`Batch has too many rows (max ${MAX_BATCH_RECIPES})`);
  }

  const items: BatchItemSuccess[] = [];
  const errors: BatchItemFailure[] = [];

  rows.forEach((row, i) => {
    const label = `Row ${i + 2}`; // +2: 1-based + header offset
    try {
      const draft = rowToDraft(row, headers, colMap);
      if (!draft.title?.trim()) {
        errors.push({ sourceIndex: i, sourceLabel: label, message: "Missing title" });
        return;
      }
      if (!draft.ingredients.length) {
        errors.push({
          sourceIndex: i,
          sourceLabel: label,
          message: "No ingredients parsed from ingredients cell",
        });
        return;
      }
      items.push({
        sourceIndex: i,
        sourceLabel: label,
        draft: rekeyIngredients(draft),
        questions: [],
        warnings: [],
      });
    } catch (e) {
      errors.push({
        sourceIndex: i,
        sourceLabel: label,
        message: e instanceof Error ? e.message : "Could not parse row",
      });
    }
  });

  return { items, errors, warnings: [] };
}

/** Attach pantry questions + drop invalid pantryItemIds, per item. */
export function annotateBatchItems(
  items: BatchItemSuccess[],
  pantryRows: { id: number; name: string }[],
  validPantryIds: Set<number>,
): BatchItemSuccess[] {
  return items.map((it) => {
    const warnings = [...it.warnings];
    const ingredients = it.draft.ingredients.map((ing) => {
      if (ing.pantryItemId != null && !validPantryIds.has(ing.pantryItemId)) {
        warnings.push(
          `Pantry item id ${ing.pantryItemId} not in your pantry; "${ing.rawName}" will be matched by name.`,
        );
        return { ...ing, pantryItemId: null };
      }
      return ing;
    });
    const draft: ImportDraft = { ...it.draft, ingredients };
    const questions = buildImportQuestions(draft, pantryRows, validPantryIds);
    return { ...it, draft, warnings, questions };
  });
}

/** Figure out if a CSV's headers can be auto-mapped without asking the user. */
export function canAutoMapCsv(headers: string[]): {
  ok: boolean;
  map: ColumnMapAnswers;
} {
  const map = autoMapCsvHeaders(headers);
  return { ok: Boolean(map.title && map.ingredients), map: map as ColumnMapAnswers };
}

export function validateBatchDraftForCommit(draft: ImportDraft): string | null {
  return validateDraftForCommit(draft);
}

/** Re-export for convenience in server actions. */
export type { ImportAnswers };
