"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { IconClose } from "./icons";

export function SheetModal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const titleId = useId();
  const descId = useId();
  const sheetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <>
      <div className="ui-sheet-backdrop" onClick={onClose} aria-hidden />
      <div
        className="ui-sheet"
        role="dialog"
        aria-modal
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        ref={sheetRef}
      >
        <div className="ui-sheet__grip" aria-hidden />
        <div className="ui-sheet__header">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="ui-sheet__title truncate">
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-0.5 text-sm text-[var(--muted)]">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            className="tap-target rounded-full p-2 text-[var(--muted)]"
            onClick={onClose}
            aria-label="Close"
          >
            <IconClose />
          </button>
        </div>
        <div className="ui-sheet__body">{children}</div>
        {footer && (
          <div className="border-t border-[var(--border)] bg-[var(--surface-inset)] px-4 pb-3 pt-3">
            {footer}
          </div>
        )}
      </div>
    </>,
    document.body,
  );
}
