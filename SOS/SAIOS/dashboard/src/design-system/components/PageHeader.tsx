import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
};

export function PageHeader({ title, subtitle, actions }: Props) {
  return (
    <header className="ds-page-header">
      <div>
        <h1>{title}</h1>
        {subtitle ? <p className="ds-page-header-sub">{subtitle}</p> : null}
      </div>
      {actions ? <div className="ds-toolbar-meta">{actions}</div> : null}
    </header>
  );
}
