import Link from "next/link";
import { notFound } from "next/navigation";
import { getRecipeById, getRecipeCookHistory } from "@/actions/recipes";
import { formatMealTypeLabel, normalizeMealType } from "@/lib/recipe-meal-types";
import { IconChevronLeft, IconClock, IconFire, IconHistory } from "@/components/ui/icons";
import { LogCookButton } from "./LogCookButton";

/* ─── Nutrition helpers ─────────────────────────────────────────── */

type NutritionRow = {
  label: string;
  perServing: string | null;
  per100g: string | null;
  unit: string;
};

function buildNutritionRows(
  recipe: NonNullable<Awaited<ReturnType<typeof getRecipeById>>>,
): NutritionRow[] {
  const servings = recipe.servings ?? 1;
  const totalWeightG = recipe.totalWeightG ? Number(recipe.totalWeightG) : null;
  const weightPerServing = totalWeightG ? totalWeightG / servings : null;

  function per100(perServingVal: number | null): string | null {
    if (perServingVal == null || weightPerServing == null || weightPerServing <= 0) return null;
    return ((perServingVal / weightPerServing) * 100).toFixed(1);
  }

  function fmt(v: number | string | null): string | null {
    if (v == null) return null;
    const n = typeof v === "string" ? parseFloat(v) : v;
    if (isNaN(n)) return null;
    return n % 1 === 0 ? String(n) : n.toFixed(1);
  }

  const cal = recipe.caloriesPerServing;
  const protein = recipe.proteinGPerServing ? Number(recipe.proteinGPerServing) : null;
  const carbs = recipe.carbsGPerServing ? Number(recipe.carbsGPerServing) : null;
  const fat = recipe.fatGPerServing ? Number(recipe.fatGPerServing) : null;
  const fiber = recipe.fiberGPerServing ? Number(recipe.fiberGPerServing) : null;
  const sodium = recipe.sodiumMgPerServing ? Number(recipe.sodiumMgPerServing) : null;

  return [
    { label: "Calories", perServing: fmt(cal), per100g: per100(cal), unit: "kcal" },
    { label: "Protein", perServing: fmt(protein), per100g: per100(protein), unit: "g" },
    { label: "Carbs", perServing: fmt(carbs), per100g: per100(carbs), unit: "g" },
    { label: "Fat", perServing: fmt(fat), per100g: per100(fat), unit: "g" },
    { label: "Fibre", perServing: fmt(fiber), per100g: per100(fiber), unit: "g" },
    { label: "Sodium", perServing: fmt(sodium), per100g: per100(sodium), unit: "mg" },
  ];
}

function hasAnyNutrition(rows: NutritionRow[]): boolean {
  return rows.some((r) => r.perServing != null);
}

/* ─── Date helpers ──────────────────────────────────────────────── */

