import Link from "next/link";
import { eq } from "drizzle-orm";
import { listRecipes } from "@/actions/recipes";
import { addMealPlanEntry, listMealPlanRange } from "@/actions/meal-plan";
import { listPantryItemsForPickers } from "@/actions/pantry";
import { deleteShoppingItem, listShoppingItems, toggleShoppingItemBought } from "@/actions/shopping";
import { InstructionIcon } from "@/components/InstructionIcon";
import { PlanDayHeaderCell } from "@/components/PlanDayHeaderCell";
import { PlanMealTile } from "@/components/PlanMealTile";
import { PlanDayColumn, PlanDndRoot } from "@/components/PlanScheduleDnd";
import { PlanSwipeContainer } from "@/components/PlanSwipeContainer";
import { AiRecipeDraftsPanel } from "@/components/AiRecipeDraftsPanel";
import { RecipeLibrarySection } from "@/components/RecipeLibrarySection";
import { ShoppingListAddForm } from "@/components/ShoppingListAddForm";
import { getDb } from "@/db";
import { pantryItems } from "@/db/schema";
import { getSession } from "@/lib/get-session";
import { toPlanRecipeDetail, type PlanRecipeDetail } from "@/lib/plan-recipe";
import { recipePantryStatus } from "@/lib/recipe-score";
import { addDaysIso, weekRangeMondayOffset } from "@/lib/week";

const MEALS = ["breakfast", "lunch", "dinner"] as const;
const PLAN_PANELS = [
  { id: "schedule", label: "Schedule" },
  { id: "recipes", label: "Recipes" },
  { id: "shopping", label: "Shopping" },
] as const;

type PlanPanel = (typeof PLAN_PANELS)[number]["id"];

function parseWeekOffset(raw?: string) {
  const weekOffset = Number(raw);
  return Number.isFinite(weekOffset) ? weekOffset : 0;
}

function parsePanel(raw?: string): PlanPanel {
  return PLAN_PANELS.some((panel) => panel.id === raw) ? (raw as PlanPanel) : "schedule";
}

