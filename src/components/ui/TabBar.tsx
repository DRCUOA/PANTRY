"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconHome, IconPlan, IconClock, IconUser } from "./icons";
import { QuickAdd } from "./QuickAdd";

const LEFT_TABS = [
  { href: "/home", label: "Home", icon: IconHome, match: (p: string) => p === "/home" || p === "/" },
  {
    href: "/plan",
    label: "Plan",
    icon: IconPlan,
    match: (p: string) => p.startsWith("/plan") || p.startsWith("/recipes"),
  },
] as const;

const RIGHT_TABS = [
  {
    href: "/pantry",
    label: "Pantry",
    icon: IconClock,
    match: (p: string) => p.startsWith("/pantry") || p.startsWith("/scan"),
  },
  {
    href: "/settings",
    label: "Profile",
    icon: IconUser,
    match: (p: string) => p.startsWith("/settings"),
  },
] as const;

/**
 * Bottom nav with integrated center FAB.
 * 5-slot layout: 2 tabs | raised FAB | 2 tabs
 */
export function TabBar({
  locationSuggestions = [],
  unitSuggestions = [],
  defaultLocation = "",
}: {
  locationSuggestions?: string[];
  unitSuggestions?: string[];
  defaultLocation?: string;
} = {}) {
  const pathname = usePathname() ?? "/";
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur-md"
      style={{ paddingBottom: "max(0.35rem, env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto grid max-w-md grid-cols-5 items-end gap-0 px-2 pt-1 pb-1">
        {LEFT_TABS.map((t) => {
          const active = t.match(pathname);
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-md px-1 py-1.5 text-[0.65rem] font-medium ${
                active ? "text-[var(--accent)]" : "text-[var(--muted)]"
              }`}
            >
              <span className="inline-flex h-6 w-6 items-center justify-center">
                <Icon size={22} />
              </span>
              <span>{t.label}</span>
            </Link>
          );
        })}

        {/* Center FAB slot */}
        <div className="flex items-center justify-center">
          <QuickAdd
            locationSuggestions={locationSuggestions}
            unitSuggestions={unitSuggestions}
            defaultLocation={defaultLocation}
          />
        </div>

        {RIGHT_TABS.map((t) => {
          const active = t.match(pathname);
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-md px-1 py-1.5 text-[0.65rem] font-medium ${
                active ? "text-[var(--accent)]" : "text-[var(--muted)]"
              }`}
            >
              <span className="inline-flex h-6 w-6 items-center justify-center">
                <Icon size={22} />
              </span>
              <span>{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
