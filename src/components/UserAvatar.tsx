import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

export type AvatarInfo = {
  /** Millisecond timestamp of the avatar's last update; used as a cache buster. */
  version: number | null;
  /** True when there's an actual image stored; false shows the initials fallback. */
  hasImage: boolean;
  /** Display name used to seed the initials fallback. */
  name: string | null;
  /** Email used when `name` is missing. */
  email: string | null;
};

type Props = {
  info: AvatarInfo;
  /** Size in px. Defaults to 36, a comfortable header size. */
  size?: number;
  /** Extra classes — applied to the outer wrapper (either the Link or the div). */
  className?: string;
  /** When set, wraps the avatar in a Next <Link> pointing here. */
  href?: string;
  /** Accessibility label when wrapped in a link (e.g. "Open settings"). */
  linkLabel?: string;
};

/**
 * Two initials drawn from the user's display name (or the local-part of their
 * email if the name is missing). Capped at 2 chars, uppercased.
 */
function pickInitials(name: string | null, email: string | null): string {
  const source = (name?.trim() || email?.split("@")[0] || "").trim();
  if (!source) return "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

/**
 * Derives a stable hue from a string so each user gets a consistent background
 * colour on their initials fallback. This keeps the placeholder recognisable
 * without adding an avatar for every new account.
 */
function hueFor(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) % 360;
  }
  return h;
}

export function UserAvatar({
  info,
  size = 36,
  className = "",
  href,
  linkLabel,
}: Props) {
  const initials = pickInitials(info.name, info.email);
  const seed = info.email ?? info.name ?? "anon";
  const hue = hueFor(seed);

  const style: CSSProperties = {
    width: size,
    height: size,
    fontSize: Math.max(10, Math.round(size * 0.38)),
    backgroundColor: info.hasImage ? "var(--surface-inset)" : `hsl(${hue} 55% 88%)`,
    color: info.hasImage ? undefined : `hsl(${hue} 45% 25%)`,
  };

  const inner: ReactNode = info.hasImage ? (
    // eslint-disable-next-line @next/next/no-img-element -- raw Postgres bytes; <Image> optimiser adds no value here
    <img
      src={`/api/avatar${info.version ? `?v=${info.version}` : ""}`}
      alt={info.name ? `${info.name}'s avatar` : "Your avatar"}
      width={size}
      height={size}
      className="h-full w-full object-cover"
    />
  ) : (
    <span aria-hidden="true" className="select-none font-semibold leading-none">
      {initials}
    </span>
  );

  const baseClass =
    "inline-flex items-center justify-center overflow-hidden rounded-full border border-[var(--border-strong)]";
  const classes = `${baseClass} ${className}`.trim();

  if (href) {
    return (
      <Link
        href={href}
        aria-label={linkLabel ?? "Profile"}
        className={classes}
        style={style}
      >
        {inner}
      </Link>
    );
  }

  return (
    <span className={classes} style={style} aria-hidden={info.hasImage ? undefined : true}>
      {inner}
    </span>
  );
}
