"use client";

import { useActionState } from "react";
import { runSundayReset, type SundayResetActionResult } from "@/actions/meal-plan";

export function SundayResetButton() {
  const [state, action, pending] = useActionState(runSundayReset, undefined as SundayResetActionResult | undefined);

  return (
    <div>
      {state?.ok === true && (
        <p className="mb-3 rounded-lg bg-[var(--accent-subtle)] px-3 py-2 text-sm text-[var(--accent-muted)]" role="status">
          {state.message}
        </p>
      )}
      {state?.ok === false && (
        <p className="mb-3 rounded-lg bg-[var(--warn-bg)] px-3 py-2 text-sm text-[var(--warn)]" role="alert">
          {state.error}
        </p>
      )}
      <form action={action}>
        <button
          type="submit"
          disabled={pending}
          className="btn-primary-touch w-full bg-[var(--accent)] font-semibold text-white shadow-[0_0_24px_var(--accent-glow)] active:opacity-90 disabled:opacity-60"
        >
          {pending ? "Running reset…" : "Run Sunday Reset"}
        </button>
      </form>
    </div>
  );
}
