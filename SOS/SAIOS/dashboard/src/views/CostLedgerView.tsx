/**
 * Cost Ledger — Agent #181.
 * Bookkeeping contracts only. Never bills. Never executes.
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

type BudgetRow = {
  budget_id: string;
  budget_kind: string;
  budget_name: string;
  status: string;
  mission_id: string | null;
  department_id: string | null;
  amount: number | null;
  remaining: number | null;
  validation_ok: boolean;
};

type SessionRow = {
  session_id: string;
  mission_id: string;
  department_id: string | null;
  status: string;
  estimated_cost: { amount: number | null };
  approved_budget: { amount: number | null };
  remaining_budget: { amount: number | null };
  provider_estimates: unknown[];
  worker_estimates: unknown[];
};

type Payload = {
  budgets: BudgetRow[];
  sessions: SessionRow[];
  snapshot?: { next_safe_action?: string };
};

export function CostLedgerView({ snapshot, onBack, onRefresh }: Props) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/platform/cost-ledger", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData((await res.json()) as Payload);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const cl = snapshot.company_brain?.cost_ledger;
  const budgets = data?.budgets ?? [];
  const sessions = data?.sessions ?? [];

  return (
    <div className="ds-stack">
      <PageHeader
        title="Cost Ledger"
        subtitle="Financial authority scaffold · metadata only · no billing · LIVE OFF"
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

      <AlertBanner tone="warn" title="NO BILLING">
        billing_allowed=false · no provider billing · no token counting
      </AlertBanner>
      <AlertBanner tone="warn" title="NO PROVIDERS">
        provider_allowed=false · estimates are placeholders
      </AlertBanner>
      <AlertBanner tone="warn" title="NO EXECUTION">
        execution_allowed=false · Cost Sessions owned by Execution Controller
        (future)
      </AlertBanner>
      <AlertBanner tone="warn" title="LIVE OFF">
        live_enabled=false
      </AlertBanner>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <SecondaryButton size="sm" onClick={onBack}>
          Back to Mission Control
        </SecondaryButton>
      </div>

      {error && !data ? (
        <EmptyIllustration title="Failed to load cost ledger" copy={error} />
      ) : (
        <>
          <MetricGrid columns={4}>
            <KPIStatCard
              value={String(budgets.length || cl?.budget_count || 0)}
              label="Budgets"
              tone="neutral"
            />
            <KPIStatCard
              value={String(sessions.length || cl?.session_count || 0)}
              label="Sessions"
              tone="neutral"
            />
            <KPIStatCard
              value={String(cl?.ready_budget_count ?? 0)}
              label="Ready Budgets"
              tone="positive"
            />
            <KPIStatCard
              value={cl?.latest_session_id ?? sessions[0]?.session_id ?? "—"}
              label="Latest Session"
              tone="neutral"
            />
          </MetricGrid>

          <PageSection title="Budget Summary">
            <SectionCard>
              <p className="ds-meta">
                {data?.snapshot?.next_safe_action ??
                  cl?.next_safe_action ??
                  "Cost ledger contracts only"}
              </p>
              <div className="ds-stack" style={{ gap: 8, marginTop: 8 }}>
                {budgets.map((b) => (
                  <div key={b.budget_id} className="ds-row-between">
                    <span>
                      <strong>{b.budget_name}</strong>{" "}
                      <Badge>{b.budget_kind}</Badge>{" "}
                      <span className="ds-meta">{b.status}</span>
                    </span>
                    <span className="ds-meta">
                      amount={b.amount ?? "null"} · remaining=
                      {b.remaining ?? "null"}
                      {b.department_id ? ` · dept=${b.department_id}` : ""}
                      {b.mission_id ? ` · mission=${b.mission_id}` : ""}
                    </span>
                  </div>
                ))}
                {!budgets.length ? (
                  <p className="ds-meta">No budgets seeded yet.</p>
                ) : null}
              </div>
            </SectionCard>
          </PageSection>

          <PageSection title="Cost Sessions">
            <SectionCard>
              <div className="ds-stack" style={{ gap: 12 }}>
                {sessions.map((s) => (
                  <div key={s.session_id}>
                    <p>
                      <strong>{s.session_id}</strong> · {s.status} · mission=
                      {s.mission_id}
                    </p>
                    <p className="ds-meta">
                      estimated={s.estimated_cost?.amount ?? "null"} · approved=
                      {s.approved_budget?.amount ?? "null"} · remaining=
                      {s.remaining_budget?.amount ?? "null"}
                    </p>
                    <p className="ds-meta">
                      provider estimates: {s.provider_estimates?.length ?? 0} ·
                      worker estimates: {s.worker_estimates?.length ?? 0}
                    </p>
                  </div>
                ))}
                {!sessions.length ? (
                  <p className="ds-meta">No sessions.</p>
                ) : null}
              </div>
            </SectionCard>
          </PageSection>
        </>
      )}
    </div>
  );
}
