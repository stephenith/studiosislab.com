import type { ReactNode } from "react";

type Props = {
  search?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
};

export function TopToolbar({ search, meta, actions }: Props) {
  return (
    <header className="ds-toolbar" role="banner">
      {search ?? null}
      <div className="ds-toolbar-spacer" />
      {meta ? <div className="ds-toolbar-meta">{meta}</div> : null}
      {actions ? <div className="ds-toolbar-actions">{actions}</div> : null}
    </header>
  );
}
