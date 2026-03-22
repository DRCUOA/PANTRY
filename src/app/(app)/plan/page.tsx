import Link from "next/link";
import { eq } from "drizzle-orm";
import { listRecipes } from "@/actions/recipes";
import { addMealPlanEntry, listMealPlanRange } from "@/actions/meal-plan";
import { listPantryItemsForPickers } from "@/actions/pantry";
import { deleteShoppingItem, listShoppingItems, toggleShoppingItemBought } from "@/actions/shopping";
import { InstructionIcon } from "@/components/InstructionIcon";
import { ShoppingListAddForm } from "@/components/ShoppingListAddForm";
import { getDb } from "@/db";
import { pantryItems } from "@/db/schema";
import { getSession } from "@/lib/get-session";
import { addDaysIso, weekRangeMondayOffset } from "@/lib/week";
import { RecipeLibrarySection } from "@/components/RecipeLibrarySection";
import { toPlanRecipeDetail, type PlanRecipeDetail } from "@/lib/plan-recipe";
import { recipePantryStatus } from "@/lib/recipe-score";
import { PlanMealTile } from "@/components/PlanMealTile";
import { PlanDayHeaderCell } from "@/components/PlanDayHeaderCell";
import { PlanDayColumn, PlanDndRoot } from "@/components/PlanScheduleDnd";
import { PlanSwipeContainer } from "@/components/PlanSwipeContainer";

