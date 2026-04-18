"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

export type DayPill = {
  iso: string;
  label: string; // e.g. "Mon"
  dateNum: number; // 1..31
  isToday: boolean;
  isActive: boolean;
  mealDots: number; // 0..3
  href: string;
};

export function WeekStrip({ days, ariaLabel = "Pick a day" }: { days: DayPill[]; ariaLabel?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>("[data-active='true']");
    if (el) {
      el.scrollIntoView({ inline: "center", block: "nearest", behavior: "auto" });
    }
  }, []);
  return (
    <nav aria-label={ariaLabel}>
      <div className="ui-week-strip" ref={ref}>
        {days.map((d) => {
          const cls =
            "ui-day-pill" +
            (d.isActive ? " ui-day-pill--active" : "") +
            (d.isToday ? " ui-day-pill--today" : "");
          return (
            <Link
              key={d.iso}
              href={d.href}
              data-active={d.isActive ? "true" : undefined}
              aria-current={d.isActive ? "page" : undefined}
              className={cls}
            >
              <span>{d.label}</span>
              <span className="ui-day-pill__date">{d.dateNum}</span>
              <span className="ui-day-pill__dots" aria-hidden>
                {Array.from({ length: Math.min(d.mealDots, 3) }).map((_, i) => (
                  <span key={i} className="ui-day-pill__dot" />
                ))}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
