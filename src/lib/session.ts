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
  return {
    password,
    cookieName: "pantry_session",
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 14,
      path: "/",
    },
  };
}
