import Link from "next/link";
import { listPantryItemsForPickers } from "@/actions/pantry";
import { RecipeImportWizard } from "@/components/RecipeImportWizard";
import { RecipeNewForm } from "@/components/RecipeNewForm";

export default async function NewRecipePage() {
  const pantryOptions = await listPantryItemsForPickers();
  return (
    <div className="space-y-6 pb-4">
      <div className="flex items-center gap-3">
        <Link href="/plan" className="text-sm text-[var(--muted)]">
          ← Plan
        </Link>
      </div>
      <h1 className="font-serif text-2xl font-semibold tracking-tight">New recipe</h1>
      <div className="panel-bordered border-2 p-5">
        <h2 className="mb-3 font-serif text-lg font-semibold text-[var(--accent)]">Import from file</h2>
        <RecipeImportWizard />
      </div>
      <div className="panel-bordered border-2 p-5">
        <h2 className="mb-3 font-serif text-lg font-semibold text-[var(--accent)]">Manual entry</h2>
        <RecipeNewForm pantryOptions={pantryOptions} />
      </div>
    </div>
  );
}
