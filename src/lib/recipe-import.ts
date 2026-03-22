import { z } from "zod";
import { findPantryItemMatches } from "@/lib/pantry-match";
import {
  mealTypeFromLegacyArray,
  normalizeMealType,
  type RecipeMealTypeValue,
} from "@/lib/recipe-meal-types";

const MAX_IMPORT_BYTES = 512 * 1024;

export type RecipeImportPhase = "csv_map" | "resolve";

export type CsvColumnMapField =
  | "title"
  | "description"
  | "instructions"
  | "servings"
  | "prepTimeMinutes"
  | "caloriesPerServing"
  | "proteinGPerServing"
  | "mealType"
  | "ingredients";

export const CSV_MAP_FIELDS: { key: CsvColumnMapField; label: string; required: boolean }[] = [
  { key: "title", label: "Recipe title", required: true },
  { key: "ingredients", label: "Ingredients (JSON array or plain lines)", required: true },
  { key: "description", label: "Description", required: false },
  { key: "instructions", label: "Instructions", required: false },
  { key: "servings", label: "Servings", required: false },
  { key: "prepTimeMinutes", label: "Prep time (minutes)", required: false },
  { key: "caloriesPerServing", label: "Calories per serving", required: false },
  { key: "proteinGPerServing", label: "Protein g per serving", required: false },
  {
    key: "mealType",
    label: "Meal type (all, breakfast, lunch, or dinner)",
    required: false,
  },
];

export type DraftIngredient = {
  key: string;
  rawName: string;
  quantity: string | null;
  unit: string | null;
  optional: boolean;
  /** From file; validated at commit */
  pantryItemId: number | null;
};

export type ImportDraft = {
  title: string | null;
  description: string | null;
  instructions: string | null;
  servings: number | null;
  prepTimeMinutes: number | null;
  caloriesPerServing: number | null;
  proteinGPerServing: string | null;
  /** null = all meals at commit */
  mealType: RecipeMealTypeValue | null;
  ingredients: DraftIngredient[];
};

export type ImportQuestionIngredientPantry = {
  type: "ingredient_pantry";
  id: string;
  rawName: string;
  candidates: { id: number; name: string }[];
};

export type ImportQuestion = ImportQuestionIngredientPantry;

export type PreAnalyzeOk =
  | {
      ok: true;
      phase: "csv_map";
      format: "csv";
      headers: string[];
      previewRows: string[][];
      /** Rows after header (full file). */
      dataRowCount: number;
      suggestedColumnMap: ColumnMapAnswers;
      warnings: string[];
    }
  | {
      ok: true;
      phase: "resolve";
      format: "json" | "csv";
      draft: ImportDraft;
      questions: ImportQuestion[];
      warnings: string[];
    };

export type PreAnalyzeResult =
  | PreAnalyzeOk
  | { ok: false; error: string };

const draftIngredientSchema = z.object({
  key: z.string(),
  rawName: z.string(),
  quantity: z.string().nullable(),
  unit: z.string().nullable(),
  optional: z.boolean(),
  pantryItemId: z.number().int().positive().nullable(),
});

export const importDraftSchema = z.object({
  title: z.string().nullable(),
  description: z.string().nullable(),
  instructions: z.string().nullable(),
  servings: z.number().int().positive().nullable(),
  prepTimeMinutes: z.number().int().min(0).nullable(),
  caloriesPerServing: z.number().int().min(0).nullable(),
  proteinGPerServing: z.string().nullable(),
  mealType: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v): RecipeMealTypeValue | null => {
      if (v == null) return null;
      if (typeof v !== "string" || !v.trim()) return null;
      return normalizeMealType(v);
    }),
  ingredients: z.array(draftIngredientSchema),
});

export type ImportAnswers = Record<string, string>;

