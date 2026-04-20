import Link from "next/link";
import { getCurrentUser } from "@/actions/auth";
import { getHomeSnapshot } from "@/actions/home";
import { getUserSettings } from "@/actions/settings";
import { listShoppingItems } from "@/actions/shopping";
import { UserAvatar } from "@/components/UserAvatar";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  IconChevronRight,
  IconFire,
} from "@/components/ui/icons";
import { hourInZone, isoDateInZone, resolveTimezone } from "@/lib/timezone";

function greetingForHour(h: number) {
  if (h < 5) return "Good night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 22) return "Good evening";
  return "Good night";
}

function daysUntilIso(iso: string | null, todayIso: string): number | null {
  if (!iso) return null;
  const [ty, tm, td] = todayIso.split("-").map(Number);
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d || !ty || !tm || !td) return null;
  const target = Date.UTC(y, m - 1, d);
  const today = Date.UTC(ty, tm - 1, td);
  return Math.round((target - today) / 86400000);
}

function mealTimeLabel(mealType: string) {
  return mealType.charAt(0).toUpperCase() + mealType.slice(1);
}

export default async function HomePage() {
  const [snap, shopping, settings, user] = await Promise.all([
    getHomeSnapshot(),
    listShoppingItems(),
    getUserSettings(),
    getCurrentUser(),
  ]);
  const remaining = shopping.filter((s) => s.status === "needed");

  const tz = await resolveTimezone(settings?.timezone);
  const now = new Date();
  const todayIso = isoDateInZone(now, tz);
  const dateLabel = new Intl.DateTimeFormat(undefined, {
    timeZone: tz,
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(now);

  const nextMeal = snap.nextMeal;
  const nextMealIsToday = nextMeal?.plannedDate === todayIso;

  const pinnedRecipes = snap.cookIdeas.slice(0, 4);
  const expiringSoon = snap.expiring
    .slice(0, 4)
    .map((item) => ({
      ...item,
      days: daysUntilIso(item.expirationDate, todayIso),
    }))
    .filter((item) => item.days != null);

  return (
    <div className="space-y-5 pb-4">
      {/* Greeting */}
      <header className="flex items-center gap-3">
        <UserAvatar
          info={{
            version: settings?.avatarUpdatedAt ? settings.avatarUpdatedAt.getTime() : null,
            hasImage: !!settings?.avatarMime,
            name: user?.name ?? null,
            email: user?.email ?? null,
          }}
          size={52}
          href="/settings"
          linkLabel="Open settings"
        />
        <div className="min-w-0">
          <p className="text-sm text-[var(--muted)]">{dateLabel}</p>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">
            {greetingForHour(hourInZone(now, tz))}
            {user?.name ? `, ${user.name.split(/\s+/)[0]}` : ""}
          </h1>
        </div>
      </header>

      {/* Next meal — compact card */}
      <section className="rounded-2xl border border-[var(--border-accent)] bg-[var(--surface)] p-4">
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
          <IconFire size={14} /> {nextMealIsToday ? "Tonight" : "Next meal"}
        </p>
        {nextMeal ? (
          <div className="mt-2 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-serif text-xl font-semibold leading-tight truncate">
                {nextMeal.recipeTitle ?? "Free-form meal"}
              </p>
              <p className="mt-0.5 text-sm text-[var(--muted)]">
                {nextMealIsToday
                  ? mealTimeLabel(nextMeal.mealType)
                  : `${nextMeal.plannedDate} · ${mealTimeLabel(nextMeal.mealType)}`}
              </p>
            </div>
            <Link href="/plan?week=0" className="shrink-0 rounded-full border border-[var(--border-strong)] p-2.5 text-[var(--muted)]">
              <IconChevronRight size={18} />
            </Link>
          </div>
        ) : (
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-sm text-[var(--muted)]">Nothing planned yet</p>
            <Link href="/plan" className="ui-btn ui-btn--primary px-4 text-sm" style={{ minHeight: 40 }}>
              Plan
            </Link>
          </div>
        )}
      </section>

      {/* Cook from what you have */}
      {pinnedRecipes.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between pb-2">
            <h3 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wider">
              Cook from what you have
            </h3>
            <Link href="/plan?panel=recipes" className="text-sm font-semibold text-[var(--accent)]">
              All
            </Link>
          </div>
          <ul className="space-y-2">
            {pinnedRecipes.map(({ recipe, matched, total }) => {
              const missing = Math.max(0, total - matched);
              return (
                <li key={recipe.id}>
                  <Link
                    href={`/recipes/${recipe.id}`}
                    className="ui-item-row active:bg-[var(--surface-inset)]"
                  >
                    <div className="ui-item-row__body">
                      <p className="ui-item-row__title">{recipe.title}</p>
                      <p className="ui-item-row__meta">
                        {total > 0
                          ? missing === 0
                            ? "You have everything"
                            : `${matched}/${total} in pantry`
                          : "Recipe"}
                      </p>
                    </div>
                    <span className="text-[var(--muted)]">
                      <IconChevronRight size={16} />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Expiring soon */}
      {expiringSoon.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between pb-2">
            <h3 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wider">
              Use soon
            </h3>
            <Link href="/pantry?filter=expiring" className="text-sm font-semibold text-[var(--accent)]">
              Pantry
            </Link>
          </div>
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
                    </p>
                  </div>
                  <span className={`text-sm font-semibold ${tone}`}>{label}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Shopping peek — only if items exist */}
      {remaining.length > 0 && (
        <section>
          <Link
            href="/shop"
            className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 active:bg-[var(--surface-inset)]"
          >
            <div>
              <p className="font-semibold">Ready to shop?</p>
              <p className="text-sm text-[var(--muted)]">{remaining.length} item{remaining.length !== 1 ? "s" : ""} on your list</p>
            </div>
            <span className="text-[var(--accent)]">
              <IconChevronRight size={18} />
            </span>
          </Link>
        </section>
      )}

      {/* Fallback empty state when nothing is populated */}
      {!nextMeal && pinnedRecipes.length === 0 && expiringSoon.length === 0 && remaining.length === 0 && (
        <EmptyState
          title="Your kitchen is quiet"
          hint="Tap the basket button below to start adding items to your pantry."
        />
      )}
    </div>
  );
}
