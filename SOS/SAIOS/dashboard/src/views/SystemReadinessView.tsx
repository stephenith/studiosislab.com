/**
 * System Readiness Freeze — Agent #171.
 * Read-only certification. Never executes.
 */
import { useCallback, useEffect, useState } from "react";
import type { DashboardSnapshot } from "../data/types";
import {
  AlertBanner,
  Badge,
  EmptyIllustration,
  InfoBanner,
  KPIStatCard,
  MetricGrid,
  PageHeader,
  PageSection,
  SecondaryButton,
  SectionCard,
} from "../design-system";

type Props = {
  snapshot: DashboardSnapshot;
  onBack: () => void;
  onRefresh: () => void | Promise<void>;
};

type ReadinessPayload = {
  certificate: {
    certificate_id: string;
    mission_id: string;
    mission_version: number;
    runtime_plan_id: string;
    runtime_release_id: string;
    shadow_queue_id: string;
    submission_id: string;
    checksum_chain: Record<string, string>;
    architecture_version: string;
    governance_version: string;
    validated_at: string;
    founder: string;
    current_lifecycle: string;
    certificate_status: "SYSTEM_READY" | "SYSTEM_BLOCKED";
    lifecycle_timeline: Array<{
      stage: string;
      status: string;
      required: boolean;
      satisfied: boolean;
    }>;
    safety_flags: Record<string, boolean>;
    verification_summary: Record<string, boolean | string>;
    reports_present: string[];
    blockers: string[];
    readiness_score: number;
    next_safe_action: string;
  } | null;
  mission_status: string | null;
  latest: unknown;
  health: unknown;
  error?: string;
};

