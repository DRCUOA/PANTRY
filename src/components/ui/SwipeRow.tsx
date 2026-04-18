"use client";

import { useRef, useState, type ReactNode } from "react";

type SwipeAction = {
  label: string;
  icon?: ReactNode;
  onAction: () => void;
};

/**
 * Horizontal swipe container that reveals a left (primary) or right (destructive) action
 * once the user drags past a commit threshold. Falls back gracefully for keyboard/mouse:
 * children are expected to expose explicit buttons too (we don't hide the content).
 */
export function SwipeRow({
  children,
  leftAction,
  rightAction,
  commitPx = 88,
}: {
  children: ReactNode;
  leftAction?: SwipeAction;
  rightAction?: SwipeAction;
  commitPx?: number;
}) {
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef<number | null>(null);
  const committed = useRef(false);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Ignore drags that start from interactive elements (buttons/links/inputs)
    const target = e.target as HTMLElement;
    if (target.closest("button, a, input, textarea, select, [data-no-swipe]")) return;
    startX.current = e.clientX;
    committed.current = false;
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (startX.current == null) return;
    const dx = e.clientX - startX.current;
    const clamped =
      dx > 0 && !leftAction
        ? 0
        : dx < 0 && !rightAction
        ? 0
        : Math.max(Math.min(dx, 160), -160);
    setDrag(clamped);
  };

  const onPointerUp = () => {
    const dx = drag;
    startX.current = null;
    setDragging(false);
    if (dx >= commitPx && leftAction && !committed.current) {
      committed.current = true;
      leftAction.onAction();
    } else if (dx <= -commitPx && rightAction && !committed.current) {
      committed.current = true;
      rightAction.onAction();
    }
    setDrag(0);
  };

  return (
    <div className="ui-swipe">
      {leftAction && (
        <div className="ui-swipe__bg ui-swipe__bg--left" aria-hidden>
          <span className="flex items-center gap-2">
            {leftAction.icon}
            {leftAction.label}
          </span>
          <span />
        </div>
      )}
      {rightAction && (
        <div className="ui-swipe__bg ui-swipe__bg--right" aria-hidden>
          <span />
          <span className="flex items-center gap-2">
            {rightAction.label}
            {rightAction.icon}
          </span>
        </div>
      )}
      <div
        className={`ui-swipe__body${dragging ? " ui-swipe__body--dragging" : ""}`}
        style={{ transform: `translateX(${drag}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {children}
      </div>
    </div>
  );
}
