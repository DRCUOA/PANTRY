"use client";

import { useEffect } from "react";
import { applyThemePreference, readStoredTheme, THEME_STORAGE_KEY } from "@/lib/theme";

/**
 * Syncs theme when system preference changes (Auto) and across tabs; boot script already applied initial state.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const sync = () => applyThemePreference(readStoredTheme());

    sync();

    const mq = window.matchMedia("(prefers-color-scheme: light)");
    mq.addEventListener("change", sync);

    const onStorage = (e: StorageEvent) => {
      if (e.key === THEME_STORAGE_KEY || e.key === null) sync();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("pantry-theme-change", sync);

    return () => {
      mq.removeEventListener("change", sync);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("pantry-theme-change", sync);
    };
  }, []);

  return children;
}
