"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/home", label: "Home" },
  { href: "/pantry", label: "Pantry" },
  { href: "/scan", label: "Scan" },
  { href: "/plan", label: "Plan" },
  { href: "/settings", label: "Settings" },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t-2 border-[var(--border-accent)] bg-[var(--surface)]/98 backdrop-blur-md safe-pb"
      aria-label="Main"
    >
      <ul className="mx-auto flex max-w-5xl items-stretch justify-around gap-1 px-2 pb-2 pt-2 md:px-4">
        {links.map(({ href, label }) => {
          const active =
            pathname === href ||
            (href === "/plan" && pathname.startsWith("/recipes")) ||
            (href !== "/home" && href !== "/plan" && pathname.startsWith(href));
          const isScan = href === "/scan";
          return (
            <li key={href} className="flex-1 text-center">
              <Link
                href={href}
                className={`tap-target flex w-full items-center justify-center rounded-xl px-2 text-xs font-semibold transition-colors md:text-sm ${
                  isScan
                    ? active
                      ? "bg-[var(--accent)] text-white shadow-[0_0_24px_var(--accent-glow)]"
                      : "bg-[var(--accent-muted)] text-white shadow-[0_0_20px_var(--accent-glow)]"
                    : active
                      ? "bg-[var(--accent-subtle)] text-[var(--accent)]"
                      : "text-[var(--muted)] active:bg-[var(--surface-elevated)]"
                }`}
                aria-current={active ? "page" : undefined}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
