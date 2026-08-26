import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
};

export function ToolbarActions({ children, className = "" }: Props) {
  return (
    <div className={`ds-toolbar-actions${className ? ` ${className}` : ""}`}>
      {children}
    </div>
  );
}
