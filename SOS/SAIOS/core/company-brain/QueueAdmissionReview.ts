/**
 * QueueAdmissionReview — founder-facing readiness review (Agent #164).
 * Never enqueues, executes, dispatches workers, calls providers, or publishes.
 */
import { randomUUID } from "node:crypto";
import { MissionRegistry } from "./MissionRegistry.js";
import { resolveRepoRoot } from "./PlanRepository.js";
import { QueueAdmissionRepository } from "./QueueAdmissionRepository.js";
import { QueueAdmissionReporter } from "./QueueAdmissionReporter.js";
import { QueueReadinessCalculator } from "./QueueReadinessCalculator.js";
import {
  canQueueTransition,
  decisionToQueueStatus,
  validateQueueDecisionInput,
} from "./QueueAdmissionValidator.js";
import type { MissionContract, MissionLifecycleStatus } from "./mission-types.js";
import type {
  QueueAdmissionDecision,
  QueueAdmissionHealth,
  QueueAdmissionSnapshot,
  QueueDecisionInput,
  QueueDecisionResult,
  QueueReadinessReport,
} from "./queue-admission-types.js";
import {
  QUEUE_ADMISSION_SCHEMA_VERSION,
  QUEUE_FOUNDER_ACTOR,
} from "./queue-admission-types.js";

export class QueueAdmissionReview {
  readonly registry: MissionRegistry;
  readonly calculator: QueueReadinessCalculator;
  readonly reporter: QueueAdmissionReporter;
  readonly root: string;

  constructor(repoRoot?: string) {
    this.root = repoRoot ?? resolveRepoRoot();
    this.registry = new MissionRegistry(this.root);
    this.calculator = new QueueReadinessCalculator(this.root);
    this.reporter = new QueueAdmissionReporter();
  }

  private repo(fixture?: boolean): QueueAdmissionRepository {
    return new QueueAdmissionRepository(this.root, {
      fixture: Boolean(fixture),
    });
  }

  /**
   * APPROVED → WAITING_QUEUE_REVIEW + compute readiness.
   */
  startReview(
    missionId: string,
    opts?: { fixture?: boolean },
  ): QueueDecisionResult {
    if (process.env.SOS_AIOS_LIVE === "1") {
      return fail("LIVE must be OFF", "LIVE_ON");
    }
    const mission = this.registry.get(missionId);
    if (!mission) return fail("Mission not found", "MISSION_NOT_FOUND");

    let current = mission;
    if (mission.status === "APPROVED") {
      if (!canQueueTransition("APPROVED", "WAITING_QUEUE_REVIEW")) {
        return fail(
          "Cannot start queue review",
          "INVALID_LIFECYCLE_TRANSITION",
          mission.status,
        );
      }
      current = this.applyStatus(mission, "WAITING_QUEUE_REVIEW", opts?.fixture);
      const r = this.repo(opts?.fixture);
      r.appendEvent({
        event_id: `qevt-${randomUUID().slice(0, 8)}`,
        event_type: "QUEUE_REVIEW_STARTED",
        at: new Date().toISOString(),
        mission_id: missionId,
        decision_id: null,
        review_id: null,
        summary: `Queue readiness review started for ${missionId}`,
        fixture: opts?.fixture,
      });
      r.appendHistory({
        at: new Date().toISOString(),
        mission_id: missionId,
        mission_version: current.mission_version,
        from_status: "APPROVED",
        to_status: "WAITING_QUEUE_REVIEW",
        decision_id: null,
        review_id: null,
        actor: QUEUE_FOUNDER_ACTOR,
        note: "Founder opened queue readiness review",
        fixture: opts?.fixture,
      });
    } else if (
      mission.status !== "WAITING_QUEUE_REVIEW" &&
      mission.status !== "QUEUE_BLOCKED" &&
      mission.status !== "READY_FOR_QUEUE"
    ) {
      return fail(
        `Mission must be APPROVED to start queue review (got ${mission.status})`,
        "INVALID_LIFECYCLE_TRANSITION",
        mission.status,
      );
    }

    const review = this.calculator.calculate(current, {
      fixture: opts?.fixture,
    });
    const r = this.repo(opts?.fixture);
    r.saveReview(review);
    r.appendEvent({
      event_id: `qevt-${randomUUID().slice(0, 8)}`,
      event_type: "READINESS_COMPUTED",
      at: review.generated_at,
      mission_id: missionId,
      decision_id: null,
      review_id: review.review_id,
      summary: `Readiness ${review.overall_score} · ${review.verdict}`,
      fixture: opts?.fixture,
    });
    this.refreshSnapshots(opts?.fixture);
    this.reporter.writeMarkdown(r);

    return {
      ok: true,
      decision: null,
      review,
      mission_status: current.status,
      next_safe_action:
        "Review readiness · Approve Queue Admission only moves WAITING_QUEUE_REVIEW → READY_FOR_QUEUE",
    };
  }

