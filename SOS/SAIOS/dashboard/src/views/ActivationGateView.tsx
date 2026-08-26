/**
 * Activation Gate — Agent #185.
 * Eligibility only. Does not execute.
 */
import { useCallback, useEffect, useState } from "react";
import type { DashboardSnapshot } from "../data/types";
import {
  AlertBanner,
  Badge,
  EmptyIllustration,
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

type ActivationRow = {
  activation_id: string;
  mission_id: string;
  status: string;
  outcome: string | null;
  overall_score: number;
  blocking_count: number;
  certificate_id: string | null;
};

type Payload = {
  activations: ActivationRow[];
  certificates: Array<{
    certificate_id: string;
    mission_id: string;
    overall_score: number;
    status: string;
    execution_permissions: boolean;
  }>;
};

type Detail = {
  eligibility: {
    checklist: Array<{
      check_id: string;
      label: string;
      status: string;
      blocking: boolean;
      detail: string;
    }>;
    score: Record<string, number>;
    blocking_items: string[];
    warnings: string[];
    recommendations: string[];
    outcome: string | null;
    status: string;
  };
};

export function ActivationGateView({
  snapshot,
  onBack,
  onRefresh,
}: Props) {
  const [data, setData] = useState<Payload | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/runtime/activation-gate", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as Payload;
      setData(body);
      const first = body.activations[0];
      if (first) {
        const d = await fetch(
          `/api/runtime/activation-gate/${encodeURIComponent(first.mission_id)}`,
          { cache: "no-store" },
        );
        if (d.ok) setDetail((await d.json()) as Detail);
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const ag = snapshot.company_brain?.activation_gate;
  const rows = data?.activations ?? [];

  return (
    <div className="ds-stack">
      <PageHeader
        title="Activation Gate"
        subtitle="Eligibility only · does not execute · LIVE OFF"
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

      <AlertBanner tone="warn" title="EXECUTION DISABLED">
        Execution remains disabled. Activation does not unlock workers or queues.
      </AlertBanner>
      <AlertBanner tone="warn" title="ACTIVATION DOES NOT EXECUTE">
        Eligibility outcome is advisory metadata only.
      </AlertBanner>
      <AlertBanner tone="warn" title="LIVE OFF">
        LIVE remains OFF. No safety flag may change.
      </AlertBanner>

      <SecondaryButton size="sm" onClick={onBack}>
        Back to Mission Control
      </SecondaryButton>

      {error ? (
        <EmptyIllustration title="Failed to load activation gate" copy={error} />
      ) : null}

      <MetricGrid columns={4}>
        <KPIStatCard
          value={String(ag?.activation_count ?? rows.length)}
          label="Activations"
          tone="neutral"
        />
        <KPIStatCard
          value={String(ag?.blocked_count ?? 0)}
          label="Blocked"
          tone="blocked"
        />
        <KPIStatCard
          value={String(ag?.eligible_count ?? 0)}
          label="Eligible"
          tone="neutral"
        />
        <KPIStatCard
          value={
            ag?.overall_score != null ? String(ag.overall_score) : "—"
          }
          label="Latest Score"
          tone="neutral"
        />
      </MetricGrid>

      <PageSection title="Scores">
        <SectionCard>
          {detail?.eligibility.score ? (
            <div className="ds-stack">
              {Object.entries(detail.eligibility.score).map(([k, v]) => (
                <div key={k} className="ds-row-between">
                  <span>{k}</span>
                  <Badge>{String(v)}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p>No scorecard loaded.</p>
          )}
        </SectionCard>
      </PageSection>

      <PageSection title="Checklist">
        <SectionCard>
          {(detail?.eligibility.checklist ?? []).length === 0 ? (
            <p>No checklist loaded.</p>
          ) : (
            <div className="ds-stack">
              {detail!.eligibility.checklist.map((c) => (
                <div key={c.check_id} className="ds-row-between">
                  <div>
                    <strong>{c.label}</strong>
                    <div>{c.detail}</div>
                  </div>
                  <Badge tone={c.blocking ? "blocked" : "neutral"}>
                    {c.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </PageSection>

      <PageSection title="Blocking items">
        <SectionCard>
          {(detail?.eligibility.blocking_items ?? []).length === 0 ? (
            <p>None on selected record.</p>
          ) : (
            <ul>
              {detail!.eligibility.blocking_items.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          )}
        </SectionCard>
      </PageSection>

      <PageSection title="Warnings">
        <SectionCard>
          {(detail?.eligibility.warnings ?? []).length === 0 ? (
            <p>None.</p>
          ) : (
            <ul>
              {detail!.eligibility.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
        </SectionCard>
      </PageSection>

      <PageSection title="Certificates">
        <SectionCard>
          {(data?.certificates ?? []).map((c) => (
            <div key={c.certificate_id} className="ds-row-between">
              <div>
                <strong>{c.certificate_id}</strong> · {c.mission_id} ·{" "}
                {c.status}
              </div>
              <Badge>score={c.overall_score} · perms=false</Badge>
            </div>
          ))}
        </SectionCard>
      </PageSection>
    </div>
  );
}
