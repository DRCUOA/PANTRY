import {
  listPantryItems,
  listPantryLocationSuggestions,
  listPantryUnitSuggestions,
  type PantryFilter,
} from "@/actions/pantry";
import type { PantryItemDTO } from "@/components/PantryEditSheet";
import { Aisle } from "@/components/ui/Aisle";
import { ChipRow, Chip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconPantry, IconSearch } from "@/components/ui/icons";
import { PantryRow } from "@/components/ui/PantryRow";
import { pantrySectionFor } from "@/lib/pantry-section";

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
  const filter = FILTERS.some((f) => f.key === sp.filter) ? (sp.filter as PantryFilter) : "all";
  const [rows, locationSuggestions, unitSuggestions] = await Promise.all([
    listPantryItems(q, filter),
    listPantryLocationSuggestions(),
    listPantryUnitSuggestions(),
  ]);
  const items = rows.map(toDto);

  const grouped = new Map<string, PantryItemDTO[]>();
  for (const item of items) {
    const key = pantrySectionFor(item);
    const bucket = grouped.get(key) ?? [];
    bucket.push(item);
    grouped.set(key, bucket);
  }
  const sectionOrder = ["Fridge", "Freezer", "Pantry"];
  const sortedSections = Array.from(grouped.keys()).sort((a, b) => {
    const ai = sectionOrder.indexOf(a);
    const bi = sectionOrder.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  return (
    <div className="space-y-4 pb-4">
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight md:text-3xl">Pantry</h1>
          <p className="text-sm text-[var(--muted)]">
            {items.length} {items.length === 1 ? "item" : "items"}
            {filter !== "all" && ` · ${FILTERS.find((f) => f.key === filter)?.label.toLowerCase()}`}
          </p>
        </div>
      </header>

      <form method="get" className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">
          <IconSearch size={20} />
        </span>
        <input type="hidden" name="filter" value={filter} />
        <input
          name="q"
          defaultValue={q}
          placeholder="Search pantry…"
          className="input-touch w-full rounded-full border border-[var(--border-strong)] bg-[var(--surface)] pl-10 pr-4 text-[var(--foreground)] placeholder:text-[var(--muted)]"
          autoComplete="off"
          inputMode="search"
        />
      </form>

      <ChipRow>
        {FILTERS.map(({ key, label }) => {
          const params = new URLSearchParams();
          if (key !== "all") params.set("filter", key);
          if (q) params.set("q", q);
          const href = `/pantry${params.toString() ? `?${params.toString()}` : ""}`;
          return (
            <Chip key={key} href={href} active={filter === key}>
              {label}
            </Chip>
          );
        })}
      </ChipRow>

      {items.length === 0 ? (
        <EmptyState
          icon={<IconPantry size={40} />}
          title={q ? `No match for “${q}”` : "Pantry is empty"}
          hint={
            q
              ? "Try a different word, or clear the search."
              : "Tap the + button to scan or type something in."
          }
        />
      ) : (
        <div className="ui-list-stack">
          {sortedSections.map((section) => {
            const sectionItems = grouped.get(section) ?? [];
            return (
              <Aisle key={section} title={section} count={sectionItems.length}>
                <ul className="space-y-2">
                  {sectionItems.map((item) => (
                    <li key={item.id}>
                      <PantryRow
                        item={item}
                        locationSuggestions={locationSuggestions}
                        unitSuggestions={unitSuggestions}
                      />
                    </li>
                  ))}
                </ul>
              </Aisle>
            );
          })}
        </div>
      )}
    </div>
  );
}
