import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { defaultSession, getSessionOptions, type SessionData } from "./session";

export async function getSession(): Promise<
  SessionData & { save: () => Promise<void>; destroy: () => void }
> {
  const session = await getIronSession<SessionData>(await cookies(), getSessionOptions());
  if (session.isLoggedIn === undefined) session.isLoggedIn = defaultSession.isLoggedIn;
  return session;
}
