import { redirect } from "next/navigation";
import { BottomNav } from "@/components/BottomNav";
import { getSession } from "@/lib/get-session";

export default async function AppShellLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    redirect("/login");
  }
  return (
    <div className="flex min-h-full flex-col pb-24">
      <main className="mx-auto w-full max-w-lg flex-1 px-4 pt-6">{children}</main>
      <BottomNav />
    </div>
  );
}
