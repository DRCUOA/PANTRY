"use client";

import Link from "next/link";
import type { ReactNode } from "react";

type Common = {
  children: ReactNode;
  active?: boolean;
  count?: number | string;
  className?: string;
};

export function Chip(
  props:
    | (Common & { href: string; onClick?: never; type?: never; as?: "link" })
    | (Common & { onClick: () => void; href?: never; type?: "button"; as?: "button" })
    | (Common & { as: "toggle"; onClick: () => void; href?: never; type?: "button" }),
) {
  const { children, active, count, className = "" } = props;
  const classes = `ui-chip${active ? " ui-chip--active" : ""} ${className}`.trim();
  const body = (
    <>
      {children}
      {count != null && count !== "" && <span className="ui-chip--count">· {count}</span>}
    </>
  );
  if ("href" in props && props.href) {
    return (
      <Link href={props.href} className={classes} aria-current={active ? "page" : undefined}>
        {body}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={props.onClick}
      aria-pressed={active}
      className={classes}
    >
      {body}
    </button>
  );
}

export function ChipRow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`ui-chip-row ${className}`.trim()}>{children}</div>;
}
