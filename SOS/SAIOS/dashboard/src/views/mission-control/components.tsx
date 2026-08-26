/**
 * Mission Control visual primitives — Agent #222B.
 * UI only. No data ownership. Freshness-aware. Restrained accents.
 */
import type { ReactNode } from "react";
import type { FreshnessStatus } from "../../data/founderCommandCenterTypes";
import type { BadgeTone } from "../../design-system";
import { Badge, EmptyIllustration, Skeleton } from "../../design-system";

export function freshnessTone(s: FreshnessStatus): BadgeTone {
  if (s === "current") return "approved";
  if (s === "stale") return "waiting";
  if (s === "missing") return "rejected";
  return "neutral";
}

export function FreshnessIndicator({
  status,
  compact = false,
}: {
  status: FreshnessStatus;
  compact?: boolean;
}) {
  const label =
    status === "current"
      ? "Current"
      : status === "stale"
        ? "Stale"
        : status === "missing"
          ? "Missing"
          : "Unavailable";
  return (
    <Badge
      tone={freshnessTone(status)}
      className={`mono mc-freshness${compact ? " mc-freshness-compact" : ""}`}
    >
      {label}
    </Badge>
  );
}

export function McSectionHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mc-section-header">
      <div>
        <h2 className="mc-section-title">{title}</h2>
        {subtitle ? <p className="mc-section-sub">{subtitle}</p> : null}
      </div>
      {actions ? <div className="mc-section-actions">{actions}</div> : null}
    </div>
  );
}

export function StatusCard({
  label,
  value,
  freshness,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string;
  freshness: FreshnessStatus;
  detail?: string;
  tone?: BadgeTone;
}) {
  return (
    <article className="mc-card mc-status-card" data-tone={tone}>
      <div className="mc-card-top">
        <span className="mc-card-label">{label}</span>
        <FreshnessIndicator status={freshness} compact />
      </div>
      <div className="mc-card-value">{value}</div>
      {detail ? <p className="mc-card-detail mono muted">{detail}</p> : null}
    </article>
  );
}

export function McMetricCard({
  label,
  value,
  freshness,
  detail,
  empty,
}: {
  label: string;
  value: string;
  freshness: FreshnessStatus;
  detail?: string;
  empty?: boolean;
}) {
  return (
    <article
      className={`mc-card mc-metric-card${empty ? " mc-card-empty" : ""}`}
    >
      <div className="mc-card-top">
        <span className="mc-card-label">{label}</span>
        <FreshnessIndicator status={freshness} compact />
      </div>
      <div className="mc-card-value">{value}</div>
      {detail ? <p className="mc-card-detail muted">{detail}</p> : null}
    </article>
  );
}

export function RecommendationCard({
  id,
  title,
  body,
  severity,
}: {
  id: string;
  title: string;
  body?: string;
  severity?: string;
}) {
  return (
    <article className="mc-card mc-rec-card">
      <div className="mc-card-top">
        <span className="mc-card-label mono">{id}</span>
        {severity ? (
          <Badge tone="neutral" className="mono">
            {severity}
          </Badge>
        ) : null}
      </div>
      <p className="mc-rec-title">{title}</p>
      {body ? <p className="mc-card-detail muted">{body}</p> : null}
    </article>
  );
}

export function McTimelineCard({
  title,
  freshness,
  items,
  emptyLabel,
}: {
  title: string;
  freshness: FreshnessStatus;
  items: Array<{
    id: string;
    title: string;
    timestamp: string;
    body?: string;
    kind?: "ok" | "warn" | "error" | "info";
  }>;
  emptyLabel: string;
}) {
  return (
    <section className="mc-card mc-timeline-card">
      <div className="mc-card-top">
        <h3 className="mc-card-heading">{title}</h3>
        <FreshnessIndicator status={freshness} compact />
      </div>
      {items.length === 0 ? (
        <EmptyIllustration title={emptyLabel} copy="No invented activity." />
      ) : (
        <ul className="mc-timeline">
          {items.map((item) => (
            <li key={item.id} className="mc-timeline-item" data-kind={item.kind ?? "info"}>
              <span className="mc-timeline-dot" aria-hidden />
              <div>
                <p className="mc-timeline-title">{item.title}</p>
                <p className="mc-timeline-time mono">{item.timestamp}</p>
                {item.body ? (
                  <p className="mc-card-detail muted">{item.body}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function MissionControlSkeleton() {
  return (
    <div className="mc-root mc-skeleton" aria-busy="true" aria-label="Loading Mission Control">
      <Skeleton variant="line" width="36%" height={32} />
      <Skeleton variant="line" width="48%" height={14} />
      <div className="mc-row mc-row-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} variant="block" height={96} className="mc-skel-card" />
        ))}
      </div>
      <div className="mc-row mc-row-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} variant="block" height={88} className="mc-skel-card" />
        ))}
      </div>
      <Skeleton variant="block" height={160} />
      <Skeleton variant="block" height={140} />
    </div>
  );
}

export function unavailableValue(status: FreshnessStatus): string {
  if (status === "missing") return "—";
  if (status === "unavailable") return "—";
  return "—";
}

export function formatDisplay(
  freshness: FreshnessStatus,
  value: string | number | boolean | null | undefined,
  opts?: { missingLabel?: string },
): { text: string; empty: boolean } {
  if (freshness === "missing") {
    return { text: opts?.missingLabel ?? "—", empty: true };
  }
  if (freshness === "unavailable") {
    return { text: "—", empty: true };
  }
  if (value === null || value === undefined) {
    return { text: "—", empty: true };
  }
  if (typeof value === "boolean") {
    return { text: value ? "yes" : "no", empty: false };
  }
  return { text: String(value), empty: false };
}
