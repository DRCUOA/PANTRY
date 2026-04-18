import Link from "next/link";
import { getHomeSnapshot } from "@/actions/home";
import { listShoppingItems } from "@/actions/shopping";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  IconAlert,
  IconChevronRight,
  IconClock,
  IconFire,
  IconPlan,
  IconSparkle,
} from "@/components/ui/icons";

function greeting(now: Date) {
  const h = now.getHours();
  if (h < 5) return "Good night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 22) return "Good evening";
  return "Good night";
}

function daysUntilIso(iso: string | null): number | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  const target = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function mealTimeLabel(mealType: string) {
  return mealType.charAt(0).toUpperCase() + mealType.slice(1);
}

export default async function HomePage() {
  const snap = await getHomeSnapshot();
  const shopping = await listShoppingItems();
  const remaining = shopping.filter((s) => s.status === "needed");

  const now = new Date();
  const dateLabel = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  const nextMeal = snap.nextMeal;
  const todayIso = now.toISOString().slice(0, 10);
  const nextMealIsToday = nextMeal?.plannedDate === todayIso;

  const pinnedRecipes = snap.cookIdeas.slice(0, 6);
  const expiringSoon = snap.expiring
    .slice(0, 6)
    .map((item) => ({
      ...item,
      days: daysUntilIso(item.expirationDate),
    }))
    .filter((item) => item.days != null);

  return (
    <div className="space-y-6 pb-4">
      <header className="space-y-1">
        <p className="text-sm font-medium text-[var(--muted)]">{dateLabel}</p>
        <h1 className="font-serif text-3xl font-semibold tracking-tight md:text-4xl">
          {greeting(now)}
        </h1>
      </header>

      {/* Tonight hero */}
      <section className="ui-card ui-card-lg ui-card--hero ui-today-hero">
        <div className="relative z-10">
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
            <IconFire size={14} /> {nextMealIsToday ? "Tonight" : "Next meal"}
          </p>
          {nextMeal ? (
            <>
              <h2 className="mt-2 font-serif text-2xl font-semibold leading-tight">
                {nextMeal.recipeTitle ?? "Free-form meal"}
              </h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {nextMealIsToday
                  ? mealTimeLabel(nextMeal.mealType)
                  : `${nextMeal.plannedDate} · ${mealTimeLabel(nextMeal.mealType)}`}
                {nextMeal.servings ? ` · ${nextMeal.servings} serving${Number(nextMeal.servings) === 1 ? "" : "s"}` : ""}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={`/plan?week=0`} className="ui-btn ui-btn--primary">
                  Open plan <IconChevronRight size={16} />
                </Link>
                {nextMeal.recipeId && (
                  <Link
                    href={`/recipes/${nextMeal.recipeId}`}
                    className="ui-btn ui-btn--ghost"
                  >
                    View recipe
                  </Link>
                )}
              </div>
            </>
          ) : (
            <>
              <h2 className="mt-2 font-serif text-2xl font-semibold leading-tight">
                Nothing planned yet
              </h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Plan tonight in a few taps.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href="/plan" className="ui-btn ui-btn--primary">
                  Plan a meal <IconChevronRight size={16} />
                </Link>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Cook from what you have */}
      <section>
        <div className="ui-section-title">
          <h3 className="ui-section-title__h">
            <span className="inline-flex items-center gap-1.5">
              <IconSparkle size={16} className="text-[var(--accent)]" /> Cook from what you have
            </span>
          </h3>
          <Link href="/plan?panel=recipes" className="ui-section-title__link">
            All
          </Link>
        </div>
        {pinnedRecipes.length === 0 ? (
          <EmptyState
            title="No suggestions yet"
            hint="Once you add recipes and pantry items, best matches for tonight appear here."
          />
        ) : (
          <div
            className="flex gap-3 overflow-x-auto pb-2 pt-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={{ scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch" }}
          >
            {pinnedRecipes.map(({ recipe, matched, total }) => {
              const missing = Math.max(0, total - matched);
              return (
                <Link
                  key={recipe.id}
                  href={`/recipes/${recipe.id}`}
                  className="ui-card shrink-0 basis-[72%] p-4 active:bg-[var(--surface-inset)] sm:basis-[44%]"
                  style={{ scrollSnapAlign: "start" }}
                >
                  <p className="text-[0.68rem] font-semibold uppercase tracking-wider text-[var(--muted)]">
                    {total > 0 ? `${matched}/${total} in pantry` : "Recipe"}
                  </p>
                  <p className="mt-1 font-semibold leading-tight">{recipe.title}</p>
                  <p className="mt-2 text-xs text-[var(--muted)]">
                    {missing === 0 ? "You have everything" : `${missing} missing`}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Use before they spoil */}
      <section>
        <div className="ui-section-title">
          <h3 className="ui-section-title__h">
            <span className="inline-flex items-center gap-1.5">
              <IconClock size={16} className="text-[var(--warn)]" /> Use before they spoil
            </span>
          </h3>
          <Link href="/pantry?filter=expiring" className="ui-section-title__link">
            Pantry
          </Link>
        </div>
        {expiringSoon.length === 0 ? (
          <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--muted)]">
            Nothing expiring this week.
          </p>
        ) : (
          <ul className="space-y-2">
            {expiringSoon.map((item) => {
              const d = item.days ?? 0;
              const tone =
                d < 0 ? "text-[var(--danger)]" : d <= 2 ? "text-[var(--warn)]" : "text-[var(--muted)]";
              const label =
                d < 0
                  ? `${Math.abs(d)}d past`
                  : d === 0
                    ? "Today"
                    : d === 1
                      ? "Tomorrow"
                      : `${d}d`;
              return (
                <li key={item.id} className="ui-item-row">
                  <div className="ui-item-row__body">
                    <p className="ui-item-row__title">{item.name}</p>
                    <p className="ui-item-row__meta">
                      {item.quantity} {item.unit}
                      {item.location ? ` · ${item.location}` : ""}
                    </p>
                  </div>
                  <div className={`text-right text-sm font-semibold ${tone}`}>{label}</div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Low stock / shopping peek */}
      <section>
        <div className="ui-section-title">
          <h3 className="ui-section-title__h">
            <span className="inline-flex items-center gap-1.5">
              <IconAlert size={16} className="text-[var(--accent)]" /> Shopping
            </span>
          </h3>
          <Link href="/shop" className="ui-section-title__link">
            Open list
          </Link>
        </div>
        {remaining.length === 0 ? (
          <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--muted)]">
            Shopping list is empty.
          </p>
        ) : (
          <ul className="space-y-2">
            {remaining.slice(0, 5).map((item) => (
              <li key={item.id} className="ui-item-row">
                <div className="ui-item-row__body">
                  <p className="ui-item-row__title">{item.name}</p>
                  <p className="ui-item-row__meta">
                    {item.quantity ? `${item.quantity} ${item.unit ?? ""}` : item.unit ?? ""}
                    {item.sourceRecipeTitle ? ` · from ${item.sourceRecipeTitle}` : ""}
                  </p>
                </div>
              </li>
            ))}
            {remaining.length > 5 && (
              <li className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--muted)]">
                +{remaining.length - 5} more
              </li>
            )}
          </ul>
        )}
      </section>

      {snap.low.length > 0 && (
        <section>
          <div className="ui-section-title">
            <h3 className="ui-section-title__h">
              <span className="inline-flex items-center gap-1.5">
                <IconPlan size={16} className="text-[var(--accent)]" /> Running low
              </span>
            </h3>
            <Link href="/pantry?filter=low" className="ui-section-title__link">
              Pantry
            </Link>
          </div>
          <ul className="space-y-2">
            {snap.low.slice(0, 5).map((item) => (
              <li key={item.id} className="ui-item-row">
                <div className="ui-item-row__body">
                  <p className="ui-item-row__title">{item.name}</p>
                  <p className="ui-item-row__meta">
                    {item.quantity} {item.unit}
                    {item.lowStockThreshold ? ` · low at ${item.lowStockThreshold}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
