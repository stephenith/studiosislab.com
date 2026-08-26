import type { ReactNode } from "react";

type Props = {
  title: string;
  as?: "h2" | "h3";
  actions?: ReactNode;
};

export function SectionHeader({ title, as = "h2", actions }: Props) {
  const Tag = as;
  return (
    <div className="ds-section-header">
      <Tag>{title}</Tag>
      {actions ? <div>{actions}</div> : null}
    </div>
  );
}
