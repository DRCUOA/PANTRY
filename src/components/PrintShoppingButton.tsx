"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { IconPrinter } from "@/components/ui/icons";
import { SheetModal } from "@/components/ui/SheetModal";
import { UndoSnackbar } from "@/components/ui/UndoSnackbar";
import { classifyItem, type SupermarketSection } from "@/lib/supermarket-sections";

/**
 * Items the print dialog needs from the shop page. Status is included so we
 * can default to "to get" but still let the caller pass the bigger set.
 */
export type PrintShoppingItem = {
  id: number;
  name: string;
  quantity: string | null;
  unit: string | null;
  status: string;
};

type Variant = "simple" | "enhanced" | "checklist";
type Scaling = "none" | "fit" | "sms";

type GroupedSection = { section: SupermarketSection; items: PrintShoppingItem[] };

/** A4 portrait inner height in CSS px (96dpi), assuming the @page margins
 * declared in globals.css (top 14mm, bottom 18mm). Used to approximate
 * "fit to N pages" by scaling --print-scale. Slightly conservative so
 * content tends to slip under, not over. */
const A4_INNER_HEIGHT_PX = ((297 - 14 - 18) * 96) / 25.4;
/** A4 portrait inner width in CSS px (210mm − 12mm × 2 horizontal margins). */
const A4_INNER_WIDTH_MM = 210 - 12 - 12;

function formatQty(item: PrintShoppingItem): string {
  if (item.quantity == null || item.quantity === "") return "";
  return item.unit ? `${item.quantity} ${item.unit}` : item.quantity;
}

/**
 * Build the SMS-friendly plaintext list. One line per item, name + qty,
 * separated by CRLF so it pastes cleanly into iOS / Android message apps.
 */
function buildSmsText(items: PrintShoppingItem[]): string {
  return items
    .map((it) => {
      const qty = formatQty(it);
      return qty ? `${it.name} ${qty}` : it.name;
    })
    .join("\r\n");
}

/**
 * Hand-held printable version of the shopping list. Three table variants
 * (simple / enhanced / checklist), an A4 portrait page layout with repeating
 * column headers and a "Page X of Y" footer, plus an SMS-clipboard mode.
 */
