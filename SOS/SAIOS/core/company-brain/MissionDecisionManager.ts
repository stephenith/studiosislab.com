/**
 * MissionDecisionManager — founder mission approval workflow (Agent #163).
 * Never enqueues, executes, publishes, or calls providers.
 */
import { randomUUID } from "node:crypto";
import { createMissionDecision } from "./MissionDecision.js";
import { MissionApprovalRepository } from "./MissionApprovalRepository.js";
import { MissionApprovalReporter } from "./MissionApprovalReporter.js";
import {
  assertApprovalTransition,
  canApprovalTransition,
  decisionToStatus,
} from "./MissionApprovalStateMachine.js";
import { validateMissionDecisionInput } from "./MissionDecisionValidator.js";
import { MissionRegistry } from "./MissionRegistry.js";
import { PlanRepository } from "./PlanRepository.js";
import type { MissionContract } from "./mission-types.js";
import type {
  MissionApprovalHealth,
  MissionApprovalSnapshot,
  MissionDecision,
  MissionDecisionEvent,
  MissionDecisionInput,
  MissionDecisionResult,
  PendingMissionApproval,
} from "./mission-decision-types.js";
import { MISSION_FOUNDER_ACTOR } from "./mission-decision-types.js";

export class MissionDecisionManager {
  readonly registry: MissionRegistry;
  readonly plans: PlanRepository;
  readonly reporter: MissionApprovalReporter;

  constructor(repoRoot?: string) {
    this.registry = new MissionRegistry(repoRoot);
    this.plans = new PlanRepository(repoRoot);
    this.reporter = new MissionApprovalReporter();
  }

  private approvalRepo(fixture?: boolean): MissionApprovalRepository {
    return new MissionApprovalRepository(this.registry.root, {
      fixture: Boolean(fixture),
    });
  }

  /**
   * PLANNED → WAITING_FOUNDER (governance only).
   */
  submitForFounderApproval(
    missionId: string,
    opts?: { fixture?: boolean },
  ): MissionDecisionResult {
    if (process.env.SOS_AIOS_LIVE === "1") {
      return {
        ok: false,
        decision: null,
        mission_status: null,
        next_safe_action: null,
        error: "LIVE must be OFF",
        error_code: "LIVE_ON",
      };
    }
    const mission = this.registry.get(missionId);
    if (!mission) {
      return {
        ok: false,
        decision: null,
        mission_status: null,
        next_safe_action: null,
        error: "Mission not found",
        error_code: "MISSION_NOT_FOUND",
      };
    }
    if (!canApprovalTransition(mission.status, "WAITING_FOUNDER")) {
      return {
        ok: false,
        decision: null,
        mission_status: mission.status,
        next_safe_action: null,
        error: `Cannot submit ${mission.status} → WAITING_FOUNDER`,
        error_code: "INVALID_LIFECYCLE_TRANSITION",
      };
    }
    assertApprovalTransition(mission.status, "WAITING_FOUNDER");
    const updated = this.applyMissionStatus(mission, "WAITING_FOUNDER", opts?.fixture);
    const repo = this.approvalRepo(opts?.fixture);
    const event: MissionDecisionEvent = {
      event_id: `mevt-${randomUUID().slice(0, 8)}`,
      event_type: "MISSION_SUBMITTED_FOR_FOUNDER",
      at: new Date().toISOString(),
      mission_id: missionId,
      decision_id: null,
      summary: `Mission ${missionId} submitted for founder approval`,
      fixture: opts?.fixture,
    };
    repo.appendEvent(event);
    repo.appendHistory({
      at: event.at,
      mission_id: missionId,
      mission_version: updated.mission_version,
      from_status: mission.status,
      to_status: "WAITING_FOUNDER",
      decision_id: null,
      actor: MISSION_FOUNDER_ACTOR,
      note: "Submitted for founder approval",
      fixture: opts?.fixture,
    });
    this.refreshSnapshots(opts?.fixture);
    return {
      ok: true,
      decision: null,
      mission_status: "WAITING_FOUNDER",
      next_safe_action: "Await founder mission decision in dashboard",
    };
  }

