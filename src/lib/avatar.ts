import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { userSettings } from "@/db/schema";

/**
 * Fetch the raw avatar bytes + MIME for a given user. The caller MUST have
 * already authenticated the request and resolved this `userId` from the
 * session — never pass an arbitrary id from the URL.
 */
export async function readAvatarForUser(userId: number) {
  const db = getDb();
  const rows = await db
    .select({
      avatarImage: userSettings.avatarImage,
      avatarMime: userSettings.avatarMime,
      avatarUpdatedAt: userSettings.avatarUpdatedAt,
    })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}