export function PrintShoppingButton({
  items,
  totalCount,
}: {
  items: PrintShoppingItem[];
  totalCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [variant, setVariant] = useState<Variant>("enhanced");
  const [scaling, setScaling] = useState<Scaling>("none");
  const [fitPages, setFitPages] = useState<number>(1);
  const [printRequested, setPrintRequested] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: "info" | "warn" } | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  // Only print "to get" items. The bought ones aren't a shopping list.
  const needed = useMemo(() => items.filter((i) => i.status === "needed"), [items]);

  const grouped: GroupedSection[] = useMemo(() => {
    const map = new Map<string, GroupedSection>();
    for (const item of needed) {
      const section = classifyItem(item.name);
      const existing = map.get(section.id);
      if (existing) existing.items.push(item);
      else map.set(section.id, { section, items: [item] });
    }
    return Array.from(map.values()).sort(
      (a, b) => a.section.sortOrder - b.section.sortOrder,
    );
  }, [needed]);

  // ── Print pipeline ────────────────────────────────────────────────────
  // The print stage is rendered (display:none on screen) so it's available
  // to measure for "fit to N pages" before triggering the browser dialog.
  useEffect(() => {
    if (!printRequested) return;
    const stage = stageRef.current;
    if (!stage) {
      setPrintRequested(false);
      return;
    }

    let scale = 1;
    if (scaling === "fit") {
      const measured = measureStageHeight(stage);
      const target = Math.max(1, fitPages) * A4_INNER_HEIGHT_PX;
      const raw = measured > 0 ? target / measured : 1;
      scale = clamp(raw, 0.45, 1.5);
    }

    document.documentElement.style.setProperty("--print-scale", String(scale));
    document.body.setAttribute("data-print-active", "true");
    document.body.setAttribute("data-print-variant", variant);

    const cleanup = () => {
      document.body.removeAttribute("data-print-active");
      document.body.removeAttribute("data-print-variant");
      document.documentElement.style.removeProperty("--print-scale");
      window.removeEventListener("afterprint", cleanup);
      setPrintRequested(false);
    };
    window.addEventListener("afterprint", cleanup);

    // Defer to next frame so the data-attribute switch has applied. Use a
    // microtask delay otherwise some browsers print before the body attribute
    // is reflected in the print stylesheet.
    const handle = window.setTimeout(() => {
      try {
        window.print();
      } finally {
        // Some mobile browsers don't fire afterprint reliably — clean up
        // defensively after a tick if it never arrives.
        window.setTimeout(() => {
          if (document.body.getAttribute("data-print-active") === "true") {
            cleanup();
          }
        }, 1500);
      }
    }, 30);

    return () => {
      window.clearTimeout(handle);
      window.removeEventListener("afterprint", cleanup);
    };
  }, [printRequested, scaling, fitPages, variant]);

  async function handleAction() {
    if (needed.length === 0) {
      setToast({ message: "Nothing to print — list is empty.", tone: "warn" });
      setOpen(false);
      return;
    }

    if (scaling === "sms") {
      const txt = buildSmsText(needed);
      try {
        await navigator.clipboard.writeText(txt);
        setToast({
          message: `Copied ${needed.length} item${needed.length === 1 ? "" : "s"} to clipboard.`,
          tone: "info",
        });
      } catch {
        setToast({
          message: "Could not access clipboard. Try the Print option instead.",
          tone: "warn",
        });
      }
      setOpen(false);
      return;
    }

    // Print path. Close the modal first so it doesn't appear in the print
    // preview, then queue the print on the next tick.
    setOpen(false);
    requestAnimationFrame(() => setPrintRequested(true));
  }

  const actionLabel = scaling === "sms" ? "Copy to clipboard" : "Print";
  const disableAction = needed.length === 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={totalCount === 0}
        className="ui-btn ui-btn--ghost text-sm disabled:opacity-50"
        title="Print or send the shopping list"
      >
        <IconPrinter size={16} /> Print
      </button>

      <SheetModal
        open={open}
        onClose={() => setOpen(false)}
        title="Print shopping list"
        description={`${needed.length} item${needed.length === 1 ? "" : "s"} to get. Pick a layout.`}
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              className="ui-btn ui-btn--ghost text-sm"
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="ui-btn ui-btn--primary text-sm"
              onClick={handleAction}
              disabled={disableAction}
            >
              {actionLabel}
            </button>
          </div>
        }
      >
        <PrintOptionsForm
          variant={variant}
          onVariantChange={setVariant}
          scaling={scaling}
          onScalingChange={setScaling}
          fitPages={fitPages}
          onFitPagesChange={setFitPages}
        />
      </SheetModal>

      {/* The hidden print stage is portaled to <body> so it's a direct child
          of the print root. CSS in @media print hides everything else and
          shows just this. Always present so "fit" measurements are stable. */}
      <PrintStagePortal
        stageRef={stageRef}
        variant={variant}
        needed={needed}
        grouped={grouped}
      />

      {toast && (
        <UndoSnackbar
          message={
            <span className={toast.tone === "warn" ? "text-[var(--warn)]" : undefined}>
              {toast.message}
            </span>
          }
          duration={4000}
          onDismiss={() => setToast(null)}
        />
      )}
    </>
  );
}

// ── Modal contents ───────────────────────────────────────────────────────

