"use client";

import { useActionState } from "react";
import Link from "next/link";
import { resetPasswordAction, type ResetPasswordResult } from "@/actions/password-reset";
import { InstructionIcon } from "@/components/InstructionIcon";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(
    resetPasswordAction,
    undefined as ResetPasswordResult | undefined,
  );

  return (
    <form
      action={action}
      className="panel-bordered space-y-4 border-2 p-6 shadow-[0_8px_32px_rgba(0,0,0,0.25)]"
    >
      <input type="hidden" name="token" value={token} />
      {state?.ok === false && (
        <p className="rounded-lg bg-[var(--warn-bg)] px-3 py-2 text-sm text-[var(--warn)]" role="alert">
          {state.error}
        </p>
      )}
      <div>
        <label htmlFor="password" className="mb-1 flex items-center gap-1 text-sm font-medium">
          New password
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
      <div>
        <label htmlFor="confirmPassword" className="mb-1 block text-sm font-medium">
          Confirm new password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
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
        {pending ? "Updating…" : "Set new password"}
      </button>
      <p className="text-center text-sm text-[var(--muted)]">
        <Link href="/login" className="font-medium text-[var(--accent)] hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
