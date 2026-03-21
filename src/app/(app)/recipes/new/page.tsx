import Link from "next/link";
import { RecipeNewForm } from "@/components/RecipeNewForm";

export default function NewRecipePage() {
  return (
    <div className="space-y-6 pb-4">
      <div className="flex items-center gap-3">
        <Link href="/plan" className="text-sm text-[var(--muted)]">
          ← Plan
        </Link>
      </div>
      <h1 className="font-serif text-2xl font-semibold tracking-tight">New recipe</h1>
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <RecipeNewForm />
      </div>
    </div>
  );
}
