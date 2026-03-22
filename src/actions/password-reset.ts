"use server";

import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { passwordResetTokens, users } from "@/db/schema";
import { hashPassword } from "@/lib/password";

const emailSchema = z.object({
  email: z.string().email(),
});

const resetSchema = z
  .object({
    token: z.string().min(1),
    password: z.string().min(8),
    confirmPassword: z.string().min(1),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type ForgotPasswordState =
  | { ok: true; devResetUrl?: string }
  | { ok: false; error: string }
  | undefined;

async function appOrigin(): Promise<string> {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (envUrl) return envUrl;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  if (host) return `${proto}://${host}`;
  return "http://localhost:3000";
}

function hashToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Always returns success for unknown emails (no account enumeration). */
export async function requestPasswordResetAction(
  _prev: ForgotPasswordState | undefined,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const parsed = emailSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid email" };
  }
  const { email } = parsed.data;
  const db = getDb();
  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const user = rows[0];
  if (!user) {
    return { ok: true };
  }

  await db
    .delete(passwordResetTokens)
    .where(
      and(eq(passwordResetTokens.userId, user.id), isNull(passwordResetTokens.usedAt)),
    );

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await db.insert(passwordResetTokens).values({
    userId: user.id,
    tokenHash,
    expiresAt,
  });

  const origin = await appOrigin();
  const devResetUrl =
    process.env.NODE_ENV === "development"
      ? `${origin}/reset-password?token=${encodeURIComponent(rawToken)}`
      : undefined;

  return { ok: true, devResetUrl };
}

export type ResetPasswordResult = { ok: false; error: string } | undefined;

export async function resetPasswordAction(
  _prev: ResetPasswordResult | undefined,
  formData: FormData,
): Promise<ResetPasswordResult> {
  const parsed = resetSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { token, password } = parsed.data;
  const tokenHash = hashToken(token);
  const db = getDb();
  const rows = await db
    .select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.tokenHash, tokenHash))
    .limit(1);
  const row = rows[0];
  const now = new Date();
  if (!row || row.usedAt != null || row.expiresAt < now) {
    return { ok: false, error: "This reset link is invalid or has expired. Request a new one." };
  }

  const passwordHash = await hashPassword(password);
  await db
    .update(users)
    .set({ passwordHash, updatedAt: now })
    .where(eq(users.id, row.userId));
  await db
    .update(passwordResetTokens)
    .set({ usedAt: now })
    .where(eq(passwordResetTokens.id, row.id));

  redirect("/login?reset=1");
}