export function SystemReadinessView({ snapshot, onBack, onRefresh }: Props) {
  const missionId = snapshot.company_brain?.current_mission_id ?? null;
  const [data, setData] = useState<ReadinessPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!missionId) {
      setData(null);
      return;
    }
    try {
      const res = await fetch(
        `/api/runtime/system-readiness/${encodeURIComponent(missionId)}`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as ReadinessPayload;
      setData(body);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [missionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const cert =
    data?.certificate ??
    (snapshot.company_brain?.latest_system_readiness
      ? {
          certificate_id:
            snapshot.company_brain.latest_system_readiness.certificate_id ??
            "—",
          mission_id: missionId ?? "—",
          mission_version: 0,
          runtime_plan_id: "—",
          runtime_release_id: "—",
          shadow_queue_id: "—",
          submission_id: "—",
          checksum_chain: {},
          architecture_version:
            snapshot.company_brain.latest_system_readiness
              .architecture_version ?? "—",
          governance_version:
            snapshot.company_brain.latest_system_readiness.governance_version ??
            "—",
          validated_at: "—",
          founder: "stephen",
          current_lifecycle:
            snapshot.company_brain.system_readiness_status ?? "—",
          certificate_status: (snapshot.company_brain.system_readiness_status ===
          "SYSTEM_READY"
            ? "SYSTEM_READY"
            : snapshot.company_brain.system_readiness_status === "SYSTEM_BLOCKED"
              ? "SYSTEM_BLOCKED"
              : "SYSTEM_BLOCKED") as "SYSTEM_READY" | "SYSTEM_BLOCKED",
          lifecycle_timeline: [],
          safety_flags: {},
          verification_summary: {},
          reports_present: [],
          blockers: [],
          readiness_score:
            snapshot.company_brain.latest_system_readiness.readiness_score ?? 0,
          next_safe_action:
            snapshot.company_brain.latest_system_readiness.next_safe_action ??
            "—",
        }
      : null);

  const status =
    cert?.certificate_status ??
    snapshot.company_brain?.system_readiness_status ??
    data?.mission_status;

  return (
    <div className="ds-stack">
      <PageHeader
        title="System Readiness Freeze"
        subtitle="Governance spine certificate · execution remains impossible · LIVE OFF"
        actions={
          <SecondaryButton
            size="sm"
            onClick={() => {
              void onRefresh();
              void load();
            }}
          >
            Refresh
          </SecondaryButton>
        }
      />

      <AlertBanner tone="success" title="GOVERNANCE COMPLETE">
        Founder → Mission → Approval → Queue → Package → Ack → Submission →
        Shadow → Plan → Release → Readiness Freeze.
      </AlertBanner>
      <AlertBanner tone="warn" title="EXECUTION DISABLED">
        execution_allowed=false · no runtime path exists.
      </AlertBanner>
      <AlertBanner tone="warn" title="SCHEDULER DISABLED">
        scheduler_allowed=false.
      </AlertBanner>
      <AlertBanner tone="warn" title="PROVIDERS DISABLED">
        provider_allowed=false.
      </AlertBanner>
      <AlertBanner tone="warn" title="PUBLISHING DISABLED">
        publishing_allowed=false.
      </AlertBanner>
      <AlertBanner tone="warn" title="LIVE OFF">
        live_enabled=false · STOP.
      </AlertBanner>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <SecondaryButton size="sm" onClick={onBack}>
          Back to Mission Control
        </SecondaryButton>
      </div>

      {!missionId ? (
        <EmptyIllustration
          title="No current mission"
          copy="Complete Runtime Release approval, then open System Readiness."
        />
      ) : error && !data && !cert ? (
        <EmptyIllustration title="Failed to load readiness" copy={error} />
      ) : (
        <>
          <MetricGrid columns={4}>
            <KPIStatCard
              value={status ?? "—"}
              label="Certificate Status"
              tone={
                status === "SYSTEM_READY"
                  ? "positive"
                  : status === "SYSTEM_BLOCKED"
                    ? "critical"
                    : "neutral"
              }
            />
            <KPIStatCard
              value={String(cert?.readiness_score ?? "—")}
              label="Readiness Score"
              tone="neutral"
            />
            <KPIStatCard
              value={cert?.architecture_version ?? "—"}
              label="Architecture"
              tone="neutral"
            />
            <KPIStatCard
              value={cert?.governance_version ?? "—"}
              label="Governance"
              tone="neutral"
            />
          </MetricGrid>

          <PageSection title="Readiness Certificate">
            {!cert ? (
              <InfoBanner title="No certificate yet">
                Mission must be RUNTIME_RELEASE_APPROVED. Certificate issues on
                GET (read-only certify).
              </InfoBanner>
            ) : (
              <SectionCard title={cert.certificate_id}>
                <div className="ds-stack" style={{ gap: 8 }}>
                  <div>
                    <Badge
                      tone={
                        cert.certificate_status === "SYSTEM_READY"
                          ? "success"
                          : "danger"
                      }
                    >
                      {cert.certificate_status}
                    </Badge>
                  </div>
                  <p>
                    Mission: <code>{cert.mission_id}</code> · v
                    {cert.mission_version}
                  </p>
                  <p>
                    Plan: <code>{cert.runtime_plan_id}</code>
                  </p>
                  <p>
                    Release: <code>{cert.runtime_release_id}</code>
                  </p>
                  <p>
                    Founder: {cert.founder} · Validated: {cert.validated_at}
                  </p>
                  <p>Lifecycle at certify: {cert.current_lifecycle}</p>
                  <p>
                    Next: <strong>{cert.next_safe_action}</strong>
                  </p>
                </div>
              </SectionCard>
            )}
          </PageSection>

          <PageSection title="Lifecycle Timeline">
            <SectionCard title="Governance spine">
              {(cert?.lifecycle_timeline ?? []).length === 0 ? (
                <p>No timeline loaded.</p>
              ) : (
                <ul>
                  {(cert?.lifecycle_timeline ?? []).map((t) => (
                    <li key={t.stage}>
                      {t.satisfied ? "✓" : "✗"} {t.stage} — {t.status}
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </PageSection>

          <PageSection title="Checksum Chain">
            <SectionCard title="Immutable chain">
              {cert?.checksum_chain ? (
                <ul>
                  {Object.entries(cert.checksum_chain).map(([k, v]) => (
                    <li key={k}>
                      <code>{k}</code>: {String(v).slice(0, 16)}…
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No checksums.</p>
              )}
            </SectionCard>
          </PageSection>

          <PageSection title="Verification Summary">
            <SectionCard title="Prior suite">
              {cert?.verification_summary ? (
                <ul>
                  {Object.entries(cert.verification_summary).map(([k, v]) => (
                    <li key={k}>
                      {k}: {String(v)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No verification summary.</p>
              )}
            </SectionCard>
          </PageSection>

          <PageSection title="Reports Generated">
            <SectionCard title="Required reports present">
              {(cert?.reports_present ?? []).length ? (
                <ul>
                  {(cert?.reports_present ?? []).map((r) => (
                    <li key={r}>
                      <code>{r}</code>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>None listed.</p>
              )}
            </SectionCard>
          </PageSection>

          <PageSection title="Safety Summary">
            <SectionCard title="All must remain false">
              <ul>
                {Object.entries(
                  cert?.safety_flags ??
                    snapshot.company_brain?.system_readiness_health
                      ?.safety_flags ??
                    {},
                ).map(([k, v]) => (
                  <li key={k}>
                    {k}: {String(v)}
                  </li>
                ))}
              </ul>
              {(cert?.blockers ?? []).length > 0 ? (
                <>
                  <p>Blockers:</p>
                  <ul>
                    {(cert?.blockers ?? []).map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                </>
              ) : null}
            </SectionCard>
          </PageSection>
        </>
      )}
    </div>
  );
}
