import { redirect } from "next/navigation";
import { BottomNav } from "@/components/BottomNav";
import { getSession } from "@/lib/get-session";

export default async function AppShellLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    redirect("/login");
  }
  return (
    <div className="flex min-h-full flex-col pb-28 md:pb-24">
      <main className="safe-pt mx-auto w-full max-w-5xl flex-1 px-4 pt-5 md:px-8 md:pt-8">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
