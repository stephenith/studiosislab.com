import type { ReactNode } from "react";
import { Badge, type BadgeTone } from "./Badge";
import { PrimaryButton } from "./Buttons";

type Props = {
  priority: string;
  priorityTone?: BadgeTone;
  title: string;
  description: string;
  ctaLabel?: string;
  onCta?: () => void;
  cta?: ReactNode;
  className?: string;
};

export function FounderActionCard({
  priority,
  priorityTone = "waiting",
  title,
  description,
  ctaLabel = "Open",
  onCta,
  cta,
  className = "",
}: Props) {
  return (
    <article
      className={`ds-lib-card ds-lib-interactive ds-founder-action${className ? ` ${className}` : ""}`}
    >
      <Badge tone={priorityTone}>{priority}</Badge>
      <h3 className="ds-founder-action-title">{title}</h3>
      <p className="ds-founder-action-desc">{description}</p>
      {cta ?? (
        <PrimaryButton size="sm" onClick={onCta}>
          {ctaLabel}
        </PrimaryButton>
      )}
    </article>
  );
}