const MEALS = ["breakfast", "lunch", "dinner"] as const;

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const sp = await searchParams;
  const weekOffset = Number(sp.week) || 0;
  const { start, end } = weekRangeMondayOffset(weekOffset);
  const meals = await listMealPlanRange(start, end);
  const recipes = await listRecipes();
  const shopping = await listShoppingItems();
  const pantryPickers = await listPantryItemsForPickers();

  const session = await getSession();
  const userId = session.userId!;
  const db = getDb();
  const pantryRows = await db
    .select({ name: pantryItems.name, expirationDate: pantryItems.expirationDate })
    .from(pantryItems)
    .where(eq(pantryItems.userId, userId));

  const byDate = new Map<string, typeof meals>();
  for (const m of meals) {
    const arr = byDate.get(m.plannedDate) ?? [];
    arr.push(m);
    byDate.set(m.plannedDate, arr);
  }

  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    days.push(addDaysIso(start, i));
  }

  const dayLabels = days.map((date) => {
    const d = new Date(date + "T12:00:00");
    return {
      iso: date,
      header: d.toLocaleDateString(undefined, { weekday: "short" }),
      sub: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      mobile: d.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
    };
  });

  return (
    <PlanSwipeContainer weekOffset={weekOffset}>
      <div className="space-y-8 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="font-serif text-2xl font-semibold tracking-tight md:text-3xl">Plan</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/recipes/new"
              className="tap-target rounded-lg border border-[var(--border-accent)] bg-[var(--accent-subtle)] px-3 py-2 text-sm font-semibold text-[var(--accent)]"
            >
              New recipe
            </Link>
            <span className="text-xs text-[var(--muted)]">Import template</span>
            <a
              href="/templates/recipe-import.json"
              download="recipe-import-template.json"
              title="Download JSON recipe import template"
              className="tap-target rounded-lg border border-[var(--border-strong)] bg-[var(--background)] px-2.5 py-2 text-xs font-semibold text-[var(--foreground)]"
            >
              JSON ↓
            </a>
            <a
              href="/templates/recipe-import.csv"
              download="recipe-import-template.csv"
              title="Download CSV recipe import template"
              className="tap-target rounded-lg border border-[var(--border-strong)] bg-[var(--background)] px-2.5 py-2 text-xs font-semibold text-[var(--foreground)]"
            >
              CSV ↓
            </a>
            <Link
              href="/recipes/new#recipe-import-templates"
              className="tap-target text-xs font-medium text-[var(--accent)]"
            >
              How to use
            </Link>
          </div>
        </div>

        <div className="plan-outer-frame">
          <div className="plan-week-nav">
            <Link href={`/plan?week=${weekOffset - 1}`} className="min-w-14 shrink-0">
              ← Prev
            </Link>
            <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-center">
              {weekOffset !== 0 && (
                <Link
                  href="/plan"
                  className="text-xs font-semibold text-[var(--today-fg)] hover:underline"
                >
                  This week
                </Link>
              )}
              <span className="text-sm font-mono text-[var(--foreground)]">
                {start}
                <span className="text-[var(--muted)]"> — </span>
                {end}
              </span>
            </div>
            <Link href={`/plan?week=${weekOffset + 1}`} className="min-w-14 shrink-0">
              Next →
            </Link>
          </div>

          <div className="plan-day-headers">
            {dayLabels.map((dl) => (
              <PlanDayHeaderCell key={dl.iso} iso={dl.iso} header={dl.header} sub={dl.sub} />
            ))}
          </div>

          <PlanDndRoot>
            <div className="plan-week-body">
              {dayLabels.map((dl) => {
                const date = dl.iso;
                const slotMeals = byDate.get(date) ?? [];
                return (
                  <PlanDayColumn
                    key={date}
                    date={date}
                    mobileLabel={dl.mobile}
                    mealCountDesktop={`${slotMeals.length} meal${slotMeals.length === 1 ? "" : "s"}`}
                  >
                    {slotMeals.length === 0 ? (
                      <p className="mt-2 text-sm text-[var(--muted)]">—</p>
                    ) : (
                      <ul className="mt-1 list-none space-y-0 p-0">
                        {slotMeals.map((entry) => {
                          const recipe = entry.recipeId
                            ? recipes.find((r) => r.id === entry.recipeId)
                            : null;
                          const recipeDetail: PlanRecipeDetail | null = recipe
                            ? toPlanRecipeDetail(recipe)
                            : null;
                          let missingSummary: string | null = null;
                          let pantryRatio: string | null = null;
                          let missingRequired: number | null = null;
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
                            const need = missing.filter((m) => !m.optional).length;
                            const total = recipe.ingredients.length;
                            pantryRatio = total > 0 ? `${matchedCount}/${total}` : null;
                            missingRequired = need;
                            missingSummary =
                              total > 0
                                ? `${matchedCount}/${total} in pantry · ${need} missing`
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
                  </PlanDayColumn>
                );
              })}
            </div>
          </PlanDndRoot>

          <div className="swipe-hint flex items-center justify-center gap-2 py-1">
            <InstructionIcon text="Swipe left or right on this area to change the week, or use Prev / Next above. Drag a meal by the grip (left of each tile) onto another day to move or duplicate it. On iPad or phone, press and hold the grip briefly, then drag." />
          </div>
        </div>

        <section className="plan-form-panel">
          <h2 className="font-serif text-lg font-semibold text-[var(--accent)]">Add meal</h2>
          <form action={addMealPlanEntry} className="mt-3 space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                Date
              </label>
              <input
                type="date"
                name="plannedDate"
                required
                defaultValue={start}
                className="input-touch w-full border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                Meal
              </label>
              <select
                name="mealType"
                required
                className="input-touch w-full border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)]"
              >
                {MEALS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                Recipe
              </label>
              <select
                name="recipeId"
                className="input-touch w-full border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)]"
              >
                <option value="none">— optional —</option>
                {recipes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                Servings
              </label>
              <input
                name="servings"
                type="number"
                min={0.5}
                step={0.5}
                defaultValue={1}
                className="input-touch w-full border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)]"
              />
            </div>
            <button type="submit" className="btn-primary-touch w-full bg-[var(--accent)] text-white">
              Add to plan
            </button>
          </form>
        </section>

        <section className="panel-bordered">
          <h2 className="border-b border-[var(--border-strong)] pb-2 font-serif text-lg font-semibold">
            Recipes
          </h2>
          <RecipeLibrarySection recipes={recipes} pantryOptions={pantryPickers} />
        </section>

        <section className="panel-bordered">
          <h2 className="border-b border-[var(--border-strong)] pb-2 font-serif text-lg font-semibold">
            Shopping list
          </h2>
          <ShoppingListAddForm pantryOptions={pantryPickers} />
          <ul className="mt-4 space-y-2">
            {shopping.length === 0 ? (
              <li className="text-sm text-[var(--muted)]">List is empty</li>
            ) : (
              shopping.map((item) => (
                <li key={item.id} className="receipt-card flex items-center justify-between gap-2">
                  <form action={toggleShoppingItemBought.bind(null, item.id)} className="min-w-0 flex-1">
                    <button
                      type="submit"
                      className={`w-full rounded-md py-2 text-left ${
                        item.status === "bought" ? "text-[var(--muted)] line-through" : ""
                      }`}
                    >
                      {item.name}
                      {item.quantity != null && (
                        <span className="receipt-card-muted ml-2">
                          {item.quantity} {item.unit ?? ""}
                        </span>
                      )}
                    </button>
                  </form>
                  <form action={deleteShoppingItem.bind(null, item.id)}>
                    <button type="submit" className="tap-target text-lg leading-none text-[var(--danger)]">
                      ✕
                    </button>
                  </form>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </PlanSwipeContainer>
  );
}
