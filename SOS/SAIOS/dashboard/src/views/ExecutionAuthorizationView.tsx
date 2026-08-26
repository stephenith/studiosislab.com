/**
 * Execution Authorization — Agent #186.
 * Founder intent only. Does not execute.
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

type AuthRow = {
  authorization_id: string;
  mission_id: string;
  status: string;
  outcome: string | null;
  founder: string;
  activation_id: string | null;
  certificate_id: string | null;
};

type Payload = {
  authorizations: AuthRow[];
  certificates: Array<{
    certificate_id: string;
    mission_id: string;
    status: string;
    execution_permissions: boolean;
    activation_reference: string | null;
  }>;
};

type Detail = {
  authorization: {
    authorization_id: string;
    mission_id: string;
    founder: string;
    reason: string;
    scope: string;
    status: string;
    outcome: string | null;
    requested_at: string;
    authorized_at: string | null;
    activation_id: string | null;
  };
  request: {
    request_id: string;
    reason: string;
    requested_at: string;
    scope: string;
  } | null;
  decision: {
    decision_id: string;
    decision: string;
    reason: string;
    decided_at: string;
  } | null;
};

export function ExecutionAuthorizationView({
  snapshot,
  onBack,
  onRefresh,
}: Props) {
  const [data, setData] = useState<Payload | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/runtime/execution-authorization", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as Payload;
      setData(body);
      const first = body.authorizations[0];
      if (first) {
        const d = await fetch(
          `/api/runtime/execution-authorization/${encodeURIComponent(first.mission_id)}`,
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

  const ea = snapshot.company_brain?.execution_authorization;
  const rows = data?.authorizations ?? [];

  return (
    <div className="ds-stack">
      <PageHeader
        title="Execution Authorization"
        subtitle="Founder intent only · does not execute · LIVE OFF"
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

      <AlertBanner tone="warn" title="AUTHORIZATION IS NOT EXECUTION">
        Recording founder intent never grants runtime permission.
      </AlertBanner>
      <AlertBanner tone="warn" title="EXECUTION DISABLED">
        Execution remains impossible. Activation Gate is not overridden.
      </AlertBanner>
      <AlertBanner tone="warn" title="LIVE OFF">
        LIVE remains OFF. All allow flags stay false.
      </AlertBanner>

      <SecondaryButton size="sm" onClick={onBack}>
        Back to Mission Control
      </SecondaryButton>

      {error ? (
        <EmptyIllustration
          title="Failed to load execution authorization"
          copy={error}
        />
      ) : null}

      <MetricGrid columns={4}>
        <KPIStatCard
          value={String(ea?.authorization_count ?? rows.length)}
          label="Authorizations"
          tone="neutral"
        />
        <KPIStatCard
          value={String(ea?.authorized_count ?? 0)}
          label="Authorized"
          tone="neutral"
        />
        <KPIStatCard
          value={String(ea?.rejected_count ?? 0)}
          label="Rejected"
          tone="blocked"
        />
        <KPIStatCard
          value={String(ea?.certificate_count ?? 0)}
          label="Certificates"
          tone="neutral"
        />
      </MetricGrid>

      <PageSection title="Request">
        <SectionCard>
          {detail?.request ? (
            <div className="ds-stack">
              <div>
                <strong>{detail.request.request_id}</strong>
              </div>
              <div>Reason: {detail.request.reason}</div>
              <div>Scope: {detail.request.scope}</div>
              <div>Requested: {detail.request.requested_at}</div>
            </div>
          ) : (
            <p>No request loaded.</p>
          )}
        </SectionCard>
      </PageSection>

      <PageSection title="Decision">
        <SectionCard>
          {detail?.decision ? (
            <div className="ds-stack">
              <div className="ds-row-between">
                <strong>{detail.decision.decision_id}</strong>
                <Badge
                  tone={
                    detail.decision.decision === "AUTHORIZED"
                      ? "approved"
                      : "blocked"
                  }
                >
                  {detail.decision.decision}
                </Badge>
              </div>
              <div>Reason: {detail.decision.reason}</div>
              <div>Decided: {detail.decision.decided_at}</div>
              <div>Founder: {detail.authorization.founder}</div>
            </div>
          ) : (
            <p>No decision loaded.</p>
          )}
        </SectionCard>
      </PageSection>

      <PageSection title="Authorization record">
        <SectionCard>
          {detail?.authorization ? (
            <div className="ds-stack">
              <div>
                <strong>{detail.authorization.authorization_id}</strong> ·{" "}
                {detail.authorization.mission_id}
              </div>
              <div>
                Status: {detail.authorization.status} /{" "}
                {detail.authorization.outcome ?? "n/a"}
              </div>
              <div>Activation ref: {detail.authorization.activation_id}</div>
              <div>Requested: {detail.authorization.requested_at}</div>
              <div>
                Authorized at: {detail.authorization.authorized_at ?? "—"}
              </div>
              <div>Reason: {detail.authorization.reason}</div>
            </div>
          ) : (
            <p>No authorization loaded.</p>
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
              <Badge>perms=false</Badge>
            </div>
          ))}
        </SectionCard>
      </PageSection>
    </div>
  );
}
