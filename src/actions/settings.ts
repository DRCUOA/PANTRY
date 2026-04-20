"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { userSettings } from "@/db/schema";
import { getSession } from "@/lib/get-session";
import { isValidTimezone } from "@/lib/timezone";

async function requireUserId(): Promise<number> {
  const session = await getSession();
  if (!session.isLoggedIn || session.userId == null) throw new Error("Unauthorized");
  return session.userId;
}

export async function getUserSettings() {
  const userId = await requireUserId();
  const db = getDb();
  // Deliberately exclude the bytea avatar blob — every page in the app shell
  // fetches this row and the avatar can be several MB. The avatar route
  // handler reads the bytes directly through `readAvatarForUser`.
  const rows = await db
    .select({
      userId: userSettings.userId,
      dailyCalories: userSettings.dailyCalories,
      dailyProteinG: userSettings.dailyProteinG,
      dietaryPreferences: userSettings.dietaryPreferences,
      defaultLocation: userSettings.defaultLocation,
      timezone: userSettings.timezone,
      avatarMime: userSettings.avatarMime,
      avatarUpdatedAt: userSettings.avatarUpdatedAt,
      foodPreferences: userSettings.foodPreferences,
      foodIntolerances: userSettings.foodIntolerances,
      foodNotes: userSettings.foodNotes,
      createdAt: userSettings.createdAt,
      updatedAt: userSettings.updatedAt,
    })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Strip bytea and other weighty fields before a settings row crosses the
 * server/client RSC boundary — avatars are streamed through a dedicated route
 * handler so the image never needs to be serialized into the page payload.
 */
export async function getUserProfileLite() {
  const row = await getUserSettings();
  if (!row) return null;
  return {
    dailyCalories: row.dailyCalories,
    dailyProteinG: row.dailyProteinG,
    defaultLocation: row.defaultLocation,
    timezone: row.timezone,
    avatarMime: row.avatarMime,
    avatarUpdatedAt: row.avatarUpdatedAt ? row.avatarUpdatedAt.getTime() : null,
    foodPreferences: row.foodPreferences ?? [],
    foodIntolerances: row.foodIntolerances ?? [],
    foodNotes: row.foodNotes,
  };
}

const nutritionSchema = z.object({
  dailyCalories: z.coerce.number().int().positive().optional().nullable(),
  dailyProteinG: z.coerce.number().int().positive().optional().nullable(),
  defaultLocation: z.string().max(100).optional().nullable(),
});

export async function updateSettings(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const parsed = nutritionSchema.safeParse({
    dailyCalories: formData.get("dailyCalories") || null,
    dailyProteinG: formData.get("dailyProteinG") || null,
    defaultLocation: formData.get("defaultLocation"),
  });
  if (!parsed.success) return;
  const v = parsed.data;
  const db = getDb();
  await db
    .update(userSettings)
    .set({
      dailyCalories: v.dailyCalories ?? null,
      dailyProteinG: v.dailyProteinG ?? null,
      defaultLocation: v.defaultLocation || null,
      updatedAt: new Date(),
    })
    .where(eq(userSettings.userId, userId));
  revalidatePath("/settings");
  revalidatePath("/home");
}

// ---------------------------------------------------------------------------
// Profile — timezone + food prefs/intolerances + free-text notes
// ---------------------------------------------------------------------------

/** Tags are short, free-form strings. Normalise: trim, dedupe, drop empties. */
const TAG_MAX_LEN = 64;
const TAG_MAX_COUNT = 40;

function cleanTagList(raw: FormDataEntryValue[] | null): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of raw) {
    if (typeof entry !== "string") continue;
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const capped = trimmed.slice(0, TAG_MAX_LEN);
    const key = capped.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(capped);
    if (out.length >= TAG_MAX_COUNT) break;
  }
  return out;
}

export type ProfileState = {
  ok: boolean;
  message?: string;
};

export async function updateProfileAction(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const userId = await requireUserId();

  const tzRaw = formData.get("timezone");
  const tz = typeof tzRaw === "string" ? tzRaw.trim() : "";
  // An empty string means "clear the override and fall back to the browser
  // default". Any non-empty value must be a real IANA zone or we reject it —
  // silently persisting a bad zone would break every later date calc.
  if (tz && !isValidTimezone(tz)) {
    return { ok: false, message: `"${tz}" is not a valid IANA timezone.` };
  }

  const foodPreferences = cleanTagList(formData.getAll("foodPreferences"));
  const foodIntolerances = cleanTagList(formData.getAll("foodIntolerances"));

  const notesRaw = formData.get("foodNotes");
  const notes =
    typeof notesRaw === "string" && notesRaw.trim() ? notesRaw.trim().slice(0, 1000) : null;

  const db = getDb();
  await db
    .update(userSettings)
    .set({
      timezone: tz ? tz : null,
      foodPreferences,
      foodIntolerances,
      foodNotes: notes,
      updatedAt: new Date(),
    })
    .where(eq(userSettings.userId, userId));

  revalidatePath("/settings");
  revalidatePath("/home");
  revalidatePath("/plan");
  return { ok: true, message: "Profile saved." };
}

// ---------------------------------------------------------------------------
// Avatar upload/remove
// ---------------------------------------------------------------------------

export type AvatarState = {
  ok: boolean;
  message?: string;
};

const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5MB
const ACCEPTED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function uploadAvatarAction(
  _prev: AvatarState,
  formData: FormData,
): Promise<AvatarState> {
  const userId = await requireUserId();

  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Please choose an image." };
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return {
      ok: false,
      message: `Image is too large (max ${(MAX_AVATAR_BYTES / 1024 / 1024).toFixed(0)}MB).`,
    };
  }
  if (!ACCEPTED_MIME.has(file.type)) {
    return { ok: false, message: "Unsupported image type. Use JPEG, PNG, WebP, or GIF." };
  }

  const raw = Buffer.from(await file.arrayBuffer());

  // Resize + re-encode to WebP so stored rows stay small and the served image
  // is consistent across browsers. `sharp` ships native bindings; it's
  // imported lazily so it never leaks into client bundles.
  let processed: Buffer;
  let outMime: string;
  try {
    const sharpMod = (await import("sharp")).default;
    processed = await sharpMod(raw)
      .rotate() // honour EXIF orientation
      .resize(512, 512, { fit: "cover", position: "centre" })
      .webp({ quality: 85 })
      .toBuffer();
    outMime = "image/webp";
  } catch (err) {
    // If sharp isn't available at runtime, fall back to the raw upload. This
    // keeps the feature functional during local dev where `sharp` may not be
    // installed for the current platform.
    console.error("avatar: sharp processing failed, storing raw bytes", err);
    processed = raw;
    outMime = file.type;
  }

  const db = getDb();
  await db
    .update(userSettings)
    .set({
      avatarImage: processed,
      avatarMime: outMime,
      avatarUpdatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(userSettings.userId, userId));

  revalidatePath("/settings");
  return { ok: true, message: "Avatar updated." };
}

export async function removeAvatarAction(): Promise<void> {
  const userId = await requireUserId();
  const db = getDb();
  await db
    .update(userSettings)
    .set({
      avatarImage: null,
      avatarMime: null,
      avatarUpdatedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(userSettings.userId, userId));
  revalidatePath("/settings");
}
