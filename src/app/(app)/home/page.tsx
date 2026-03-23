import Link from "next/link";
import { getHomeSnapshot } from "@/actions/home";
import { InstructionIcon } from "@/components/InstructionIcon";

function formatDate(d: Date) {
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export default async function HomePage() {
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

      <section className="panel-bordered">
        <h2 className="border-b border-[var(--border-strong)] pb-2 font-serif text-lg font-semibold">
          Cook with what you have
        </h2>
        {data.cookIdeas.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--muted)]">Add recipes under Plan to get ideas.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {data.cookIdeas.map(({ recipe, matched, total }) => (
              <li key={recipe.id} className="receipt-card">
                <span className="font-semibold">{recipe.title}</span>
                <span className="receipt-card-muted ml-2">
                  {matched}/{total} ingredients
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel-bordered border-l-4 border-l-[var(--accent)]">
        <h2 className="border-b border-[var(--border-strong)] pb-2 font-serif text-lg font-semibold">
          Need a new idea
        </h2>
        <p className="mt-3 text-sm text-[var(--muted)]">
          Turn your current pantry into a few reviewable recipe drafts, then save only the ones worth keeping.
        </p>
        <Link
          href="/plan?panel=recipes#ai-recipe-drafts"
          className="tap-target mt-4 inline-flex rounded-lg border border-[var(--border-accent)] bg-[var(--accent-subtle)] px-3 py-2 text-sm font-semibold text-[var(--accent)]"
        >
          Draft recipes from pantry
        </Link>
      </section>

      <section className="panel-bordered">
        <h2 className="border-b border-[var(--border-strong)] pb-2 font-serif text-lg font-semibold">
          Next planned meal
        </h2>
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
    </div>
  );
}
