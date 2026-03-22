"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const HOLD_MS = 480;

/**
 * Info icon: full instruction on hover (mouse) or press-and-hold (touch / iPad).
 */
export function InstructionIcon({
  text,
  className = "",
  variant = "default",
  placement = "top",
}: {
  text: string;
  className?: string;
  variant?: "default" | "inverse";
  placement?: "top" | "bottom";
}) {
  const [touchOpen, setTouchOpen] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const clearHold = useCallback(() => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }, []);

  useEffect(() => {
    if (!touchOpen) return;
    const onDocPointerDown = (ev: PointerEvent) => {
      if (buttonRef.current?.contains(ev.target as Node)) return;
      setTouchOpen(false);
    };
    const t = window.setTimeout(() => {
      document.addEventListener("pointerdown", onDocPointerDown, true);
    }, 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener("pointerdown", onDocPointerDown, true);
    };
  }, [touchOpen]);

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === "mouse") return;
    if (touchOpen) {
      e.preventDefault();
      setTouchOpen(false);
      clearHold();
      return;
    }
    clearHold();
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      setTouchOpen(true);
    }, HOLD_MS);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === "mouse") return;
    clearHold();
  };

  const onPointerCancel = () => {
    clearHold();
  };

  const iconMuted =
    variant === "inverse"
      ? "text-white/85 hover:text-white"
      : "text-[var(--muted)] hover:text-[var(--foreground)]";

  const bubblePos =
    placement === "top"
      ? "bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2"
      : "top-[calc(100%+6px)] left-1/2 -translate-x-1/2";

  const bubbleTheme =
    variant === "inverse"
      ? "border border-white/25 bg-[#141414] text-white shadow-xl"
      : "border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--foreground)] shadow-lg";

  const bubbleVisible = touchOpen
    ? "visible z-[70] opacity-100"
    : "invisible z-[60] opacity-0 group-hover:visible group-hover:opacity-100";

  return (
    <span className={`group relative inline-flex align-middle ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        className={`tap-target -m-1 rounded-full p-1 ${iconMuted} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]`}
        aria-label={text}
        aria-expanded={touchOpen}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerCancel}
        onPointerCancel={onPointerCancel}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          aria-hidden
          className="shrink-0"
          fill="none"
        >
          <path
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 16v-4M12 8h.01M22 12c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2s10 4.477 10 10Z"
          />
        </svg>
      </button>
      <span
        role="tooltip"
        aria-hidden
        className={`pointer-events-none absolute ${bubblePos} w-[min(18rem,calc(100vw-2rem))] max-w-[min(18rem,calc(100vw-2rem))] rounded-lg px-3 py-2 text-left text-sm leading-snug transition-opacity duration-150 ${bubbleTheme} ${bubbleVisible}`}
      >
        {text}
      </span>
    </span>
  );
}
