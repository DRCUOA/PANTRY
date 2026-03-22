import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <div className="w-full max-w-sm space-y-8">
      <div className="text-center">
        <h1 className="font-serif text-2xl font-semibold tracking-tight text-[var(--foreground)]">
          Reset password
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">Enter the email for your account</p>
      </div>
      <ForgotPasswordForm />
    </div>
  );
}
