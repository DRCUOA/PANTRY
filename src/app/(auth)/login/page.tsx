import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <div className="w-full max-w-sm space-y-8">
      <div className="text-center">
        <h1 className="font-serif text-2xl font-semibold tracking-tight text-[var(--foreground)]">
          Pantry
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">Sign in to continue</p>
      </div>
      <LoginForm />
    </div>
  );
}
