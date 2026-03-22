"use client";

import { useEffect, useState } from "react";
import { toIsoDate } from "@/lib/week";

/** Local calendar date (YYYY-MM-DD) from the user’s device; `null` until after mount (avoids SSR / hydration mismatch). */
export function useLocalIsoToday(): string | null {
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setToday(toIsoDate(new Date()));
    });
    return () => cancelAnimationFrame(id);
  }, []);
  return today;
}
