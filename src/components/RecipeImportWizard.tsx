"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import {
  applyRecipeCsvColumnMap,
  commitRecipeImport,
  preAnalyzeRecipeImport,
} from "@/actions/recipe-import";
import {
  CSV_MAP_FIELDS,
  type ColumnMapAnswers,
  type CsvColumnMapField,
  type ImportDraft,
  type ImportQuestion,
} from "@/lib/recipe-import";

type Step = "idle" | "csv_map" | "resolve";

export function RecipeImportWizard() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);

  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<string[][]>([]);
  const [columnMap, setColumnMap] = useState<Partial<Record<CsvColumnMapField, string>>>({});
  const [csvRowIndex, setCsvRowIndex] = useState(0);
  const [csvDataRowCount, setCsvDataRowCount] = useState(0);

  const [draft, setDraft] = useState<ImportDraft | null>(null);
  const [questions, setQuestions] = useState<ImportQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [titleOverride, setTitleOverride] = useState("");

  const resetFlow = useCallback(() => {
    setStep("idle");
    setError(null);
    setWarnings([]);
    setCsvHeaders([]);
    setPreviewRows([]);
    setColumnMap({});
    setCsvRowIndex(0);
    setCsvDataRowCount(0);
    setDraft(null);
    setQuestions([]);
    setAnswers({});
    setTitleOverride("");
  }, []);

  const headerOptions = useMemo(() => {
    const empty = { value: "", label: "— not mapped —" };
    return [empty, ...csvHeaders.map((h) => ({ value: h, label: h }))];
  }, [csvHeaders]);

  async function onAnalyze() {
    setError(null);
    setWarnings([]);
    if (!file) {
      setError("Choose a .json or .csv file first.");
      return;
    }
    const fd = new FormData();
    fd.set("file", file);
    setPending(true);
    try {
      const r = await preAnalyzeRecipeImport(fd);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setWarnings(r.warnings ?? []);
      if (r.phase === "csv_map") {
        setCsvHeaders(r.headers);
        setPreviewRows(r.previewRows);
        setColumnMap({ ...r.suggestedColumnMap });
        setCsvDataRowCount(r.dataRowCount);
        setCsvRowIndex(0);
        setStep("csv_map");
        return;
      }
      setDraft(r.draft);
      setQuestions(r.questions);
      setAnswers({});
      setTitleOverride(r.draft.title ?? "");
      setStep("resolve");
    } finally {
      setPending(false);
    }
  }

  async function onApplyCsvMap() {
    setError(null);
    if (!file) {
      setError("File missing; start over and pick the file again.");
      return;
    }
    const map: ColumnMapAnswers = {};
    for (const f of CSV_MAP_FIELDS) {
      const v = columnMap[f.key];
      if (v) map[f.key] = v;
    }
    if (!map.title || !map.ingredients) {
      setError("Map both recipe title and ingredients columns.");
      return;
    }
    const fd = new FormData();
    fd.set("file", file);
    fd.set("columnMap", JSON.stringify(map));
    fd.set("csvRowIndex", String(csvRowIndex));
    setPending(true);
    try {
      const r = await applyRecipeCsvColumnMap(fd);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setWarnings(r.warnings ?? []);
      setDraft(r.draft);
      setQuestions(r.questions);
      setAnswers({});
      setTitleOverride(r.draft.title ?? "");
      setStep("resolve");
    } finally {
      setPending(false);
    }
  }

  async function onCommit() {
    setError(null);
    if (!draft) return;
    const missingPantry = questions.filter((q) => !answers[q.id]?.trim());
    if (missingPantry.length > 0) {
      setError("Choose a pantry item (or “keep name”) for each highlighted ingredient.");
      return;
    }
    const d: ImportDraft = {
      ...draft,
      title: (titleOverride.trim() || draft.title)?.trim() || null,
    };
    if (!d.title) {
      setError("Recipe title is required.");
      return;
    }
    const fd = new FormData();
    fd.set("draftJson", JSON.stringify(d));
    fd.set("answersJson", JSON.stringify(answers));
    setPending(true);
    try {
      const r = await commitRecipeImport(fd);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.push("/plan");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <section
        id="recipe-import-templates"
        className="receipt-card space-y-3 border border-[var(--border-accent)] bg-[var(--accent-subtle)]/30 p-4"
        aria-label="Download import templates"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-[var(--foreground)]">Download a template</h3>
            <p className="mt-1 max-w-xl text-sm text-[var(--muted)]">
              Save a starter file, edit it on your device (spreadsheet or editor), then upload it below to prepopulate
              fields and ingredients before you confirm.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href="/templates/recipe-import.json"
            download="recipe-import-template.json"
            className="tap-target inline-flex items-center gap-2 rounded-lg border border-[var(--border-strong)] bg-[var(--background)] px-3 py-2 text-sm font-semibold text-[var(--foreground)] shadow-sm"
          >
            <span aria-hidden>↓</span>
            JSON template
          </a>
          <a
            href="/templates/recipe-import.csv"
            download="recipe-import-template.csv"
            className="tap-target inline-flex items-center gap-2 rounded-lg border border-[var(--border-strong)] bg-[var(--background)] px-3 py-2 text-sm font-semibold text-[var(--foreground)] shadow-sm"
          >
            <span aria-hidden>↓</span>
            CSV template
          </a>
        </div>
        <p className="text-xs text-[var(--muted)]">
          JSON: one recipe object with an <code className="rounded bg-[var(--background)] px-1">ingredients</code> array;
          optional <code className="rounded bg-[var(--background)] px-1">mealType</code>{" "}
          (<code className="rounded bg-[var(--background)] px-1">breakfast</code>,{" "}
          <code className="rounded bg-[var(--background)] px-1">lunch</code>,{" "}
          <code className="rounded bg-[var(--background)] px-1">dinner</code>,{" "}
          <code className="rounded bg-[var(--background)] px-1">snack</code>).
          CSV: same ingredient JSON in the ingredients column; optional <code className="rounded bg-[var(--background)] px-1">meal_type</code>{" "}
          cell with one of those words.
        </p>
      </section>

      <p className="text-sm text-[var(--muted)]">
        Upload your filled file below. If column names differ from the sample, you will map them. If an ingredient name
        matches several pantry items, you will pick the right one.
      </p>

      {(step === "idle" || step === "csv_map") && (
        <div className="space-y-3">
          <input
            type="file"
            accept=".json,.csv,.tsv,application/json,text/csv,text/plain"
            className="block w-full text-sm text-[var(--foreground)] file:mr-3 file:rounded-lg file:border file:border-[var(--border-strong)] file:bg-[var(--background)] file:px-3 file:py-2 file:text-sm"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
              resetFlow();
              if (f) setStep("idle");
            }}
          />
          {step === "idle" && (
            <button
              type="button"
              disabled={pending || !file}
              onClick={onAnalyze}
              className="btn-primary-touch rounded-lg bg-[var(--accent)] px-4 py-2 font-semibold text-white disabled:opacity-50"
            >
              {pending ? "Analyzing…" : "Analyze file"}
            </button>
          )}
        </div>
      )}

      {step === "csv_map" && (
        <div className="receipt-card space-y-4 p-4">
          <h3 className="font-medium text-[var(--foreground)]">Map CSV columns</h3>
          <p className="text-xs text-[var(--muted)]">
            Preview (first rows). Choose which column holds each field.
          </p>
          <div className="max-h-40 overflow-auto rounded-md border border-[var(--border-strong)] text-xs">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {csvHeaders.map((h) => (
                    <th key={h} className="border-b border-[var(--border-strong)] p-2 text-left font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, ri) => (
                  <tr key={ri}>
                    {csvHeaders.map((_, ci) => (
                      <td key={ci} className="border-b border-[var(--border-muted)] p-2">
                        {row[ci] ?? ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-2">
            {CSV_MAP_FIELDS.map((f) => (
              <li key={f.key} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                <label className="min-w-[10rem] text-sm">
                  {f.label}
                  {f.required && <span className="text-[var(--danger)]"> *</span>}
                </label>
                <select
                  value={columnMap[f.key] ?? ""}
                  onChange={(e) =>
                    setColumnMap((m) => ({ ...m, [f.key]: e.target.value || undefined }))
                  }
                  className="input-touch flex-1 border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)]"
                >
                  {headerOptions.map((o) => (
                    <option key={o.value || "—"} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>

          {csvDataRowCount > 1 && (
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
                Data row (1 = first row after header)
              </label>
              <input
                type="number"
                min={1}
                max={csvDataRowCount}
                value={csvRowIndex + 1}
                onChange={(e) => {
                  const v = Math.min(
                    csvDataRowCount,
                    Math.max(1, Math.trunc(Number(e.target.value)) || 1),
                  );
                  setCsvRowIndex(v - 1);
                }}
                className="input-touch w-28 border border-[var(--border-strong)] bg-[var(--background)]"
              />
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={onApplyCsvMap}
              className="btn-primary-touch rounded-lg bg-[var(--accent)] px-4 py-2 font-semibold text-white disabled:opacity-50"
            >
              {pending ? "Building…" : "Continue"}
            </button>
            <button
              type="button"
              onClick={() => {
                resetFlow();
              }}
              className="tap-target rounded-lg px-3 text-sm text-[var(--muted)]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {step === "resolve" && draft && (
        <div className="receipt-card space-y-4 p-4">
          <h3 className="font-medium">Review and resolve</h3>

          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Title</label>
            <input
              value={titleOverride}
              onChange={(e) => setTitleOverride(e.target.value)}
              placeholder={draft.title ?? "Recipe title"}
              className="input-touch w-full border border-[var(--border-strong)] bg-[var(--background)]"
            />
          </div>

          <div className="grid gap-2 text-sm text-[var(--muted)]">
            {draft.description && (
              <p>
                <span className="font-medium text-[var(--foreground)]">Description: </span>
                {draft.description}
              </p>
            )}
            {draft.instructions && (
              <p>
                <span className="font-medium text-[var(--foreground)]">Instructions: </span>
                <span className="whitespace-pre-wrap">{draft.instructions}</span>
              </p>
            )}
            <p>
              {(draft.servings ?? "—") + " servings"}
              {draft.prepTimeMinutes != null && ` · ${draft.prepTimeMinutes} min prep`}
            </p>
          </div>

          <div>
            <span className="text-sm font-medium">Ingredients ({draft.ingredients.length})</span>
            <ul className="mt-2 list-inside list-disc text-sm text-[var(--muted)]">
              {draft.ingredients.map((ing) => (
                <li key={ing.key}>
                  {ing.rawName}
                  {ing.quantity != null && ing.quantity !== "" && (
                    <span className="receipt-card-muted">
                      {" "}
                      — {ing.quantity} {ing.unit ?? ""}
                    </span>
                  )}
                  {ing.optional && <span className="text-xs"> (optional)</span>}
                </li>
              ))}
            </ul>
          </div>

          {questions.length > 0 && (
            <div className="space-y-3 border-t border-[var(--border-strong)] pt-3">
              <p className="text-sm font-medium text-[var(--accent)]">Match pantry items</p>
              {questions.map((q) => (
                <div key={q.id} className="rounded-lg border border-[var(--border-strong)] p-3">
                  <p className="mb-2 text-sm">
                    Which pantry item is <strong className="text-[var(--foreground)]">{q.rawName}</strong>?
                  </p>
                  <select
                    value={answers[q.id] ?? ""}
                    onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                    className="input-touch w-full border border-[var(--border-strong)] bg-[var(--background)]"
                  >
                    <option value="">Choose…</option>
                    {q.candidates.map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        {c.name}
                      </option>
                    ))}
                    <option value="custom">None of these (keep name as written)</option>
                  </select>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={onCommit}
              className="btn-primary-touch rounded-lg bg-[var(--accent)] px-4 py-2 font-semibold text-white disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save recipe"}
            </button>
            <button
              type="button"
              onClick={() => {
                resetFlow();
                setFile(null);
              }}
              className="tap-target rounded-lg px-3 text-sm text-[var(--muted)]"
            >
              Start over
            </button>
          </div>
        </div>
      )}

      {warnings.length > 0 && (
        <ul className="list-inside list-disc text-sm text-amber-800 dark:text-amber-200">
          {warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
    </div>
  );
}
