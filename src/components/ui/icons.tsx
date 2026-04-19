/** Inline SVG icons — single-stroke, 24x24 viewbox, currentColor. */
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Base({ size = 24, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export function IconHome(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M3 11 12 4l9 7" />
      <path d="M5 10v10h14V10" />
    </Base>
  );
}

export function IconPantry(p: IconProps) {
  return (
    <Base {...p}>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M4 9h16M4 15h16M10 3v18" />
    </Base>
  );
}

export function IconPlan(p: IconProps) {
  return (
    <Base {...p}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </Base>
  );
}

export function IconShop(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M4 6h2l2 12h10l2-8H7" />
      <circle cx="9" cy="20" r="1.5" />
      <circle cx="17" cy="20" r="1.5" />
    </Base>
  );
}

export function IconScan(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M4 7V5a1 1 0 0 1 1-1h2M20 7V5a1 1 0 0 0-1-1h-2M4 17v2a1 1 0 0 0 1 1h2M20 17v2a1 1 0 0 1-1 1h-2" />
      <path d="M7 8v8M11 8v8M15 8v8M19 8v8" />
    </Base>
  );
}

export function IconPlus(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M12 5v14M5 12h14" />
    </Base>
  );
}

export function IconMinus(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M5 12h14" />
    </Base>
  );
}

export function IconSearch(p: IconProps) {
  return (
    <Base {...p}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </Base>
  );
}

export function IconClose(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Base>
  );
}

export function IconCheck(p: IconProps) {
  return (
    <Base {...p}>
      <path d="m5 12 5 5L20 7" />
    </Base>
  );
}

export function IconAlert(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M12 9v4M12 17h.01" />
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.72 3h16.92a2 2 0 0 0 1.72-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
    </Base>
  );
}

export function IconSparkle(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M12 3v3M12 18v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M3 12h3M18 12h3M4.2 19.8 6.3 17.7M17.7 6.3l2.1-2.1" />
      <circle cx="12" cy="12" r="3" />
    </Base>
  );
}

export function IconChevronLeft(p: IconProps) {
  return (
    <Base {...p}>
      <path d="m15 18-6-6 6-6" />
    </Base>
  );
}

export function IconChevronRight(p: IconProps) {
  return (
    <Base {...p}>
      <path d="m9 6 6 6-6 6" />
    </Base>
  );
}

export function IconSettings(p: IconProps) {
  return (
    <Base {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </Base>
  );
}

export function IconTrash(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" />
    </Base>
  );
}

export function IconEdit(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </Base>
  );
}

export function IconFire(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M12 3s4 4 4 9a4 4 0 0 1-8 0c0-3 2-4 2-7 2 1 2 5 2 5Z" />
    </Base>
  );
}

export function IconClock(p: IconProps) {
  return (
    <Base {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Base>
  );
}

export function IconFilter(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M3 4h18l-7 9v7l-4-2v-5Z" />
    </Base>
  );
}

export function IconBarcode(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M4 5v14M7 5v14M11 5v14M14 5v14M17 5v14M20 5v14" />
    </Base>
  );
}

export function IconMic(p: IconProps) {
  return (
    <Base {...p}>
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 19v3" />
    </Base>
  );
}

export function IconKeyboard(p: IconProps) {
  return (
    <Base {...p}>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8" />
    </Base>
  );
}

export function IconUser(p: IconProps) {
  return (
    <Base {...p}>
      <circle cx="12" cy="8" r="4" />
      <path d="M20 21a8 8 0 0 0-16 0" />
    </Base>
  );
}

export function IconBasket(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M5.2 11h13.6l-1.2 8H6.4z" />
      <path d="M8 11 12 3l4 8" />
      <path d="M15 15l2-1" strokeWidth="1.8" />
      <path d="M15 17l1.5 1" strokeWidth="1.8" />
      <path d="M14.5 14.5l2.5 4" strokeWidth="1.8" />
    </Base>
  );
}

export function IconHistory(p: IconProps) {
  return (
    <Base {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Base>
  );
}