function PrintOptionsForm({
  variant,
  onVariantChange,
  scaling,
  onScalingChange,
  fitPages,
  onFitPagesChange,
}: {
  variant: Variant;
  onVariantChange: (v: Variant) => void;
  scaling: Scaling;
  onScalingChange: (v: Scaling) => void;
  fitPages: number;
  onFitPagesChange: (n: number) => void;
}) {
  return (
    <div className="space-y-5">
      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Layout
        </legend>
        <RadioCard
          name="print-variant"
          value="simple"
          checked={variant === "simple"}
          onChange={() => onVariantChange("simple")}
          title="Simple"
          hint="Items and quantities only."
        />
        <RadioCard
          name="print-variant"
          value="enhanced"
          checked={variant === "enhanced"}
          onChange={() => onVariantChange("enhanced")}
          title="Enhanced"
          hint="Adds the supermarket aisle for each item."
        />
        <RadioCard
          name="print-variant"
          value="checklist"
          checked={variant === "checklist"}
          onChange={() => onVariantChange("checklist")}
          title="Full checklist"
          hint="Got box, allow-similar box, blank rows for write-ins."
        />
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Scaling
        </legend>
        <RadioCard
          name="print-scaling"
          value="none"
          checked={scaling === "none"}
          onChange={() => onScalingChange("none")}
          title="No scaling"
          hint="Standard 11pt size."
        />
        <RadioCard
          name="print-scaling"
          value="fit"
          checked={scaling === "fit"}
          onChange={() => onScalingChange("fit")}
          title="Fit to pages"
          hint="Shrink (or grow) text to fit a target page count."
          right={
            <span className="ui-stepper" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="ui-stepper__btn"
                onClick={() => onFitPagesChange(Math.max(1, fitPages - 1))}
                aria-label="Decrease pages"
                disabled={scaling !== "fit"}
              >
                −
              </button>
              <span className="ui-stepper__value">{fitPages}</span>
              <button
                type="button"
                className="ui-stepper__btn"
                onClick={() => onFitPagesChange(Math.min(9, fitPages + 1))}
                aria-label="Increase pages"
                disabled={scaling !== "fit"}
              >
                +
              </button>
            </span>
          }
        />
        <RadioCard
          name="print-scaling"
          value="sms"
          checked={scaling === "sms"}
          onChange={() => onScalingChange("sms")}
          title="Scale as SMS"
          hint="Plain text — names + qty per line. Copies to clipboard for paste into messages."
        />
      </fieldset>
    </div>
  );
}

