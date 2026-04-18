import Link from "next/link";
import { eq } from "drizzle-orm";
import { addMealPlanEntry, listMealPlanRange } from "@/actions/meal-plan";
import { listPantryItemsForPickers } from "@/actions/pantry";
import { listRecipes } from "@/actions/recipes";
import { PlanMealTile } from "@/components/PlanMealTile";
import { SundayResetButton } from "@/components/SundayResetButton";
import { Chip, ChipRow } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconChevronLeft, IconChevronRight, IconPlan, IconPlus, IconSparkle } from "@/components/ui/icons";
import { WeekStrip, type DayPill } from "@/components/ui/WeekStrip";
import { getDb } from "@/db";
import { pantryItems } from "@/db/schema";
import { getSession } from "@/lib/get-session";
import { toPlanRecipeDetail } from "@/lib/plan-recipe";
import { recipePantryStatus } from "@/lib/recipe-score";
import { addDaysIso, mondayOfDate, toIsoDate, weekRangeMondayOffset } from "@/lib/week";

const MEALS = ["breakfast", "lunch", "dinner"] as const;

function parseIsoOrToday(raw: string | undefined): string {
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return toIsoDate(new Date());
}

function dayLabel(iso: string): { weekday: string; dateNum: number; long: string } {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y!, m! - 1, d!);
  return {
    weekday: dt.toLocaleDateString(undefined, { weekday: "short" }),
    dateNum: dt.getDate(),
    long: dt.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    }),
  };
}

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string; panel?: string }>;
}) {
  const sp = await searchParams;
  const selectedIso = parseIsoOrToday(sp.day);
  const [sy, sm, sd] = selectedIso.split("-").map(Number);
  const selectedDate = new Date(sy!, sm! - 1, sd!);
  const weekStart = mondayOfDate(selectedDate);
  const weekEnd = addDaysIso(weekStart, 6);
  const todayIso = toIsoDate(new Date());

  const meals = await listMealPlanRange(weekStart, weekEnd);
  const recipes = await listRecipes();
  const pantryPickers = await listPantryItemsForPickers();

  const session = await getSession();
  const userId = session.userId!;
  const db = getDb();
  const pantryRows = await db
    .select({
      name: pantryItems.name,
      expirationDate: pantryItems.expirationDate,
      quantity: pantryItems.quantity,
      lowStockThreshold: pantryItems.lowStockThreshold,
    })
    .from(pantryItems)
    .where(eq(pantryItems.userId, userId));

  // Build week strip
  const days: DayPill[] = Array.from({ length: 7 }, (_, i) => {
    const iso = addDaysIso(weekStart, i);
    const dl = dayLabel(iso);
    const mealDots = meals.filter((m) => m.plannedDate === iso).length;
    const params = new URLSearchParams({ day: iso });
    return {
      iso,
      label: dl.weekday,
      dateNum: dl.dateNum,
      isToday: iso === todayIso,
      isActive: iso === selectedIso,
      mealDots,
      href: `/plan?${params.toString()}`,
    };
  });

  const selectedLabel = dayLabel(selectedIso);
  const selectedMeals = meals.filter((m) => m.plannedDate === selectedIso);
  const prevWeek = addDaysIso(weekStart, -7);
  const nextWeek = addDaysIso(weekStart, 7);

  // Offset math
  const thisWeekStart = weekRangeMondayOffset(0).start;
  const weekOffset = Math.round(
    (new Date(weekStart + "T12:00Z").getTime() - new Date(thisWeekStart + "T12:00Z").getTime()) /
      (7 * 86400000),
  );
  const weekLabel =
    weekOffset === 0
      ? "This week"
      : weekOffset === -1
        ? "Last week"
        : weekOffset === 1
          ? "Next week"
          : weekOffset > 1
            ? `+${weekOffset} weeks`
            : `${weekOffset} weeks`;

  return (
    <div className="space-y-5 pb-4">
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight md:text-3xl">Plan</h1>
          <p className="text-sm text-[var(--muted)]">{selectedLabel.long}</p>
        </div>
        <Link href="/recipes" className="ui-btn ui-btn--ghost text-sm">
          Recipes
        </Link>
      </header>

      {/* Week navigation */}
      <div className="flex items-center justify-between gap-2">
        <Link
          href={`/plan?day=${prevWeek}`}
          className="tap-target rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-semibold text-[var(--muted)]"
          aria-label="Previous week"
        >
          <IconChevronLeft size={18} />
        </Link>
        <span className="text-sm font-semibold text-[var(--foreground)]">{weekLabel}</span>
        <Link
          href={`/plan?day=${nextWeek}`}
          className="tap-target rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-semibold text-[var(--muted)]"
          aria-label="Next week"
        >
          <IconChevronRight size={18} />
        </Link>
      </div>

      <WeekStrip days={days} />

      {/* Meal slots */}
      <section className="space-y-3">
        {MEALS.map((mealType) => {
          const entriesForSlot = selectedMeals.filter((m) => m.mealType === mealType);
          return (
            <div key={mealType}>
              <div className="ui-section-title">
                <h3 className="ui-section-title__h capitalize">{mealType}</h3>
              </div>
              {entriesForSlot.length === 0 ? (
                <form
                  action={async (fd: FormData) => {
                    "use server";
                    fd.set("plannedDate", selectedIso);
                    fd.set("mealType", mealType);
                    if (!fd.get("servings")) fd.set("servings", "1");
                    if (!fd.get("recipeId")) fd.set("recipeId", "none");
                    await addMealPlanEntry(fd);
                  }}
                >
                  <button
                    type="submit"
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface)] px-3 py-3 text-sm text-[var(--muted)] active:bg-[var(--surface-inset)]"
                  >
                    <IconPlus size={16} /> Add {mealType}
                  </button>
                </form>
              ) : (
                <ul className="space-y-2">
                  {entriesForSlot.map((entry) => {
                    const recipe = entry.recipeId
                      ? recipes.find((r) => r.id === entry.recipeId)
                      : null;
                    const recipeDetail = recipe ? toPlanRecipeDetail(recipe) : null;
                    let pantryRatio: string | null = null;
                    let missingRequired: number | null = null;
                    let missingSummary: string | null = null;
                    if (recipe) {
                      const { missing, matchedCount } = recipePantryStatus(
                        {
                          id: recipe.id,
                          title: recipe.title,
                          ingredients: recipe.ingredients.map((i) => ({
                            pantryItemName: i.pantryItemName,
                            optional: i.optional,
                          })),
                        },
                        pantryRows,
                      );
                      const requiredMissing = missing.filter((i) => !i.optional).length;
                      const totalIngredients = recipe.ingredients.length;
                      pantryRatio = totalIngredients > 0 ? `${matchedCount}/${totalIngredients}` : null;
                      missingRequired = requiredMissing;
                      missingSummary =
                        totalIngredients > 0
                          ? `${matchedCount}/${totalIngredients} in pantry · ${requiredMissing} missing`
                          : null;
                    }
                    return (
                      <li key={entry.id}>
                        <PlanMealTile
                          entryId={entry.id}
                          plannedDate={entry.plannedDate}
                          mealType={entry.mealType}
                          status={entry.status}
                          recipeTitle={recipe?.title ?? null}
                          recipeId={entry.recipeId}
                          recipeDetail={recipeDetail}
                          plannedServings={entry.servings}
                          mealNotes={entry.notes}
                          pantryOptions={pantryPickers}
                          pantryRatio={pantryRatio}
                          missingRequired={missingRequired}
                          missingSummary={missingSummary}
                          showPlannedActions={Boolean(
                            entry.recipeId && entry.status === "planned",
                          )}
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </section>

      {/* Add meal full-form fallback */}
      <details className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <summary className="tap-target cursor-pointer list-none font-semibold">
          <span className="inline-flex items-center gap-2">
            <IconPlus size={16} /> Add a specific recipe
          </span>
        </summary>
        <form action={addMealPlanEntry} className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                Date
              </span>
              <input
                type="date"
                name="plannedDate"
                required
                defaultValue={selectedIso}
                className="input-touch w-full rounded-lg border border-[var(--border-strong)] bg-[var(--background)]"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                Meal
              </span>
              <select
                name="mealType"
                required
                defaultValue="dinner"
                className="input-touch w-full rounded-lg border border-[var(--border-strong)] bg-[var(--background)]"
              >
                {MEALS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
              Recipe (optional)
            </span>
            <select
              name="recipeId"
              defaultValue="none"
              className="input-touch w-full rounded-lg border border-[var(--border-strong)] bg-[var(--background)]"
            >
              <option value="none">— no recipe —</option>
              {recipes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
              Servings
            </span>
            <input
              name="servings"
              type="number"
              min={0.5}
              step={0.5}
              defaultValue={1}
              className="input-touch w-full rounded-lg border border-[var(--border-strong)] bg-[var(--background)]"
            />
          </label>
          <button type="submit" className="ui-btn ui-btn--primary w-full">
            Add to plan
          </button>
        </form>
      </details>

      <section className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="ui-section-title">
          <h3 className="ui-section-title__h">
            <span className="inline-flex items-center gap-1.5">
              <IconSparkle size={16} className="text-[var(--accent)]" /> Quick plan the week
            </span>
          </h3>
        </div>
        <p className="text-sm text-[var(--muted)]">
          Let the Sunday reset fill empty slots based on what&apos;s about to expire and what you
          already have.
        </p>
        <SundayResetButton />
        <div className="border-t border-[var(--border)] pt-3">
          <ChipRow>
            <Chip href="/recipes">Browse recipes</Chip>
            <Chip href="/recipes/new">New recipe</Chip>
            <Chip href="/shop">Shopping list</Chip>
          </ChipRow>
        </div>
      </section>

      {selectedMeals.length === 0 && (
        <EmptyState
          icon={<IconPlan size={40} />}
          title="Nothing planned yet"
          hint="Tap any empty meal slot above, or run a quick reset to fill the whole week."
        />
      )}
    </div>
  );
}

