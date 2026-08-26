import type { ReactNode } from "react";

type Props = {
  title: string;
  copy?: string;
  action?: ReactNode;
  className?: string;
};

/** Reference-style empty illustration (line-art circle motif). */
export function EmptyIllustration({
  title,
  copy,
  action,
  className = "",
}: Props) {
  return (
    <div className={`ds-empty-illu${className ? ` ${className}` : ""}`}>
      <div className="ds-empty-illu-art" aria-hidden />
      <p className="ds-empty-illu-title">{title}</p>
      {copy ? <p className="ds-empty-illu-copy">{copy}</p> : null}
      {action ?? null}
    </div>
  );
}