  recordDecision(input: MissionDecisionInput): MissionDecisionResult {
    if (process.env.SOS_AIOS_LIVE === "1") {
      return {
        ok: false,
        decision: null,
        mission_status: null,
        next_safe_action: null,
        error: "LIVE must be OFF",
        error_code: "LIVE_ON",
      };
    }

    const fixture = Boolean(input.fixture);
    const repo = this.approvalRepo(fixture);
    const mission = this.registry.get(input.mission_id);
    const consumed = mission
      ? repo.hasConsumedForVersion(mission.mission_id, input.mission_version)
      : false;

    const validation = validateMissionDecisionInput(input, mission, {
      consumed_for_version: consumed,
    });
    if (!validation.ok) {
      const first = validation.errors[0]!;
      return {
        ok: false,
        decision: null,
        mission_status: mission?.status ?? null,
        next_safe_action: null,
        error: first.message,
        error_code: first.code,
        duplicate: first.code === "DUPLICATE_DECISION",
      };
    }

    const reason =
      String(input.reason ?? "").trim() ||
      (input.decision === "APPROVED" ? "Founder approved mission" : "");
    const feedback = String(input.feedback ?? "").trim();

    const prior = repo.latestDecisionForMission(
      input.mission_id,
      input.mission_version,
    );

    const decision = createMissionDecision({
      ...input,
      reason,
      feedback,
      fixture,
    });
    if (prior && prior.status === "CONSUMED") {
      // Should have been caught as duplicate; belt-and-suspenders
      return {
        ok: false,
        decision: null,
        mission_status: mission!.status,
        next_safe_action: null,
        error: "Duplicate decision",
        error_code: "DUPLICATE_DECISION",
        duplicate: true,
      };
    }
    if (prior && prior.status === "RECORDED") {
      decision.supersedes_decision_id = prior.decision_id;
    }

    // Append immutable decision (RECORDED)
    repo.appendDecision(decision);
    repo.appendEvent({
      event_id: `mevt-${randomUUID().slice(0, 8)}`,
      event_type: "MISSION_DECISION_RECORDED",
      at: decision.created_at,
      mission_id: decision.mission_id,
      decision_id: decision.decision_id,
      summary: `Recorded ${decision.decision} for ${decision.mission_id}`,
      fixture,
    });

    // Consume → update mission status (still no execute/enqueue)
    const target = decisionToStatus(decision.decision);
    assertApprovalTransition(mission!.status, target);

    const consumedDecision: MissionDecision = {
      ...decision,
      status: "CONSUMED",
      consumed_at: new Date().toISOString(),
    };
    // Append consumed marker as new immutable line (do not mutate prior line)
    repo.appendDecision(consumedDecision);
    repo.appendEvent({
      event_id: `mevt-${randomUUID().slice(0, 8)}`,
      event_type: "MISSION_DECISION_CONSUMED",
      at: consumedDecision.consumed_at!,
      mission_id: decision.mission_id,
      decision_id: decision.decision_id,
      summary: `Consumed ${decision.decision} → ${target}`,
      fixture,
    });

    if (prior && prior.status === "RECORDED") {
      repo.appendDecision({
        ...prior,
        status: "SUPERSEDED",
      });
    }

    const updated = this.applyMissionStatus(mission!, target, fixture);
    repo.appendHistory({
      at: consumedDecision.consumed_at!,
      mission_id: updated.mission_id,
      mission_version: updated.mission_version,
      from_status: mission!.status,
      to_status: target,
      decision_id: decision.decision_id,
      actor: decision.actor,
      note: decision.reason || decision.feedback || decision.decision,
      fixture,
    });
    repo.appendEvent({
      event_id: `mevt-${randomUUID().slice(0, 8)}`,
      event_type: "MISSION_STATUS_UPDATED",
      at: consumedDecision.consumed_at!,
      mission_id: updated.mission_id,
      decision_id: decision.decision_id,
      summary: `Mission status ${mission!.status} → ${target}`,
      fixture,
    });

    if (decision.revision_proposal) {
      repo.appendEvent({
        event_id: `mevt-${randomUUID().slice(0, 8)}`,
        event_type: "MISSION_REVISION_PROPOSED",
        at: consumedDecision.consumed_at!,
        mission_id: updated.mission_id,
        decision_id: decision.decision_id,
        summary: `Revision proposal ${decision.revision_proposal.proposal_id} (auto_revise=false)`,
        fixture,
      });
    }

    this.refreshSnapshots(fixture);
    this.reporter.writeMarkdown(repo);

    // Safety: never flip execution/queue/publish flags
    if (
      updated.execution_allowed !== false ||
      updated.queue_admission_allowed !== false ||
      updated.publishing_allowed !== false
    ) {
      throw new Error("Safety invariant violated: execution/queue/publish must stay false");
    }

    return {
      ok: true,
      decision: consumedDecision,
      mission_status: target,
      next_safe_action: consumedDecision.next_safe_action,
    };
  }

