/**
 * Runtime Plan view — Agent #169.
 * Planning only. Never dispatches or executes.
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

type PlanPayload = {
  plan: {
    runtime_plan_id: string;
    shadow_queue_id: string;
    mission_id: string;
    submission_id: string;
    department: string;
    priority: string;
    plan_status: string;
    plan_checksum: string;
    estimated_duration: string;
    estimated_cost_note: string;
    estimated_cost_usd: number | null;
    worker_order: string[];
    missing_workers: string[];
    missing_skills: string[];
    missing_models: string[];
    missing_tools: string[];
    warnings: string[];
    next_safe_action: string;
    planning_still_blocked_reason: string;
    execution_graph: {
      nodes: Array<{ id: string; kind: string; label: string; order: number }>;
      critical_path: string[];
      topological_order: string[];
      note: string;
    };
    dependency_graph: {
      nodes: string[];
      edges: Array<{ from: string; to: string; kind: string }>;
      critical_path: string[];
      cycles: string[][];
      acyclic: boolean;
      note: string;
    };
    planning_only: true;
    dispatch_allowed: false;
    execution_allowed: false;
  } | null;
  mission_status: string | null;
  error?: string;
};

export function RuntimePlanView({ snapshot, onBack, onRefresh }: Props) {
  const missionId = snapshot.company_brain?.current_mission_id ?? null;
  const [data, setData] = useState<PlanPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!missionId) {
      setData(null);
      return;
    }
    try {
      const res = await fetch(
        `/api/runtime/runtime-plan/${encodeURIComponent(missionId)}`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as PlanPayload;
      setData(body);
      setError(null);
      void onRefresh;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [missionId, onRefresh]);

  useEffect(() => {
    void load();
  }, [load]);

  const plan = data?.plan;
  const snapStatus =
    snapshot.company_brain?.runtime_plan_status ??
    plan?.plan_status ??
    data?.mission_status;

  return (
    <div className="ds-stack">
      <PageHeader
        title="Runtime Plan"
        subtitle="Deterministic planning from Shadow Queue · never executes"
        actions={
          <SecondaryButton size="sm" onClick={onBack}>
            Back to Mission Control
          </SecondaryButton>
        }
      />

      <AlertBanner tone="warn" title="Planning Only">
        This view shows a deterministic Runtime Execution Plan. Nothing is
        invoked.
      </AlertBanner>
      <AlertBanner tone="warn" title="Execution Disabled">
        dispatch_allowed=false · execution_allowed=false · publishing_allowed=false
      </AlertBanner>
      <AlertBanner tone="warn" title="LIVE OFF">
        No scheduler · no workers · no providers · no publish.
      </AlertBanner>

      {!missionId ? (
        <EmptyIllustration
          title="No current mission"
          copy="Accept a package into Shadow Queue first, then open Runtime Plan."
        />
      ) : error && !data ? (
        <EmptyIllustration title="Failed to load runtime plan" copy={error} />
      ) : !plan ? (
        <EmptyIllustration
          title="No runtime plan"
          copy={
            data?.error ??
            "Mission must be SHADOW_QUEUE_RECEIVED to generate a runtime plan."
          }
        />
      ) : (
        <>
          <InfoBanner title={`Plan status · ${snapStatus ?? "—"}`}>
            {plan.planning_still_blocked_reason} · {plan.next_safe_action}
          </InfoBanner>

          <MetricGrid columns={4}>
            <KPIStatCard
              value={plan.runtime_plan_id.slice(0, 14)}
              label="Runtime Plan ID"
              delta={plan.plan_status}
              deltaDirection="flat"
              tone="processing"
            />
            <KPIStatCard
              value={plan.estimated_duration}
              label="Estimated Runtime"
              delta={plan.estimated_cost_note}
              deltaDirection="flat"
              tone="neutral"
            />
            <KPIStatCard
              value={
                plan.estimated_cost_usd != null
                  ? `$${plan.estimated_cost_usd}`
                  : "n/a"
              }
              label="Estimated Cost"
              delta={plan.department}
              deltaDirection="flat"
              tone="neutral"
            />
            <KPIStatCard
              value={plan.dependency_graph.acyclic ? "DAG OK" : "CYCLES"}
              label="Dependency Graph"
              delta={plan.plan_checksum.slice(0, 12)}
              deltaDirection="flat"
              tone={plan.dependency_graph.acyclic ? "approved" : "rejected"}
            />
          </MetricGrid>

          <PageSection title="Worker order" subtitle="Director → Manager → Workers → Skills → Models → Tools">
            <SectionCard title="Order">
              {plan.worker_order.map((w) => (
                <Badge key={w}>{w}</Badge>
              ))}
            </SectionCard>
          </PageSection>

          <PageSection title="Execution DAG">
            <SectionCard title="Critical path">
              <p className="mono">{plan.execution_graph.critical_path.join(" → ")}</p>
              <p className="muted">{plan.execution_graph.note}</p>
            </SectionCard>
            <SectionCard title="Topological order">
              <p className="mono">
                {plan.execution_graph.topological_order.slice(0, 12).join(" → ")}
                {plan.execution_graph.topological_order.length > 12 ? " …" : ""}
              </p>
            </SectionCard>
          </PageSection>

          <PageSection title="Dependency graph">
            <SectionCard title="Edges">
              <p className="mono">
                {plan.dependency_graph.edges.length} edges ·{" "}
                {plan.dependency_graph.nodes.length} nodes · acyclic=
                {String(plan.dependency_graph.acyclic)}
              </p>
              <p className="muted">{plan.dependency_graph.note}</p>
            </SectionCard>
          </PageSection>

          <PageSection title="Missing inventory">
            <SectionCard title="Workers">
              {plan.missing_workers.length
                ? plan.missing_workers.map((x) => <Badge key={x}>{x}</Badge>)
                : <p className="muted">None</p>}
            </SectionCard>
            <SectionCard title="Skills">
              {plan.missing_skills.length
                ? plan.missing_skills.map((x) => <Badge key={x}>{x}</Badge>)
                : <p className="muted">None</p>}
            </SectionCard>
            <SectionCard title="Models">
              {plan.missing_models.length
                ? plan.missing_models.map((x) => <Badge key={x}>{x}</Badge>)
                : <p className="muted">None</p>}
            </SectionCard>
            <SectionCard title="Tools">
              {plan.missing_tools.length
                ? plan.missing_tools.map((x) => <Badge key={x}>{x}</Badge>)
                : <p className="muted">None</p>}
            </SectionCard>
          </PageSection>

          <PageSection title="Warnings">
            <SectionCard title="Safety">
              {plan.warnings.map((w) => (
                <p key={w} className="muted">
                  {w}
                </p>
              ))}
            </SectionCard>
          </PageSection>
        </>
      )}
    </div>
  );
}
