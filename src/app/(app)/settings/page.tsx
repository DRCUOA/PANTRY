import { logoutAction } from "@/actions/auth";
import { listPantryLocationSuggestions } from "@/actions/pantry";
import { getUserSettings, updateSettings } from "@/actions/settings";
import { ThemeToggle } from "@/components/ThemeToggle";

export default async function SettingsPage() {
  const s = await getUserSettings();
  const locationSuggestions = await listPantryLocationSuggestions();

  return (
    <div className="space-y-5 pb-4">
      <header>
        <h1 className="font-serif text-2xl font-semibold tracking-tight md:text-3xl">Settings</h1>
      </header>

      <section className="ui-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold">Appearance</p>
            <p className="text-sm text-[var(--muted)]">Light, dark, or match your device.</p>
          </div>
          <ThemeToggle />
        </div>
      </section>

      <form action={updateSettings} className="ui-card space-y-4 p-4">
        <p className="font-semibold">Nutrition goals</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
              Calories / day
            </span>
            <input
              name="dailyCalories"
              type="number"
              min={1}
              defaultValue={s?.dailyCalories ?? ""}
              className="input-touch w-full rounded-lg border border-[var(--border-strong)] bg-[var(--background)]"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
              Protein g / day
            </span>
            <input
              name="dailyProteinG"
              type="number"
              min={1}
              defaultValue={s?.dailyProteinG ?? ""}
              className="input-touch w-full rounded-lg border border-[var(--border-strong)] bg-[var(--background)]"
            />
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
            Dietary preferences
          </span>
          <textarea
            name="dietaryPreferences"
            rows={3}
            defaultValue={s?.dietaryPreferences ?? ""}
            placeholder="e.g. vegetarian, low sodium"
            className="input-touch min-h-[100px] w-full resize-y rounded-lg border border-[var(--border-strong)] bg-[var(--background)] placeholder:text-[var(--muted)]"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
            Default location for new items
          </span>
          <datalist id="settings-location-suggestions">
            {locationSuggestions.map((loc) => (
              <option key={loc} value={loc} />
            ))}
          </datalist>
          <input
            name="defaultLocation"
            list="settings-location-suggestions"
            defaultValue={s?.defaultLocation ?? ""}
            placeholder="Fridge, Pantry, Freezer…"
            autoComplete="off"
            className="input-touch w-full rounded-lg border border-[var(--border-strong)] bg-[var(--background)] placeholder:text-[var(--muted)]"
          />
        </label>
        <button type="submit" className="ui-btn ui-btn--primary w-full">
          Save settings
        </button>
      </form>

      <form action={logoutAction}>
        <button type="submit" className="ui-btn ui-btn--ghost w-full">
          Log out
        </button>
      </form>

      <p className="text-center text-xs text-[var(--muted)]">
        Pantry · single-user edition
      </p>
    </div>
  );
}
