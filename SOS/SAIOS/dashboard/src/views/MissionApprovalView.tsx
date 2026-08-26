/**
 * Mission Approval surface — Agent #163.
 * Separate from Resume Founder Review. Local-only decisions. No execution.
 */
import { useCallback, useEffect, useState } from "react";
import type { DashboardSnapshot } from "../data/types";
import {
  AlertBanner,
  Badge,
  DangerButton,
  EmptyIllustration,
  InfoBanner,
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
  onDecided: () => void | Promise<void>;
};

type MissionDetail = {
  mission: {
    mission_id: string;
    mission_version: number;
    mission_name: string;
    status: string;
    founder_objective: string;
    mission_description: string;
    business_goal: string;
    priority: string;
    risk_level: string;
    success_kpis: Array<{ id: string; label: string; target: string }>;
    blocking_issues: Array<{ code: string; message: string; severity: string }>;
    estimated_departments: Array<{
      department: string;
      role_in_plan: string;
      enabled: boolean;
    }>;
    dependency_graph: {
      critical_path: string[];
      edges: Array<{ from: string; to: string; kind: string; description: string }>;
      nodes: string[];
    };
    execution_allowed: boolean;
    queue_admission_allowed: boolean;
    publishing_allowed: boolean;
  };
  plan: {
    plan_id: string;
    execution_status: string;
    recommended_order: string[];
    planning_notes: string[];
  } | null;
  history: Array<{
    at: string;
    from_status: string;
    to_status: string;
    note: string;
  }>;
};

