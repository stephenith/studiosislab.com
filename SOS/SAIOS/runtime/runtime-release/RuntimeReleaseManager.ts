/**
 * RuntimeReleaseManager — founder runtime release gate (Agent #170).
 * Governance only. Never executes, dispatches, schedules, or publishes.
 */
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { MissionRegistry } from "../../core/company-brain/MissionRegistry.js";
import type {
  MissionContract,
  MissionLifecycleStatus,
} from "../../core/company-brain/mission-types.js";
import { RuntimePlanRepository } from "../planner/RuntimePlanRepository.js";
import { ShadowQueueRepository } from "../queue/ShadowQueueRepository.js";
import { RuntimeReleaseRepository } from "./RuntimeReleaseRepository.js";
import { RuntimeReleaseReporter } from "./RuntimeReleaseReporter.js";
import { validateRuntimeReleaseInput } from "./RuntimeReleaseValidator.js";
import {
  assertRuntimeReleaseTransition,
  decisionToReleaseStatus,
} from "./RuntimeReleaseStateMachine.js";
import type {
  RuntimeReleaseDecision,
  RuntimeReleaseDecisionInput,
  RuntimeReleaseDecisionResult,
  RuntimeReleaseHealth,
  RuntimeReleaseRevisionProposal,
  RuntimeReleaseSnapshot,
} from "./runtime-release-types.js";
import {
  RUNTIME_RELEASE_FOUNDER_ACTOR,
  RUNTIME_RELEASE_SCHEMA_VERSION,
} from "./runtime-release-types.js";

function resolveRepoRoot(fromDir = import.meta.dirname): string {
  return resolve(fromDir, "../../../..");
}

export class RuntimeReleaseManager {
  readonly registry: MissionRegistry;
  readonly reporter: RuntimeReleaseReporter;
  readonly root: string;

  constructor(repoRoot?: string) {
    this.root = repoRoot ?? resolveRepoRoot();
    this.registry = new MissionRegistry(this.root);
    this.reporter = new RuntimeReleaseReporter();
  }

  private repo(fixture?: boolean): RuntimeReleaseRepository {
    return new RuntimeReleaseRepository(this.root, {
      fixture: Boolean(fixture),
    });
  }

  private planStore(fixture?: boolean): RuntimePlanRepository {
    return new RuntimePlanRepository(this.root, {
      fixture: Boolean(fixture),
    });
  }

  private shadowStore(fixture?: boolean): ShadowQueueRepository {
    return new ShadowQueueRepository(this.root, {
      fixture: Boolean(fixture),
    });
  }

  /**
   * RUNTIME_PLAN_READY → WAITING_RUNTIME_RELEASE
   */
  openForRelease(
    missionId: string,
    opts?: { fixture?: boolean },
  ): RuntimeReleaseDecisionResult {
    if (process.env.SOS_AIOS_LIVE === "1") {
      return fail("LIVE must be OFF", "LIVE_ON");
    }
    const fixture = Boolean(opts?.fixture);
    const mission = this.registry.get(missionId);
    if (!mission) return fail("Mission not found", "MISSION_NOT_FOUND");

    const plan = this.planStore(fixture).getForMission(missionId);
    if (!plan || plan.plan_status !== "RUNTIME_PLAN_READY") {
      if (mission.status === "WAITING_RUNTIME_RELEASE" && plan) {
        return {
          ok: true,
          release: null,
          mission_status: mission.status,
          next_safe_action:
            "Review runtime plan · approval is not execution authorization",
        };
      }
      return fail(
        "Runtime plan must be RUNTIME_PLAN_READY",
        "PLAN_NOT_READY",
        mission.status,
      );
    }

    let current = mission;
    if (mission.status === "RUNTIME_PLAN_READY") {
      assertRuntimeReleaseTransition(
        "RUNTIME_PLAN_READY",
        "WAITING_RUNTIME_RELEASE",
      );
      current = this.applyStatus(
        mission,
        "WAITING_RUNTIME_RELEASE",
        fixture,
      );
      const r = this.repo(fixture);
      r.appendEvent({
        event_id: `rrevt-${randomUUID().slice(0, 8)}`,
        event_type: "RELEASE_REVIEW_OPENED",
        at: new Date().toISOString(),
        mission_id: missionId,
        release_id: null,
        runtime_plan_id: plan.runtime_plan_id,
        summary: `Opened runtime release review for ${plan.runtime_plan_id}`,
        fixture,
      });
      r.appendHistory({
        at: new Date().toISOString(),
        mission_id: missionId,
        mission_version: current.mission_version,
        release_id: null,
        runtime_plan_id: plan.runtime_plan_id,
        from_status: "RUNTIME_PLAN_READY",
        to_status: "WAITING_RUNTIME_RELEASE",
        actor: RUNTIME_RELEASE_FOUNDER_ACTOR,
        note: "Waiting founder runtime release decision",
        fixture,
      });
      this.refreshSnapshots(fixture);
    } else if (mission.status !== "WAITING_RUNTIME_RELEASE") {
      return fail(
        `Mission must be RUNTIME_PLAN_READY or WAITING_RUNTIME_RELEASE (got ${mission.status})`,
        "INVALID_LIFECYCLE_TRANSITION",
        mission.status,
      );
    }

    return {
      ok: true,
      release: null,
      mission_status: current.status,
      next_safe_action:
        "Review runtime plan · approval is not execution authorization",
    };
  }

