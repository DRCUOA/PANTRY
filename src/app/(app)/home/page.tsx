import Link from "next/link";
import { getHomeSnapshot } from "@/actions/home";

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
        <h1 className="font-serif text-2xl font-semibold tracking-tight">Home</h1>
      </header>

      <Link
        href="/scan"
        className="flex w-full items-center justify-center rounded-2xl bg-[var(--accent)] py-4 text-center text-sm font-medium text-white shadow-sm hover:opacity-90"
      >
        Scan item
      </Link>

      {(s?.dailyCalories != null || s?.dailyProteinG != null) && (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm">
          <h2 className="font-medium text-[var(--muted)]">Goals</h2>
          <p className="mt-1 text-[var(--foreground)]">
            {s.dailyCalories != null && <span>{s.dailyCalories} kcal/day </span>}
            {s.dailyProteinG != null && <span>· {s.dailyProteinG} g protein/day</span>}
          </p>
          <p className="mt-2 text-xs text-[var(--muted)]">
            Light guidance only — set details in Settings.
          </p>
        </section>
      )}

      <section>
        <h2 className="mb-3 font-serif text-lg font-semibold">Expiring soon</h2>
        {data.expiring.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Nothing expiring in the next week.</p>
        ) : (
          <ul className="space-y-2">
            {data.expiring.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              >
                <span>{item.name}</span>
                <span className="text-[var(--warn)]">{item.expirationDate}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-serif text-lg font-semibold">Low stock</h2>
        {data.low.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No low-stock alerts.</p>
        ) : (
          <ul className="space-y-2">
            {data.low.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              >
                <span>{item.name}</span>
                <span className="text-[var(--muted)]">
                  {item.quantity} {item.unit}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-serif text-lg font-semibold">Cook with what you have</h2>
        {data.cookIdeas.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Add recipes under Plan to get ideas.</p>
        ) : (
          <ul className="space-y-2">
            {data.cookIdeas.map(({ recipe, matched, total }) => (
              <li
                key={recipe.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              >
                <span className="font-medium">{recipe.title}</span>
                <span className="ml-2 text-[var(--muted)]">
                  {matched}/{total} ingredients
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-serif text-lg font-semibold">Next planned meal</h2>
        {!data.nextMeal ? (
          <p className="text-sm text-[var(--muted)]">Nothing planned yet. Open Plan to add meals.</p>
        ) : (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3 text-sm">
            <p className="font-medium capitalize">{data.nextMeal.mealType}</p>
            <p className="text-[var(--muted)]">{data.nextMeal.plannedDate}</p>
            {data.nextMeal.recipeTitle && <p className="mt-1">{data.nextMeal.recipeTitle}</p>}
          </div>
        )}
      </section>
    </div>
  );
}
