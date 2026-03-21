import { logoutAction } from "@/actions/auth";
import { getUserSettings, updateSettings } from "@/actions/settings";

export default async function SettingsPage() {
  const s = await getUserSettings();

  return (
    <div className="space-y-8 pb-4">
      <h1 className="font-serif text-2xl font-semibold tracking-tight">Settings</h1>

      <form
        action={updateSettings}
        className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
      >
        <div>
          <label className="mb-1 block text-sm font-medium">Daily calories (optional)</label>
          <input
            name="dailyCalories"
            type="number"
            min={1}
            defaultValue={s?.dailyCalories ?? ""}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Daily protein g (optional)</label>
          <input
            name="dailyProteinG"
            type="number"
            min={1}
            defaultValue={s?.dailyProteinG ?? ""}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Dietary preferences</label>
          <textarea
            name="dietaryPreferences"
            rows={3}
            defaultValue={s?.dietaryPreferences ?? ""}
            placeholder="e.g. vegetarian, low sodium"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Default location for new items</label>
          <input
            name="defaultLocation"
            defaultValue={s?.defaultLocation ?? ""}
            placeholder="Fridge, Pantry, Freezer…"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-xl bg-[var(--accent)] py-3 text-sm font-medium text-white"
        >
          Save settings
        </button>
      </form>

      <form action={logoutAction}>
        <button
          type="submit"
          className="w-full rounded-xl border border-[var(--border)] py-3 text-sm text-[var(--muted)]"
        >
          Log out
        </button>
      </form>
    </div>
  );
}