export function MissionApprovalView({ snapshot, onBack, onDecided }: Props) {
  const cb = snapshot.company_brain;
  const missionId = cb?.current_mission_id ?? null;
  const [detail, setDetail] = useState<MissionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState("");

  const load = useCallback(async () => {
    if (!missionId) {
      setDetail(null);
      return;
    }
    try {
      const res = await fetch(
        `/api/company-brain/mission/${encodeURIComponent(missionId)}`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as MissionDetail;
      setDetail(data);
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
    if (!detail) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/company-brain/mission-decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mission_id: detail.mission.mission_id,
          mission_version: detail.mission.mission_version,
          decision,
          actor: "stephen",
          reason:
            decision === "REJECTED"
              ? reason
              : reason || (decision === "APPROVED" ? "Founder approved mission" : ""),
          feedback: decision === "CHANGES_REQUESTED" ? feedback : feedback || "",
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
      await onDecided();
      await load();
      setReason("");
      setFeedback("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const waiting = detail?.mission.status === "WAITING_FOUNDER";

  return (
    <div className="ds-stack">
      <PageHeader
        title="Mission Approval"
        subtitle="Founder-governed Mission Contract · never executes · LIVE OFF"
        actions={
          <SecondaryButton size="sm" onClick={onBack}>
            Back to Mission Control
          </SecondaryButton>
        }
      />

      <AlertBanner tone="warn" title="Safety locks">
        Execution disabled · Queue admission disabled · Publishing disabled ·
        LIVE OFF · approval_only
      </AlertBanner>

      {!missionId ? (
        <EmptyIllustration
          title="No current mission"
          copy="Create a Mission via Company Brain planning before reviewing."
        />
      ) : error && !detail ? (
        <EmptyIllustration title="Failed to load mission" copy={error} />
      ) : detail ? (
        <>
          {waiting ? (
            <InfoBanner title="WAITING FOR FOUNDER">
              Mission {detail.mission.mission_id} · v
              {detail.mission.mission_version} · no automatic decision
            </InfoBanner>
          ) : (
            <InfoBanner title={`Status · ${detail.mission.status}`}>
              Latest state for {detail.mission.mission_name}
            </InfoBanner>
          )}

          <PageSection title="Mission summary" subtitle="Canonical business object">
            <SectionCard title={detail.mission.mission_name}>
              <p className="mono ds-meta">
                ID: {detail.mission.mission_id} · Version:{" "}
                {detail.mission.mission_version} · Status:{" "}
                {detail.mission.status} · Priority: {detail.mission.priority} ·
                Risk: {detail.mission.risk_level}
              </p>
              <p>
                <strong>Objective.</strong> {detail.mission.founder_objective}
              </p>
              <p className="muted">{detail.mission.mission_description}</p>
              <p>
                <strong>Business goal.</strong> {detail.mission.business_goal}
              </p>
              <div className="ds-row-wrap" style={{ marginTop: "0.5rem" }}>
                <Badge tone="approved">founder approval required</Badge>
                <Badge tone="blocked">execution_allowed=false</Badge>
                <Badge tone="blocked">queue_admission_allowed=false</Badge>
                <Badge tone="blocked">publishing_allowed=false</Badge>
              </div>
            </SectionCard>
          </PageSection>

          <PageSection title="Departments & critical path">
            <SectionCard title="Departments">
              <p className="mono muted ds-meta-mono">
                {detail.mission.estimated_departments
                  .filter(
                    (d) =>
                      d.role_in_plan === "primary" ||
                      d.role_in_plan === "supporting",
                  )
                  .map((d) => d.department)
                  .join(" → ") || "—"}
              </p>
              <p className="mono muted ds-meta-mono">
                Critical path:{" "}
                {detail.mission.dependency_graph.critical_path.join(" → ") ||
                  "—"}
              </p>
              <ul className="muted">
                {detail.mission.dependency_graph.edges.slice(0, 8).map((e) => (
                  <li key={`${e.from}-${e.to}-${e.kind}`}>
                    {e.from} → {e.to} ({e.kind}) — {e.description}
                  </li>
                ))}
              </ul>
            </SectionCard>
          </PageSection>

          <PageSection title="KPIs · blockers · plan">
            <SectionCard title="Success KPIs">
              <ul>
                {detail.mission.success_kpis.map((k) => (
                  <li key={k.id}>
                    {k.label} · target {k.target}
                  </li>
                ))}
              </ul>
            </SectionCard>
            <SectionCard title="Blocking issues">
              {detail.mission.blocking_issues.length === 0 ? (
                <p className="muted">None recorded</p>
              ) : (
                <ul>
                  {detail.mission.blocking_issues.map((b) => (
                    <li key={b.code}>
                      [{b.severity}] {b.message}
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
            <SectionCard title="Execution Plan (derived)">
              {detail.plan ? (
                <>
                  <p className="mono ds-meta">
                    {detail.plan.plan_id} · {detail.plan.execution_status}
                  </p>
                  <p className="mono muted ds-meta-mono">
                    Order: {detail.plan.recommended_order.join(" → ")}
                  </p>
                </>
              ) : (
                <p className="muted">No linked plan loaded</p>
              )}
            </SectionCard>
          </PageSection>

          <PageSection title="Mission history">
            <SectionCard title="Approval history">
              {detail.history.length === 0 ? (
                <p className="muted">No approval history yet</p>
              ) : (
                <ul className="mono muted ds-meta-mono">
                  {detail.history
                    .slice()
                    .reverse()
                    .slice(0, 12)
                    .map((h, i) => (
                      <li key={`${h.at}-${i}`}>
                        {h.at} · {h.from_status} → {h.to_status} · {h.note}
                      </li>
                    ))}
                </ul>
              )}
            </SectionCard>
          </PageSection>

          {error ? (
            <AlertBanner tone="warn" title="Decision rejected">
              {error}
            </AlertBanner>
          ) : null}

          {waiting ? (
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
                <label className="ds-meta" style={{ display: "block", marginTop: "0.75rem" }}>
                  Feedback (required for Request Changes)
                  <textarea
                    className="ds-input"
                    rows={3}
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    style={{ width: "100%", marginTop: "0.35rem" }}
                  />
                </label>
              </PageSection>
              <StickyFooter>
                <PrimaryButton
                  disabled={busy}
                  onClick={() => void submit("APPROVED")}
                >
                  Approve Mission
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
                  Reject Mission
                </DangerButton>
              </StickyFooter>
            </>
          ) : null}
        </>
      ) : (
        <EmptyIllustration title="Loading mission…" copy="Fetching mission detail" />
      )}
    </div>
  );
}