function RadioCard({
  name,
  value,
  checked,
  onChange,
  title,
  hint,
  right,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  title: string;
  hint: string;
  right?: React.ReactNode;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
        checked
          ? "border-[var(--border-accent)] bg-[var(--accent-subtle)]"
          : "border-[var(--border)] bg-[var(--surface-inset)]"
      }`}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="mt-1 h-4 w-4 accent-[var(--accent)]"
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-[var(--foreground)]">
          {title}
        </span>
        <span className="block text-xs text-[var(--muted)]">{hint}</span>
      </span>
      {right}
    </label>
  );
}

// ── Print stage ──────────────────────────────────────────────────────────

const EMPTY_SUBSCRIBE = () => () => {};

function PrintStagePortal({
  stageRef,
  variant,
  needed,
  grouped,
}: {
  stageRef: React.RefObject<HTMLDivElement | null>;
  variant: Variant;
  needed: PrintShoppingItem[];
  grouped: GroupedSection[];
}) {
  // SSR-safe "are we mounted?" without an effect-driven setState — matches
  // the pattern used by UndoSnackbar.
  const mounted = useSyncExternalStore(
    EMPTY_SUBSCRIBE,
    () => true,
    () => false,
  );
  if (!mounted || typeof document === "undefined") return null;

  const today = new Date();
  const dateLabel = today.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  let body: React.ReactNode = null;
  if (variant === "simple") {
    body = <SimpleTable items={needed} />;
  } else if (variant === "enhanced") {
    body = <EnhancedTable grouped={grouped} />;
  } else {
    body = <ChecklistTable grouped={grouped} extraRowsPerSection={3} trailingBlankRows={10} />;
  }

  return createPortal(
    <div className="print-stage" aria-hidden="true" ref={stageRef}>
      <header className="print-header">
        <h1 className="print-title">Shopping List</h1>
        <span className="print-meta">{dateLabel}</span>
      </header>
      {body}
    </div>,
    document.body,
  );
}

function SimpleTable({ items }: { items: PrintShoppingItem[] }) {
  return (
    <table className="print-table print-table--simple">
      <thead>
        <tr>
          <th className="print-col-name">Item</th>
          <th className="print-col-qty">Qty</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.id}>
            <td>{item.name}</td>
            <td className="print-cell--qty">{formatQty(item)}</td>
          </tr>
        ))}
        {items.length === 0 && (
          <tr>
            <td colSpan={2} className="print-cell--empty">
              List is empty.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

function EnhancedTable({ grouped }: { grouped: GroupedSection[] }) {
  return (
    <table className="print-table print-table--enhanced">
      <thead>
        <tr>
          <th className="print-col-name">Item</th>
          <th className="print-col-qty">Qty</th>
          <th className="print-col-aisle">Aisle</th>
        </tr>
      </thead>
      <tbody>
        {grouped.flatMap(({ section, items }) => [
          <tr key={`section-${section.id}`} className="print-section-row">
            <td colSpan={3}>{section.name}</td>
          </tr>,
          ...items.map((item) => (
            <tr key={item.id}>
              <td>{item.name}</td>
              <td className="print-cell--qty">{formatQty(item)}</td>
              <td className="print-cell--aisle">{section.name}</td>
            </tr>
          )),
        ])}
        {grouped.length === 0 && (
          <tr>
            <td colSpan={3} className="print-cell--empty">
              List is empty.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

function ChecklistTable({
  grouped,
  extraRowsPerSection,
  trailingBlankRows,
}: {
  grouped: GroupedSection[];
  extraRowsPerSection: number;
  trailingBlankRows: number;
}) {
  return (
    <table className="print-table print-table--checklist">
      <thead>
        <tr>
          <th className="print-col-check">Got</th>
          <th className="print-col-name">Item</th>
          <th className="print-col-qty">Qty</th>
          <th className="print-col-aisle">Aisle</th>
          <th className="print-col-check">Sub OK</th>
        </tr>
      </thead>
      <tbody>
        {grouped.flatMap(({ section, items }) => [
          <tr key={`section-${section.id}`} className="print-section-row">
            <td colSpan={5}>{section.name}</td>
          </tr>,
          ...items.map((item) => (
            <tr key={item.id}>
              <td className="print-cell--check" />
              <td>{item.name}</td>
              <td className="print-cell--qty">{formatQty(item)}</td>
              <td className="print-cell--aisle">{section.name}</td>
              <td className="print-cell--check" />
            </tr>
          )),
          // Per-section write-in rows so the user can add items they spot in
          // each aisle as they walk past it.
          ...Array.from({ length: extraRowsPerSection }).map((_, i) => (
            <tr key={`blank-${section.id}-${i}`} className="print-blank-row">
              <td className="print-cell--check" />
              <td />
              <td className="print-cell--qty" />
              <td className="print-cell--aisle">{section.name}</td>
              <td className="print-cell--check" />
            </tr>
          )),
        ])}
        {grouped.length === 0 && (
          <tr>
            <td colSpan={5} className="print-cell--empty">
              List is empty.
            </td>
          </tr>
        )}
        {/* Tail block of unassigned blank rows for last-minute additions. */}
        {trailingBlankRows > 0 && (
          <tr className="print-section-row">
            <td colSpan={5}>Other / Notes</td>
          </tr>
        )}
        {Array.from({ length: trailingBlankRows }).map((_, i) => (
          <tr key={`tail-${i}`} className="print-blank-row">
            <td className="print-cell--check" />
            <td />
            <td className="print-cell--qty" />
            <td className="print-cell--aisle" />
            <td className="print-cell--check" />
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Measure the rendered height of a print-stage clone laid out at the printed
 * page width. We deliberately clone (not reuse) the live stage so any CSS
 * tied to data-print-active is bypassed and the measurement is pure.
 */
function measureStageHeight(stage: HTMLElement): number {
  if (typeof document === "undefined") return 0;
  const clone = stage.cloneNode(true) as HTMLElement;
  clone.classList.add("print-stage--measure");
  clone.style.position = "fixed";
  clone.style.left = "-9999px";
  clone.style.top = "0";
  clone.style.width = `${A4_INNER_WIDTH_MM}mm`;
  clone.style.display = "block";
  clone.style.visibility = "hidden";
  clone.style.pointerEvents = "none";
  document.body.appendChild(clone);
  const h = clone.scrollHeight;
  document.body.removeChild(clone);
  return h;
}
