import Link from "next/link";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const t = token?.trim() ?? "";

  if (!t) {
    return (
      <div className="w-full max-w-sm space-y-6 text-center">
        <h1 className="font-serif text-2xl font-semibold tracking-tight text-[var(--foreground)]">
          Invalid link
        </h1>
        <p className="text-sm text-[var(--muted)]">
          This reset link is missing a token. Request a new reset from the sign-in page.
        </p>
        <Link
          href="/forgot-password"
          className="btn-primary-touch inline-flex w-full items-center justify-center bg-[var(--accent)] font-semibold text-white"
        >
          Request reset
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm space-y-8">
      <div className="text-center">
        <h1 className="font-serif text-2xl font-semibold tracking-tight text-[var(--foreground)]">
          New password
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">Choose a new password for your account</p>
      </div>
      <ResetPasswordForm token={t} />
    </div>
  );
}