  getLatestReview(fixture?: boolean): QueueReadinessReport | null {
    return this.repo(fixture).loadLatestReview();
  }

  getReviewForMission(missionId: string): QueueReadinessReport | null {
    const mission = this.registry.get(missionId);
    if (!mission) return null;
    const latest = this.repo(Boolean(mission.fixture)).loadLatestReview();
    if (latest?.mission_id === missionId) return latest;
    // Compute on the fly (read-only)
    return this.calculator.calculate(mission, {
      fixture: mission.fixture,
    });
  }

  recordDecision(input: QueueDecisionInput): QueueDecisionResult {
    if (process.env.SOS_AIOS_LIVE === "1") {
      return fail("LIVE must be OFF", "LIVE_ON");
    }

    const fixture = Boolean(input.fixture);
    const repo = this.repo(fixture);
    const mission = this.registry.get(input.mission_id);
    const consumed = mission
      ? repo.hasApprovedForVersion(mission.mission_id, input.mission_version)
      : false;

    const validation = validateQueueDecisionInput(input, mission, {
      consumed_for_version: consumed,
    });
    if (!validation.ok) {
      const first = validation.errors[0]!;
      return {
        ok: false,
        decision: null,
        review: null,
        mission_status: mission?.status ?? null,
        next_safe_action: null,
        error: first.message,
        error_code: first.code,
        duplicate: first.code === "DUPLICATE_DECISION",
      };
    }

    // Ensure WAITING_QUEUE_REVIEW before approve/reject from APPROVED
    let working = mission!;
    if (
      working.status === "APPROVED" &&
      input.decision !== "APPROVE_QUEUE_ADMISSION"
    ) {
      // reject/changes from APPROVED: start review state first for reject path
      working = this.applyStatus(working, "WAITING_QUEUE_REVIEW", fixture);
    }
    if (
      working.status === "APPROVED" &&
      input.decision === "APPROVE_QUEUE_ADMISSION"
    ) {
      return fail(
        "Cannot approve queue admission from APPROVED — start review first (WAITING_QUEUE_REVIEW)",
        "INVALID_LIFECYCLE_TRANSITION",
        working.status,
      );
    }

    const reason =
      String(input.reason ?? "").trim() ||
      (input.decision === "APPROVE_QUEUE_ADMISSION"
        ? "Founder approved queue admission"
        : "");
    const feedback = String(input.feedback ?? "").trim();

    const resulting =
      input.decision === "REQUEST_CHANGES"
        ? ("QUEUE_BLOCKED" as const)
        : decisionToQueueStatus(input.decision);

    const review =
      repo.loadLatestReview()?.mission_id === working.mission_id
        ? repo.loadLatestReview()
        : this.calculator.calculate(working, { fixture });

    if (review && review.mission_id === working.mission_id) {
      repo.saveReview(review);
    }

    const now = new Date().toISOString();
    const decision: QueueAdmissionDecision = {
      schema_version: QUEUE_ADMISSION_SCHEMA_VERSION,
      decision_id: `qdec-${now.slice(0, 10).replace(/-/g, "")}-${randomUUID().slice(0, 8)}`,
      mission_id: working.mission_id,
      mission_version: input.mission_version,
      review_id: input.review_id ?? review?.review_id ?? null,
      decision: input.decision,
      actor: input.actor || QUEUE_FOUNDER_ACTOR,
      reason,
      feedback,
      created_at: now,
      consumed_at: null,
      status: "RECORDED",
      resulting_status: resulting,
      execution_allowed: false,
      queue_enqueue_allowed: false,
      publishing_allowed: false,
      next_safe_action:
        resulting === "READY_FOR_QUEUE"
          ? "STOP — Mission READY_FOR_QUEUE · execution remains impossible"
          : "Address queue blockers · re-run readiness review",
      supersedes_decision_id: null,
      fixture,
    };

    repo.appendDecision(decision);
    repo.appendEvent({
      event_id: `qevt-${randomUUID().slice(0, 8)}`,
      event_type: "QUEUE_DECISION_RECORDED",
      at: now,
      mission_id: decision.mission_id,
      decision_id: decision.decision_id,
      review_id: decision.review_id,
      summary: `Recorded ${decision.decision}`,
      fixture,
    });

    const consumedDecision: QueueAdmissionDecision = {
      ...decision,
      status: "CONSUMED",
      consumed_at: new Date().toISOString(),
    };
    repo.appendDecision(consumedDecision);
    repo.appendEvent({
      event_id: `qevt-${randomUUID().slice(0, 8)}`,
      event_type: "QUEUE_DECISION_CONSUMED",
      at: consumedDecision.consumed_at!,
      mission_id: decision.mission_id,
      decision_id: decision.decision_id,
      review_id: decision.review_id,
      summary: `Consumed → ${resulting}`,
      fixture,
    });

    const from = working.status;
    const updated = this.applyStatus(working, resulting, fixture);
    repo.appendHistory({
      at: consumedDecision.consumed_at!,
      mission_id: updated.mission_id,
      mission_version: updated.mission_version,
      from_status: from,
      to_status: resulting,
      decision_id: decision.decision_id,
      review_id: decision.review_id,
      actor: decision.actor,
      note: reason || feedback || decision.decision,
      fixture,
    });
    repo.appendEvent({
      event_id: `qevt-${randomUUID().slice(0, 8)}`,
      event_type: "MISSION_STATUS_UPDATED",
      at: consumedDecision.consumed_at!,
      mission_id: updated.mission_id,
      decision_id: decision.decision_id,
      review_id: decision.review_id,
      summary: `${from} → ${resulting}`,
      fixture,
    });

    this.refreshSnapshots(fixture);
    this.reporter.writeMarkdown(repo);

    if (
      updated.execution_allowed !== false ||
      updated.queue_admission_allowed !== false ||
      updated.publishing_allowed !== false
    ) {
      throw new Error("Safety invariant violated");
    }

    return {
      ok: true,
      decision: consumedDecision,
      review: review ?? null,
      mission_status: resulting,
      next_safe_action: consumedDecision.next_safe_action,
    };
  }

