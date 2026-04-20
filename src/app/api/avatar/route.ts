import { NextResponse } from "next/server";
import { readAvatarForUser } from "@/lib/avatar";
import { getSession } from "@/lib/get-session";

export const dynamic = "force-dynamic";

/**
 * Streams the current user's avatar bytes from Postgres.
 *
 * We authenticate via the iron-session cookie before reading anything — the
 * avatar is always the caller's own, never addressable by user id in the URL.
 * Responses are marked private so they never end up in a shared CDN cache,
 * but the browser can still re-use the bytes for the short window before the
 * avatar changes (the avatarUpdatedAt timestamp drives the ETag / query
 * buster on the client side).
 */
export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn || session.userId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const row = await readAvatarForUser(session.userId);
  if (!row?.avatarImage || !row.avatarMime) {
    return new NextResponse("No avatar", { status: 404 });
  }

  const bytes = row.avatarImage;
  // Wrap in a Blob so it's a typed BodyInit and we don't accidentally share
  // the Buffer's pooled ArrayBuffer with the response.
  const body = new Blob([new Uint8Array(bytes)], { type: row.avatarMime });

  const etag = row.avatarUpdatedAt
    ? `"${row.avatarUpdatedAt.getTime().toString(36)}"`
    : undefined;

  const headers: Record<string, string> = {
    "Content-Type": row.avatarMime,
    "Content-Length": String(body.size),
    "Cache-Control": "private, max-age=60, must-revalidate",
  };
  if (etag) headers.ETag = etag;

  return new NextResponse(body, { status: 200, headers });
}
