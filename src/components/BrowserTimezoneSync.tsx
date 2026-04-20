"use client";

import { useEffect } from "react";

/**
 * Writes the browser's detected IANA timezone into a long-lived cookie so the
 * server can use it as a default when the user hasn't explicitly set one.
 *
 * Rendered once inside the authenticated app shell — cheap enough to run on
 * every mount, so we don't need a provider or a global store.
 */
export function BrowserTimezoneSync() {
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (!tz) return;
      // One year; SameSite=Lax so the cookie accompanies normal GETs but not
      // cross-site POSTs. Not HttpOnly — we never read it from JS again, but
      // we also don't need to hide it from document.cookie.
      document.cookie = `pantryBrowserTz=${encodeURIComponent(tz)}; path=/; max-age=31536000; samesite=lax`;
    } catch {
      // Some very old browsers expose Intl without resolvedOptions — in that
      // case the server just falls through to UTC.
    }
  }, []);
  return null;
}