  private applyMissionStatus(
    mission: MissionContract,
    status: MissionContract["status"],
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
        `Mission approval status → ${status} (Agent #163; no execution)`,
      ],
      fixture: fixture ?? mission.fixture,
    };
    // Preserve mission history via registry save (append jsonl + version file)
    this.registry.save(updated, { set_current: !fixture });
    return updated;
  }

  refreshSnapshots(fixture?: boolean): void {
    const repo = this.approvalRepo(fixture);
    const missions = this.registry.listAll().filter((m) =>
      fixture ? Boolean(m.fixture) : !m.fixture,
    );
    // Also include current even if fixture filter empty
    const current = this.registry.getCurrent();
    const pool =
      missions.length > 0
        ? missions
        : current
          ? [current]
          : this.registry.listAll();

    const pending: PendingMissionApproval[] = pool
      .filter(
        (m) => m.status === "WAITING_FOUNDER" || m.status === "PLANNED",
      )
      .map((m) => ({
        mission_id: m.mission_id,
        mission_version: m.mission_version,
        mission_name: m.mission_name,
        status: m.status as "WAITING_FOUNDER" | "PLANNED",
        priority: m.priority,
        risk_level: m.risk_level,
        updated_at: m.updated_at,
        founder_approval_required: true as const,
      }));

    const decisions = repo.listDecisions(true).filter((d) => d.status === "CONSUMED");
    const approved = decisions.filter((d) => d.decision === "APPROVED").length;
    const rejected = decisions.filter((d) => d.decision === "REJECTED").length;
    const changes = decisions.filter((d) => d.decision === "CHANGES_REQUESTED").length;

    const focus =
      pool.find((m) => m.status === "WAITING_FOUNDER") ??
      pool.find((m) => m.status === "APPROVED") ??
      current ??
      pool[0] ??
      null;

    const latestDec = focus
      ? repo.latestDecisionForMission(focus.mission_id, focus.mission_version)
      : null;

    const snapshot: MissionApprovalSnapshot = {
      schema_version: "mission-approval-snapshot-1.0.0",
      updated_at: new Date().toISOString(),
      mission_id: focus?.mission_id ?? null,
      mission_version: focus?.mission_version ?? null,
      mission_status: focus?.status ?? null,
      latest_decision_id: latestDec?.decision_id ?? null,
      latest_decision: latestDec?.decision ?? null,
      founder_approval_required: true,
      execution_allowed: false,
      queue_admission_allowed: false,
      publishing_allowed: false,
      next_safe_action: latestDec?.next_safe_action ?? null,
      pending: pending.some((p) => p.status === "WAITING_FOUNDER"),
    };
    repo.writeLatestApproval(snapshot);
    repo.writePending(pending);

    const health: MissionApprovalHealth = {
      schema_version: "mission-approval-health-1.0.0",
      updated_at: new Date().toISOString(),
      pending_count: pending.filter((p) => p.status === "WAITING_FOUNDER").length,
      approved_count: approved,
      rejected_count: rejected,
      changes_requested_count: changes,
      decision_count: decisions.length,
      execution_allowed: false,
      queue_admission_allowed: false,
      publishing_allowed: false,
      live: false,
      mode: "approval_only",
      status:
        pending.filter((p) => p.status === "WAITING_FOUNDER").length > 0
          ? "healthy"
          : decisions.length > 0
            ? "healthy"
            : "idle",
    };
    repo.writeHealth(health);
  }

  listMissions(): MissionContract[] {
    return this.registry.listAll();
  }

  getMission(missionId: string): MissionContract | null {
    return this.registry.get(missionId);
  }

  getMissionDetail(missionId: string) {
    const mission = this.registry.get(missionId);
    if (!mission) return null;
    const plan =
      (mission.linked_plan_id &&
        this.plans.loadLatestPlan()?.plan_id === mission.linked_plan_id
          ? this.plans.loadLatestPlan()
          : this.plans.loadLatestPlan()) ?? null;
    const repo = this.approvalRepo(Boolean(mission.fixture));
    const decisions = repo
      .listDecisions(true)
      .filter((d) => d.mission_id === missionId);
    const history = repo
      .listHistory()
      .filter((h) => h.mission_id === missionId);
    return {
      mission,
      plan,
      decisions,
      history,
      execution_allowed: false as const,
      queue_admission_allowed: false as const,
      publishing_allowed: false as const,
      live: false as const,
    };
  }
}

export function createMissionDecisionManager(
  repoRoot?: string,
): MissionDecisionManager {
  return new MissionDecisionManager(repoRoot);
}
