import Link from "next/link";
import { listPantryItemsForPickers } from "@/actions/pantry";
import { listRecipes } from "@/actions/recipes";
import { RecipeLibrarySection } from "@/components/RecipeLibrarySection";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconPlus } from "@/components/ui/icons";

export default async function RecipesIndexPage() {
  const recipes = await listRecipes();
  const pantryOptions = await listPantryItemsForPickers();

  return (
    <div className="space-y-5 pb-4">
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight md:text-3xl">Recipes</h1>
          <p className="text-sm text-[var(--muted)]">
            {recipes.length} saved {recipes.length === 1 ? "recipe" : "recipes"}
          </p>
        </div>
        <Link href="/recipes/new" className="ui-btn ui-btn--primary text-sm">
          <IconPlus size={18} /> New
        </Link>
      </header>

      {recipes.length === 0 ? (
        <EmptyState
          title="No recipes yet"
          hint="Import a JSON/CSV file or add one manually."
          action={
            <Link href="/recipes/new" className="ui-btn ui-btn--primary">
              <IconPlus size={18} /> Add recipe
            </Link>
          }
        />
      ) : (
        <RecipeLibrarySection recipes={recipes} pantryOptions={pantryOptions} />
      )}
    </div>
  );
}