  private applyStatus(
    mission: MissionContract,
    status: MissionLifecycleStatus,
    fixture?: boolean,
  ): MissionContract {
    const updated: MissionContract = {
      ...mission,
      status,
      current_stage: status,
      updated_at: new Date().toISOString(),
      execution_allowed: false,
      queue_admission_allowed: false,
      publishing_allowed: false,
      founder_approval_required: true,
      planning_notes: [
        ...mission.planning_notes,
        `Queue admission status → ${status} (Agent #164; no enqueue/execute)`,
      ],
      fixture: fixture ?? mission.fixture,
    };
    this.registry.save(updated, { set_current: !fixture });
    return updated;
  }

  refreshSnapshots(fixture?: boolean): void {
    const repo = this.repo(fixture);
    const missions = this.registry
      .listAll(true)
      .filter((m) => (fixture ? Boolean(m.fixture) : !m.fixture));
    const current = this.registry.getCurrent();
    const pool = missions.length ? missions : current ? [current] : [];

    const pending = pool.filter((m) => m.status === "WAITING_QUEUE_REVIEW");
    const ready = pool.filter((m) => m.status === "READY_FOR_QUEUE");
    const blocked = pool.filter((m) => m.status === "QUEUE_BLOCKED");
    const focus =
      pending[0] ?? ready[0] ?? blocked[0] ?? current ?? pool[0] ?? null;

    const latestReview = repo.loadLatestReview();
    const decisions = repo
      .listDecisions()
      .filter((d) => d.status === "CONSUMED");
    const latestDec = decisions.length
      ? decisions[decisions.length - 1]!
      : null;

    const snapshot: QueueAdmissionSnapshot = {
      schema_version: "queue-admission-snapshot-1.0.0",
      updated_at: new Date().toISOString(),
      mission_id: focus?.mission_id ?? null,
      mission_version: focus?.mission_version ?? null,
      queue_status:
        focus?.status === "WAITING_QUEUE_REVIEW" ||
        focus?.status === "READY_FOR_QUEUE" ||
        focus?.status === "QUEUE_BLOCKED"
          ? focus.status
          : "NOT_STARTED",
      overall_score: latestReview?.overall_score ?? null,
      verdict: latestReview?.verdict ?? null,
      latest_decision_id: latestDec?.decision_id ?? null,
      latest_decision: latestDec?.decision ?? null,
      latest_review_id: latestReview?.review_id ?? null,
      execution_allowed: false,
      queue_enqueue_allowed: false,
      publishing_allowed: false,
      execution_still_blocked_reason:
        "Queue admission review never enqueues or executes. READY_FOR_QUEUE stops here.",
      pending: pending.length > 0,
    };
    repo.writeSnapshot(snapshot);

    const health: QueueAdmissionHealth = {
      schema_version: "queue-admission-health-1.0.0",
      updated_at: new Date().toISOString(),
      pending_review_count: pending.length,
      ready_for_queue_count: ready.length,
      blocked_count: blocked.length,
      decision_count: decisions.length,
      execution_allowed: false,
      queue_enqueue_allowed: false,
      publishing_allowed: false,
      live: false,
      mode: "readiness_review_only",
      status:
        pending.length || ready.length || blocked.length
          ? "healthy"
          : decisions.length
            ? "healthy"
            : "idle",
    };
    repo.writeHealth(health);
  }
}

function fail(
  error: string,
  error_code: string,
  mission_status: MissionLifecycleStatus | null = null,
): QueueDecisionResult {
  return {
    ok: false,
    decision: null,
    review: null,
    mission_status,
    next_safe_action: null,
    error,
    error_code,
  };
}

export function createQueueAdmissionReview(
  repoRoot?: string,
): QueueAdmissionReview {
  return new QueueAdmissionReview(repoRoot);
}

/** Alias matching Agent #164 filename expectation */
export { QueueAdmissionReview as QueueAdmissionReviewService };
