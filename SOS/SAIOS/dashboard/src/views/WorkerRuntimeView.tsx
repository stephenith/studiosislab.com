/**
 * Worker Runtime — Agent #182.
 * Contracts only. Never spawns. Never executes.
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

type RuntimeRow = {
  worker_runtime_id: string;
  worker_id: string;
  department_id: string;
  mission_id: string;
  status: string;
  capability_count: number;
  dependency_count: number;
  cost_session_reference: string | null;
  telemetry_reference: string | null;
  validation_ok: boolean;
};

type SessionRow = {
  session_id: string;
  worker_id: string;
  execution_controller_id: string | null;
  activated: boolean;
};

type AssignmentRow = {
  assignment_id: string;
  worker_id: string;
  director_id: string | null;
  manager_id: string | null;
  priority: string;
  dependency_order: number;
};

type Payload = {
  runtimes: RuntimeRow[];
  sessions: SessionRow[];
  capabilities: Array<{ capability_id: string; kind: string }>;
};

export function WorkerRuntimeView({ snapshot, onBack, onRefresh }: Props) {
  const [data, setData] = useState<Payload | null>(null);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [res, asg] = await Promise.all([
        fetch("/api/runtime/worker-runtime", { cache: "no-store" }),
        fetch("/api/runtime/worker-runtime/assignments", { cache: "no-store" }),
      ]);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (!asg.ok) throw new Error(`assignments HTTP ${asg.status}`);
      setData((await res.json()) as Payload);
      const body = (await asg.json()) as { assignments: AssignmentRow[] };
      setAssignments(body.assignments ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const wr = snapshot.company_brain?.worker_runtime;
  const runtimes = data?.runtimes ?? [];
  const sessions = data?.sessions ?? [];

  return (
    <div className="ds-stack">
      <PageHeader
        title="Worker Runtime"
        subtitle="Canonical worker contract · Execution Controller owns sessions (future) · LIVE OFF"
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

      <AlertBanner tone="warn" title="WORKER SPAWN DISABLED">
        worker_spawn_allowed=false · child_process_allowed=false
      </AlertBanner>
      <AlertBanner tone="warn" title="EXECUTION DISABLED">
        execution_allowed=false · no scheduler · no queue insert
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
        <EmptyIllustration title="Failed to load worker runtime" copy={error} />
      ) : (
        <>
          <MetricGrid columns={4}>
            <KPIStatCard
              value={String(runtimes.length || wr?.runtime_count || 0)}
              label="Runtimes"
              tone="neutral"
            />
            <KPIStatCard
              value={String(assignments.length || wr?.assignment_count || 0)}
              label="Assignments"
              tone="neutral"
            />
            <KPIStatCard
              value={String(sessions.length || wr?.session_count || 0)}
              label="Sessions"
              tone="neutral"
            />
            <KPIStatCard
              value={String(wr?.authorized_count ?? 0)}
              label="Controller Authorized"
              tone="positive"
            />
          </MetricGrid>

          <PageSection title="Worker Runtimes">
            <SectionCard>
              <div className="ds-stack" style={{ gap: 8 }}>
                {runtimes.map((r) => (
                  <div key={r.worker_runtime_id} className="ds-row-between">
                    <span>
                      <strong>{r.worker_id}</strong>{" "}
                      <Badge>{r.status}</Badge>{" "}
                      <span className="ds-meta">{r.department_id}</span>
                    </span>
                    <span className="ds-meta">
                      caps={r.capability_count} · deps={r.dependency_count} ·
                      cost={r.cost_session_reference ?? "—"} · telemetry=
                      {r.telemetry_reference ?? "—"}
                    </span>
                  </div>
                ))}
                {!runtimes.length ? (
                  <p className="ds-meta">No worker runtimes.</p>
                ) : null}
              </div>
            </SectionCard>
          </PageSection>

          <PageSection title="Assignments">
            <SectionCard>
              <div className="ds-stack" style={{ gap: 8 }}>
                {assignments.map((a) => (
                  <div key={a.assignment_id} className="ds-meta">
                    {a.assignment_id} · {a.worker_id} · director=
                    {a.director_id ?? "—"} · manager={a.manager_id ?? "—"} ·
                    priority={a.priority} · order={a.dependency_order}
                  </div>
                ))}
                {!assignments.length ? (
                  <p className="ds-meta">No assignments.</p>
                ) : null}
              </div>
            </SectionCard>
          </PageSection>

          <PageSection title="Runtime Sessions">
            <SectionCard>
              <div className="ds-stack" style={{ gap: 8 }}>
                {sessions.map((s) => (
                  <div key={s.session_id} className="ds-meta">
                    {s.session_id} · {s.worker_id} · XC=
                    {s.execution_controller_id ?? "—"} · activated=
                    {String(s.activated)}
                  </div>
                ))}
                {!sessions.length ? (
                  <p className="ds-meta">No sessions.</p>
                ) : null}
              </div>
            </SectionCard>
          </PageSection>

          <PageSection title="Capabilities">
            <SectionCard>
              <p className="ds-meta">
                {(data?.capabilities ?? [])
                  .map((c) => c.capability_id)
                  .join(", ") || "—"}{" "}
                · invokable=false
              </p>
            </SectionCard>
          </PageSection>
        </>
      )}
    </div>
  );
}
