"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import {
  applyRecipeBatchCsvColumnMap,
  commitRecipeBatchImport,
  preAnalyzeRecipeBatch,
} from "@/actions/recipe-import";
import {
  CSV_MAP_FIELDS,
  type ColumnMapAnswers,
  type CsvColumnMapField,
} from "@/lib/recipe-import";
import type {
  BatchCommitOutcome,
  BatchItemFailure,
  BatchItemSuccess,
} from "@/lib/recipe-import-batch";

type Step = "idle" | "csv_map" | "resolve" | "report";

type PerItemAnswers = Record<number, Record<string, string>>;
type PerItemTitleOverride = Record<number, string>;
type PerItemSkip = Record<number, boolean>;

export function BatchRecipeImportWizard() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);

  // CSV mapping state
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<string[][]>([]);
  const [columnMap, setColumnMap] = useState<Partial<Record<CsvColumnMapField, string>>>({});
  const [csvDataRowCount, setCsvDataRowCount] = useState(0);

  // Resolve state
  const [items, setItems] = useState<BatchItemSuccess[]>([]);
  const [parseErrors, setParseErrors] = useState<BatchItemFailure[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [answers, setAnswers] = useState<PerItemAnswers>({});
  const [titleOverrides, setTitleOverrides] = useState<PerItemTitleOverride>({});
  const [skipItem, setSkipItem] = useState<PerItemSkip>({});

  // Report state
  const [results, setResults] = useState<BatchCommitOutcome[]>([]);

  const headerOptions = useMemo(() => {
    const empty = { value: "", label: "— not mapped —" };
    return [empty, ...csvHeaders.map((h) => ({ value: h, label: h }))];
  }, [csvHeaders]);

  const resetFlow = useCallback(() => {
    setStep("idle");
    setError(null);
    setWarnings([]);
    setCsvHeaders([]);
    setPreviewRows([]);
    setColumnMap({});
    setCsvDataRowCount(0);
    setItems([]);
    setParseErrors([]);
    setActiveIdx(0);
    setAnswers({});
    setTitleOverrides({});
    setSkipItem({});
    setResults([]);
  }, []);

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
      const r = await preAnalyzeRecipeBatch(fd);
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
        setStep("csv_map");
        return;
      }
      enterResolveStep(r.items, r.errors);
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
    setPending(true);
    try {
      const r = await applyRecipeBatchCsvColumnMap(fd);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setWarnings(r.warnings ?? []);
      enterResolveStep(r.items, r.errors);
    } finally {
      setPending(false);
    }
  }

  function enterResolveStep(newItems: BatchItemSuccess[], errors: BatchItemFailure[]) {
    setItems(newItems);
    setParseErrors(errors);
    setActiveIdx(0);
    const initialTitles: PerItemTitleOverride = {};
    for (const it of newItems) initialTitles[it.sourceIndex] = it.draft.title ?? "";
    setTitleOverrides(initialTitles);
    setAnswers({});
    setSkipItem({});
    if (newItems.length === 0) {
      // All rows failed to parse — jump to report using errors only.
      setResults(
        errors.map((e) => ({
          sourceIndex: e.sourceIndex,
          sourceLabel: e.sourceLabel,
          ok: false as const,
          title: null,
          error: e.message,
        })),
      );
      setStep("report");
      return;
    }
    setStep("resolve");
  }

  const active = items[activeIdx];
  const missingAnswersForActive =
    active?.questions.filter((q) => !answers[active.sourceIndex]?.[q.id]?.trim()) ?? [];

  function setAnswerForActive(id: string, value: string) {
    if (!active) return;
    setAnswers((a) => ({
      ...a,
      [active.sourceIndex]: { ...(a[active.sourceIndex] ?? {}), [id]: value },
    }));
  }

  function goPrev() {
    setError(null);
    if (activeIdx > 0) setActiveIdx(activeIdx - 1);
  }

  function goNext() {
    setError(null);
    if (!active) return;
    if (!skipItem[active.sourceIndex] && missingAnswersForActive.length > 0) {
      setError("Resolve all pantry matches, or mark this recipe as skipped.");
      return;
    }
    const title = (titleOverrides[active.sourceIndex] ?? active.draft.title ?? "").trim();
    if (!skipItem[active.sourceIndex] && !title) {
      setError("Recipe title is required. Either provide one or skip this recipe.");
      return;
    }
    if (activeIdx < items.length - 1) setActiveIdx(activeIdx + 1);
  }

  async function onCommitBatch() {
    setError(null);
    if (items.length === 0) {
      setError("No recipes to import.");
      return;
    }
    // Per-item validation first.
    for (let i = 0; i < items.length; i++) {
      const it = items[i]!;
      if (skipItem[it.sourceIndex]) continue;
      const missing = it.questions.filter(
        (q) => !answers[it.sourceIndex]?.[q.id]?.trim(),
      );
      if (missing.length > 0) {
        setActiveIdx(i);
        setError(`Resolve pantry matches for "${it.sourceLabel}" (or mark it skipped).`);
        return;
      }
      const title = (titleOverrides[it.sourceIndex] ?? it.draft.title ?? "").trim();
      if (!title) {
        setActiveIdx(i);
        setError(`Missing title for "${it.sourceLabel}" (or mark it skipped).`);
        return;
      }
    }

    const payloadItems = items
      .filter((it) => !skipItem[it.sourceIndex])
      .map((it) => ({
        sourceIndex: it.sourceIndex,
        sourceLabel: it.sourceLabel,
        draft: {
          ...it.draft,
          title: (titleOverrides[it.sourceIndex] ?? it.draft.title ?? "").trim() || null,
        },
        answers: answers[it.sourceIndex] ?? {},
      }));

    if (payloadItems.length === 0) {
      setError("All recipes are marked as skipped.");
      return;
    }

    const fd = new FormData();
    fd.set("payloadJson", JSON.stringify({ items: payloadItems }));
    setPending(true);
    try {
      const r = await commitRecipeBatchImport(fd);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      const combined: BatchCommitOutcome[] = [
        ...r.results,
        ...parseErrors.map(
          (e): BatchCommitOutcome => ({
            sourceIndex: e.sourceIndex,
            sourceLabel: e.sourceLabel,
            ok: false,
            title: null,
            error: e.message,
          }),
        ),
        ...items
          .filter((it) => skipItem[it.sourceIndex])
          .map(
            (it): BatchCommitOutcome => ({
              sourceIndex: it.sourceIndex,
              sourceLabel: it.sourceLabel,
              ok: false,
              title: it.draft.title,
              error: "Skipped by user",
            }),
          ),
      ].sort((a, b) => a.sourceIndex - b.sourceIndex);
      setResults(combined);
      setStep("report");
    } finally {
      setPending(false);
    }
  }

  const successCount = results.filter((r) => r.ok).length;
  const failCount = results.length - successCount;

  return (
    <div className="space-y-4">
      <section
        className="receipt-card space-y-3 border border-[var(--border-accent)] bg-[var(--accent-subtle)]/30 p-4"
        aria-label="Batch import templates"
      >
        <div>
          <h3 className="text-sm font-semibold text-[var(--foreground)]">Batch file format</h3>
          <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
            Upload a <strong>CSV</strong> with one row per recipe (ingredients as JSON in the{" "}
            <code className="rounded bg-[var(--background)] px-1">ingredients</code> cell), or a{" "}
            <strong>JSON</strong> file that is a top-level array of recipe objects (or an object
            with a <code className="rounded bg-[var(--background)] px-1">recipes</code> array).
            Invalid rows are reported and skipped; valid ones are imported.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href="/templates/recipe-import-batch.json"
            download="recipe-import-batch-template.json"
            className="tap-target inline-flex items-center gap-2 rounded-lg border border-[var(--border-strong)] bg-[var(--background)] px-3 py-2 text-sm font-semibold text-[var(--foreground)] shadow-sm"
          >
            <span aria-hidden>↓</span>
            JSON batch template
          </a>
          <a
            href="/templates/recipe-import-batch.csv"
            download="recipe-import-batch-template.csv"
            className="tap-target inline-flex items-center gap-2 rounded-lg border border-[var(--border-strong)] bg-[var(--background)] px-3 py-2 text-sm font-semibold text-[var(--foreground)] shadow-sm"
          >
            <span aria-hidden>↓</span>
            CSV batch template
          </a>
        </div>
      </section>

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
            Detected {csvDataRowCount} data row{csvDataRowCount === 1 ? "" : "s"}. Each row becomes
            one recipe. Choose which column holds each field.
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
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={onApplyCsvMap}
              className="btn-primary-touch rounded-lg bg-[var(--accent)] px-4 py-2 font-semibold text-white disabled:opacity-50"
            >
              {pending ? "Parsing…" : "Continue"}
            </button>
            <button
              type="button"
              onClick={() => {
                resetFlow();
                setFile(null);
              }}
              className="tap-target rounded-lg px-3 text-sm text-[var(--muted)]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {step === "resolve" && active && (
        <div className="receipt-card space-y-4 p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-medium">
              Resolve recipe {activeIdx + 1} of {items.length}
              <span className="ml-2 text-xs font-normal text-[var(--muted)]">
                ({active.sourceLabel})
              </span>
            </h3>
            <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
              <input
                type="checkbox"
                checked={Boolean(skipItem[active.sourceIndex])}
                onChange={(e) =>
                  setSkipItem((m) => ({ ...m, [active.sourceIndex]: e.target.checked }))
                }
              />
              Skip this recipe
            </label>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Title</label>
            <input
              value={titleOverrides[active.sourceIndex] ?? ""}
              onChange={(e) =>
                setTitleOverrides((m) => ({ ...m, [active.sourceIndex]: e.target.value }))
              }
              placeholder={active.draft.title ?? "Recipe title"}
              className="input-touch w-full border border-[var(--border-strong)] bg-[var(--background)]"
              disabled={Boolean(skipItem[active.sourceIndex])}
            />
          </div>

          <div className="grid gap-2 text-sm text-[var(--muted)]">
            {active.draft.description && (
              <p>
                <span className="font-medium text-[var(--foreground)]">Description: </span>
                {active.draft.description}
              </p>
            )}
            {active.draft.instructions && (
              <p>
                <span className="font-medium text-[var(--foreground)]">Instructions: </span>
                <span className="whitespace-pre-wrap">{active.draft.instructions}</span>
              </p>
            )}
            <p>
              {(active.draft.servings ?? "—") + " servings"}
              {active.draft.prepTimeMinutes != null && ` · ${active.draft.prepTimeMinutes} min prep`}
            </p>
          </div>

          <div>
            <span className="text-sm font-medium">
              Ingredients ({active.draft.ingredients.length})
            </span>
            <ul className="mt-2 list-inside list-disc text-sm text-[var(--muted)]">
              {active.draft.ingredients.map((ing) => (
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

          {active.warnings.length > 0 && (
            <ul className="list-inside list-disc text-sm text-amber-800 dark:text-amber-200">
              {active.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}

          {active.questions.length > 0 && !skipItem[active.sourceIndex] && (
            <div className="space-y-3 border-t border-[var(--border-strong)] pt-3">
              <p className="text-sm font-medium text-[var(--accent)]">Match pantry items</p>
              {active.questions.map((q) => (
                <div key={q.id} className="rounded-lg border border-[var(--border-strong)] p-3">
                  <p className="mb-2 text-sm">
                    Which pantry item is{" "}
                    <strong className="text-[var(--foreground)]">{q.rawName}</strong>?
                  </p>
                  <select
                    value={answers[active.sourceIndex]?.[q.id] ?? ""}
                    onChange={(e) => setAnswerForActive(q.id, e.target.value)}
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

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={pending || activeIdx === 0}
              onClick={goPrev}
              className="tap-target rounded-lg border border-[var(--border-strong)] px-3 py-2 text-sm disabled:opacity-50"
            >
              ← Previous
            </button>
            {activeIdx < items.length - 1 ? (
              <button
                type="button"
                disabled={pending}
                onClick={goNext}
                className="tap-target rounded-lg border border-[var(--border-strong)] px-3 py-2 text-sm"
              >
                Next →
              </button>
            ) : (
              <button
                type="button"
                disabled={pending}
                onClick={onCommitBatch}
                className="btn-primary-touch rounded-lg bg-[var(--accent)] px-4 py-2 font-semibold text-white disabled:opacity-50"
              >
                {pending ? "Saving…" : `Save ${items.filter((it) => !skipItem[it.sourceIndex]).length} recipe(s)`}
              </button>
            )}
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

          {parseErrors.length > 0 && (
            <p className="text-xs text-[var(--muted)]">
              {parseErrors.length} row{parseErrors.length === 1 ? "" : "s"} could not be parsed and
              will be shown in the final report.
            </p>
          )}
        </div>
      )}

      {step === "report" && (
        <div className="receipt-card space-y-3 p-4">
          <h3 className="font-medium">Batch import report</h3>
          <p className="text-sm text-[var(--muted)]">
            Imported {successCount} · Skipped or failed {failCount}
          </p>
          <ul className="divide-y divide-[var(--border-muted)] text-sm">
            {results.map((r) => (
              <li
                key={`${r.sourceIndex}-${r.ok ? "ok" : "fail"}`}
                className="flex items-start justify-between gap-3 py-2"
              >
                <div>
                  <div className="font-medium">
                    {r.title ?? "(no title)"}{" "}
                    <span className="text-xs font-normal text-[var(--muted)]">
                      · {r.sourceLabel}
                    </span>
                  </div>
                  {!r.ok && (
                    <div className="text-xs text-[var(--danger)]">{r.error}</div>
                  )}
                </div>
                <div
                  className={
                    r.ok
                      ? "text-xs font-semibold text-emerald-700 dark:text-emerald-300"
                      : "text-xs font-semibold text-[var(--danger)]"
                  }
                >
                  {r.ok ? "Imported" : "Skipped"}
                </div>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                router.push("/plan");
              }}
              className="btn-primary-touch rounded-lg bg-[var(--accent)] px-4 py-2 font-semibold text-white"
            >
              Go to meal plan
            </button>
            <button
              type="button"
              onClick={() => {
                resetFlow();
                setFile(null);
              }}
              className="tap-target rounded-lg border border-[var(--border-strong)] px-3 py-2 text-sm"
            >
              Import another batch
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
