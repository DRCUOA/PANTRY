import type { ReactNode } from "react";

export function Aisle({
  title,
  count,
  children,
}: {
  title: string;
  count?: number | string;
  children: ReactNode;
}) {
  return (
    <>
      <div className="ui-aisle">
        <span>{title}</span>
        {count != null && <span className="ui-aisle__count">{count}</span>}
      </div>
      {children}
    </>
  );
}
