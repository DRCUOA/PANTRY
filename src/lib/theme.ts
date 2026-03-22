export const THEME_STORAGE_KEY = "pantry-color-scheme";

export type ThemePreference = "light" | "dark" | "system";

export function readStoredTheme(): ThemePreference {
  if (typeof window === "undefined") return "system";
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    if (v === "light" || v === "dark") return v;
  } catch {
    /* private mode */
  }
  return "system";
}

export function resolveEffectiveTheme(
  pref: ThemePreference,
  prefersLight: boolean,
): "light" | "dark" {
  if (pref === "light") return "light";
  if (pref === "dark") return "dark";
  return prefersLight ? "light" : "dark";
}

/** Applies data-theme on <html> and .dark for Tailwind; safe to call repeatedly. */
export function applyThemePreference(pref: ThemePreference): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
  const effective = resolveEffectiveTheme(pref, prefersLight);

  root.setAttribute("data-theme", pref);

  if (effective === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

export function persistThemePreference(pref: ThemePreference): void {
  try {
    if (pref === "system") {
      localStorage.removeItem(THEME_STORAGE_KEY);
    } else {
      localStorage.setItem(THEME_STORAGE_KEY, pref);
    }
  } catch {
    /* ignore */
  }
  applyThemePreference(pref);
  window.dispatchEvent(new CustomEvent("pantry-theme-change"));
}

/** Effective light/dark after resolving Auto (system) preference. */
export function getResolvedTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "dark";
  return resolveEffectiveTheme(
    readStoredTheme(),
    window.matchMedia("(prefers-color-scheme: light)").matches,
  );
}

/** Subscribe to anything that can change the resolved theme (storage, explicit preference, OS scheme). */
export function subscribeResolvedTheme(onChange: () => void): () => void {
  const mq = window.matchMedia("(prefers-color-scheme: light)");
  const onMq = () => onChange();
  mq.addEventListener("change", onMq);
  const onStorage = (e: StorageEvent) => {
    if (e.key === THEME_STORAGE_KEY || e.key === null) onChange();
  };
  window.addEventListener("pantry-theme-change", onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    mq.removeEventListener("change", onMq);
    window.removeEventListener("pantry-theme-change", onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** Persist the opposite of the current resolved appearance (icon toggle). */
export function toggleLightDark(): void {
  persistThemePreference(getResolvedTheme() === "dark" ? "light" : "dark");
}

/** Inline boot script (beforeInteractive) — keep in sync with readStoredTheme / applyThemePreference. */
export function themeBootScript(): string {
  const k = JSON.stringify(THEME_STORAGE_KEY);
  return `(()=>{try{var d=document.documentElement;var s=localStorage.getItem(${k});var pref=s==="light"||s==="dark"?s:"system";var light=window.matchMedia("(prefers-color-scheme: light)").matches;var eff=pref==="light"?"light":pref==="dark"?"dark":light?"light":"dark";d.setAttribute("data-theme",pref);if(eff==="dark")d.classList.add("dark");else d.classList.remove("dark");}catch(e){}})();`;
}
