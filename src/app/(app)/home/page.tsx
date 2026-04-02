import Link from "next/link";
import { getHomeSnapshot } from "@/actions/home";
import { SundayResetButton } from "@/components/SundayResetButton";
import { InstructionIcon } from "@/components/InstructionIcon";

const HOME_PANELS = [
  { id: "stock", label: "Stock" },
  { id: "cook", label: "Cook" },
  { id: "plan", label: "Plan" },
] as const;

type HomePanel = (typeof HOME_PANELS)[number]["id"];

function formatDate(d: Date) {
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function parsePanel(raw?: string): HomePanel {
  return HOME_PANELS.some((panel) => panel.id === raw) ? (raw as HomePanel) : "stock";
}

function buildHomeHref(panel: HomePanel) {
  return panel === "stock" ? "/home" : `/home?panel=${panel}`;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ panel?: string }>;
}) {
  const sp = await searchParams;
  const activePanel = parsePanel(sp.panel);
  const data = await getHomeSnapshot();
  const s = data.settings;

  return (
    <div className="space-y-8 pb-4">
      <header>
        <p className="text-sm text-[var(--muted)]">{formatDate(new Date())}</p>
        <h1 className="font-serif text-2xl font-semibold tracking-tight md:text-3xl">Home</h1>
      </header>

      <Link
        href="/scan"
        className="btn-primary-touch flex w-full items-center justify-center bg-[var(--accent)] font-semibold text-white shadow-[0_0_24px_var(--accent-glow)] active:opacity-90"
      >
        Scan item
      </Link>

      <div className="panel-switcher" role="tablist" aria-label="Home sections">
        {HOME_PANELS.map((panel) => {
          const active = activePanel === panel.id;
          return (
            <Link
              key={panel.id}
              href={buildHomeHref(panel.id)}
              className={`panel-switcher__tab ${active ? "panel-switcher__tab--active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              {panel.label}
            </Link>
          );
        })}
      </div>

      {(s?.dailyCalories != null || s?.dailyProteinG != null) && (
        <section className="panel-bordered border-l-4 border-l-[var(--accent)]">
          <h2 className="flex flex-wrap items-center gap-2 font-semibold uppercase tracking-wide text-[var(--muted)]">
            Goals
            <InstructionIcon text="Light guidance only — set full details in Settings." />
          </h2>
          <p className="mt-2 text-[var(--foreground)]">
            {s.dailyCalories != null && <span>{s.dailyCalories} kcal/day </span>}
            {s.dailyProteinG != null && <span>· {s.dailyProteinG} g protein/day</span>}
          </p>
        </section>
      )}

      {activePanel === "stock" && (
        <>
          <section className="panel-bordered">
            <h2 className="border-b border-[var(--border-strong)] pb-2 font-serif text-lg font-semibold">
              Expiring soon
            </h2>
            {data.expiring.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--muted)]">Nothing expiring in the next week.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {data.expiring.map((item) => (
                  <li key={item.id} className="receipt-card flex items-center justify-between gap-2">
                    <span className="font-medium">{item.name}</span>
                    <span className="receipt-card-muted shrink-0 text-[var(--warn)]">{item.expirationDate}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel-bordered">
            <h2 className="border-b border-[var(--border-strong)] pb-2 font-serif text-lg font-semibold">
              Low stock
            </h2>
            {data.low.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--muted)]">No low-stock alerts.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {data.low.map((item) => (
                  <li key={item.id} className="receipt-card flex items-center justify-between gap-2">
                    <span className="font-medium">{item.name}</span>
                    <span className="receipt-card-muted shrink-0">
                      {item.quantity} {item.unit}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {activePanel === "cook" && (
        <section className="panel-bordered">
          <h2 className="border-b border-[var(--border-strong)] pb-2 font-serif text-lg font-semibold">
            Cook with what you have
          </h2>
          {data.cookIdeas.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--muted)]">Add recipes under Plan to get ideas.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {data.cookIdeas.map(({ recipe, matched, total, variety }) => (
                <li key={recipe.id} className="receipt-card">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold">{recipe.title}</span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                        variety?.isVarietySafe ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {variety?.label ?? "Not seen in last 28 days"}
                    </span>
                  </div>
                  <span className="receipt-card-muted">
                    {matched}/{total} ingredients
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {activePanel === "plan" && (
        <section className="panel-bordered">
          <div className="border-b border-[var(--border-strong)] pb-3">
            <h2 className="font-serif text-lg font-semibold">Next planned meal</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">Refresh the next week with pantry-aware meal picks.</p>
            <div className="mt-3">
              <SundayResetButton />
            </div>
          </div>
          {!data.nextMeal ? (
            <p className="mt-3 text-sm text-[var(--muted)]">Nothing planned yet. Open Plan to add meals.</p>
          ) : (
            <div className="plan-meal-tile mt-3">
              <p className="receipt-card-muted uppercase tracking-wide">{data.nextMeal.mealType}</p>
              <p className="mt-1 font-mono text-sm text-[var(--muted)]">{data.nextMeal.plannedDate}</p>
              {data.nextMeal.recipeTitle && (
                <p className="mt-2 font-semibold leading-snug">{data.nextMeal.recipeTitle}</p>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
