import { redirect } from "next/navigation";
import { getSession } from "@/lib/get-session";

export default async function RootPage() {
  const session = await getSession();
  if (session.isLoggedIn) {
    redirect("/home");
  }
  redirect("/login");
}
