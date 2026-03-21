"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { userSettings } from "@/db/schema";
import { getSession } from "@/lib/get-session";

async function requireUserId(): Promise<number> {
  const session = await getSession();
  if (!session.isLoggedIn || session.userId == null) throw new Error("Unauthorized");
  return session.userId;
}

export async function getUserSettings() {
  const userId = await requireUserId();
  const db = getDb();
  const rows = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1);
  return rows[0] ?? null;
}

const settingsSchema = z.object({
  dailyCalories: z.coerce.number().int().positive().optional().nullable(),
  dailyProteinG: z.coerce.number().int().positive().optional().nullable(),
  dietaryPreferences: z.string().optional().nullable(),
  defaultLocation: z.string().max(100).optional().nullable(),
});

export async function updateSettings(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const parsed = settingsSchema.safeParse({
    dailyCalories: formData.get("dailyCalories") || null,
    dailyProteinG: formData.get("dailyProteinG") || null,
    dietaryPreferences: formData.get("dietaryPreferences"),
    defaultLocation: formData.get("defaultLocation"),
  });
  if (!parsed.success) {
    return;
  }
  const v = parsed.data;
  const db = getDb();
  await db
    .update(userSettings)
    .set({
      dailyCalories: v.dailyCalories ?? null,
      dailyProteinG: v.dailyProteinG ?? null,
      dietaryPreferences: v.dietaryPreferences || null,
      defaultLocation: v.defaultLocation || null,
      updatedAt: new Date(),
    })
    .where(eq(userSettings.userId, userId));
  revalidatePath("/settings");
  revalidatePath("/home");
}
