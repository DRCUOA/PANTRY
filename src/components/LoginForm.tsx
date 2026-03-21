"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction, type ActionResult } from "@/actions/auth";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, undefined as ActionResult | undefined);

  return (
    <form action={action} className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
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
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
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
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-[var(--accent)] py-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
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
