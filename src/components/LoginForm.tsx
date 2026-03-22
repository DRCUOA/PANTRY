"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction, type ActionResult } from "@/actions/auth";

export function LoginForm({ resetSuccess }: { resetSuccess?: boolean }) {
  const [state, action, pending] = useActionState(loginAction, undefined as ActionResult | undefined);

  return (
    <form
      action={action}
      className="panel-bordered space-y-4 border-2 p-6 shadow-[0_8px_32px_rgba(0,0,0,0.25)]"
    >
      {resetSuccess && (
        <p className="rounded-lg bg-[var(--accent-subtle)] px-3 py-2 text-sm text-[var(--accent-muted)]" role="status">
          Your password was updated. Sign in with your new password.
        </p>
      )}
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
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="input-touch w-full border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)]"
        />
        <p className="mt-1 text-right text-xs">
          <Link href="/forgot-password" className="font-medium text-[var(--accent)] hover:underline">
            Forgot password?
          </Link>
        </p>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="btn-primary-touch w-full bg-[var(--accent)] font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-center text-sm text-[var(--muted)]">
        No account?{" "}
        <Link href="/register" className="font-medium text-[var(--accent)] hover:underline">
          Register
        </Link>
      </p>
    </form>
  );
}
