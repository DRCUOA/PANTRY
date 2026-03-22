"use client";

import { useEffect, useId, type ReactNode } from "react";
import { createPortal } from "react-dom";

function IconClose({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function MobileSheet({
  open,
  onClose,
  title,
  eyebrow,
  subtitle,
  children,
  footer,
  maxWidthClassName = "max-w-2xl",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  eyebrow?: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  maxWidthClassName?: string;
}) {
  const titleId = useId();

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
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="presentation"
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
    >
      <div className="absolute inset-0 cursor-pointer bg-black/70" aria-hidden onClick={onClose} />
      <div
        className={`relative z-10 flex max-h-[min(92vh,800px)] w-full flex-col overflow-hidden rounded-t-2xl border-2 border-[var(--border-strong)] bg-[var(--surface)] shadow-[0_-8px_40px_rgba(0,0,0,0.5)] sm:rounded-2xl sm:border-[var(--border-accent)] ${maxWidthClassName}`}
        role="dialog"
        aria-modal
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-center px-5 pt-3 sm:hidden">
          <span className="h-1.5 w-14 rounded-full bg-[var(--border-strong)]" aria-hidden />
        </div>
        <div className="flex items-start justify-between gap-3 px-5 pb-4 pt-4">
          <div className="min-w-0">
            {eyebrow && (
              <p className="receipt-card-muted text-[0.72rem] uppercase tracking-wide">{eyebrow}</p>
            )}
            <h2 id={titleId} className="mt-1 font-serif text-xl font-semibold leading-snug">
              {title}
            </h2>
            {subtitle && <div className="mt-1 text-sm text-[var(--muted)]">{subtitle}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="tap-target shrink-0 rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--surface-inset)] hover:text-[var(--foreground)]"
            aria-label="Close"
          >
            <IconClose />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>
        {footer && <div className="mobile-sheet-footer px-5 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
