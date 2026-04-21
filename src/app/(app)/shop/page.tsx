import { listPantryUnitSuggestions } from "@/actions/pantry";
import { listRecentShoppingNames, listShoppingItems } from "@/actions/shopping";
import { ClearShoppingButton } from "@/components/ClearShoppingButton";
import { ShoppingQuickAddForm } from "@/components/ShoppingQuickAddForm";
import { Aisle } from "@/components/ui/Aisle";
import { ChipRow, Chip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconShop } from "@/components/ui/icons";
import { ShoppingRow } from "@/components/ui/ShoppingRow";
import { classifyItem, type SupermarketSection } from "@/lib/supermarket-sections";

type Filter = "active" | "bought" | "all";

function parseFilter(raw?: string): Filter {
  if (raw === "bought" || raw === "all") return raw;
  return "active";
}

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const sp = await searchParams;
  const filter = parseFilter(sp.filter);
  const [all, unitSuggestions, recentNames] = await Promise.all([
    listShoppingItems(),
    listPantryUnitSuggestions(),
    listRecentShoppingNames(),
  ]);
  const activeCount = all.filter((i) => i.status === "needed").length;
  const boughtCount = all.length - activeCount;

  const visible =
    filter === "bought"
      ? all.filter((i) => i.status === "bought")
      : filter === "all"
        ? all
        : all.filter((i) => i.status === "needed");

  const grouped = new Map<string, { section: SupermarketSection; items: typeof all }>();
  for (const item of visible) {
    const section = classifyItem(item.name);
    const existing = grouped.get(section.id);
    if (existing) {
      existing.items.push(item);
    } else {
      grouped.set(section.id, { section, items: [item] });
    }
  }
  const sortedSections = Array.from(grouped.values()).sort(
    (a, b) => a.section.sortOrder - b.section.sortOrder,
  );

  return (
    <div className="space-y-4 pb-4">
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight md:text-3xl">Shopping</h1>
          <p className="text-sm text-[var(--muted)]">
            {activeCount} to get · {boughtCount} done
          </p>
        </div>
        <ClearShoppingButton totalCount={all.length} />
      </header>

      <ShoppingQuickAddForm
        unitSuggestions={unitSuggestions}
        recentNames={recentNames}
      />

      <ChipRow>
        <Chip href="/shop" active={filter === "active"} count={activeCount}>
          To get
        </Chip>
        <Chip href="/shop?filter=bought" active={filter === "bought"} count={boughtCount}>
          Bought
        </Chip>
        <Chip href="/shop?filter=all" active={filter === "all"} count={all.length}>
          All
        </Chip>
      </ChipRow>

      {visible.length === 0 ? (
        <EmptyState
          icon={<IconShop size={40} />}
          title={filter === "bought" ? "Nothing checked off" : "List is clear"}
          hint={
            filter === "bought"
              ? "Items you tick appear here until you clear them."
              : "Add what you need above, or let the Plan tab pull missing ingredients for you."
          }
        />
      ) : (
        <div className="ui-list-stack">
          {sortedSections.map(({ section, items }) => (
            <Aisle key={section.id} title={section.name} count={items.length}>
              <ul className="space-y-2">
                {items.map((item) => (
                  <li key={item.id}>
                    <ShoppingRow
                      item={{
                        id: item.id,
                        name: item.name,
                        quantity: item.quantity,
                        unit: item.unit,
                        status: item.status,
                        sourceRecipeTitle: item.sourceRecipeTitle,
                      }}
                    />
                  </li>
                ))}
              </ul>
            </Aisle>
          ))}
        </div>
      )}
    </div>
  );
}
