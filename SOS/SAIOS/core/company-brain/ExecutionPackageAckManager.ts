/**
 * ExecutionPackageAckManager — founder package acknowledgement (Agent #166).
 * Never enqueues, executes, dispatches, or publishes.
 */
import { randomUUID } from "node:crypto";
import { MissionRegistry } from "./MissionRegistry.js";
import { resolveRepoRoot } from "./PlanRepository.js";
import { ExecutionPackageBuilder } from "./ExecutionPackageBuilder.js";
import { ExecutionPackageRepository } from "./ExecutionPackageRepository.js";
import { ExecutionPackageAckRepository } from "./ExecutionPackageAckRepository.js";
import { ExecutionPackageAckReporter } from "./ExecutionPackageAckReporter.js";
import { createExecutionPackageAcknowledgement } from "./ExecutionPackageAcknowledgement.js";
import { validatePackageAckInput } from "./ExecutionPackageAckValidator.js";
import {
  assertPackageAckTransition,
  decisionToAckStatus,
} from "./ExecutionPackageAckStateMachine.js";
import type { MissionContract, MissionLifecycleStatus } from "./mission-types.js";
import type {
  ExecutionPackageAcknowledgement,
  PackageAckDecisionInput,
  PackageAckDecisionResult,
  PackageAckHealth,
  PackageAckSnapshot,
} from "./execution-package-ack-types.js";
import { PACKAGE_ACK_FOUNDER_ACTOR } from "./execution-package-ack-types.js";

export class ExecutionPackageAckManager {
  readonly registry: MissionRegistry;
  readonly packages: ExecutionPackageBuilder;
  readonly reporter: ExecutionPackageAckReporter;
  readonly root: string;

  constructor(repoRoot?: string) {
    this.root = repoRoot ?? resolveRepoRoot();
    this.registry = new MissionRegistry(this.root);
    this.packages = new ExecutionPackageBuilder(this.root);
    this.reporter = new ExecutionPackageAckReporter();
  }

  private repo(fixture?: boolean): ExecutionPackageAckRepository {
    return new ExecutionPackageAckRepository(this.root, {
      fixture: Boolean(fixture),
    });
  }

  private packageStore(fixture?: boolean): ExecutionPackageRepository {
    return new ExecutionPackageRepository(this.root, {
      fixture: Boolean(fixture),
    });
  }

  openForAcknowledgement(
    missionId: string,
    opts?: { fixture?: boolean },
  ): PackageAckDecisionResult {
    if (process.env.SOS_AIOS_LIVE === "1") {
      return fail("LIVE must be OFF", "LIVE_ON");
    }
    const mission = this.registry.get(missionId);
    if (!mission) return fail("Mission not found", "MISSION_NOT_FOUND");

    let pkg = this.packages.getForMission(missionId);
    if (!pkg && mission.status === "READY_FOR_QUEUE") {
      const built = this.packages.buildForMission(missionId, {
        fixture: opts?.fixture,
        skip_ack_transition: true,
      });
      if (!built.ok || !built.package) {
        return fail(
          built.error ?? "Failed to build package",
          built.error_code ?? "PACKAGE_BUILD_FAILED",
          mission.status,
        );
      }
      pkg = built.package;
    }
    if (!pkg) {
      return fail(
        "Execution package not found",
        "MISSING_PACKAGE",
        mission.status,
      );
    }

    let current = mission;
    if (mission.status === "READY_FOR_QUEUE") {
      assertPackageAckTransition(
        "READY_FOR_QUEUE",
        "WAITING_PACKAGE_ACKNOWLEDGEMENT",
      );
      current = this.applyStatus(
        mission,
        "WAITING_PACKAGE_ACKNOWLEDGEMENT",
        opts?.fixture,
      );
      const r = this.repo(opts?.fixture);
      r.appendEvent({
        event_id: `aevt-${randomUUID().slice(0, 8)}`,
        event_type: "ACK_REVIEW_OPENED",
        at: new Date().toISOString(),
        mission_id: missionId,
        acknowledgement_id: null,
        package_id: pkg.package_id,
        summary: `Opened package acknowledgement for ${pkg.package_id} v${pkg.package_version}`,
        fixture: opts?.fixture,
      });
      r.appendHistory({
        at: new Date().toISOString(),
        mission_id: missionId,
        mission_version: current.mission_version,
        package_id: pkg.package_id,
        from_status: "READY_FOR_QUEUE",
        to_status: "WAITING_PACKAGE_ACKNOWLEDGEMENT",
        acknowledgement_id: null,
        actor: PACKAGE_ACK_FOUNDER_ACTOR,
        note: "Waiting founder package acknowledgement",
        fixture: opts?.fixture,
      });
      this.refreshSnapshots(opts?.fixture);
    } else if (mission.status !== "WAITING_PACKAGE_ACKNOWLEDGEMENT") {
      return fail(
        `Mission must be READY_FOR_QUEUE or WAITING_PACKAGE_ACKNOWLEDGEMENT (got ${mission.status})`,
        "INVALID_LIFECYCLE_TRANSITION",
        mission.status,
      );
    }

    return {
      ok: true,
      acknowledgement: null,
      mission_status: current.status,
      next_safe_action:
        "Acknowledge exact package checksum · acknowledgement is not execution approval",
    };
  }

