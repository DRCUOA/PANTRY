import type { SessionOptions } from "iron-session";

export type SessionData = {
  userId?: number;
  isLoggedIn: boolean;
};

export const defaultSession: SessionData = {
  isLoggedIn: false,
};

export function getSessionOptions(): SessionOptions {
  let password = process.env.SESSION_SECRET;
  if (!password || password.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SESSION_SECRET must be set and at least 32 characters");
    }
    password = "dev-only-secret-min-32-chars!!!!!!!!";
  }
  const isProd = process.env.NODE_ENV === "production";
  return {
    password,
    // __Host- prefix enforces secure + path=/ and prevents domain overrides.
    // Browsers reject __Host- cookies over plain HTTP, so skip in dev.
    cookieName: isProd ? "__Host-pantry_session" : "pantry_session",
    cookieOptions: {
      secure: isProd,
      httpOnly: true,
      sameSite: "lax" as const,
      // 30 days — tighter than 400 days; re-login once a month is reasonable.
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    },
  };
}
