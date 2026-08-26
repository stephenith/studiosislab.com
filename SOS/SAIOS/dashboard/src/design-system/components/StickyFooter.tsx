import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  busy?: boolean;
  "aria-label"?: string;
};

export function StickyFooter({
  children,
  className = "",
  busy,
  "aria-label": ariaLabel = "Sticky actions",
}: Props) {
  return (
    <div
      className={`ds-sticky-footer${busy ? " is-busy" : ""}${className ? ` ${className}` : ""}`}
      role="toolbar"
      aria-label={ariaLabel}
      aria-busy={busy}
    >
      {children}
    </div>
  );
}
