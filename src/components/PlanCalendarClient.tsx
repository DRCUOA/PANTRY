"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useLocalIsoToday } from "@/lib/use-local-iso-today";
import { getSwipeDirection, type SwipeDirection } from "@/components/PlanSwipeContainer";

type ViewMode = "day" | "week";

function IconCalendarDay({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <rect x="10" y="14" width="4" height="4" rx="0.5" fill="currentColor" />
    </svg>
  );
}

function IconCalendarWeek({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M7 14h10M7 18h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconChevronLeft({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconChevronRight({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export type DayLabel = {
  iso: string;
  header: string;
  sub: string;
  mobile: string;
};

export function PlanCalendarClient({
  prevWeekHref,
  nextWeekHref,
  thisWeekHref,
  weekOffset,
  start,
  end,
  dayLabels,
  children,
}: {
  prevWeekHref: string;
  nextWeekHref: string;
  thisWeekHref: string;
  weekOffset: number;
  start: string;
  end: string;
  dayLabels: DayLabel[];
  children: ReactNode;
}) {
  const router = useRouter();
  const today = useLocalIsoToday();
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [activeDayIndex, setActiveDayIndex] = useState(0);

  useEffect(() => {
    if (!today) return;
    const todayIdx = dayLabels.findIndex((d) => d.iso === today);
    if (todayIdx >= 0) setActiveDayIndex(todayIdx);
  }, [today, dayLabels]);

  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const rafId = useRef<number | null>(null);
  const pendingDir = useRef<SwipeDirection | null>(null);

  const flushNav = useCallback(() => {
    rafId.current = null;
    const dir = pendingDir.current;
    pendingDir.current = null;
    if (!dir) return;

    if (viewMode === "week") {
      router.push(dir === "prev" ? prevWeekHref : nextWeekHref);
    } else {
      if (dir === "prev") {
        if (activeDayIndex > 0) {
          setActiveDayIndex((i) => i - 1);
        } else {
          router.push(prevWeekHref);
        }
      } else {
        if (activeDayIndex < 6) {
          setActiveDayIndex((i) => i + 1);
        } else {
          router.push(nextWeekHref);
        }
      }
    }

    if (navigator.vibrate) navigator.vibrate(12);
  }, [viewMode, activeDayIndex, prevWeekHref, nextWeekHref, router]);

  const scheduleNav = useCallback(
    (dir: SwipeDirection | null) => {
      if (!dir) return;
      pendingDir.current = dir;
      if (rafId.current != null) return;
      rafId.current = window.requestAnimationFrame(flushNav);
    },
    [flushNav],
  );

  useEffect(() => {
    return () => {
      if (rafId.current != null) window.cancelAnimationFrame(rafId.current);
      rafId.current = null;
      pendingDir.current = null;
    };
  }, []);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    touchStart.current = { x: t.clientX, y: t.clientY };
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStart.current) return;
      const t = e.changedTouches[0];
      if (!t) {
        touchStart.current = null;
        return;
      }
      const dir = getSwipeDirection({
        deltaX: t.clientX - touchStart.current.x,
        deltaY: t.clientY - touchStart.current.y,
      });
      touchStart.current = null;
      scheduleNav(dir);
    },
    [scheduleNav],
  );

  const activeDay = dayLabels[activeDayIndex]!;

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{ touchAction: "pan-y pinch-zoom" }}
    >
      <div className="plan-outer-frame">
        {/* Nav bar */}
        <div className="plan-week-nav">
          {viewMode === "week" ? (
            <>
              <Link href={prevWeekHref} className="tap-target inline-flex items-center justify-center rounded-lg p-2" aria-label="Previous week">
                <IconChevronLeft />
              </Link>
              <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-center">
                {weekOffset !== 0 && (
                  <Link href={thisWeekHref} className="text-xs font-semibold text-[var(--today-fg)] hover:underline">
                    This week
                  </Link>
                )}
                <span className="font-mono text-sm text-[var(--foreground)]">
                  {start}
                  <span className="text-[var(--muted)]"> — </span>
                  {end}
                </span>
              </div>
              <Link href={nextWeekHref} className="tap-target inline-flex items-center justify-center rounded-lg p-2" aria-label="Next week">
                <IconChevronRight />
              </Link>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  if (activeDayIndex > 0) {
                    setActiveDayIndex((i) => i - 1);
                  } else {
                    router.push(prevWeekHref);
                  }
                }}
                className="tap-target inline-flex items-center justify-center rounded-lg p-2"
                aria-label="Previous day"
              >
                <IconChevronLeft />
              </button>
              <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-center">
                {today && activeDay.iso === today && (
                  <span className="text-xs font-semibold text-[var(--today-fg)]">Today</span>
                )}
                <span className="font-mono text-sm text-[var(--foreground)]">
                  {activeDay.header}, {activeDay.sub}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (activeDayIndex < 6) {
                    setActiveDayIndex((i) => i + 1);
                  } else {
                    router.push(nextWeekHref);
                  }
                }}
                className="tap-target inline-flex items-center justify-center rounded-lg p-2"
                aria-label="Next day"
              >
                <IconChevronRight />
              </button>
            </>
          )}

          {/* View toggle */}
          <div className="flex items-center gap-0.5 border-l-2 border-[var(--border-strong)] pl-2">
            <button
              type="button"
              onClick={() => setViewMode("day")}
              className={`tap-target inline-flex items-center justify-center rounded-lg p-2 transition-colors ${
                viewMode === "day"
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
              title="Day view"
              aria-label="Day view"
              aria-pressed={viewMode === "day"}
            >
              <IconCalendarDay />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("week")}
              className={`tap-target inline-flex items-center justify-center rounded-lg p-2 transition-colors ${
                viewMode === "week"
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
              title="Week view"
              aria-label="Week view"
              aria-pressed={viewMode === "week"}
            >
              <IconCalendarWeek />
            </button>
          </div>
        </div>

        {/* Day headers (week view only, md+) */}
        {viewMode === "week" && (
          <div className="plan-day-headers">
            {dayLabels.map((day) => {
              const isToday = today !== null && day.iso === today;
              return (
                <div
                  key={day.iso}
                  className={isToday ? "plan-day-header plan-day-header--today" : "plan-day-header"}
                >
                  <div className="text-[var(--accent)]">{day.header}</div>
                  <div className="mt-0.5 font-mono text-[0.65rem] font-normal normal-case tracking-normal text-[var(--muted)]">
                    {day.sub}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Calendar body */}
        <div
          className="plan-calendar-body"
          data-view={viewMode}
          data-active-day={activeDayIndex}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export { type SwipeDirection };
