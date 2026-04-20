import { cookies } from "next/headers";

/** Name of the cookie that records the browser's detected IANA zone. */
export const BROWSER_TZ_COOKIE = "pantryBrowserTz";

/** Fallback zone when neither the user nor the browser has told us anything. */
export const DEFAULT_TZ = "UTC";

/**
 * Returns true iff `tz` is an IANA zone that Intl.DateTimeFormat will accept.
 * We can't enumerate the full list on every validate call, so we construct a
 * formatter — the constructor throws on bad input.
 */
export function isValidTimezone(tz: string | null | undefined): tz is string {
  if (!tz || typeof tz !== "string") return false;
  try {
    // `timeZone: "not/a/zone"` throws RangeError
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** The full IANA list, or a reasonable fallback on older runtimes. */
export function listTimezones(): string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
  if (typeof intl.supportedValuesOf === "function") {
    try {
      return intl.supportedValuesOf("timeZone");
    } catch {
      /* fall through */
    }
  }
  return ["UTC", "America/Los_Angeles", "America/New_York", "Europe/London", "Asia/Tokyo"];
}

/**
 * Resolve the timezone to use for the current request. Preference order:
 *   1. explicit user setting
 *   2. browser-detected zone (set by BrowserTimezoneSync into a cookie)
 *   3. DEFAULT_TZ
 */
export async function resolveTimezone(userPref?: string | null): Promise<string> {
  if (isValidTimezone(userPref)) return userPref;
  const jar = await cookies();
  const browserTz = jar.get(BROWSER_TZ_COOKIE)?.value;
  if (isValidTimezone(browserTz)) return browserTz;
  return DEFAULT_TZ;
}

/** YYYY-MM-DD for the given `date` as seen in `timezone`. */
export function isoDateInZone(date: Date, timezone: string): string {
  // en-CA formats as YYYY-MM-DD; safer than hand-splitting on every locale.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
}

/** 0–23 hour-of-day for `date` as seen in `timezone`. */
export function hourInZone(date: Date, timezone: string): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const h = parts.find((p) => p.type === "hour")?.value ?? "0";
  const n = Number(h);
  // "24" can appear for midnight on some ICU versions — normalise to 0.
  return Number.isFinite(n) ? n % 24 : 0;
}