  recordDecision(
    input: RuntimeReleaseDecisionInput,
  ): RuntimeReleaseDecisionResult {
    if (process.env.SOS_AIOS_LIVE === "1") {
      return fail("LIVE must be OFF", "LIVE_ON");
    }

    const fixture = Boolean(input.fixture);
    const repo = this.repo(fixture);
    const mission = this.registry.get(input.mission_id);
    const plan =
      this.planStore(fixture).get(input.runtime_plan_id) ??
      this.planStore(fixture).getForMission(input.mission_id);

    const already =
      plan != null &&
      repo.hasApprovedPlan(input.mission_id, plan.plan_checksum);

    const validation = validateRuntimeReleaseInput(input, mission, plan, {
      already_decided: already,
    });
    if (!validation.ok) {
      const first = validation.errors[0]!;
      return {
        ok: false,
        release: null,
        mission_status: mission?.status ?? null,
        next_safe_action: null,
        error: first.message,
        error_code: first.code,
        duplicate: first.code === "DUPLICATE_APPROVAL",
      };
    }

    let working = mission!;
    if (working.status === "RUNTIME_PLAN_READY") {
      working = this.applyStatus(
        working,
        "WAITING_RUNTIME_RELEASE",
        fixture,
      );
    }

    const now = new Date().toISOString();
    const reason =
      String(input.reason ?? "").trim() ||
      (input.decision === "APPROVED"
        ? "Founder approved runtime release contract"
        : "");
    const notes = String(input.notes ?? "").trim();

    let revision: RuntimeReleaseRevisionProposal | null = null;
    if (input.decision === "CHANGES_REQUESTED") {
      revision = {
        proposal_id: `rrev-${randomUUID().slice(0, 8)}`,
        mission_id: input.mission_id,
        runtime_plan_id: plan!.runtime_plan_id,
        feedback: notes,
        created_at: now,
        auto_revise: false,
        status: "PROPOSED",
      };
    }

    const resulting = decisionToReleaseStatus(input.decision);
    const shadow = this.shadowStore(fixture).getForMission(working.mission_id);
    const release: RuntimeReleaseDecision = {
      schema_version: RUNTIME_RELEASE_SCHEMA_VERSION,
      release_id: `rrel-${now.slice(0, 10).replace(/-/g, "")}-${randomUUID().slice(0, 8)}`,
      mission_id: working.mission_id,
      mission_version: working.mission_version,
      runtime_plan_id: plan!.runtime_plan_id,
      plan_checksum: plan!.plan_checksum,
      shadow_queue_id: plan!.shadow_queue_id,
      submission_id: plan!.submission_id,
      submission_checksum: plan!.submission_checksum,
      execution_package_checksum: plan!.execution_package_checksum,
      acknowledgement_id: shadow?.acknowledgement_id ?? "",
      acknowledgement_checksum: plan!.acknowledgement_checksum,
      founder_actor: input.actor || RUNTIME_RELEASE_FOUNDER_ACTOR,
      decision: input.decision,
      reason,
      notes,
      created_at: now,
      decided_at: now,
      consumed_at: null,
      status: "RECORDED",
      resulting_status: resulting,
      execution_allowed: false,
      dispatch_allowed: false,
      scheduler_allowed: false,
      queue_insert_allowed: false,
      worker_execution_allowed: false,
      provider_allowed: false,
      publishing_allowed: false,
      live_enabled: false,
      next_safe_action:
        input.decision === "APPROVED"
          ? "Runtime release approved · STOP — not execution authorization"
          : input.decision === "CHANGES_REQUESTED"
            ? "Review runtime plan revision proposal — do not auto-revise"
            : "Runtime release rejected — no automatic regeneration",
      revision_proposal: revision,
      fixture: fixture || undefined,
    };

    repo.appendDecision(release);
    repo.appendEvent({
      event_id: `rrevt-${randomUUID().slice(0, 8)}`,
      event_type: "RELEASE_RECORDED",
      at: now,
      mission_id: release.mission_id,
      release_id: release.release_id,
      runtime_plan_id: release.runtime_plan_id,
      summary: `Recorded ${release.decision}`,
      fixture,
    });

    assertRuntimeReleaseTransition(working.status, resulting);

    const consumed: RuntimeReleaseDecision = {
      ...release,
      status: "CONSUMED",
      consumed_at: new Date().toISOString(),
    };
    repo.appendDecision(consumed);
    repo.appendEvent({
      event_id: `rrevt-${randomUUID().slice(0, 8)}`,
      event_type: "RELEASE_CONSUMED",
      at: consumed.consumed_at!,
      mission_id: release.mission_id,
      release_id: release.release_id,
      runtime_plan_id: release.runtime_plan_id,
      summary: `Consumed → ${resulting}`,
      fixture,
    });

    if (revision) {
      repo.appendEvent({
        event_id: `rrevt-${randomUUID().slice(0, 8)}`,
        event_type: "RELEASE_REVISION_PROPOSED",
        at: consumed.consumed_at!,
        mission_id: release.mission_id,
        release_id: release.release_id,
        runtime_plan_id: release.runtime_plan_id,
        summary: `Revision proposal ${revision.proposal_id} (auto_revise=false)`,
        fixture,
      });
    }

    const from = working.status;
    const updated = this.applyStatus(working, resulting, fixture);
    repo.appendHistory({
      at: consumed.consumed_at!,
      mission_id: updated.mission_id,
      mission_version: updated.mission_version,
      release_id: release.release_id,
      runtime_plan_id: release.runtime_plan_id,
      from_status: from,
      to_status: resulting,
      actor: release.founder_actor,
      note: reason || notes || release.decision,
      fixture,
    });
    repo.appendEvent({
      event_id: `rrevt-${randomUUID().slice(0, 8)}`,
      event_type: "MISSION_STATUS_UPDATED",
      at: consumed.consumed_at!,
      mission_id: updated.mission_id,
      release_id: release.release_id,
      runtime_plan_id: release.runtime_plan_id,
      summary: `${from} → ${resulting}`,
      fixture,
    });

    this.refreshSnapshots(fixture);
    this.reporter.writeMarkdown(repo);

    if (
      consumed.execution_allowed !== false ||
      consumed.dispatch_allowed !== false ||
      consumed.scheduler_allowed !== false ||
      consumed.queue_insert_allowed !== false ||
      consumed.live_enabled !== false ||
      updated.execution_allowed !== false
    ) {
      throw new Error("Safety invariant violated");
    }

    return {
      ok: true,
      release: consumed,
      mission_status: resulting,
      next_safe_action: consumed.next_safe_action,
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
        `Runtime release → ${status} (Agent #170; approval ≠ execution)`,
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

    const pendingM = pool.filter(
      (m) => m.status === "WAITING_RUNTIME_RELEASE",
    );
    const approved = pool.filter(
      (m) => m.status === "RUNTIME_RELEASE_APPROVED",
    );
    const rejected = pool.filter(
      (m) => m.status === "RUNTIME_RELEASE_REJECTED",
    );
    const changes = pool.filter(
      (m) => m.status === "RUNTIME_RELEASE_CHANGES_REQUESTED",
    );
    const focus =
      pendingM[0] ??
      approved[0] ??
      changes[0] ??
      rejected[0] ??
      current ??
      pool[0] ??
      null;

    const plan = focus
      ? this.planStore(fixture).getForMission(focus.mission_id)
      : null;
    const consumed = repo
      .listDecisions()
      .filter((d) => d.status === "CONSUMED");
    const latest = consumed.length ? consumed[consumed.length - 1]! : null;

    const snapshot: RuntimeReleaseSnapshot = {
      schema_version: "runtime-release-snapshot-1.0.0",
      updated_at: new Date().toISOString(),
      mission_id: focus?.mission_id ?? null,
      runtime_plan_id: plan?.runtime_plan_id ?? latest?.runtime_plan_id ?? null,
      plan_checksum: plan?.plan_checksum ?? latest?.plan_checksum ?? null,
      release_status:
        focus?.status === "WAITING_RUNTIME_RELEASE" ||
        focus?.status === "RUNTIME_RELEASE_APPROVED" ||
        focus?.status === "RUNTIME_RELEASE_REJECTED" ||
        focus?.status === "RUNTIME_RELEASE_CHANGES_REQUESTED"
          ? focus.status
          : "NOT_STARTED",
      latest_release_id: latest?.release_id ?? null,
      latest_decision: latest?.decision ?? null,
      execution_allowed: false,
      dispatch_allowed: false,
      scheduler_allowed: false,
      queue_insert_allowed: false,
      worker_execution_allowed: false,
      provider_allowed: false,
      publishing_allowed: false,
      live_enabled: false,
      pending: pendingM.length > 0,
      next_safe_action: latest?.next_safe_action ?? null,
    };
    repo.writeLatest(snapshot);

    repo.writePending(
      pendingM.map((m) => {
        const p = this.planStore(fixture).getForMission(m.mission_id);
        return {
          mission_id: m.mission_id,
          runtime_plan_id: p?.runtime_plan_id ?? "",
          plan_checksum: p?.plan_checksum ?? "",
          status: m.status,
        };
      }),
    );

    const health: RuntimeReleaseHealth = {
      schema_version: "runtime-release-health-1.0.0",
      updated_at: new Date().toISOString(),
      pending_count: pendingM.length,
      approved_count: consumed.filter((d) => d.decision === "APPROVED").length,
      rejected_count: consumed.filter((d) => d.decision === "REJECTED").length,
      changes_requested_count: consumed.filter(
        (d) => d.decision === "CHANGES_REQUESTED",
      ).length,
      decision_count: consumed.length,
      execution_allowed: false,
      dispatch_allowed: false,
      scheduler_allowed: false,
      queue_insert_allowed: false,
      worker_execution_allowed: false,
      provider_allowed: false,
      publishing_allowed: false,
      live_enabled: false,
      live: false,
      mode: "release_gate_only",
      status: pendingM.length || consumed.length ? "healthy" : "idle",
    };
    repo.writeHealth(health);
  }
}

function fail(
  error: string,
  error_code: string,
  mission_status: string | null = null,
): RuntimeReleaseDecisionResult {
  return {
    ok: false,
    release: null,
    mission_status,
    next_safe_action: null,
    error,
    error_code,
  };
}

export function createRuntimeReleaseManager(
  repoRoot?: string,
): RuntimeReleaseManager {
  return new RuntimeReleaseManager(repoRoot);
}
