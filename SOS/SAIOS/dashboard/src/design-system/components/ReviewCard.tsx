import type { ReactNode } from "react";

type Props = {
  selected?: boolean;
  onClick?: () => void;
  thumb?: ReactNode;
  title: string;
  meta?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function ReviewCard({
  selected,
  onClick,
  thumb,
  title,
  meta,
  action,
  className = "",
}: Props) {
  return (
    <button
      type="button"
      className={`ds-review-card${selected ? " selected" : ""}${className ? ` ${className}` : ""}`}
      onClick={onClick}
    >
      <div className="fr-v3-card-thumb fr-thumb">{thumb}</div>
      <div className="fr-v3-card-body">
        <div className="fr-v3-card-title">{title}</div>
        {meta ? <div className="fr-v3-card-meta">{meta}</div> : null}
      </div>
      {action ?? null}
    </button>
  );
}
