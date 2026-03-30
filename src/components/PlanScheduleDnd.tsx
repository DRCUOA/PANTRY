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
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { moveMealPlanEntryToDate } from "@/actions/meal-plan";
import { useLocalIsoToday } from "@/lib/use-local-iso-today";

type ActiveDragPayload = {
  label: string;
  mealType: string;
};

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
  const [activeDrag, setActiveDrag] = useState<ActiveDragPayload | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const pendingActiveDragRef = useRef<ActiveDragPayload | null>(null);

  const flushActiveDrag = useCallback(() => {
    rafIdRef.current = null;
    setActiveDrag(pendingActiveDragRef.current);
  }, []);

  const scheduleActiveDrag = useCallback(
    (nextActiveDrag: ActiveDragPayload | null) => {
      pendingActiveDragRef.current = nextActiveDrag;
      if (rafIdRef.current != null || typeof window === "undefined") {
        return;
      }
      rafIdRef.current = window.requestAnimationFrame(flushActiveDrag);
    },
    [flushActiveDrag],
  );

  useEffect(() => {
    return () => {
      if (rafIdRef.current != null && typeof window !== "undefined") {
        window.cancelAnimationFrame(rafIdRef.current);
      }
      rafIdRef.current = null;
      pendingActiveDragRef.current = null;
    };
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 10 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 300, tolerance: 8 },
    }),
    useSensor(KeyboardSensor),
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const data = event.active.data.current as
        | { label?: string; mealType?: string }
        | undefined;
      scheduleActiveDrag({
        label: data?.label ?? "Meal",
        mealType: data?.mealType ?? "",
      });
    },
    [scheduleActiveDrag],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      scheduleActiveDrag(null);
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
      if (data.sourceDate === targetDate) return;
      const entryId = data.entryId;
      void (async () => {
        const r = await moveMealPlanEntryToDate(entryId, targetDate);
        if (!r.ok) {
          if (typeof window !== "undefined") {
            window.alert(r.error);
          }
          return;
        }
        router.refresh();
      })();
    },
    [router, scheduleActiveDrag],
  );

  const handleDragCancel = useCallback(() => {
    scheduleActiveDrag(null);
  }, [scheduleActiveDrag]);

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
  const cellClassName = useMemo(
    () =>
      `plan-day-cell ${isToday ? "plan-day-cell--today" : ""} ${isOver ? "plan-day-cell--dnd-over" : ""}`,
    [isOver, isToday],
  );

  return (
    <div ref={setNodeRef} className={cellClassName}>
      <div className="plan-day-label md:hidden">{mobileLabel}</div>
      <div className="hidden text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--muted)] md:block">
        {mealCountDesktop}
      </div>
      {children}
    </div>
  );
}
