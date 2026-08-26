/**
 * Pre-Dispatch Simulation — Agent #187.
 * Simulation metadata only. Does not execute.
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

type SimRow = {
  simulation_id: string;
  mission_id: string;
  status: string;
  overall_readiness: number | null;
  certificate_id: string | null;
};

type Payload = {
  simulations: SimRow[];
  certificates: Array<{
    certificate_id: string;
    mission_id: string;
    scores: Record<string, number>;
    execution_permissions: boolean;
  }>;
};

type Detail = {
  simulation: {
    simulation_id: string;
    mission_id: string;
    status: string;
    estimated_duration_ms: number;
    estimated_cost: { estimated_usd: number; billing: boolean };
    timeline: Array<{ step_id: string; label: string; executed: boolean }>;
    graph_nodes: Array<{ node_id: string; label: string; executed: boolean }>;
    worker_allocations: Array<{
      worker_id: string;
      assigned: boolean;
      spawned: boolean;
      running: boolean;
    }>;
    department_allocations: Array<{
      department_id: string;
      allocated: boolean;
      executing: boolean;
    }>;
    rollback_plan: { steps: string[]; executable: boolean };
    retry_plan: { max_attempts: number; executable: boolean };
    telemetry_refs: Array<{ telemetry_session_id: string; events_emitted: boolean }>;
    learning_ref: { learning_plan_id: string; writes: boolean };
  };
  certificate: {
    scores: Record<string, number>;
    execution_permissions: boolean;
  } | null;
};

export function PreDispatchSimulationView({
  snapshot,
  onBack,
  onRefresh,
}: Props) {
  const [data, setData] = useState<Payload | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/runtime/pre-dispatch-simulation", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as Payload;
      setData(body);
      const first = body.simulations[0];
      if (first) {
        const d = await fetch(
          `/api/runtime/pre-dispatch-simulation/${encodeURIComponent(first.mission_id)}`,
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

  const pds = snapshot.company_brain?.pre_dispatch_simulation;
  const rows = data?.simulations ?? [];

  return (
    <div className="ds-stack">
      <PageHeader
        title="Pre-Dispatch Simulation"
        subtitle="Deterministic planning artifact · simulation only · LIVE OFF"
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

      <AlertBanner tone="warn" title="SIMULATION ONLY">
        This view shows metadata for what execution would look like.
      </AlertBanner>
      <AlertBanner tone="warn" title="EXECUTION DISABLED">
        No dispatch, enqueue, or worker spawn occurs here.
      </AlertBanner>
      <AlertBanner tone="warn" title="LIVE OFF">
        LIVE remains OFF. All allow flags stay false.
      </AlertBanner>

      <SecondaryButton size="sm" onClick={onBack}>
        Back to Mission Control
      </SecondaryButton>

      {error ? (
        <EmptyIllustration
          title="Failed to load pre-dispatch simulation"
          copy={error}
        />
      ) : null}

      <MetricGrid columns={4}>
        <KPIStatCard
          value={String(pds?.simulation_count ?? rows.length)}
          label="Simulations"
          tone="neutral"
        />
        <KPIStatCard
          value={String(pds?.complete_count ?? 0)}
          label="Complete"
          tone="neutral"
        />
        <KPIStatCard
          value={
            pds?.overall_readiness != null
              ? String(pds.overall_readiness)
              : "—"
          }
          label="Readiness"
          tone="neutral"
        />
        <KPIStatCard
          value={String(pds?.certificate_count ?? 0)}
          label="Certificates"
          tone="neutral"
        />
      </MetricGrid>

      <PageSection title="Execution graph">
        <SectionCard>
          {(detail?.simulation.graph_nodes ?? []).map((n) => (
            <div key={n.node_id} className="ds-row-between">
              <span>
                {n.label} ({n.node_id})
              </span>
              <Badge tone="blocked">executed={String(n.executed)}</Badge>
            </div>
          ))}
        </SectionCard>
      </PageSection>

      <PageSection title="Timeline">
        <SectionCard>
          {(detail?.simulation.timeline ?? []).slice(0, 8).map((s) => (
            <div key={s.step_id} className="ds-row-between">
              <span>{s.label}</span>
              <Badge>executed={String(s.executed)}</Badge>
            </div>
          ))}
          {(detail?.simulation.timeline?.length ?? 0) > 8 ? (
            <p>…and {detail!.simulation.timeline.length - 8} more steps</p>
          ) : null}
        </SectionCard>
      </PageSection>

      <PageSection title="Workers / Departments">
        <SectionCard>
          <div className="ds-stack">
            {(detail?.simulation.worker_allocations ?? []).map((w) => (
              <div key={w.worker_id}>
                {w.worker_id}: assigned={String(w.assigned)} spawned=
                {String(w.spawned)} running={String(w.running)}
              </div>
            ))}
            {(detail?.simulation.department_allocations ?? []).map((d) => (
              <div key={d.department_id}>
                {d.department_id}: allocated={String(d.allocated)} executing=
                {String(d.executing)}
              </div>
            ))}
          </div>
        </SectionCard>
      </PageSection>

      <PageSection title="Cost / Telemetry / Learning">
        <SectionCard>
          {detail?.simulation ? (
            <div className="ds-stack">
              <div>
                Est. USD: {detail.simulation.estimated_cost.estimated_usd} ·
                billing=
                {String(detail.simulation.estimated_cost.billing)}
              </div>
              <div>
                Duration ms: {detail.simulation.estimated_duration_ms}
              </div>
              <div>
                Telemetry refs:{" "}
                {detail.simulation.telemetry_refs
                  .map((t) => t.telemetry_session_id)
                  .join(", ")}
              </div>
              <div>
                Learning: {detail.simulation.learning_ref.learning_plan_id} ·
                writes={String(detail.simulation.learning_ref.writes)}
              </div>
              <div>
                Rollback executable=
                {String(detail.simulation.rollback_plan.executable)} · Retry
                executable=
                {String(detail.simulation.retry_plan.executable)}
              </div>
            </div>
          ) : (
            <p>No simulation detail loaded.</p>
          )}
        </SectionCard>
      </PageSection>

      <PageSection title="Certificate scores">
        <SectionCard>
          {detail?.certificate?.scores ? (
            <div className="ds-stack">
              {Object.entries(detail.certificate.scores).map(([k, v]) => (
                <div key={k} className="ds-row-between">
                  <span>{k}</span>
                  <Badge>{String(v)}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p>No certificate loaded.</p>
          )}
        </SectionCard>
      </PageSection>
    </div>
  );
}
