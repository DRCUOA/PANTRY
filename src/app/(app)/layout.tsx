import Link from "next/link";
import { redirect } from "next/navigation";
import {
  listPantryLocationSuggestions,
  listPantryUnitSuggestions,
} from "@/actions/pantry";
import { getUserSettings } from "@/actions/settings";
import { getSession } from "@/lib/get-session";
import { BrowserTimezoneSync } from "@/components/BrowserTimezoneSync";
import { IconSettings } from "@/components/ui/icons";
import { TabBar } from "@/components/ui/TabBar";

export default async function AppShellLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    redirect("/login");
  }

  // The FAB (QuickAdd) lives in the shell, so surface the user's common
  // locations and units here — chip pickers need them to feel personal.
  const [locationSuggestions, unitSuggestions, settings] = await Promise.all([
    listPantryLocationSuggestions(),
    listPantryUnitSuggestions(),
    getUserSettings(),
  ]);
  const defaultLocation = settings?.defaultLocation ?? "";

  return (
    <div className="flex min-h-full flex-col pb-24">
      <BrowserTimezoneSync />
      <header className="safe-pt sticky top-0 z-30 mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-4 py-2 backdrop-blur-md md:max-w-3xl md:px-6">
        <Link href="/home" className="font-serif text-sm font-semibold tracking-tight text-[var(--foreground)]">
          Pantry
        </Link>
        <Link
          href="/settings"
          className="tap-target rounded-full p-2 text-[var(--muted)]"
          aria-label="Settings"
        >
          <IconSettings size={20} />
        </Link>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-4 md:max-w-3xl md:px-6">
        {children}
      </main>
      <TabBar
        locationSuggestions={locationSuggestions}
        unitSuggestions={unitSuggestions}
        defaultLocation={defaultLocation}
      />
    </div>
  );
}
