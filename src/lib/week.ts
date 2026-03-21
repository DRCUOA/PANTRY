/** Monday of the week containing `d`, as YYYY-MM-DD (local). */
export function mondayOfDate(d: Date): string {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff);
  return toIsoDate(m);
}

export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

export function addDaysIso(iso: string, days: number): string {
  const [y, m, da] = iso.split("-").map(Number);
  const d = new Date(y!, m! - 1, da! + days);
  return toIsoDate(d);
}

export function weekRangeMondayOffset(weekOffset: number): { start: string; end: string } {
  const base = mondayOfDate(new Date());
  const start = addDaysIso(base, weekOffset * 7);
  const end = addDaysIso(start, 6);
  return { start, end };
}
