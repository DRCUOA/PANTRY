"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconHome, IconPantry, IconPlan, IconShop } from "./icons";

const TABS = [
  { href: "/home", label: "Today", icon: IconHome, match: (p: string) => p === "/home" || p === "/" },
  {
    href: "/pantry",
    label: "Pantry",
    icon: IconPantry,
    match: (p: string) => p.startsWith("/pantry") || p.startsWith("/scan"),
  },
  {
    href: "/plan",
    label: "Plan",
    icon: IconPlan,
    match: (p: string) => p.startsWith("/plan") || p.startsWith("/recipes"),
  },
  {
    href: "/shop",
    label: "Shop",
    icon: IconShop,
    match: (p: string) => p.startsWith("/shop"),
  },
] as const;

/**
 * Fixed bottom nav. Styled with inline Tailwind utilities (no reliance on custom
 * .ui-tabbar class) so it can't silently break if globals.css layering shifts.
 */
export function TabBar() {
  const pathname = usePathname() ?? "/";
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur-md"
      style={{ paddingBottom: "max(0.35rem, env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto grid max-w-2xl grid-cols-4 items-stretch gap-0 px-2 pt-1 pb-1">
        {TABS.map((t) => {
          const active = t.match(pathname);
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-md px-1 py-1.5 text-[0.7rem] font-semibold ${
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
