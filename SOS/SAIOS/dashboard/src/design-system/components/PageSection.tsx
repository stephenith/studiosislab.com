import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  as?: "section" | "div";
};

export function PageSection({
  title,
  subtitle,
  actions,
  children,
  className = "",
  as = "section",
}: Props) {
  const Tag = as;
  return (
    <Tag className={`ds-page-section${className ? ` ${className}` : ""}`}>
      <div className="ds-page-section-head">
        <div>
          <h2 className="ds-page-section-title">{title}</h2>
          {subtitle ? <p className="ds-page-section-sub">{subtitle}</p> : null}
        </div>
        {actions ? <div className="ds-toolbar-actions">{actions}</div> : null}
      </div>
      {children}
    </Tag>
  );
}
