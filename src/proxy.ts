import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Simple in-memory rate limiter (per-instance; sufficient for single-container)
// ---------------------------------------------------------------------------
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_ATTEMPTS = 10; // per window

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  entry.count++;
  return entry.count > RATE_LIMIT_MAX_ATTEMPTS;
}

// Periodically purge stale entries so the Map doesn't grow forever.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(key);
  }
}, 60_000);

// ---------------------------------------------------------------------------
// Paths that are rate-limited (auth-sensitive)
// ---------------------------------------------------------------------------
const RATE_LIMITED_PATHS = ["/login", "/register", "/forgot-password", "/reset-password"];

function isAuthPath(pathname: string): boolean {
  return RATE_LIMITED_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

// ---------------------------------------------------------------------------
// Security headers applied to every matched request
// ---------------------------------------------------------------------------
const isDev = process.env.NODE_ENV === "development";

const securityHeaders: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "0", // modern browsers; CSP is the real protection
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy":
    "camera=(self), microphone=(), geolocation=(), payment=()",
  ...(isDev
    ? {}
    : { "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload" }),
};

// ---------------------------------------------------------------------------
// Proxy function (Next.js 16 — replaces middleware)
// ---------------------------------------------------------------------------
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // --- Rate limit auth endpoints (POST only — form submissions) ---
  if (request.method === "POST" && isAuthPath(pathname)) {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";

    if (isRateLimited(ip)) {
      return new NextResponse("Too many requests. Please try again later.", {
        status: 429,
        headers: {
          "Retry-After": "900", // 15 min
          ...securityHeaders,
        },
      });
    }
  }

  // --- Build response with security headers ---
  const response = NextResponse.next();

  for (const [key, value] of Object.entries(securityHeaders)) {
    response.headers.set(key, value);
  }

  return response;
}

// ---------------------------------------------------------------------------
// Matcher — skip static assets & image optimization
// ---------------------------------------------------------------------------
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
