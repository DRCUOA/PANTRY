"use client";

import { useLocalIsoToday } from "@/lib/use-local-iso-today";

export function PlanDayHeaderCell({
  iso,
  header,
  sub,
}: {
  iso: string;
  header: string;
  sub: string;
}) {
  const today = useLocalIsoToday();
  const isToday = today !== null && iso === today;

  return (
    <div className={isToday ? "plan-day-header plan-day-header--today" : "plan-day-header"}>
      <div className="text-[var(--accent)]">{header}</div>
      <div className="mt-0.5 font-mono text-[0.65rem] font-normal normal-case tracking-normal text-[var(--muted)]">
        {sub}
      </div>
    </div>
  );
}
