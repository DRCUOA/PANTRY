import Link from "next/link";
import { listPantryItems, listPantryLocationSuggestions, type PantryFilter } from "@/actions/pantry";
import { PantryEditSheet, type PantryItemDTO } from "@/components/PantryEditSheet";

const FILTERS: { key: PantryFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "expiring", label: "Expiring" },
  { key: "low", label: "Low" },
  { key: "fridge", label: "Fridge" },
  { key: "freezer", label: "Freezer" },
  { key: "pantry", label: "Pantry" },
];

function toDto(row: Awaited<ReturnType<typeof listPantryItems>>[number]): PantryItemDTO {
  return {
    id: row.id,
    name: row.name,
    quantity: String(row.quantity),
    unit: row.unit,
    category: row.category,
    location: row.location,
    barcode: row.barcode,
    expirationDate: row.expirationDate,
    lowStockThreshold: row.lowStockThreshold != null ? String(row.lowStockThreshold) : null,
    productId: row.productId,
    notes: row.notes,
  };
}

export default async function PantryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q ?? "";
  const filter = FILTERS.some((f) => f.key === sp.filter)
    ? (sp.filter as PantryFilter)
    : "all";
  const items = await listPantryItems(q, filter);
  const locationSuggestions = await listPantryLocationSuggestions();

  return (
    <div className="space-y-6 pb-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-serif text-2xl font-semibold tracking-tight md:text-3xl">Pantry</h1>
        <Link
          href="/scan"
          className="tap-target rounded-lg border border-[var(--border-accent)] bg-[var(--accent-subtle)] px-4 text-sm font-semibold text-[var(--accent)]"
        >
          Add
        </Link>
      </div>

      <form method="get" className="panel-bordered flex flex-wrap gap-2">
        <input type="hidden" name="filter" value={filter} />
        <input
          name="q"
          defaultValue={q}
          placeholder="Search…"
          className="input-touch min-w-0 flex-1 border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted)]"
        />
        <button
          type="submit"
          className="btn-primary-touch border border-[var(--border-strong)] bg-[var(--surface-elevated)] text-[var(--foreground)]"
        >
          Go
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map(({ key, label }) => {
          const href = `/pantry?filter=${key}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
          const active = filter === key;
          return (
            <Link
              key={key}
              href={href}
              className={`tap-target rounded-full px-4 text-sm font-semibold ${
                active
                  ? "bg-[var(--accent)] text-white"
                  : "border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--muted)]"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No items match. Add something from Scan.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((row) => (
            <li key={row.id}>
              <PantryEditSheet item={toDto(row)} locationSuggestions={locationSuggestions} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
