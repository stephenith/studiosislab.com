/**
 * Queue Admission Readiness Review — Agent #164.
 * Founder-facing only. Never enqueues or executes.
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
  onDecided: () => void | Promise<void>;
};

type ReviewPayload = {
  mission_id: string;
  mission_status: string;
  review: {
    review_id: string;
    overall_score: number;
    verdict: string;
    queue_status: string;
    categories: Array<{
      id: string;
      label: string;
      score: number;
      weight: number;
      status: string;
    }>;
    departments: string[];
    workers: string[];
    skills: string[];
    models: string[];
    tools: string[];
    dependency_graph: {
      critical_path: string[];
      edges: Array<{ from: string; to: string; kind: string }>;
    };
    estimated_cost_note: string;
    estimated_duration: string;
    issues: Array<{ severity: string; message: string; code: string }>;
    warnings: string[];
    risks: string[];
    execution_still_blocked_reason: string;
    mission_version: number;
  } | null;
};

export function QueueAdmissionView({ snapshot, onBack, onDecided }: Props) {
  const missionId = snapshot.company_brain?.current_mission_id ?? null;
  const [data, setData] = useState<ReviewPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState("");

  const load = useCallback(async () => {
    if (!missionId) {
      setData(null);
      return;
    }
    try {
      const res = await fetch(
        `/api/company-brain/queue-review/${encodeURIComponent(missionId)}`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as ReviewPayload;
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
    decision:
      | "APPROVE_QUEUE_ADMISSION"
      | "REQUEST_CHANGES"
      | "REJECT_QUEUE_ADMISSION",
  ) => {
    if (!data?.review) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/company-brain/queue-decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mission_id: data.mission_id,
          mission_version: data.review.mission_version,
          decision,
          actor: "stephen",
          reason:
            decision === "REJECT_QUEUE_ADMISSION"
              ? reason
              : reason ||
                (decision === "APPROVE_QUEUE_ADMISSION"
                  ? "Founder approved queue admission"
                  : ""),
          feedback: decision === "REQUEST_CHANGES" ? feedback : feedback || "",
          review_id: data.review.review_id,
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

  const review = data?.review;
  const canDecide =
    data?.mission_status === "WAITING_QUEUE_REVIEW" ||
    data?.mission_status === "QUEUE_BLOCKED";

  return (
    <div className="ds-stack">
      <PageHeader
        title="Queue Admission Review"
        subtitle="Operational readiness only · never enqueues · LIVE OFF"
        actions={
          <SecondaryButton size="sm" onClick={onBack}>
            Back to Mission Control
          </SecondaryButton>
        }
      />

      <AlertBanner tone="warn" title="Execution remains blocked">
        Approving Queue Admission only reaches READY_FOR_QUEUE and then STOPS.
        No workers · no providers · no publish · no enqueue.
      </AlertBanner>

      {!missionId ? (
        <EmptyIllustration
          title="No current mission"
          copy="Approve a Mission first, then open Queue Admission Review."
        />
      ) : error && !data ? (
        <EmptyIllustration title="Failed to load review" copy={error} />
      ) : review ? (
        <>
          <InfoBanner title={`Queue status · ${data?.mission_status}`}>
            Score {review.overall_score}/100 · Verdict {review.verdict} ·{" "}
            {review.execution_still_blocked_reason}
          </InfoBanner>

          <MetricGrid columns={4}>
            <KPIStatCard
              value={`${review.overall_score}`}
              label="Readiness Score"
              delta={review.verdict}
              deltaDirection="flat"
              tone={
                review.verdict === "READY_FOR_QUEUE" ? "approved" : "waiting"
              }
            />
            <KPIStatCard
              value={data?.mission_status ?? "—"}
              label="Queue Status"
              delta="approval_only"
              deltaDirection="flat"
              tone="processing"
            />
            <KPIStatCard
              value={review.estimated_duration}
              label="Estimated Duration"
              delta={review.estimated_cost_note}
              deltaDirection="flat"
              tone="neutral"
            />
            <KPIStatCard
              value="NOT READY"
              label="Publishing"
              delta="always blocked"
              deltaDirection="flat"
              tone="blocked"
            />
          </MetricGrid>

          <PageSection title="Category scores">
            <SectionCard title="Weighted readiness">
              <ul className="mono muted ds-meta-mono">
                {review.categories.map((c) => (
                  <li key={c.id}>
                    {c.label}: {c.score}% · weight {c.weight} · {c.status}
                  </li>
                ))}
              </ul>
            </SectionCard>
          </PageSection>

          <PageSection title="Departments · workers · skills · tools">
            <SectionCard title="Operational inventory">
              <p className="mono muted ds-meta-mono">
                Departments: {review.departments.join(" → ") || "—"}
              </p>
              <p className="mono muted ds-meta-mono">
                Workers: {review.workers.join(", ")}
              </p>
              <p className="mono muted ds-meta-mono">
                Skills: {review.skills.join(", ") || "—"}
              </p>
              <p className="mono muted ds-meta-mono">
                Models: {review.models.join(", ")}
              </p>
              <p className="mono muted ds-meta-mono">
                Tools: {review.tools.join(", ")}
              </p>
              <p className="mono muted ds-meta-mono">
                Critical path:{" "}
                {review.dependency_graph.critical_path.join(" → ") || "—"}
              </p>
            </SectionCard>
          </PageSection>

          <PageSection title="Blockers · warnings · risks">
            <SectionCard title="Issues">
              {review.issues.length === 0 ? (
                <p className="muted">None</p>
              ) : (
                <ul>
                  {review.issues.map((i) => (
                    <li key={i.code}>
                      [{i.severity}] {i.message}
                    </li>
                  ))}
                </ul>
              )}
              <div className="ds-row-wrap" style={{ marginTop: "0.5rem" }}>
                <Badge tone="blocked">execution_allowed=false</Badge>
                <Badge tone="blocked">queue_enqueue_allowed=false</Badge>
                <Badge tone="blocked">publishing_allowed=false</Badge>
              </div>
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
                  onClick={() => void submit("APPROVE_QUEUE_ADMISSION")}
                >
                  Approve Queue Admission
                </PrimaryButton>
                <SecondaryButton
                  disabled={busy}
                  onClick={() => void submit("REQUEST_CHANGES")}
                >
                  Request Changes
                </SecondaryButton>
                <DangerButton
                  disabled={busy}
                  onClick={() => void submit("REJECT_QUEUE_ADMISSION")}
                >
                  Reject Queue Admission
                </DangerButton>
              </StickyFooter>
            </>
          ) : null}
        </>
      ) : (
        <EmptyIllustration
          title="Loading readiness…"
          copy="Computing queue admission review"
        />
      )}
    </div>
  );
}
