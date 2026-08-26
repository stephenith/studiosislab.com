/**
 * Runtime Release Gate — Agent #170.
 * Governance only. Approval is not execution authorization.
 */
import { useCallback, useEffect, useState } from "react";
import type { DashboardSnapshot } from "../data/types";
import {
  AlertBanner,
  Badge,
  DangerButton,
  EmptyIllustration,
  InfoBanner,
  KPIStatCard,
  MetricGrid,
  PageHeader,
  PageSection,
  PrimaryButton,
  SecondaryButton,
  SectionCard,
  StickyFooter,
} from "../design-system";

type Props = {
  snapshot: DashboardSnapshot;
  onBack: () => void;
  onRefresh: () => void | Promise<void>;
};

type ReleasePayload = {
  plan: {
    runtime_plan_id: string;
    mission_id: string;
    mission_version: number;
    plan_checksum: string;
    shadow_queue_id: string;
    submission_id: string;
    department: string;
    priority: string;
    estimated_duration: string;
    estimated_cost_note: string;
    estimated_cost_usd: number | null;
    worker_order: string[];
    warnings: string[];
    plan_status: string;
    execution_graph: {
      critical_path: string[];
      topological_order: string[];
      note: string;
    };
    dependency_graph: {
      nodes: string[];
      edges: Array<{ from: string; to: string; kind: string }>;
      acyclic: boolean;
      note: string;
    };
    submission_checksum: string;
    execution_package_checksum: string;
    acknowledgement_checksum: string;
  } | null;
  release_status: string | null;
  mission_status: string | null;
  latest_release: {
    release_id: string;
    decision: string;
    reason: string;
    created_at: string;
  } | null;
  history: Array<{ at: string; from_status: string; to_status: string; note: string }>;
  error?: string;
};