function buildPlanHref(weekOffset: number, panel: PlanPanel) {
  const params = new URLSearchParams();
  if (weekOffset !== 0) {
    params.set("week", String(weekOffset));
  }
  if (panel !== "schedule") {
    params.set("panel", panel);
  }
  const query = params.toString();
  return query ? `/plan?${query}` : "/plan";
}

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ panel?: string; week?: string }>;
}) {
  const sp = await searchParams;
  const weekOffset = parseWeekOffset(sp.week);
  const activePanel = parsePanel(sp.panel);
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
  for (const meal of meals) {
    const rows = byDate.get(meal.plannedDate) ?? [];
    rows.push(meal);
    byDate.set(meal.plannedDate, rows);
  }

  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    days.push(addDaysIso(start, i));
  }

  const dayLabels = days.map((date) => {
    const d = new Date(`${date}T12:00:00`);
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

  const prevHref = buildPlanHref(weekOffset - 1, activePanel);
  const nextHref = buildPlanHref(weekOffset + 1, activePanel);
  const thisWeekHref = buildPlanHref(0, activePanel);

  function renderRecipesPanel() {
    return (
      <section className="panel-bordered">
        <div className="flex flex-col gap-3 border-b border-[var(--border-strong)] pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="font-serif text-lg font-semibold">Recipes</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Browse what you already know how to cook, then edit or import when needed.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/recipes/new"
                className="tap-target rounded-lg border border-[var(--border-accent)] bg-[var(--accent-subtle)] px-3 py-2 text-sm font-semibold text-[var(--accent)]"
              >
                New recipe
              </Link>
              <a
                href="/templates/recipe-import.json"
                download="recipe-import-template.json"
                title="Download JSON recipe import template"
                className="tap-target rounded-lg border border-[var(--border-strong)] bg-[var(--background)] px-2.5 py-2 text-xs font-semibold text-[var(--foreground)]"
              >
                JSON
              </a>
              <a
                href="/templates/recipe-import.csv"
                download="recipe-import-template.csv"
                title="Download CSV recipe import template"
                className="tap-target rounded-lg border border-[var(--border-strong)] bg-[var(--background)] px-2.5 py-2 text-xs font-semibold text-[var(--foreground)]"
              >
                CSV
              </a>
              <Link
                href="/recipes/new#recipe-import-templates"
                className="tap-target text-xs font-medium text-[var(--accent)]"
              >
                Import help
              </Link>
            </div>
          </div>
        </div>
        <div className="mt-4">
          <AiRecipeDraftsPanel />
        </div>
        <RecipeLibrarySection recipes={recipes} pantryOptions={pantryPickers} />
      </section>
    );
  }

  function renderShoppingPanel() {
    return (
      <section className="panel-bordered">
        <div className="border-b border-[var(--border-strong)] pb-3">
          <h2 className="font-serif text-lg font-semibold">Shopping list</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Add missing ingredients or quick reminders without leaving the plan flow.
          </p>
        </div>
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
    );
  }

  return (
    <div className="space-y-6 pb-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight md:text-3xl">Plan</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Keep the week focused: schedule first, then recipes and shopping when you need them.
          </p>
        </div>
        <div className="panel-switcher md:hidden" role="tablist" aria-label="Plan sections">
          {PLAN_PANELS.map((panel) => {
            const active = activePanel === panel.id;
            return (
              <Link
                key={panel.id}
                href={buildPlanHref(weekOffset, panel.id)}
                className={`panel-switcher__tab ${active ? "panel-switcher__tab--active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                {panel.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className={activePanel === "schedule" ? "space-y-4" : "hidden space-y-4 md:block"}>
        <div className="space-y-4 lg:grid lg:grid-cols-[minmax(0,1.8fr)_minmax(18rem,1fr)] lg:items-start lg:gap-6 lg:space-y-0">
          <PlanSwipeContainer prevHref={prevHref} nextHref={nextHref}>
            <div className="plan-outer-frame">
              <div className="plan-week-nav">
                <Link href={prevHref} className="min-w-14 shrink-0">
                  ← Prev
                </Link>
                <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-center">
                  {weekOffset !== 0 && (
                    <Link
                      href={thisWeekHref}
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
                <Link href={nextHref} className="min-w-14 shrink-0">
                  Next →
                </Link>
              </div>

              <div className="plan-day-headers">
                {dayLabels.map((day) => (
                  <PlanDayHeaderCell key={day.iso} iso={day.iso} header={day.header} sub={day.sub} />
                ))}
              </div>

              <PlanDndRoot>
                <div className="plan-week-body">
                  {dayLabels.map((day) => {
                    const date = day.iso;
                    const slotMeals = byDate.get(date) ?? [];
                    return (
                      <PlanDayColumn
                        key={date}
                        date={date}
                        mobileLabel={day.mobile}
                        mealCountDesktop={`${slotMeals.length} meal${slotMeals.length === 1 ? "" : "s"}`}
                      >
                        {slotMeals.length === 0 ? (
                          <p className="mt-2 text-sm text-[var(--muted)]">—</p>
                        ) : (
                          <ul className="mt-1 list-none space-y-0 p-0">
                            {slotMeals.map((entry) => {
                              const recipe = entry.recipeId
                                ? recipes.find((candidate) => candidate.id === entry.recipeId)
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
                                    ingredients: recipe.ingredients.map((ingredient) => ({
                                      pantryItemName: ingredient.pantryItemName,
                                      optional: ingredient.optional,
                                    })),
                                  },
                                  pantryRows,
                                );
                                const requiredMissing = missing.filter((ingredient) => !ingredient.optional).length;
                                const totalIngredients = recipe.ingredients.length;
                                pantryRatio =
                                  totalIngredients > 0 ? `${matchedCount}/${totalIngredients}` : null;
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
                      </PlanDayColumn>
                    );
                  })}
                </div>
              </PlanDndRoot>

              <div className="swipe-hint flex items-center justify-center gap-2 py-1">
                <InstructionIcon text="Swipe left or right on this calendar to change the week. Drag a meal by the grip onto another day to move it. To duplicate a meal, open it and use Duplicate meal." />
              </div>
            </div>
          </PlanSwipeContainer>

          <section className="plan-form-panel lg:sticky lg:top-24">
            <h2 className="font-serif text-lg font-semibold text-[var(--accent)]">Add meal</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Keep quick scheduling separate from recipe browsing on small screens.
            </p>
            <form action={addMealPlanEntry} className="mt-4 space-y-3">
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
                  {MEALS.map((meal) => (
                    <option key={meal} value={meal}>
                      {meal}
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
                  {recipes.map((recipe) => (
                    <option key={recipe.id} value={recipe.id}>
                      {recipe.title}
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
              <button
                type="submit"
                className="btn-primary-touch w-full bg-[var(--accent)] text-white"
              >
                Add to plan
              </button>
            </form>
          </section>
        </div>
      </div>

      <div className="md:hidden">
        {activePanel === "recipes" && renderRecipesPanel()}
        {activePanel === "shopping" && renderShoppingPanel()}
      </div>

      <div className="hidden md:grid md:grid-cols-2 md:gap-6">
        {renderRecipesPanel()}
        {renderShoppingPanel()}
      </div>
    </div>
  );
}
