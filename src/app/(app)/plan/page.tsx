import Link from "next/link";
import { eq } from "drizzle-orm";
import { deleteRecipe, listRecipes } from "@/actions/recipes";
import {
  addMealPlanEntry,
  addMissingToShoppingList,
  deleteMealPlanEntry,
  listMealPlanRange,
  markMealCooked,
} from "@/actions/meal-plan";
import { addShoppingItem, deleteShoppingItem, listShoppingItems, toggleShoppingItemBought } from "@/actions/shopping";
import { getDb } from "@/db";
import { pantryItems } from "@/db/schema";
import { getSession } from "@/lib/get-session";
import { addDaysIso, weekRangeMondayOffset } from "@/lib/week";
import { recipePantryStatus } from "@/lib/recipe-score";

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

  return (
    <div className="space-y-8 pb-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-serif text-2xl font-semibold tracking-tight">Plan</h1>
        <Link href="/recipes/new" className="text-sm font-medium text-[var(--accent)]">
          New recipe
        </Link>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm">
        <Link
          href={`/plan?week=${weekOffset - 1}`}
          className="text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          ← Prev
        </Link>
        <span className="text-[var(--muted)]">
          {start} — {end}
        </span>
        <Link
          href={`/plan?week=${weekOffset + 1}`}
          className="text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          Next →
        </Link>
      </div>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h2 className="font-serif text-lg font-semibold">Add meal</h2>
        <form action={addMealPlanEntry} className="mt-3 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium">Date</label>
            <input
              type="date"
              name="plannedDate"
              required
              defaultValue={start}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Meal</label>
            <select
              name="mealType"
              required
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            >
              {MEALS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Recipe</label>
            <select
              name="recipeId"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
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
            <label className="mb-1 block text-xs font-medium">Servings</label>
            <input
              name="servings"
              type="number"
              min={0.5}
              step={0.5}
              defaultValue={1}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-xl bg-[var(--accent)] py-3 text-sm font-medium text-white"
          >
            Add to plan
          </button>
        </form>
      </section>

      <section className="space-y-4">
        <h2 className="font-serif text-lg font-semibold">This week</h2>
        {days.map((date) => {
          const slotMeals = byDate.get(date) ?? [];
          const label = new Date(date + "T12:00:00").toLocaleDateString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
          });
          return (
            <div key={date} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
              <p className="text-sm font-medium text-[var(--muted)]">{label}</p>
              {slotMeals.length === 0 ? (
                <p className="mt-2 text-sm text-[var(--muted)]">Nothing planned</p>
              ) : (
                <ul className="mt-2 space-y-3">
                  {slotMeals.map((entry) => {
                    const recipe = entry.recipeId
                      ? recipes.find((r) => r.id === entry.recipeId)
                      : null;
                    let missingLabel = "";
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
                      missingLabel = `${matchedCount}/${recipe.ingredients.length} in pantry · ${need} missing`;
                    }
                    return (
                      <li
                        key={entry.id}
                        className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                      >
                        <p className="capitalize text-[var(--muted)]">{entry.mealType}</p>
                        {recipe ? (
                          <p className="font-medium">{recipe.title}</p>
                        ) : (
                          <p className="text-[var(--muted)]">No recipe</p>
                        )}
                        {missingLabel && <p className="mt-1 text-xs text-[var(--muted)]">{missingLabel}</p>}
                        <p className="mt-1 text-xs text-[var(--muted)]">Status: {entry.status}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {entry.recipeId && entry.status === "planned" && (
                            <>
                              <form action={markMealCooked.bind(null, entry.id)}>
                                <button
                                  type="submit"
                                  className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white"
                                >
                                  Mark cooked
                                </button>
                              </form>
                              <form action={addMissingToShoppingList.bind(null, entry.id)}>
                                <button
                                  type="submit"
                                  className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs"
                                >
                                  Add missing to list
                                </button>
                              </form>
                            </>
                          )}
                          <form action={deleteMealPlanEntry.bind(null, entry.id)}>
                            <button type="submit" className="rounded-lg px-3 py-1.5 text-xs text-[var(--danger)]">
                              Remove
                            </button>
                          </form>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h2 className="font-serif text-lg font-semibold">Recipes</h2>
        {recipes.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--muted)]">No recipes yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {recipes.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
              >
                <span>{r.title}</span>
                <form action={deleteRecipe.bind(null, r.id)}>
                  <button type="submit" className="text-xs text-[var(--danger)]">
                    Delete
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h2 className="font-serif text-lg font-semibold">Shopping list</h2>
        <form action={addShoppingItem} className="mt-3 flex flex-wrap gap-2">
          <input
            name="name"
            placeholder="Item"
            required
            className="min-w-[120px] flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
          />
          <input
            name="quantity"
            placeholder="Qty"
            className="w-20 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
          />
          <input
            name="unit"
            placeholder="Unit"
            className="w-24 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
          >
            Add
          </button>
        </form>
        <ul className="mt-4 space-y-2">
          {shopping.length === 0 ? (
            <li className="text-sm text-[var(--muted)]">List is empty</li>
          ) : (
            shopping.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
              >
                <form action={toggleShoppingItemBought.bind(null, item.id)} className="min-w-0 flex-1">
                  <button
                    type="submit"
                    className={`w-full text-left ${item.status === "bought" ? "text-[var(--muted)] line-through" : ""}`}
                  >
                    {item.name}
                    {item.quantity != null && (
                      <span className="ml-2 text-[var(--muted)]">
                        {item.quantity} {item.unit ?? ""}
                      </span>
                    )}
                  </button>
                </form>
                <form action={deleteShoppingItem.bind(null, item.id)}>
                  <button type="submit" className="text-xs text-[var(--danger)]">
                    ✕
                  </button>
                </form>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
