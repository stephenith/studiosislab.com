import type { ReactNode } from "react";
import { SectionHeader } from "./SectionHeader";

type Props = {
  title?: string;
  actions?: ReactNode;
  children?: ReactNode;
};

export function ChartCard({ title = "Statistics", actions, children }: Props) {
  return (
    <section className="ds-chart-card">
      <SectionHeader title={title} as="h3" actions={actions} />
      <div className="ds-chart-body">{children}</div>
    </section>
  );
}
