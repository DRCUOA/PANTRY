"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, type ReactNode } from "react";

const SWIPE_THRESHOLD_PX = 56;
const MAX_VERTICAL_DRIFT = 100;

/**
 * Swipe horizontally on the plan screen to change week (tablet / touch).
 */
export function PlanSwipeContainer({
  weekOffset,
  children,
}: {
  weekOffset: number;
  children: ReactNode;
}) {
  const router = useRouter();
  const start = useRef<{ x: number; y: number } | null>(null);

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
      const dx = t.clientX - start.current.x;
      const dy = Math.abs(t.clientY - start.current.y);
      start.current = null;
      if (dy > MAX_VERTICAL_DRIFT) return;
      if (dx > SWIPE_THRESHOLD_PX) {
        router.push(`/plan?week=${weekOffset - 1}`);
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate(12);
        }
      } else if (dx < -SWIPE_THRESHOLD_PX) {
        router.push(`/plan?week=${weekOffset + 1}`);
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate(12);
        }
      }
    },
    [router, weekOffset],
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
