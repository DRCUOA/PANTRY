"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { users, userSettings } from "@/db/schema";
import { getSession } from "@/lib/get-session";
import { hashPassword, verifyPassword } from "@/lib/password";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().max(255).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function registerAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = registerSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    name: formData.get("name") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { email, password, name } = parsed.data;
  const db = getDb();
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing.length) {
    return { ok: false, error: "An account with this email already exists." };
  }
  const passwordHash = await hashPassword(password);
  const [user] = await db
    .insert(users)
    .values({ email, passwordHash, name: name || null })
    .returning({ id: users.id });
  await db.insert(userSettings).values({ userId: user.id });
  const session = await getSession();
  session.userId = user.id;
  session.isLoggedIn = true;
  await session.save();
  redirect("/home");
}

export async function loginAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { email, password } = parsed.data;
  const db = getDb();
  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const user = rows[0];
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { ok: false, error: "Invalid email or password." };
  }
  const session = await getSession();
  session.userId = user.id;
  session.isLoggedIn = true;
  await session.save();
  redirect("/home");
}

export async function logoutAction(): Promise<void> {
  const session = await getSession();
  session.destroy();
  redirect("/login");
}
