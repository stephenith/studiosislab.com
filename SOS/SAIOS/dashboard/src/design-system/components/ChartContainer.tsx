import type { ReactNode } from "react";
import { SectionHeader } from "./SectionHeader";

type Props = {
  title?: string;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  minHeight?: number | string;
};

/** Reusable chart wrapper (extends ChartCard pattern). */
export function ChartContainer({
  title = "Chart",
  actions,
  children,
  className = "",
  minHeight = 160,
}: Props) {
  return (
    <section className={`ds-lib-card ds-chart-wrap${className ? ` ${className}` : ""}`}>
      <SectionHeader title={title} as="h3" actions={actions} />
      <div className="ds-chart-wrap-body" style={{ minHeight }}>
        {children}
      </div>
    </section>
  );
}
