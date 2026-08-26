/**
 * Execution Package Dry-Run Preview + Acknowledgement — Agents #165/#166.
 * Preview only. Acknowledgement is not execution approval.
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

type PackagePayload = {
  package: {
    package_id: string;
    package_version: number;
    checksum: string;
    execution_id: string;
    mission_id: string;
    mission_version: number;
    plan_id: string | null;
    objective: string;
    priority: string;
    department: string;
    estimated_duration: string;
    estimated_cost_note: string;
    estimated_outputs: string[];
    required_departments: string[];
    required_workers: string[];
    required_skills: string[];
    required_models: string[];
    required_tools: string[];
    created_at: string;
    execution_graph: {
      nodes: Array<{
        id: string;
        label: string;
        order: number;
        executed: boolean;
      }>;
      critical_path: string[];
      note: string;
    };
    worker_graph: {
      nodes: Array<{ id: string; kind: string; label: string }>;
      edges: Array<{ from: string; to: string; kind: string }>;
      note: string;
    };
    dependency_graph: {
      nodes: string[];
      critical_path: string[];
      edges: Array<{ from: string; to: string; kind: string }>;
    };
    quality_gates: Array<{
      id: string;
      label: string;
      satisfied: boolean | null;
      note: string;
    }>;
    rollback_points: Array<{ id: string; label: string; description: string }>;
    risk_summary: { risk_level: string; risks: string[]; warnings: string[] };
    execution_still_blocked_reason: string;
    dry_run: true;
    execution_allowed: false;
  } | null;
  mission_status?: string;
  ack_status?: string | null;
  error?: string;
};

export function ExecutionPackageView({ snapshot, onBack, onRefresh }: Props) {
  const missionId = snapshot.company_brain?.current_mission_id ?? null;
  const [data, setData] = useState<PackagePayload | null>(null);
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
        `/api/company-brain/execution-package-ack/${encodeURIComponent(missionId)}`,
        { cache: "no-store" },
      );
      const body = (await res.json()) as PackagePayload & { error?: string };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
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
    decision: "ACKNOWLEDGED" | "CHANGES_REQUESTED" | "REJECTED",
  ) => {
    if (!data?.package) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        "/api/company-brain/execution-package-ack-decision",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mission_id: data.package.mission_id,
            mission_version: data.package.mission_version,
            package_id: data.package.package_id,
            execution_package_version: data.package.package_version,
            execution_package_checksum: data.package.checksum,
            decision,
            actor: "stephen",
            reason:
              decision === "REJECTED"
                ? reason
                : reason ||
                  (decision === "ACKNOWLEDGED"
                    ? "Founder acknowledged exact execution package"
                    : ""),
            notes: decision === "CHANGES_REQUESTED" ? notes : notes || "",
          }),
        },
      );
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

  const pkg = data?.package;
  const ackStatus =
    data?.ack_status ??
    snapshot.company_brain?.execution_package_ack_status ??
    data?.mission_status;
  const canDecide = ackStatus === "WAITING_PACKAGE_ACKNOWLEDGEMENT";

  return (
    <div className="ds-stack">
      <PageHeader
        title="Execution Package"
        subtitle="Dry-run preview · acknowledgement is not execution · LIVE OFF"
        actions={
          <>
            <SecondaryButton
              size="sm"
              onClick={() => {
                void onRefresh();
                void load();
              }}
            >
              Refresh
            </SecondaryButton>
            <SecondaryButton size="sm" onClick={onBack}>
              Back to Mission Control
            </SecondaryButton>
          </>
        }
      />

      <AlertBanner tone="warn" title="Dry Run">
        This package is a preview of what would later enter Queue. Nothing
        executes.
      </AlertBanner>
      <AlertBanner tone="warn" title="Acknowledgement ≠ execution">
        Acknowledgement is not execution approval · execution_allowed=false ·
        queue insertion disabled · publishing disabled · LIVE OFF
      </AlertBanner>

      {!missionId ? (
        <EmptyIllustration
          title="No current mission"
          copy="Reach READY_FOR_QUEUE, then open Execution Package."
        />
      ) : error && !pkg ? (
        <EmptyIllustration title="Package unavailable" copy={error} />
      ) : pkg ? (
        <>
          <InfoBanner title={`Ack status · ${ackStatus ?? "—"}`}>
            Package {pkg.package_id} · v{pkg.package_version} · checksum{" "}
            {pkg.checksum.slice(0, 16)}… · {pkg.execution_still_blocked_reason}
          </InfoBanner>

          <MetricGrid columns={4}>
            <KPIStatCard
              value={pkg.priority}
              label="Priority"
              delta={pkg.department}
              deltaDirection="flat"
              tone="neutral"
            />
            <KPIStatCard
              value={pkg.estimated_duration}
              label="Estimated Time"
              delta={pkg.estimated_cost_note}
              deltaDirection="flat"
              tone="processing"
            />
            <KPIStatCard
              value={`v${pkg.package_version}`}
              label="Package Version"
              delta={pkg.created_at}
              deltaDirection="flat"
              tone="approved"
            />
            <KPIStatCard
              value={ackStatus ?? "—"}
              label="Ack Status"
              delta="not execution"
              deltaDirection="flat"
              tone={
                ackStatus === "PACKAGE_ACKNOWLEDGED"
                  ? "approved"
                  : ackStatus === "WAITING_PACKAGE_ACKNOWLEDGEMENT"
                    ? "waiting"
                    : "blocked"
              }
            />
          </MetricGrid>

          <PageSection title="Execution Summary">
            <SectionCard title={pkg.objective}>
              <p className="mono muted ds-meta-mono">
                Mission: {pkg.mission_id} @ v{pkg.mission_version} · Plan:{" "}
                {pkg.plan_id ?? "—"} · Execution ID: {pkg.execution_id}
              </p>
              <p className="mono muted ds-meta-mono">
                Checksum: {pkg.checksum}
              </p>
              <p className="mono muted ds-meta-mono">
                Departments: {pkg.required_departments.join(" → ")}
              </p>
              <p className="mono muted ds-meta-mono">
                Workers: {pkg.required_workers.join(", ")}
              </p>
              <p className="mono muted ds-meta-mono">
                Risk: {pkg.risk_summary.risk_level}
              </p>
              <div className="ds-row-wrap" style={{ marginTop: "0.5rem" }}>
                <Badge tone="blocked">dry_run=true</Badge>
                <Badge tone="blocked">execution_allowed=false</Badge>
                <Badge tone="blocked">enqueue=false</Badge>
                <Badge tone="waiting">ack ≠ execute</Badge>
              </div>
            </SectionCard>
          </PageSection>

          <PageSection title="Execution Graph">
            <SectionCard title="Stages (not executed)">
              <ol className="mono muted ds-meta-mono">
                {pkg.execution_graph.nodes.map((n) => (
                  <li key={n.id}>
                    {n.label} · executed={String(n.executed)}
                  </li>
                ))}
              </ol>
            </SectionCard>
          </PageSection>

          <PageSection title="Worker Graph · Dependencies · Gates · Rollback">
            <SectionCard title="Worker graph">
              <ul className="mono muted ds-meta-mono">
                {pkg.worker_graph.nodes.map((n) => (
                  <li key={n.id}>
                    [{n.kind}] {n.label}
                  </li>
                ))}
              </ul>
            </SectionCard>
            <SectionCard title="Critical path">
              <p className="mono muted ds-meta-mono">
                {pkg.dependency_graph.critical_path.join(" → ") || "—"}
              </p>
            </SectionCard>
            <SectionCard title="Quality gates">
              <ul>
                {pkg.quality_gates.map((g) => (
                  <li key={g.id}>
                    {g.label}:{" "}
                    {g.satisfied === null ? "pending" : String(g.satisfied)}
                  </li>
                ))}
              </ul>
            </SectionCard>
            <SectionCard title="Rollback plan">
              <ul>
                {pkg.rollback_points.map((r) => (
                  <li key={r.id}>
                    {r.label} — {r.description}
                  </li>
                ))}
              </ul>
            </SectionCard>
          </PageSection>

          {error ? (
            <AlertBanner tone="warn" title="Decision rejected">
              {error}
            </AlertBanner>
          ) : null}

          {canDecide ? (
            <>
              <PageSection title="Founder notes">
                <label className="ds-meta">
                  Reason (required for Reject)
                  <textarea
                    className="ds-input"
                    rows={2}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    style={{ width: "100%", marginTop: "0.35rem" }}
                  />
                </label>
                <label
                  className="ds-meta"
                  style={{ display: "block", marginTop: "0.75rem" }}
                >
                  Notes (required for Request Changes)
                  <textarea
                    className="ds-input"
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    style={{ width: "100%", marginTop: "0.35rem" }}
                  />
                </label>
              </PageSection>
              <StickyFooter>
                <PrimaryButton
                  disabled={busy}
                  onClick={() => void submit("ACKNOWLEDGED")}
                >
                  Acknowledge Package
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
                  Reject Package
                </DangerButton>
              </StickyFooter>
            </>
          ) : null}
        </>
      ) : (
        <EmptyIllustration
          title="Loading package…"
          copy="Building dry-run execution package"
        />
      )}
    </div>
  );
}
