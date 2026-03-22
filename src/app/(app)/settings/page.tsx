import { logoutAction } from "@/actions/auth";
import { listPantryLocationSuggestions } from "@/actions/pantry";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getUserSettings, updateSettings } from "@/actions/settings";

export default async function SettingsPage() {
  const s = await getUserSettings();
  const locationSuggestions = await listPantryLocationSuggestions();

  return (
    <div className="space-y-8 pb-4">
      <h1 className="font-serif text-2xl font-semibold tracking-tight md:text-3xl">Settings</h1>

      <section className="panel-bordered flex flex-wrap items-center justify-between gap-3 border-2 p-5">
        <p className="text-sm font-medium text-[var(--muted)]">Appearance</p>
        <ThemeToggle />
      </section>

      <form action={updateSettings} className="panel-bordered space-y-4 border-2 p-5">
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--muted)]">
            Daily calories (optional)
          </label>
          <input
            name="dailyCalories"
            type="number"
            min={1}
            defaultValue={s?.dailyCalories ?? ""}
            className="input-touch w-full border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)]"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--muted)]">
            Daily protein g (optional)
          </label>
          <input
            name="dailyProteinG"
            type="number"
            min={1}
            defaultValue={s?.dailyProteinG ?? ""}
            className="input-touch w-full border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)]"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--muted)]">Dietary preferences</label>
          <textarea
            name="dietaryPreferences"
            rows={3}
            defaultValue={s?.dietaryPreferences ?? ""}
            placeholder="e.g. vegetarian, low sodium"
            className="input-touch min-h-[120px] w-full resize-y border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted)]"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--muted)]">
            Default location for new items
          </label>
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
            className="input-touch w-full border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted)]"
          />
        </div>
        <button type="submit" className="btn-primary-touch w-full bg-[var(--accent)] font-semibold text-white">
          Save settings
        </button>
      </form>

      <form action={logoutAction}>
        <button
          type="submit"
          className="btn-primary-touch w-full border-2 border-[var(--border-strong)] bg-[var(--surface-elevated)] font-semibold text-[var(--muted)]"
        >
          Log out
        </button>
      </form>
    </div>
  );
}