  recordDecision(input: PackageAckDecisionInput): PackageAckDecisionResult {
    if (process.env.SOS_AIOS_LIVE === "1") {
      return fail("LIVE must be OFF", "LIVE_ON");
    }

    const fixture = Boolean(input.fixture);
    const repo = this.repo(fixture);
    const mission = this.registry.get(input.mission_id);
    const currentPkg =
      this.packageStore(fixture).get(input.package_id) ??
      this.packages.getForMission(input.mission_id);

    const already = currentPkg
      ? repo.hasAcknowledgedVersion(
          input.mission_id,
          input.execution_package_version,
        )
      : false;

    const validation = validatePackageAckInput(input, mission, currentPkg, {
      already_acknowledged: already,
    });
    if (!validation.ok) {
      const first = validation.errors[0]!;
      return {
        ok: false,
        acknowledgement: null,
        mission_status: mission?.status ?? null,
        next_safe_action: null,
        error: first.message,
        error_code: first.code,
        duplicate: first.code === "DUPLICATE_ACKNOWLEDGEMENT",
      };
    }

    let working = mission!;
    if (working.status === "READY_FOR_QUEUE") {
      working = this.applyStatus(
        working,
        "WAITING_PACKAGE_ACKNOWLEDGEMENT",
        fixture,
      );
    }

    const reason =
      String(input.reason ?? "").trim() ||
      (input.decision === "ACKNOWLEDGED"
        ? "Founder acknowledged exact execution package"
        : "");
    const notes = String(input.notes ?? "").trim();

    const ack = createExecutionPackageAcknowledgement({
      ...input,
      execution_id: currentPkg!.execution_id,
      reason,
      notes,
      fixture,
    });

    repo.appendAcknowledgement(ack);
    repo.appendEvent({
      event_id: `aevt-${randomUUID().slice(0, 8)}`,
      event_type: "ACK_RECORDED",
      at: ack.created_at,
      mission_id: ack.mission_id,
      acknowledgement_id: ack.acknowledgement_id,
      package_id: ack.package_id,
      summary: `Recorded ${ack.decision}`,
      fixture,
    });

    const target = decisionToAckStatus(input.decision);
    assertPackageAckTransition(working.status, target);

    const consumed: ExecutionPackageAcknowledgement = {
      ...ack,
      status: "CONSUMED",
      consumed_at: new Date().toISOString(),
      acknowledged_at:
        input.decision === "ACKNOWLEDGED"
          ? ack.acknowledged_at ?? new Date().toISOString()
          : null,
    };
    repo.appendAcknowledgement(consumed);
    repo.appendEvent({
      event_id: `aevt-${randomUUID().slice(0, 8)}`,
      event_type: "ACK_CONSUMED",
      at: consumed.consumed_at!,
      mission_id: ack.mission_id,
      acknowledgement_id: ack.acknowledgement_id,
      package_id: ack.package_id,
      summary: `Consumed → ${target}`,
      fixture,
    });

    if (ack.revision_proposal) {
      repo.appendEvent({
        event_id: `aevt-${randomUUID().slice(0, 8)}`,
        event_type: "PACKAGE_REVISION_PROPOSED",
        at: consumed.consumed_at!,
        mission_id: ack.mission_id,
        acknowledgement_id: ack.acknowledgement_id,
        package_id: ack.package_id,
        summary: `Revision proposal ${ack.revision_proposal.proposal_id} (auto_revise=false)`,
        fixture,
      });
    }

    const from = working.status;
    const updated = this.applyStatus(working, target, fixture);
    repo.appendHistory({
      at: consumed.consumed_at!,
      mission_id: updated.mission_id,
      mission_version: updated.mission_version,
      package_id: ack.package_id,
      from_status: from,
      to_status: target,
      acknowledgement_id: ack.acknowledgement_id,
      actor: ack.founder_actor,
      note: reason || notes || ack.decision,
      fixture,
    });
    repo.appendEvent({
      event_id: `aevt-${randomUUID().slice(0, 8)}`,
      event_type: "MISSION_STATUS_UPDATED",
      at: consumed.consumed_at!,
      mission_id: updated.mission_id,
      acknowledgement_id: ack.acknowledgement_id,
      package_id: ack.package_id,
      summary: `${from} → ${target}`,
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
      acknowledgement: consumed,
      mission_status: target,
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
        `Package acknowledgement status → ${status} (Agent #166; no enqueue/execute)`,
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
      (m) => m.status === "WAITING_PACKAGE_ACKNOWLEDGEMENT",
    );
    const acked = pool.filter((m) => m.status === "PACKAGE_ACKNOWLEDGED");
    const changes = pool.filter(
      (m) => m.status === "PACKAGE_CHANGES_REQUESTED",
    );
    const rejected = pool.filter((m) => m.status === "PACKAGE_REJECTED");
    const focus =
      pendingM[0] ??
      acked[0] ??
      changes[0] ??
      rejected[0] ??
      current ??
      pool[0] ??
      null;

    const pkg = focus ? this.packages.getForMission(focus.mission_id) : null;
    const consumed = repo
      .listAcknowledgements()
      .filter((a) => a.status === "CONSUMED");
    const latest = consumed.length ? consumed[consumed.length - 1]! : null;

    const snapshot: PackageAckSnapshot = {
      schema_version: "execution-package-ack-snapshot-1.0.0",
      updated_at: new Date().toISOString(),
      mission_id: focus?.mission_id ?? null,
      package_id: pkg?.package_id ?? latest?.package_id ?? null,
      package_version:
        pkg?.package_version ?? latest?.execution_package_version ?? null,
      checksum: pkg?.checksum ?? latest?.execution_package_checksum ?? null,
      ack_status:
        focus?.status === "WAITING_PACKAGE_ACKNOWLEDGEMENT" ||
        focus?.status === "PACKAGE_ACKNOWLEDGED" ||
        focus?.status === "PACKAGE_CHANGES_REQUESTED" ||
        focus?.status === "PACKAGE_REJECTED"
          ? focus.status
          : "NOT_STARTED",
      latest_acknowledgement_id: latest?.acknowledgement_id ?? null,
      latest_decision: latest?.decision ?? null,
      execution_allowed: false,
      queue_enqueue_allowed: false,
      publishing_allowed: false,
      pending: pendingM.length > 0,
      next_safe_action: latest?.next_safe_action ?? null,
    };
    repo.writeLatest(snapshot);

    repo.writePending(
      pendingM.map((m) => {
        const p = this.packages.getForMission(m.mission_id);
        return {
          mission_id: m.mission_id,
          package_id: p?.package_id ?? "",
          package_version: p?.package_version ?? 0,
          checksum: p?.checksum ?? "",
          status: m.status,
        };
      }),
    );

    const health: PackageAckHealth = {
      schema_version: "execution-package-ack-health-1.0.0",
      updated_at: new Date().toISOString(),
      pending_count: pendingM.length,
      acknowledged_count: consumed.filter((a) => a.decision === "ACKNOWLEDGED")
        .length,
      changes_requested_count: consumed.filter(
        (a) => a.decision === "CHANGES_REQUESTED",
      ).length,
      rejected_count: consumed.filter((a) => a.decision === "REJECTED").length,
      acknowledgement_count: consumed.length,
      execution_allowed: false,
      queue_enqueue_allowed: false,
      publishing_allowed: false,
      live: false,
      mode: "acknowledgement_only",
      status: pendingM.length || consumed.length ? "healthy" : "idle",
    };
    repo.writeHealth(health);
  }
}

function fail(
  error: string,
  error_code: string,
  mission_status: MissionLifecycleStatus | null = null,
): PackageAckDecisionResult {
  return {
    ok: false,
    acknowledgement: null,
    mission_status,
    next_safe_action: null,
    error,
    error_code,
  };
}

export function createExecutionPackageAckManager(
  repoRoot?: string,
): ExecutionPackageAckManager {
  return new ExecutionPackageAckManager(repoRoot);
}