function pickString(o: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function pickNumber(
  o: Record<string, unknown>,
  keys: string[],
): number | null {
  for (const k of keys) {
    const v = o[k];
    if (v == null || v === "") continue;
    if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
    if (typeof v === "string") {
      const n = Number(v);
      if (Number.isFinite(n)) return Math.trunc(n);
    }
  }
  return null;
}

function extractFirstRecipe(parsed: unknown): { obj: Record<string, unknown>; warnings: string[] } {
  const warnings: string[] = [];
  if (Array.isArray(parsed)) {
    if (parsed.length === 0) throw new Error("JSON array is empty");
    if (parsed.length > 1) warnings.push("Multiple recipes in file; only the first will be imported.");
    const first = parsed[0];
    if (!first || typeof first !== "object") throw new Error("Invalid recipe entry");
    return { obj: first as Record<string, unknown>, warnings };
  }
  if (parsed && typeof parsed === "object") {
    const r = (parsed as Record<string, unknown>).recipes;
    if (Array.isArray(r)) {
      if (r.length === 0) throw new Error("recipes array is empty");
      if (r.length > 1) warnings.push("Multiple recipes in file; only the first will be imported.");
      const first = r[0];
      if (!first || typeof first !== "object") throw new Error("Invalid recipe entry");
      return { obj: first as Record<string, unknown>, warnings };
    }
    return { obj: parsed as Record<string, unknown>, warnings };
  }
  throw new Error("JSON must be an object or array of recipes");
}

function parseIngredientCell(raw: string): DraftIngredient[] {
  const t = raw.trim();
  if (!t) return [];
  try {
    const j = JSON.parse(t) as unknown;
    if (Array.isArray(j)) {
      return j
        .map((x, i) => normalizeOneIngredient(x, `ing-${i}`))
        .filter((x): x is DraftIngredient => x != null);
    }
  } catch {
    /* fall through */
  }
  const lines = t.split(/[\n\r;|]+/).map((s) => s.trim()).filter(Boolean);
  return lines.map((line, i) => ({
    key: `ing-${i}`,
    rawName: line,
    quantity: null,
    unit: null,
    optional: false,
    pantryItemId: null,
  }));
}

function normalizeOneIngredient(x: unknown, keyPrefix: string): DraftIngredient | null {
  if (typeof x === "string") {
    const t = x.trim();
    if (!t) return null;
    return {
      key: keyPrefix,
      rawName: t,
      quantity: null,
      unit: null,
      optional: false,
      pantryItemId: null,
    };
  }
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  const idRaw = o.pantryItemId ?? o.pantry_item_id;
  let pantryItemId: number | null = null;
  if (typeof idRaw === "number" && Number.isFinite(idRaw) && idRaw > 0) {
    pantryItemId = Math.trunc(idRaw);
  } else if (typeof idRaw === "string" && idRaw.trim()) {
    const n = Number(idRaw);
    if (Number.isFinite(n) && n > 0) pantryItemId = Math.trunc(n);
  }
  const rawName =
    pickString(o, ["pantryItemName", "pantry_item_name", "name", "item", "ingredient", "label"]) ?? "";
  if (!rawName && pantryItemId == null) return null;
  const qty = pickString(o, ["quantity", "qty", "amount"]);
  const unit = pickString(o, ["unit", "uom"]);
  const optional = Boolean(o.optional);
  return {
    key: keyPrefix,
    rawName: rawName || "(linked item)",
    quantity: qty,
    unit: unit,
    optional,
    pantryItemId,
  };
}

function normalizeIngredientsField(val: unknown, keyOffset: number): DraftIngredient[] {
  if (typeof val === "string") return parseIngredientCell(val);
  if (!Array.isArray(val)) return [];
  return val
    .map((x, i) => normalizeOneIngredient(x, `ing-${keyOffset + i}`))
    .filter((x): x is DraftIngredient => x != null);
}

export function parseRecipeJson(text: string): { draft: ImportDraft; warnings: string[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON");
  }
  const { obj, warnings } = extractFirstRecipe(parsed);
  const ingredients = normalizeIngredientsField(obj.ingredients ?? obj.items, 0);
  const o = obj as Record<string, unknown>;
  const mtStr = pickString(o, ["mealType", "meal_type", "mealSlot", "meal_slot"]);
  const mtArr = o.mealTypes ?? o.meal_types;
  let mealType: RecipeMealTypeValue | null = null;
  if (mtStr) mealType = normalizeMealType(mtStr);
  else if (mtArr != null) mealType = mealTypeFromLegacyArray(mtArr);
  const draft: ImportDraft = {
    title: pickString(obj, ["title", "name", "recipeTitle", "recipe_name"]),
    description: pickString(obj, ["description", "desc", "summary"]),
    instructions: pickString(obj, ["instructions", "steps", "method", "directions"]),
    servings: pickNumber(obj, ["servings", "serves", "yield", "servings_base"]),
    prepTimeMinutes: pickNumber(obj, ["prepTimeMinutes", "prep_time_minutes", "prepMin", "prep_min", "prepTime"]),
    caloriesPerServing: pickNumber(obj, ["caloriesPerServing", "calories_per_serving", "calories", "cal"]),
    proteinGPerServing:
      pickString(obj, ["proteinGPerServing", "protein_g_per_serving", "protein"]) ?? null,
    mealType,
    ingredients,
  };
  return { draft, warnings };
}

/** Minimal CSV/TSV row parser (quoted fields). */
export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) throw new Error("CSV is empty");
  const delim: "," | "\t" =
    lines[0].includes("\t") && lines[0].split("\t").length > lines[0].split(",").length
      ? "\t"
      : ",";

  function parseLine(line: string): string[] {
    const out: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQ && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQ = !inQ;
        }
      } else if (c === delim && !inQ) {
        out.push(cur.trim());
        cur = "";
      } else {
        cur += c;
      }
    }
    out.push(cur.trim());
    return out.map((cell) => {
      let s = cell;
      if (s.startsWith('"') && s.endsWith('"')) s = s.slice(1, -1).replace(/""/g, '"');
      return s;
    });
  }

  const headers = parseLine(lines[0]).map((h) => h.trim());
  const rows: string[][] = [];
  for (let r = 1; r < lines.length; r++) {
    const row = parseLine(lines[r]);
    if (row.every((c) => c === "")) continue;
    while (row.length < headers.length) row.push("");
    rows.push(row);
  }
  return { headers, rows };
}