function relativeDate(d: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const days = Math.floor(diffMs / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return `${weeks} ${weeks === 1 ? "week" : "weeks"} ago`;
  }
  if (days < 365) {
    const months = Math.floor(days / 30);
    return `${months} ${months === 1 ? "month" : "months"} ago`;
  }
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/* ─── Page ──────────────────────────────────────────────────────── */

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!id || isNaN(id)) notFound();

  const [recipe, cookHistory] = await Promise.all([
    getRecipeById(id),
    getRecipeCookHistory(id),
  ]);
  if (!recipe) notFound();

  const nutritionRows = buildNutritionRows(recipe);
  const showNutrition = hasAnyNutrition(nutritionRows);
  const hasPer100 = nutritionRows.some((r) => r.per100g != null);
  const totalCooks = cookHistory.length;
  const lastCooked = cookHistory[0]?.cookedAt ?? null;

  return (
    <div className="space-y-6 pb-6">
      {/* Back link */}
      <Link
        href="/recipes"
        className="inline-flex items-center gap-1 text-sm font-medium text-[var(--accent)]"
      >
        <IconChevronLeft size={16} />
        Recipes
      </Link>

      {/* Header */}
      <header>
        <h1 className="font-serif text-2xl font-semibold tracking-tight md:text-3xl">
          {recipe.title}
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {formatMealTypeLabel(normalizeMealType(recipe.mealType))}
        </p>
        {recipe.description && (
          <p className="mt-2 text-sm text-[var(--foreground)]">{recipe.description}</p>
        )}
      </header>

      {/* Quick stats bar */}
      <div className="flex flex-wrap gap-3 text-sm">
        {recipe.servings != null && (
          <span className="receipt-card-muted inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5">
            <IconFire size={14} />
            {recipe.servings} {recipe.servings === 1 ? "serving" : "servings"}
          </span>
        )}
        {recipe.prepTimeMinutes != null && (
          <span className="receipt-card-muted inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5">
            <IconClock size={14} />
            {recipe.prepTimeMinutes} min
          </span>
        )}
        {totalCooks > 0 && (
          <span className="receipt-card-muted inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5">
            <IconHistory size={14} />
            Cooked {totalCooks} {totalCooks === 1 ? "time" : "times"}
          </span>
        )}
      </div>

      {/* Nutrition panel */}
      {showNutrition && (
        <section className="receipt-card overflow-hidden rounded-xl">
          <h2 className="px-4 pt-3 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Nutrition
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dashed border-[var(--border)] text-left text-xs text-[var(--muted)]">
                  <th className="px-4 py-2 font-medium"></th>
                  <th className="px-4 py-2 font-medium text-right">Per serving</th>
                  {hasPer100 && (
                    <th className="px-4 py-2 font-medium text-right">Per 100 g</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {nutritionRows
                  .filter((r) => r.perServing != null)
                  .map((r) => (
                    <tr key={r.label} className="border-b border-dashed border-[var(--border)]/50">
                      <td className="px-4 py-2 text-[var(--muted)]">{r.label}</td>
                      <td className="px-4 py-2 text-right font-medium text-[var(--foreground)]">
                        {r.perServing} {r.unit}
                      </td>
                      {hasPer100 && (
                        <td className="px-4 py-2 text-right text-[var(--muted)]">
                          {r.per100g != null ? `${r.per100g} ${r.unit}` : "—"}
                        </td>
                      )}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {recipe.totalWeightG && (
            <p className="px-4 pb-3 pt-1 text-xs text-[var(--muted)]">
              Based on {Number(recipe.totalWeightG).toFixed(0)} g total weight
              ({((Number(recipe.totalWeightG)) / (recipe.servings ?? 1)).toFixed(0)} g/serving)
            </p>
          )}
        </section>
      )}

      {/* Ingredients */}
      {recipe.ingredients.length > 0 && (
        <section className="receipt-card rounded-xl p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Ingredients
          </h2>
          <ul className="mt-3 space-y-2">
            {recipe.ingredients.map((ing) => (
              <li
                key={ing.id}
                className="flex items-baseline justify-between gap-2 border-b border-dashed border-[var(--border)]/30 pb-1.5 text-sm last:border-0"
              >
                <span className="text-[var(--foreground)]">
                  {ing.pantryItemName}
                  {ing.optional && (
                    <span className="ml-1.5 text-xs text-[var(--muted)]">(optional)</span>
                  )}
                </span>
                {(ing.quantity || ing.unit) && (
                  <span className="shrink-0 text-[var(--muted)]">
                    {ing.quantity ?? ""}{ing.unit ? ` ${ing.unit}` : ""}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Instructions */}
      {recipe.instructions && (
        <section className="receipt-card rounded-xl p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Instructions
          </h2>
          <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[var(--foreground)]">
            {recipe.instructions}
          </div>
        </section>
      )}

      {/* Cooking history */}
      <section className="receipt-card rounded-xl p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Cooking history
          </h2>
          <LogCookButton recipeId={recipe.id} />
        </div>

        {cookHistory.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--muted)]">
            No cooks recorded yet. Tap &ldquo;Log cook&rdquo; after making this recipe to start tracking.
          </p>
        ) : (
          <>
            {/* Summary */}
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <span className="text-[var(--muted)]">
                Total cooks:{" "}
                <strong className="text-[var(--foreground)]">{totalCooks}</strong>
              </span>
              {lastCooked && (
                <span className="text-[var(--muted)]">
                  Last cooked:{" "}
                  <strong className="text-[var(--foreground)]">{relativeDate(lastCooked)}</strong>
                </span>
              )}
            </div>

            {/* Timeline */}
            <ul className="mt-4 space-y-2">
              {cookHistory.slice(0, 10).map((entry) => (
                <li
                  key={`${entry.source}-${entry.id}`}
                  className="flex items-baseline justify-between gap-2 border-b border-dashed border-[var(--border)]/30 pb-1.5 text-sm last:border-0"
                >
                  <span className="text-[var(--foreground)]">
                    {entry.cookedAt.toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                    {entry.notes && (
                      <span className="ml-2 text-xs text-[var(--muted)]">{entry.notes}</span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs text-[var(--muted)]">
                    {Number(entry.servingsCooked)} {Number(entry.servingsCooked) === 1 ? "serving" : "servings"}
                    {entry.source === "meal_plan" && " · plan"}
                  </span>
                </li>
              ))}
              {cookHistory.length > 10 && (
                <li className="text-center text-xs text-[var(--muted)]">
                  + {cookHistory.length - 10} more
                </li>
              )}
            </ul>
          </>
        )}
      </section>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/plan`}
          className="ui-btn ui-btn--primary text-sm"
        >
          Add to meal plan
        </Link>
        <Link
          href="/recipes"
          className="ui-btn text-sm"
        >
          Back to recipes
        </Link>
      </div>
    </div>
  );
}
