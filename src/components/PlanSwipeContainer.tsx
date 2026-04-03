"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, type ReactNode } from "react";

export const SWIPE_THRESHOLD_PX = 56;
export const MAX_VERTICAL_DRIFT = 100;

export type SwipeDirection = "prev" | "next";

export function getSwipeDirection({
  deltaX,
  deltaY,
  thresholdPx = SWIPE_THRESHOLD_PX,
  maxVerticalDrift = MAX_VERTICAL_DRIFT,
}: {
  deltaX: number;
  deltaY: number;
  thresholdPx?: number;
  maxVerticalDrift?: number;
}): SwipeDirection | null {
  if (Math.abs(deltaY) > maxVerticalDrift) return null;
  if (deltaX > thresholdPx) return "prev";
  if (deltaX < -thresholdPx) return "next";
  return null;
}

/**
 * Swipe horizontally on the plan screen to change week (tablet / touch).
 */
export function PlanSwipeContainer({
  prevHref,
  nextHref,
  children,
}: {
  prevHref: string;
  nextHref: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const start = useRef<{ x: number; y: number } | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const pendingDirectionRef = useRef<SwipeDirection | null>(null);

  const flushNavigation = useCallback(() => {
    rafIdRef.current = null;
    const direction = pendingDirectionRef.current;
    pendingDirectionRef.current = null;
    if (!direction) return;

    router.push(direction === "prev" ? prevHref : nextHref);
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(12);
    }
  }, [nextHref, prevHref, router]);

  const scheduleNavigation = useCallback(
    (direction: SwipeDirection | null) => {
      if (!direction) return;
      pendingDirectionRef.current = direction;
      if (rafIdRef.current != null || typeof window === "undefined") {
        return;
      }
      rafIdRef.current = window.requestAnimationFrame(flushNavigation);
    },
    [flushNavigation],
  );

  useEffect(() => {
    return () => {
      if (rafIdRef.current != null && typeof window !== "undefined") {
        window.cancelAnimationFrame(rafIdRef.current);
      }
      rafIdRef.current = null;
      pendingDirectionRef.current = null;
    };
  }, []);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    start.current = { x: t.clientX, y: t.clientY };
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!start.current) return;
      const t = e.changedTouches[0];
      if (!t) {
        start.current = null;
        return;
      }
      const direction = getSwipeDirection({
        deltaX: t.clientX - start.current.x,
        deltaY: t.clientY - start.current.y,
      });
      start.current = null;
      scheduleNavigation(direction);
    },
    [scheduleNavigation],
  );

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{ touchAction: "pan-y pinch-zoom" }}
    >
      {children}
    </div>
  );
}