const HEADER_SYNONYMS: Partial<Record<CsvColumnMapField, string[]>> = {
  title: ["title", "name", "recipe", "recipe_name", "recipename"],
  ingredients: ["ingredients", "ingredient_list", "items", "ingredients_json", "ingredient"],
  description: ["description", "desc", "summary"],
  instructions: ["instructions", "steps", "method", "directions"],
  servings: ["servings", "serves", "yield"],
  prepTimeMinutes: ["prep_time_minutes", "prep_min", "prepmin", "prep", "prep_time"],
  caloriesPerServing: ["calories_per_serving", "calories", "cal"],
  proteinGPerServing: ["protein_g_per_serving", "protein"],
  mealType: ["meal_type", "mealtype", "meal_slot", "slot", "meal"],
};

function normHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, "_");
}

export function autoMapCsvHeaders(headers: string[]): Partial<Record<CsvColumnMapField, string>> {
  const nh = headers.map((h) => ({ raw: h, n: normHeader(h) }));
  const used = new Set<string>();
  const map: Partial<Record<CsvColumnMapField, string>> = {};
  (Object.keys(HEADER_SYNONYMS) as CsvColumnMapField[]).forEach((field) => {
    const syns = HEADER_SYNONYMS[field] ?? [];
    for (const { raw, n } of nh) {
      if (used.has(raw)) continue;
      if (syns.includes(n) || syns.some((s) => n === s.replace(/_/g, ""))) {
        map[field] = raw;
        used.add(raw);
        break;
      }
    }
  });
  return map;
}

export type ColumnMapAnswers = Partial<Record<CsvColumnMapField, string>>;

function parseMealTypeCsvCell(s: string | null): RecipeMealTypeValue | null {
  if (!s?.trim()) return null;
  try {
    const j = JSON.parse(s) as unknown;
    if (typeof j === "string") return normalizeMealType(j);
    if (Array.isArray(j)) return mealTypeFromLegacyArray(j);
  } catch {
    /* plain text */
  }
  return normalizeMealType(s);
}

export function rowToDraft(
  row: string[],
  headers: string[],
  colMap: ColumnMapAnswers,
): ImportDraft {
  const idx = (field: CsvColumnMapField): number => {
    const h = colMap[field];
    if (!h) return -1;
    const i = headers.indexOf(h);
    return i;
  };
  const cell = (field: CsvColumnMapField): string | null => {
    const i = idx(field);
    if (i < 0) return null;
    return row[i]?.trim() ?? null;
  };
  const title = cell("title");
  const desc = cell("description");
  const instr = cell("instructions");
  const serv = cell("servings");
  const prep = cell("prepTimeMinutes");
  const cal = cell("caloriesPerServing");
  const prot = cell("proteinGPerServing");
  const ingCell = cell("ingredients") ?? "";
  const ingredients = parseIngredientCell(ingCell);
  return {
    title: title && title !== "" ? title : null,
    description: desc,
    instructions: instr,
    servings: serv && serv !== "" ? Math.trunc(Number(serv)) || null : null,
    prepTimeMinutes: prep && prep !== "" ? Math.trunc(Number(prep)) || null : null,
    caloriesPerServing: cal && cal !== "" ? Math.trunc(Number(cal)) || null : null,
    proteinGPerServing: prot && prot !== "" ? prot : null,
    mealType: parseMealTypeCsvCell(cell("mealType")),
    ingredients,
  };
}

