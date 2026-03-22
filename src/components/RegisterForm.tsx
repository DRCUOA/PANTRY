"use client";

import { useActionState } from "react";
import Link from "next/link";
import { registerAction, type ActionResult } from "@/actions/auth";
import { InstructionIcon } from "@/components/InstructionIcon";

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerAction, undefined as ActionResult | undefined);

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
        <label htmlFor="name" className="mb-1 block text-sm font-medium">
          Name <span className="text-[var(--muted)]">(optional)</span>
        </label>
        <input
          id="name"
          name="name"
          type="text"
          className="input-touch w-full border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)]"
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
          className="input-touch w-full border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)]"
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 flex items-center gap-1 text-sm font-medium">
          Password
          <InstructionIcon text="Use at least 8 characters." className="-mt-0.5" />
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="input-touch w-full border border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)]"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="btn-primary-touch w-full bg-[var(--accent)] font-semibold text-white disabled:opacity-60"
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
