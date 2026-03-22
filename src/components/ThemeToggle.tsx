"use client";

import { useSyncExternalStore } from "react";
import {
  getResolvedTheme,
  subscribeResolvedTheme,
  toggleLightDark,
} from "@/lib/theme";

function IconSun({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function IconMoon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

/**
 * Sun / moon control: switches between light and dark (stores an explicit preference).
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const resolved = useSyncExternalStore(
    subscribeResolvedTheme,
    getResolvedTheme,
    () => "dark" as const,
  );
  const isDark = resolved === "dark";

  return (
    <button
      type="button"
      onClick={() => toggleLightDark()}
      className={`tap-target inline-flex items-center justify-center rounded-xl border border-[var(--border-strong)] bg-[var(--surface-inset)] p-2.5 text-[var(--foreground)] transition-colors hover:bg-[var(--surface-elevated)] active:opacity-90 ${className}`}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <IconSun className="size-6" /> : <IconMoon className="size-6" />}
    </button>
  );
}
