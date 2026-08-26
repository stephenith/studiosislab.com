/**
 * Queue Submission Contract — Agent #167.
 * Shadow mode only. Never inserts into the runtime queue.
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

type SubmissionPayload = {
  package: {
    submission_id: string;
    mission_id: string;
    mission_version: number;
    execution_id: string;
    execution_package_id: string;
    execution_package_version: number;
    execution_package_checksum: string;
    acknowledgement_id: string;
    acknowledgement_checksum: string;
    department: string;
    priority: string;
    objective: string;
    worker_inventory: string[];
    skill_inventory: string[];
    provider_inventory: string[];
    tool_inventory: string[];
    estimated_duration: string;
    estimated_cost_note: string;
    estimated_cost_usd: number | null;
    submission_checksum: string;
    dependency_graph: {
      nodes: string[];
      critical_path: string[];
      edges: Array<{ from: string; to: string; kind: string }>;
    };
    execution_graph: {
      nodes: Array<{ id: string; label: string; order: number }>;
      critical_path: string[];
      note: string;
    };
    worker_graph: {
      nodes: Array<{ id: string; kind: string; label: string }>;
      edges: Array<{ from: string; to: string; kind: string }>;
    };
    quality_gates: Array<{
      id: string;
      label: string;
      satisfied: boolean | null;
      note: string;
    }>;
    rollback_plan: Array<{ id: string; label: string; description: string }>;
    security_state: {
      live: false;
      queue_insert_allowed: false;
      execution_allowed: false;
      publishing_allowed: false;
      note: string;
    };
    warnings: string[];
    risk_level: string;
    dry_run: true;
    submission_allowed: false;
    queue_insert_allowed: false;
    execution_allowed: false;
    publishing_allowed: false;
    submission_still_blocked_reason: string;
    next_safe_action: string;
    created_at: string;
  } | null;
  mission_status: string | null;
  submission_status: string | null;
  error?: string;
};

export function QueueSubmissionView({ snapshot, onBack, onRefresh }: Props) {
  const missionId = snapshot.company_brain?.current_mission_id ?? null;
  const [data, setData] = useState<SubmissionPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    if (!missionId) {
      setData(null);
      return;
    }
    try {
      const res = await fetch(
        `/api/company-brain/queue-submission/${encodeURIComponent(missionId)}`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as SubmissionPayload;
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
    decision: "CONFIRM_SHADOW_PACKAGE" | "BLOCK_SUBMISSION",
  ) => {
    if (!data?.package) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/company-brain/queue-submission-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mission_id: data.package.mission_id,
          mission_version: data.package.mission_version,
          submission_id: data.package.submission_id,
          submission_checksum: data.package.submission_checksum,
          decision,
          actor: "stephen",
          reason:
            decision === "BLOCK_SUBMISSION"
              ? reason
              : reason || "Founder confirmed shadow submission package",
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
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const pkg = data?.package;
  const canReview = data?.mission_status === "WAITING_QUEUE_SUBMISSION";
  const snapStatus =
    snapshot.company_brain?.queue_submission_status ??
    data?.submission_status ??
    data?.mission_status;

  return (
    <div className="ds-stack">
      <PageHeader
        title="Queue Submission"
        subtitle="Shadow contract only · runtime Queue untouched · LIVE OFF"
        actions={
          <SecondaryButton size="sm" onClick={onBack}>
            Back to Mission Control
          </SecondaryButton>
        }
      />

      <AlertBanner tone="warn" title="Queue disabled">
        This package is never inserted into the runtime Queue. Shadow mode only.
      </AlertBanner>
      <AlertBanner tone="warn" title="Execution disabled">
        execution_allowed remains false. No workers · no scheduler · no providers.
      </AlertBanner>
      <AlertBanner tone="warn" title="Publishing disabled">
        publishing_allowed remains false. LIVE OFF.
      </AlertBanner>

      {!missionId ? (
        <EmptyIllustration
          title="No current mission"
          copy="Acknowledge an Execution Package first, then open Queue Submission."
        />
      ) : error && !data ? (
        <EmptyIllustration title="Failed to load submission" copy={error} />
      ) : !pkg ? (
        <EmptyIllustration
          title="No submission package"
          copy={
            data?.error ??
            "Mission must be PACKAGE_ACKNOWLEDGED to generate a shadow submission package."
          }
        />
      ) : (
        <>
          <InfoBanner title={`Submission status · ${snapStatus ?? "—"}`}>
            {pkg.submission_still_blocked_reason} · {pkg.next_safe_action}
          </InfoBanner>

          <MetricGrid columns={4}>
            <KPIStatCard
              value={pkg.submission_id.slice(0, 14)}
              label="Submission ID"
              delta="shadow"
              deltaDirection="flat"
              tone="processing"
            />
            <KPIStatCard
              value={pkg.estimated_duration}
              label="Estimated Runtime"
              delta={pkg.estimated_cost_note}
              deltaDirection="flat"
              tone="neutral"
            />
            <KPIStatCard
              value={
                pkg.estimated_cost_usd != null
                  ? `$${pkg.estimated_cost_usd}`
                  : "n/a"
              }
              label="Estimated Cost"
              delta={pkg.risk_level}
              deltaDirection="flat"
              tone="neutral"
            />
            <KPIStatCard
              value={String(snapStatus ?? "—")}
              label="Submission Status"
              delta="insert=false"
              deltaDirection="flat"
              tone="waiting"
            />
          </MetricGrid>

          <PageSection title="Submission summary" subtitle="Immutable shadow package">
            <SectionCard title="Identity">
              <p className="mono">Mission: {pkg.mission_id}</p>
              <p className="mono">Execution: {pkg.execution_id}</p>
              <p className="mono">
                Package: {pkg.execution_package_id} v{pkg.execution_package_version}
              </p>
              <p className="mono">Ack: {pkg.acknowledgement_id}</p>
              <p className="mono">Department: {pkg.department}</p>
              <p className="mono">Priority: {pkg.priority}</p>
              <p className="muted">{pkg.objective}</p>
            </SectionCard>
            <SectionCard title="Checksums">
              <p className="mono">
                Submission: {pkg.submission_checksum.slice(0, 24)}…
              </p>
              <p className="mono">
                Execution package: {pkg.execution_package_checksum.slice(0, 24)}…
              </p>
              <p className="mono">
                Acknowledgement: {pkg.acknowledgement_checksum.slice(0, 24)}…
              </p>
              <p className="muted">Created {pkg.created_at}</p>
            </SectionCard>
          </PageSection>

          <PageSection title="Inventories" subtitle="Informational only">
            <SectionCard title="Workers">
              {pkg.worker_inventory.map((w) => (
                <Badge key={w}>{w}</Badge>
              ))}
            </SectionCard>
            <SectionCard title="Skills">
              {pkg.skill_inventory.map((s) => (
                <Badge key={s}>{s}</Badge>
              ))}
            </SectionCard>
            <SectionCard title="Models">
              {pkg.provider_inventory.map((m) => (
                <Badge key={m}>{m}</Badge>
              ))}
            </SectionCard>
            <SectionCard title="Tools">
              {pkg.tool_inventory.map((t) => (
                <Badge key={t}>{t}</Badge>
              ))}
            </SectionCard>
          </PageSection>

          <PageSection title="Graphs & gates">
            <SectionCard title="Dependencies">
              <p className="mono">
                Critical path: {pkg.dependency_graph.critical_path.join(" → ")}
              </p>
              <p className="muted">
                {pkg.dependency_graph.edges.length} edges ·{" "}
                {pkg.dependency_graph.nodes.length} nodes
              </p>
            </SectionCard>
            <SectionCard title="Execution stages">
              <p className="mono">
                {pkg.execution_graph.critical_path.join(" → ")}
              </p>
              <p className="muted">{pkg.execution_graph.note}</p>
            </SectionCard>
            <SectionCard title="Quality gates">
              {pkg.quality_gates.map((g) => (
                <p key={g.id} className="mono">
                  {g.label}: {String(g.satisfied)} — {g.note}
                </p>
              ))}
            </SectionCard>
            <SectionCard title="Rollback plan">
              {pkg.rollback_plan.map((r) => (
                <p key={r.id} className="muted">
                  {r.label}: {r.description}
                </p>
              ))}
            </SectionCard>
            <SectionCard title="Security checks">
              <p className="mono">live={String(pkg.security_state.live)}</p>
              <p className="mono">
                queue_insert_allowed=
                {String(pkg.security_state.queue_insert_allowed)}
              </p>
              <p className="mono">
                execution_allowed={String(pkg.security_state.execution_allowed)}
              </p>
              <p className="mono">
                publishing_allowed=
                {String(pkg.security_state.publishing_allowed)}
              </p>
              <p className="muted">{pkg.security_state.note}</p>
            </SectionCard>
            <SectionCard title="Warnings">
              {pkg.warnings.map((w) => (
                <p key={w} className="muted">
                  {w}
                </p>
              ))}
            </SectionCard>
          </PageSection>

          {error ? (
            <AlertBanner tone="danger" title="Review failed">
              {error}
            </AlertBanner>
          ) : null}

          {canReview ? (
            <StickyFooter>
              <label className="muted">
                Reason / notes
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  style={{ width: "100%", marginTop: 4 }}
                />
              </label>
              <PrimaryButton
                disabled={busy}
                onClick={() => void submit("CONFIRM_SHADOW_PACKAGE")}
              >
                Confirm Shadow Package
              </PrimaryButton>
              <DangerButton
                disabled={busy}
                onClick={() => void submit("BLOCK_SUBMISSION")}
              >
                Block Submission
              </DangerButton>
            </StickyFooter>
          ) : null}
        </>
      )}
    </div>
  );
}
