"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type ToastAction = { label: string; onAction: () => void };

const EMPTY_SUBSCRIBE = () => () => {};

export function UndoSnackbar({
  message,
  action,
  duration = 4000,
  onDismiss,
}: {
  message: ReactNode;
  action?: ToastAction;
  duration?: number;
  onDismiss: () => void;
}) {
  // useSyncExternalStore returns true after hydration, false during SSR — no effect-driven setState required.
  const mounted = useSyncExternalStore(
    EMPTY_SUBSCRIBE,
    () => true,
    () => false,
  );
  useEffect(() => {
    const t = setTimeout(onDismiss, duration);
    return () => clearTimeout(t);
  }, [duration, onDismiss]);
  if (!mounted || typeof document === "undefined") return null;
  return createPortal(
    <div className="ui-snackbar" role="status" aria-live="polite">
      <span>{message}</span>
      {action && (
        <button
          type="button"
          className="ui-snackbar__action"
          onClick={() => {
            action.onAction();
            onDismiss();
          }}
        >
          {action.label}
        </button>
      )}
    </div>,
    document.body,
  );
}
