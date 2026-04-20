import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/actions/auth";
import {
  listPantryLocationSuggestions,
  listPantryUnitSuggestions,
} from "@/actions/pantry";
import { getUserSettings } from "@/actions/settings";
import { getSession } from "@/lib/get-session";
import { BrowserTimezoneSync } from "@/components/BrowserTimezoneSync";
import { UserAvatar } from "@/components/UserAvatar";
import { TabBar } from "@/components/ui/TabBar";

export default async function AppShellLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    redirect("/login");
  }

  // The FAB (QuickAdd) lives in the shell, so surface the user's common
  // locations and units here — chip pickers need them to feel personal.
  const [locationSuggestions, unitSuggestions, settings, user] = await Promise.all([
    listPantryLocationSuggestions(),
    listPantryUnitSuggestions(),
    getUserSettings(),
    getCurrentUser(),
  ]);
  const defaultLocation = settings?.defaultLocation ?? "";

  return (
    <div className="flex min-h-full flex-col pb-24">
      <BrowserTimezoneSync />
      <header className="safe-pt sticky top-0 z-30 mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-4 py-2 backdrop-blur-md md:max-w-3xl md:px-6">
        <Link href="/home" className="font-serif text-sm font-semibold tracking-tight text-[var(--foreground)]">
          Pantry
        </Link>
        <UserAvatar
          info={{
            version: settings?.avatarUpdatedAt ? settings.avatarUpdatedAt.getTime() : null,
            hasImage: !!settings?.avatarMime,
            name: user?.name ?? null,
            email: user?.email ?? null,
          }}
          size={36}
          href="/settings"
          linkLabel="Open settings"
        />
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
