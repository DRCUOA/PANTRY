"use client";

import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  duplicateMealPlanEntryToDate,
  moveMealPlanEntryToDate,
} from "@/actions/meal-plan";
import { useLocalIsoToday } from "@/lib/use-local-iso-today";

type PendingDrop = {
  entryId: number;
  sourceDate: string;
  targetDate: string;
};

type ActiveDragPayload = {
  label: string;
  mealType: string;
};

function formatDayLabel(iso: string) {
  const d = new Date(iso + "T12:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

const DAY_PREFIX = "day-";

function dayId(date: string) {
  return `${DAY_PREFIX}${date}`;
}

function parseDayId(id: string | number | undefined): string | null {
  if (id == null) return null;
  const s = String(id);
  if (!s.startsWith(DAY_PREFIX)) return null;
  return s.slice(DAY_PREFIX.length);
}

/** Prefer pointer (touch / pen); fall back to corners when the pointer straddles columns. */
const planDayCollision: CollisionDetection = (args) => {
  const byPointer = pointerWithin(args);
  if (byPointer.length > 0) return byPointer;
  return closestCorners(args);
};

export function PlanDndRoot({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pending, setPending] = useState<PendingDrop | null>(null);
  const [busy, setBusy] = useState<"move" | "duplicate" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [activeDrag, setActiveDrag] = useState<ActiveDragPayload | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 10 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 240, tolerance: 8 },
    }),
    useSensor(KeyboardSensor),
  );

  const close = useCallback(() => {
    if (busy) return;
    setPending(null);
    setErr(null);
  }, [busy]);

  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [pending, close]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as
      | { label?: string; mealType?: string }
      | undefined;
    setActiveDrag({
      label: data?.label ?? "Meal",
      mealType: data?.mealType ?? "",
    });
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveDrag(null);
    const { active, over } = event;
    if (!over) return;
    const targetDate = parseDayId(over.id);
    if (!targetDate) return;
    const data = active.data.current as
      | { entryId?: number; sourceDate?: string }
      | undefined;
    if (typeof data?.entryId !== "number" || typeof data?.sourceDate !== "string") {
      return;
    }
    setErr(null);
    setPending({
      entryId: data.entryId,
      sourceDate: data.sourceDate,
      targetDate,
    });
  }, []);

  const handleDragCancel = useCallback(() => {
    setActiveDrag(null);
  }, []);

  const sameDay = pending != null && pending.sourceDate === pending.targetDate;
  const canMove = pending != null && !sameDay;

  async function doMove() {
    if (!pending || !canMove) return;
    setBusy("move");
    setErr(null);
    try {
      const r = await moveMealPlanEntryToDate(pending.entryId, pending.targetDate);
      if (!r.ok) {
        setErr(r.error);
        return;
      }
      setPending(null);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function doDuplicate() {
    if (!pending) return;
    setBusy("duplicate");
    setErr(null);
    try {
      const r = await duplicateMealPlanEntryToDate(pending.entryId, pending.targetDate);
      if (!r.ok) {
        setErr(r.error);
        return;
      }
      setPending(null);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={planDayCollision}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {children}
      <DragOverlay dropAnimation={null} style={{ zIndex: 105 }}>
        {activeDrag ? (
          <div className="plan-meal-drag-overlay max-w-[200px] rounded-md border-2 border-[var(--accent)] bg-[var(--surface)] px-3 py-2 shadow-xl">
            <p className="text-[0.6rem] font-bold uppercase tracking-wide text-[var(--muted)]">
              {activeDrag.mealType}
            </p>
            <p className="mt-0.5 text-sm font-semibold leading-snug text-[var(--foreground)]">
              {activeDrag.label}
            </p>
          </div>
        ) : null}
      </DragOverlay>
      {pending && (
        <div
          className="fixed inset-0 z-[110] flex items-end justify-center p-0 sm:items-center sm:p-4"
          role="presentation"
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          <div
            className="absolute inset-0 cursor-pointer bg-black/70"
            aria-hidden
            onClick={close}
          />
          <div
            role="dialog"
            aria-modal
            aria-labelledby="plan-dnd-dialog-title"
            className="relative z-10 w-full max-w-md rounded-t-2xl border-2 border-[var(--border-strong)] bg-[var(--surface)] p-5 shadow-[0_-8px_40px_rgba(0,0,0,0.5)] sm:rounded-2xl sm:border-[var(--border-accent)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="plan-dnd-dialog-title" className="font-serif text-lg font-semibold">
              Move or duplicate meal?
            </h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Target day:{" "}
              <span className="font-medium text-[var(--foreground)]">
                {formatDayLabel(pending.targetDate)}
              </span>
            </p>
            <ul className="mt-4 space-y-2 text-sm text-[var(--foreground)]">
              <li>
                <span className="font-semibold text-[var(--accent)]">Move</span> — remove from the
                original day and place it on the day you dropped on.
              </li>
              <li>
                <span className="font-semibold text-[var(--accent)]">Duplicate</span> — keep the
                original and add another planned meal on the target day (same recipe, meal type, and
                servings as when you add a meal manually).
              </li>
            </ul>
            {sameDay && (
              <p className="mt-3 rounded-lg bg-[var(--surface-inset)] px-3 py-2 text-xs text-[var(--muted)]">
                This meal is already on that day. Use <strong>Duplicate</strong> to add a second
                entry.
              </p>
            )}
            {err && (
              <p className="mt-3 text-sm text-[var(--warn)]" role="alert">
                {err}
              </p>
            )}
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                disabled={!canMove || busy !== null}
                onClick={() => void doMove()}
                className="btn-primary-touch flex-1 bg-[var(--accent)] font-semibold text-white disabled:opacity-40"
              >
                {busy === "move" ? "Moving…" : "Move"}
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void doDuplicate()}
                className="btn-primary-touch flex-1 border-2 border-[var(--border-strong)] bg-[var(--surface-elevated)] font-semibold text-[var(--foreground)] disabled:opacity-40"
              >
                {busy === "duplicate" ? "Duplicating…" : "Duplicate"}
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={close}
                className="tap-target text-sm font-medium text-[var(--muted)] sm:ml-auto"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </DndContext>
  );
}

export function PlanDayColumn({
  date,
  mobileLabel,
  mealCountDesktop,
  children,
}: {
  date: string;
  mobileLabel: string;
  mealCountDesktop: string;
  children: ReactNode;
}) {
  const todayIso = useLocalIsoToday();
  const isToday = todayIso !== null && date === todayIso;
  const { setNodeRef, isOver } = useDroppable({
    id: dayId(date),
    data: { date },
  });

  return (
    <div
      ref={setNodeRef}
      className={`plan-day-cell ${isToday ? "plan-day-cell--today" : ""} ${isOver ? "plan-day-cell--dnd-over" : ""}`}
    >
      <div className="plan-day-label md:hidden">{mobileLabel}</div>
      <div className="hidden text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--muted)] md:block">
        {mealCountDesktop}
      </div>
      {children}
    </div>
  );
}
