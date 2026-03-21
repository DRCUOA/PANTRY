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
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur-md safe-pb"
      aria-label="Main"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around gap-0 px-1 py-2">
        {links.map(({ href, label }) => {
          const active =
            pathname === href ||
            (href === "/plan" && pathname.startsWith("/recipes")) ||
            (href !== "/home" && href !== "/plan" && pathname.startsWith(href));
          return (
            <li key={href} className="flex-1 text-center">
              <Link
                href={href}
                className={`block rounded-lg px-1 py-2 text-xs font-medium transition-colors ${
                  active ? "text-[var(--accent)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
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
