import { ThemeToggle } from "@/components/ThemeToggle";
import { AppFooter } from "@/components/ui/AppFooter";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-full flex-col items-center justify-center px-4 py-12">
      <div className="absolute right-4 top-4 z-10 safe-pt md:right-8">
        <ThemeToggle />
      </div>
      {children}
      <AppFooter className="absolute inset-x-0 bottom-0 safe-pb" />
    </div>
  );
}
