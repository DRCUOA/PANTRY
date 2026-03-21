"use client";

import { useActionState } from "react";
import Link from "next/link";
import { registerAction, type ActionResult } from "@/actions/auth";

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerAction, undefined as ActionResult | undefined);

  return (
    <form action={action} className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
      {state?.ok === false && (
        <p className="rounded-lg bg-[var(--warn-bg)] px-3 py-2 text-sm text-[var(--warn)]" role="alert">
          {state.error}
        </p>
      )}
      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-medium">
          Name <span className="text-[var(--muted)]">(optional)</span>
        </label>
        <input
          id="name"
          name="name"
          type="text"
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
        />
      </div>
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
          minLength={8}
          autoComplete="new-password"
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs text-[var(--muted)]">At least 8 characters</p>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-[var(--accent)] py-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create account"}
      </button>
      <p className="text-center text-sm text-[var(--muted)]">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-[var(--accent)] hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
