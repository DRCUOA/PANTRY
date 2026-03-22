import { ThemeToggle } from "@/components/ThemeToggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-full flex-col items-center justify-center px-4 py-12">
      <div className="absolute right-4 top-4 z-10 safe-pt md:right-8">
        <ThemeToggle />
      </div>
      {children}
    </div>
  );
}