export function RuntimeReleaseView({ snapshot, onBack, onRefresh }: Props) {
  const missionId = snapshot.company_brain?.current_mission_id ?? null;
  const [data, setData] = useState<ReleasePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const load = useCallback(async () => {
    if (!missionId) {
      setData(null);
      return;
    }
    try {
      const res = await fetch(
        `/api/runtime/runtime-release/${encodeURIComponent(missionId)}`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as ReleasePayload;
      setData(body);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [missionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async (
    decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED",
  ) => {
    if (!data?.plan) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/runtime/runtime-release/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mission_id: data.plan.mission_id,
          mission_version: data.plan.mission_version,
          runtime_plan_id: data.plan.runtime_plan_id,
          plan_checksum: data.plan.plan_checksum,
          decision,
          actor: "stephen",
          reason:
            decision === "REJECTED"
              ? reason
              : reason ||
                (decision === "APPROVED"
                  ? "Founder approved runtime release contract"
                  : ""),
          notes: decision === "CHANGES_REQUESTED" ? notes : notes || "",
        }),
      });
      const body = (await res.json()) as {
        ok?: boolean;
        error?: string;
        message?: string;
      };
      if (!res.ok || body.ok === false) {
        throw new Error(body.error ?? body.message ?? `HTTP ${res.status}`);
      }
      await onRefresh();
      await load();
      setReason("");
      setNotes("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const plan = data?.plan;
  const canDecide =
    data?.mission_status === "WAITING_RUNTIME_RELEASE" ||
    data?.mission_status === "RUNTIME_PLAN_READY";
  const snapStatus =
    snapshot.company_brain?.runtime_release_status ??
    data?.release_status ??
    data?.mission_status;

  return (
    <div className="ds-stack">
      <PageHeader
        title="Runtime Release"
        subtitle="Approval contract only · not execution authorization · LIVE OFF"
        actions={
          <SecondaryButton size="sm" onClick={onBack}>
            Back to Mission Control
          </SecondaryButton>
        }
      />

      <AlertBanner tone="warn" title="Planning Only">
        Runtime Release records structural approval of a plan. It does not start
        runtime work.
      </AlertBanner>
      <AlertBanner tone="warn" title="Runtime Not Started">
        No workers · no queue insert · no providers.
      </AlertBanner>
      <AlertBanner tone="warn" title="Scheduler Disabled">
        scheduler_allowed remains false.
      </AlertBanner>
      <AlertBanner tone="warn" title="Worker Dispatch Disabled">
        dispatch_allowed and worker_execution_allowed remain false.
      </AlertBanner>
      <AlertBanner tone="warn" title="LIVE OFF">
        live_enabled=false · publishing_allowed=false.
      </AlertBanner>

      {!missionId ? (
        <EmptyIllustration
          title="No current mission"
          copy="Generate a Runtime Plan first, then open Runtime Release."
        />
      ) : error && !data ? (
        <EmptyIllustration title="Failed to load release" copy={error} />
      ) : !plan ? (
        <EmptyIllustration
          title="No runtime plan"
          copy={
            data?.error ??
            "Mission must reach RUNTIME_PLAN_READY before release review."
          }
        />
      ) : (
        <>
          <InfoBanner title={`Release status · ${snapStatus ?? "—"}`}>
            Approval is not execution. Scheduler and workers remain disabled.
          </InfoBanner>

          <MetricGrid columns={4}>
            <KPIStatCard
              value={plan.runtime_plan_id.slice(0, 14)}
              label="Runtime Plan"
              delta={plan.plan_status}
              deltaDirection="flat"
              tone="processing"
            />
            <KPIStatCard
              value={plan.estimated_duration}
              label="Estimated Duration"
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
              value={plan.dependency_graph.acyclic ? "VALID" : "INVALID"}
              label="Validation Status"
              delta={String(snapStatus ?? "—")}
              deltaDirection="flat"
              tone={plan.dependency_graph.acyclic ? "approved" : "rejected"}
            />
          </MetricGrid>

          <PageSection title="Runtime Plan summary">
            <SectionCard title="Mission">
              <p className="mono">{plan.mission_id}</p>
              <p className="mono">Priority: {plan.priority}</p>
            </SectionCard>
            <SectionCard title="Checksums">
              <p className="mono">Plan: {plan.plan_checksum.slice(0, 24)}…</p>
              <p className="mono">
                Submission: {plan.submission_checksum.slice(0, 24)}…
              </p>
              <p className="mono">
                Package: {plan.execution_package_checksum.slice(0, 24)}…
              </p>
              <p className="mono">
                Ack: {plan.acknowledgement_checksum.slice(0, 24)}…
              </p>
            </SectionCard>
          </PageSection>

          <PageSection title="Worker DAG / order">
            <SectionCard title="Critical path">
              <p className="mono">
                {plan.execution_graph.critical_path.join(" → ")}
              </p>
            </SectionCard>
            <SectionCard title="Worker order">
              {plan.worker_order.map((w) => (
                <Badge key={w}>{w}</Badge>
              ))}
            </SectionCard>
            <SectionCard title="Dependencies">
              <p className="mono">
                {plan.dependency_graph.edges.length} edges · acyclic=
                {String(plan.dependency_graph.acyclic)}
              </p>
              <p className="muted">{plan.dependency_graph.note}</p>
            </SectionCard>
          </PageSection>

          <PageSection title="Risks">
            <SectionCard title="Warnings">
              {plan.warnings.map((w) => (
                <p key={w} className="muted">
                  {w}
                </p>
              ))}
            </SectionCard>
          </PageSection>

          {data.latest_release ? (
            <PageSection title="Latest decision">
              <SectionCard title={data.latest_release.decision}>
                <p className="mono">{data.latest_release.release_id}</p>
                <p className="muted">{data.latest_release.reason}</p>
                <p className="mono">{data.latest_release.created_at}</p>
              </SectionCard>
            </PageSection>
          ) : null}

          {data.history?.length ? (
            <PageSection title="History">
              <SectionCard title="Transitions">
                {data.history.slice(-8).map((h, i) => (
                  <p key={`${h.at}-${i}`} className="mono">
                    {h.at.slice(0, 19)} · {h.from_status} → {h.to_status} ·{" "}
                    {h.note}
                  </p>
                ))}
              </SectionCard>
            </PageSection>
          ) : null}

          {error ? (
            <AlertBanner tone="danger" title="Decision failed">
              {error}
            </AlertBanner>
          ) : null}

          {canDecide ? (
            <StickyFooter>
              <label className="muted">
                Reason
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  style={{ width: "100%", marginTop: 4 }}
                />
              </label>
              <label className="muted">
                Notes / feedback
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  style={{ width: "100%", marginTop: 4 }}
                />
              </label>
              <PrimaryButton
                disabled={busy}
                onClick={() => void submit("APPROVED")}
              >
                Approve Runtime Release
              </PrimaryButton>
              <SecondaryButton
                disabled={busy}
                onClick={() => void submit("CHANGES_REQUESTED")}
              >
                Request Changes
              </SecondaryButton>
              <DangerButton
                disabled={busy}
                onClick={() => void submit("REJECTED")}
              >
                Reject
              </DangerButton>
            </StickyFooter>
          ) : null}
        </>
      )}
    </div>
  );
}
