import type { ReactNode } from "react";
import type {
  FccSection,
  FreshnessStatus,
  FounderCommandCenterSnapshot,
} from "../data/founderCommandCenterTypes";
import type { BadgeTone } from "../design-system";
import {
  Badge,
  EmptyIllustration,
  InfoBanner,
  PageHeader,
  SectionCard,
} from "../design-system";
import { MissionControlHome } from "./mission-control/MissionControlHome";

function freshnessTone(s: FreshnessStatus): BadgeTone {
  if (s === "current") return "approved";
  if (s === "stale") return "waiting";
  if (s === "missing") return "rejected";
  return "neutral";
}

function FreshnessBadge({ status }: { status: FreshnessStatus }) {
  const label =
    status === "current"
      ? "Current"
      : status === "stale"
        ? "Stale"
        : status === "missing"
          ? "Missing"
          : "Unavailable";
  return (
    <Badge tone={freshnessTone(status)} className="mono">
      {label}
    </Badge>
  );
}

function SectionShell({
  title,
  section,
  children,
}: {
  title: string;
  section: FccSection<unknown>;
  children: ReactNode;
}) {
  return (
    <SectionCard title={title}>
      <div className="ds-row" style={{ gap: 8, marginBottom: 8 }}>
        <FreshnessBadge status={section.freshness.status} />
        <span className="mono muted">{section.freshness.detail}</span>
      </div>
      {section.data === null &&
      (section.freshness.status === "missing" ||
        section.freshness.status === "unavailable") ? (
        <EmptyIllustration
          title={
            section.freshness.status === "missing"
              ? "Report missing"
              : "Report unavailable"
          }
          copy="Values are not treated as zero."
        />
      ) : (
        children
      )}
    </SectionCard>
  );
}

/** Always-visible safety banner — observation only. */
export function FounderSafetyBanner({
  safety,
}: {
  safety: FounderCommandCenterSnapshot["safety"];
}) {
  return (
    <InfoBanner title="Safety posture">
      {safety.live_label} · {safety.publication_label} · Founder Approval
      Required · Production Entry: {safety.production_entry} · SOS_AIOS_LIVE is
      an env guard (not department off)
    </InfoBanner>
  );
}

/**
 * Command Center home elevated to AIOS Mission Control — Agent #222B.
 * Same snapshot / API / routes. UI only.
 */
export function FounderCommandCenterOverview({
  snap,
  onOpenReview,
  onRefresh,
}: {
  snap: FounderCommandCenterSnapshot;
  onOpenReview: () => void;
  onRefresh?: () => void;
}) {
  return (
    <MissionControlHome
      snap={snap}
      onOpenReview={onOpenReview}
      onRefresh={onRefresh}
    />
  );
}

export function FccSectionPage({
  title,
  subtitle,
  safety,
  section,
  rows,
}: {
  title: string;
  subtitle: string;
  safety: FounderCommandCenterSnapshot["safety"];
  section: FccSection<unknown>;
  rows: Array<{ label: string; value: string }>;
}) {
  return (
    <div className="ds-command" data-readonly="true">
      <PageHeader title={title} subtitle={subtitle} />
      <FounderSafetyBanner safety={safety} />
      <SectionShell title={title} section={section}>
        <dl>
          {rows.map((r) => (
            <div key={r.label} style={{ marginBottom: 8 }}>
              <dt className="muted">{r.label}</dt>
              <dd className="mono">{r.value}</dd>
            </div>
          ))}
        </dl>
      </SectionShell>
      <p className="muted mono" style={{ marginTop: 16 }}>
        Observation only — no actions on this surface.
      </p>
    </div>
  );
}

export function FccReportsPage({
  snap,
}: {
  snap: FounderCommandCenterSnapshot;
}) {
  return (
    <div className="ds-command" data-readonly="true">
      <PageHeader
        title="Reports"
        subtitle="Legacy allowlisted reports — historical / read-only, not live Resume Template ops."
      />
      <FounderSafetyBanner safety={snap.safety} />
      <SectionCard title="Allowlist">
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {snap.reports_index.map((r) => (
            <li
              key={r.id}
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                alignItems: "center",
                marginBottom: 10,
              }}
            >
              <span>{r.label}</span>
              <Badge tone={r.available ? "approved" : "neutral"}>
                {r.available ? "available" : "missing"}
              </Badge>
              <span className="mono muted">{r.path}</span>
            </li>
          ))}
        </ul>
      </SectionCard>
      <p className="muted" style={{ marginTop: 12 }}>
        Paths are listed for Founder awareness. Content is consumed by snapshot
        aggregation — not opened as a file browser.
      </p>
    </div>
  );
}
