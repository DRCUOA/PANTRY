"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  requestPasswordResetAction,
  type ForgotPasswordState,
} from "@/actions/password-reset";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(
    requestPasswordResetAction,
    undefined as ForgotPasswordState | undefined,
  );

  if (state?.ok === true) {
    return (
      <div className="panel-bordered space-y-4 border-2 p-6 shadow-[0_8px_32px_rgba(0,0,0,0.25)]">
        <p className="text-sm text-[var(--foreground)]">
          If an account exists for that email, a password reset link has been prepared.
        </p>
        {state.devResetUrl && (
          <div className="rounded-lg border border-[var(--border-accent)] bg-[var(--surface-inset)] p-3">
            <p className="mb-2 text-xs font-medium text-[var(--warn)]">
              Development only — copy this link (no email is sent):
            </p>
            <code className="block break-all text-xs text-[var(--muted)]">{state.devResetUrl}</code>
          </div>
        )}
        <Link
          href="/login"
          className="btn-primary-touch inline-flex w-full items-center justify-center bg-[var(--accent)] font-semibold text-white"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form
      action={action}
      className="panel-bordered space-y-4 border-2 p-6 shadow-[0_8px_32px_rgba(0,0,0,0.25)]"
    >
      {state?.ok === false && (
        <p className="rounded-lg bg-[var(--warn-bg)] px-3 py-2 text-sm text-[var(--warn)]" role="alert">
          {state.error}
        </p>
      )}
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="input-touch w-full border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)]"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="btn-primary-touch w-full bg-[var(--accent)] font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send reset link"}
      </button>
      <p className="text-center text-sm text-[var(--muted)]">
        <Link href="/login" className="font-medium text-[var(--accent)] hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
