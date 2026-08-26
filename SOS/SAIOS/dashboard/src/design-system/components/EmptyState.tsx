import type { ReactNode } from "react";

type Props = {
  title: string;
  copy?: string;
  action?: ReactNode;
};

export function EmptyState({ title, copy, action }: Props) {
  return (
    <div className="ds-empty">
      <div className="ds-empty-art" aria-hidden>
        <span />
        <span />
      </div>
      <p className="ds-empty-title">{title}</p>
      {copy ? <p className="ds-empty-copy">{copy}</p> : null}
      {action ?? null}
    </div>
  );
}
