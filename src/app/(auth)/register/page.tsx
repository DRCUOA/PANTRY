import { RegisterForm } from "@/components/RegisterForm";

export default function RegisterPage() {
  return (
    <div className="w-full max-w-sm space-y-8">
      <div className="text-center">
        <h1 className="font-serif text-2xl font-semibold tracking-tight">Create account</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">One household, one login</p>
      </div>
      <RegisterForm />
    </div>
  );
}
