import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  columns?: number;
};

export function MetricGrid({ children, className = "", columns }: Props) {
  return (
    <div
      className={`ds-metric-grid${className ? ` ${className}` : ""}`}
      style={
        columns
          ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }
          : undefined
      }
    >
      {children}
    </div>
  );
}