export function buildDraftFromCsv(
  text: string,
  colMap: ColumnMapAnswers,
  rowIndex: number,
): { draft: ImportDraft; warnings: string[] } {
  const { headers, rows } = parseCsv(text);
  if (!colMap.title || !colMap.ingredients) throw new Error("Title and ingredients columns are required");
  if (rowIndex < 0 || rowIndex >= rows.length) throw new Error("Invalid row index");
  const draft = rowToDraft(rows[rowIndex], headers, colMap);
  const warnings: string[] = [];
  if (rows.length > 1) warnings.push(`CSV has ${rows.length} data rows; importing row ${rowIndex + 1} only.`);
  return { draft, warnings };
}

export function sniffFormat(filename: string, text: string): "json" | "csv" {
  const ext = filename.toLowerCase().split(".").pop();
  if (ext === "json") return "json";
  if (ext === "csv" || ext === "tsv") return "csv";
  const t = text.trimStart();
  if (t.startsWith("{") || t.startsWith("[")) return "json";
  return "csv";
}

export function validateImportSize(text: string): string | null {
  if (text.length > MAX_IMPORT_BYTES) return "File is too large (max 512 KB)";
  return null;
}

export function buildImportQuestions(
  draft: ImportDraft,
  pantryRows: { id: number; name: string }[],
  validPantryIds: Set<number>,
): ImportQuestion[] {
  const questions: ImportQuestion[] = [];
  for (const ing of draft.ingredients) {
    if (ing.pantryItemId != null) {
      if (!validPantryIds.has(ing.pantryItemId)) {
        /* treat as unresolved name */
      } else {
        continue;
      }
    }
    const nameForMatch = ing.rawName.trim();
    if (!nameForMatch || nameForMatch === "(linked item)") continue;
    const matches = findPantryItemMatches(pantryRows, nameForMatch);
    if (matches.length > 1) {
      questions.push({
        type: "ingredient_pantry",
        id: ing.key,
        rawName: nameForMatch,
        candidates: matches.map((m) => ({ id: m.id, name: m.name })),
      });
    }
  }
  return questions;
}

/**
 * Merge user answers into ingredient lines compatible with `ingredientLineSchema` in recipes action.
 */
export function draftToIngredientLines(
  draft: ImportDraft,
  pantryRows: { id: number; name: string }[],
  validPantryIds: Set<number>,
  answers: ImportAnswers,
): { ok: true; lines: { pantryItemId: number | null; pantryItemName: string | null; quantity: string | null; unit: string | null; optional: boolean }[] } | { ok: false; error: string } {
  const lines: {
    pantryItemId: number | null;
    pantryItemName: string | null;
    quantity: string | null;
    unit: string | null;
    optional: boolean;
  }[] = [];

  for (const ing of draft.ingredients) {
    let pantryItemId: number | null = ing.pantryItemId;
    if (pantryItemId != null && !validPantryIds.has(pantryItemId)) {
      pantryItemId = null;
    }

    if (pantryItemId != null) {
      lines.push({
        pantryItemId,
        pantryItemName: null,
        quantity: ing.quantity,
        unit: ing.unit,
        optional: ing.optional,
      });
      continue;
    }

    const nameForMatch = ing.rawName.trim();
    if (nameForMatch && nameForMatch !== "(linked item)") {
      const matches = findPantryItemMatches(pantryRows, nameForMatch);
      const ans = answers[ing.key];
      if (matches.length > 1) {
        if (!ans) {
          return { ok: false, error: `Choose a pantry match for "${ing.rawName}"` };
        }
        if (ans === "custom") {
          pantryItemId = null;
        } else {
          const id = Number(ans);
          if (!Number.isFinite(id) || !validPantryIds.has(id)) {
            return { ok: false, error: `Invalid choice for "${ing.rawName}"` };
          }
          pantryItemId = id;
        }
      } else if (matches.length === 1) {
        pantryItemId = matches[0]!.id;
      }
    }

    if (pantryItemId != null) {
      lines.push({
        pantryItemId,
        pantryItemName: null,
        quantity: ing.quantity,
        unit: ing.unit,
        optional: ing.optional,
      });
    } else {
      const n = ing.rawName.trim();
      if (n === "(linked item)") {
        return { ok: false, error: "Invalid pantryItemId in import for an ingredient" };
      }
      if (!n) continue;
      lines.push({
        pantryItemId: null,
        pantryItemName: n,
        quantity: ing.quantity,
        unit: ing.unit,
        optional: ing.optional,
      });
    }
  }

  return { ok: true, lines };
}

export function validateDraftForCommit(draft: ImportDraft): string | null {
  if (!draft.title?.trim()) return "Recipe title is required";
  return null;
}

export function rekeyIngredients(draft: ImportDraft): ImportDraft {
  return {
    ...draft,
    ingredients: draft.ingredients.map((ing, i) => ({ ...ing, key: `ing-${i}` })),
  };
}
