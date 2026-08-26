import type { ReactNode } from "react";
import type { BadgeTone } from "./Badge";

type Props = {
  value: string | number;
  label: string;
  delta?: string;
  deltaDirection?: "up" | "down" | "flat";
  icon?: ReactNode;
  tone?: BadgeTone;
  className?: string;
};

export function KPIStatCard({
  value,
  label,
  delta,
  deltaDirection = "flat",
  icon,
  tone = "neutral",
  className = "",
}: Props) {
  return (
    <article
      className={`ds-lib-card ds-lib-interactive ds-kpi${className ? ` ${className}` : ""}`}
      data-tone={tone === "neutral" ? undefined : tone}
    >
      <div className="ds-kpi-top">
        <div className="ds-kpi-value">{value}</div>
        {icon ? <div className="ds-kpi-icon">{icon}</div> : null}
      </div>
      <div className="ds-kpi-label">{label}</div>
      {delta ? (
        <span className={`ds-kpi-delta ${deltaDirection}`}>{delta}</span>
      ) : null}
    </article>
  );
}
