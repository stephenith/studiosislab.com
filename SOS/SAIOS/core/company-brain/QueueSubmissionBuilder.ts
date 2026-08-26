/**
 * QueueSubmissionBuilder — builds immutable shadow submission packages (Agent #167).
 * Never inserts into the runtime queue. Never executes.
 */
import { randomUUID } from "node:crypto";
import { MissionRegistry } from "./MissionRegistry.js";
import { resolveRepoRoot } from "./PlanRepository.js";
import { ExecutionPackageBuilder } from "./ExecutionPackageBuilder.js";
import { ExecutionPackageAckRepository } from "./ExecutionPackageAckRepository.js";
import { QueueSubmissionRepository } from "./QueueSubmissionRepository.js";
import { QueueSubmissionReporter } from "./QueueSubmissionReporter.js";
import {
  computeAcknowledgementChecksum,
  computeSubmissionChecksum,
  validateQueueSubmissionPackage,
  validateQueueSubmissionReviewInput,
  validateSubmissionPrerequisites,
} from "./QueueSubmissionValidator.js";
import {
  assertQueueSubmissionTransition,
  decisionToSubmissionStatus,
} from "./QueueSubmissionStateMachine.js";
import type { MissionContract, MissionLifecycleStatus } from "./mission-types.js";
import type {
  QueueSubmissionBuildResult,
  QueueSubmissionHealth,
  QueueSubmissionPackage,
  QueueSubmissionReviewInput,
  QueueSubmissionReviewResult,
  QueueSubmissionSnapshot,
} from "./queue-submission-types.js";
import {
  QUEUE_SUBMISSION_FOUNDER_ACTOR,
  QUEUE_SUBMISSION_SCHEMA_VERSION,
} from "./queue-submission-types.js";

export class QueueSubmissionBuilder {
  readonly registry: MissionRegistry;
  readonly packages: ExecutionPackageBuilder;
  readonly reporter: QueueSubmissionReporter;
  readonly root: string;

  constructor(repoRoot?: string) {
    this.root = repoRoot ?? resolveRepoRoot();
    this.registry = new MissionRegistry(this.root);
    this.packages = new ExecutionPackageBuilder(this.root);
    this.reporter = new QueueSubmissionReporter();
  }

  private repo(fixture?: boolean): QueueSubmissionRepository {
    return new QueueSubmissionRepository(this.root, {
      fixture: Boolean(fixture),
    });
  }

  private ackRepo(fixture?: boolean): ExecutionPackageAckRepository {
    return new ExecutionPackageAckRepository(this.root, {
      fixture: Boolean(fixture),
    });
  }

  getForMission(
    missionId: string,
    fixture?: boolean,
  ): QueueSubmissionPackage | null {
    const fromFixture = this.repo(true).getForMission(missionId);
    if (fixture) return fromFixture;
    return this.repo(false).getForMission(missionId) ?? fromFixture;
  }

  /**
   * PACKAGE_ACKNOWLEDGED → build immutable shadow package → WAITING_QUEUE_SUBMISSION.
   */
  buildForMission(
    missionId: string,
    opts?: { fixture?: boolean },
  ): QueueSubmissionBuildResult {
    if (process.env.SOS_AIOS_LIVE === "1") {
      return failBuild("LIVE must be OFF", "LIVE_ON");
    }

    const fixture = Boolean(opts?.fixture);
    const mission = this.registry.get(missionId);
    if (!mission) {
      return failBuild("Mission not found", "MISSION_NOT_FOUND");
    }

    const execPkg = this.packages.getForMission(missionId);
    const acks = this.ackRepo(fixture)
      .listAcknowledgements()
      .filter(
        (a) =>
          a.mission_id === missionId &&
          a.decision === "ACKNOWLEDGED" &&
          a.status === "CONSUMED",
      );
    const ack = acks.length ? acks[acks.length - 1]! : null;

    const store = this.repo(fixture);
    const already =
      execPkg != null &&
      store.hasSubmissionForPackage(
        missionId,
        execPkg.package_id,
        execPkg.checksum,
      );

    if (
      already &&
      (mission.status === "WAITING_QUEUE_SUBMISSION" ||
        mission.status === "QUEUE_SUBMISSION_READY" ||
        mission.status === "QUEUE_SUBMISSION_BLOCKED")
    ) {
      const existing = store.getForMission(missionId);
      return {
        ok: true,
        package: existing,
        mission_status: mission.status,
        next_safe_action:
          existing?.next_safe_action ??
          "Shadow submission package already exists · STOP — do not enqueue",
        artifact_paths: [],
        duplicate: true,
      };
    }

    const prereq = validateSubmissionPrerequisites(mission, execPkg, ack, {
      already_submitted: already,
    });
    if (!prereq.ok) {
      const first = prereq.errors[0]!;
      return {
        ok: false,
        package: null,
        mission_status: mission.status,
        next_safe_action: null,
        artifact_paths: [],
        error: first.message,
        error_code: first.code,
        duplicate: first.code === "DUPLICATE_SUBMISSION",
      };
    }

    if (mission.status !== "PACKAGE_ACKNOWLEDGED") {
      return failBuild(
        `Mission must be PACKAGE_ACKNOWLEDGED to build submission (got ${mission.status})`,
        "INVALID_LIFECYCLE",
        mission.status,
      );
    }

    const acknowledgement_checksum = computeAcknowledgementChecksum(ack!);
    const now = new Date().toISOString();
    const draft: Omit<QueueSubmissionPackage, "submission_checksum"> = {
      schema_version: QUEUE_SUBMISSION_SCHEMA_VERSION,
      submission_id: `qsub-${now.slice(0, 10).replace(/-/g, "")}-${randomUUID().slice(0, 8)}`,
      mission_id: mission.mission_id,
      mission_version: mission.mission_version,
      execution_id: execPkg!.execution_id,
      execution_package_id: execPkg!.package_id,
      execution_package_version: execPkg!.package_version,
      execution_package_checksum: execPkg!.checksum,
      acknowledgement_id: ack!.acknowledgement_id,
      acknowledgement_checksum,
      department: execPkg!.department,
      priority: execPkg!.priority,
      objective: execPkg!.objective,
      worker_inventory: [...execPkg!.required_workers],
      skill_inventory: [...execPkg!.required_skills],
      provider_inventory: [...execPkg!.required_models],
      tool_inventory: [...execPkg!.required_tools],
      dependency_graph: execPkg!.dependency_graph,
      execution_graph: execPkg!.execution_graph,
      worker_graph: execPkg!.worker_graph,
      estimated_cost_usd: execPkg!.estimated_cost_usd,
      estimated_cost_note: execPkg!.estimated_cost_note,
      estimated_duration: execPkg!.estimated_duration,
      rollback_plan: [...execPkg!.rollback_points],
      quality_gates: [...execPkg!.quality_gates],
      security_state: {
        live: false,
        execution_allowed: false,
        queue_insert_allowed: false,
        publishing_allowed: false,
        provider_calls: false,
        scheduler_active: false,
        runtime_queue_untouched: true,
        note: "Shadow submission only — runtime Queue is untouched",
      },
      risk_level: execPkg!.risk_summary.risk_level,
      warnings: [
        ...execPkg!.risk_summary.warnings,
        "Queue insert disabled",
        "Execution disabled",
        "Publishing disabled",
        "LIVE OFF",
      ],
      dry_run: true,
      submission_allowed: false,
      queue_insert_allowed: false,
      execution_allowed: false,
      publishing_allowed: false,
      created_at: now,
      created_by: "company_brain",
      next_safe_action:
        "Inspect shadow queue submission package · STOP — do not enqueue",
      submission_still_blocked_reason:
        "Shadow mode only — queue_insert_allowed=false · runtime Queue untouched",
      fixture: fixture || undefined,
    };

    const pkg: QueueSubmissionPackage = {
      ...draft,
      submission_checksum: computeSubmissionChecksum(draft),
    };

    const schema = validateQueueSubmissionPackage(pkg);
    if (!schema.ok) {
      const first = schema.errors[0]!;
      store.appendEvent({
        event_id: `qevt-${randomUUID().slice(0, 8)}`,
        event_type: "SUBMISSION_REJECTED",
        at: now,
        mission_id: missionId,
        submission_id: pkg.submission_id,
        summary: first.message,
        fixture,
      });
      return failBuild(first.message, first.code, mission.status);
    }

    const paths = store.save(pkg);
    store.appendEvent({
      event_id: `qevt-${randomUUID().slice(0, 8)}`,
      event_type: "SUBMISSION_BUILT",
      at: now,
      mission_id: missionId,
      submission_id: pkg.submission_id,
      summary: `Built shadow submission ${pkg.submission_id}`,
      fixture,
    });
    store.appendEvent({
      event_id: `qevt-${randomUUID().slice(0, 8)}`,
      event_type: "SUBMISSION_VALIDATED",
      at: now,
      mission_id: missionId,
      submission_id: pkg.submission_id,
      summary: `Validated checksum ${pkg.submission_checksum.slice(0, 12)}…`,
      fixture,
    });

    assertQueueSubmissionTransition(
      "PACKAGE_ACKNOWLEDGED",
      "WAITING_QUEUE_SUBMISSION",
    );
    const updated = this.applyStatus(
      mission,
      "WAITING_QUEUE_SUBMISSION",
      fixture,
    );
    store.appendHistory({
      at: now,
      mission_id: updated.mission_id,
      mission_version: updated.mission_version,
      submission_id: pkg.submission_id,
      from_status: "PACKAGE_ACKNOWLEDGED",
      to_status: "WAITING_QUEUE_SUBMISSION",
      actor: QUEUE_SUBMISSION_FOUNDER_ACTOR,
      note: "Shadow queue submission package generated — not submitted",
      fixture,
    });
    store.appendEvent({
      event_id: `qevt-${randomUUID().slice(0, 8)}`,
      event_type: "MISSION_STATUS_UPDATED",
      at: now,
      mission_id: updated.mission_id,
      submission_id: pkg.submission_id,
      summary: "PACKAGE_ACKNOWLEDGED → WAITING_QUEUE_SUBMISSION",
      fixture,
    });

    this.refreshSnapshots(fixture);
    this.reporter.writeMarkdown(store);

    if (
      updated.execution_allowed !== false ||
      updated.queue_admission_allowed !== false ||
      updated.publishing_allowed !== false ||
      pkg.queue_insert_allowed !== false ||
      pkg.submission_allowed !== false
    ) {
      throw new Error("Safety invariant violated");
    }

    return {
      ok: true,
      package: pkg,
      mission_status: updated.status,
      next_safe_action: pkg.next_safe_action,
      artifact_paths: paths,
    };
  }

  /**
   * WAITING_QUEUE_SUBMISSION → QUEUE_SUBMISSION_READY | QUEUE_SUBMISSION_BLOCKED.
   * Still never inserts into the runtime queue.
   */
  recordReview(input: QueueSubmissionReviewInput): QueueSubmissionReviewResult {
    if (process.env.SOS_AIOS_LIVE === "1") {
      return failReview("LIVE must be OFF", "LIVE_ON");
    }

    const fixture = Boolean(input.fixture);
    const store = this.repo(fixture);
    const mission = this.registry.get(input.mission_id);
    const pkg =
      store.get(input.submission_id) ??
      store.getForMission(input.mission_id);

    const validation = validateQueueSubmissionReviewInput(input, mission, pkg);
    if (!validation.ok) {
      const first = validation.errors[0]!;
      return {
        ok: false,
        package: pkg,
        mission_status: mission?.status ?? null,
        next_safe_action: null,
        error: first.message,
        error_code: first.code,
      };
    }

    const target = decisionToSubmissionStatus(input.decision);
    assertQueueSubmissionTransition(mission!.status, target);
    const now = new Date().toISOString();
    const reason =
      String(input.reason ?? "").trim() ||
      (input.decision === "CONFIRM_SHADOW_PACKAGE"
        ? "Founder confirmed shadow submission package"
        : "");

    store.appendEvent({
      event_id: `qevt-${randomUUID().slice(0, 8)}`,
      event_type: "REVIEW_RECORDED",
      at: now,
      mission_id: input.mission_id,
      submission_id: pkg!.submission_id,
      summary: `${input.decision} · ${reason || input.notes || ""}`.trim(),
      fixture,
    });

    const from = mission!.status;
    const updated = this.applyStatus(mission!, target, fixture);
    store.appendHistory({
      at: now,
      mission_id: updated.mission_id,
      mission_version: updated.mission_version,
      submission_id: pkg!.submission_id,
      from_status: from,
      to_status: target,
      actor: input.actor,
      note: reason || String(input.notes ?? ""),
      fixture,
    });
    store.appendEvent({
      event_id: `qevt-${randomUUID().slice(0, 8)}`,
      event_type: "MISSION_STATUS_UPDATED",
      at: now,
      mission_id: updated.mission_id,
      submission_id: pkg!.submission_id,
      summary: `${from} → ${target}`,
      fixture,
    });

    this.refreshSnapshots(fixture);
    this.reporter.writeMarkdown(store);

    return {
      ok: true,
      package: pkg,
      mission_status: target,
      next_safe_action:
        target === "QUEUE_SUBMISSION_READY"
          ? "Shadow submission marked ready · STOP — queue_insert_allowed remains false"
          : "Shadow submission blocked · STOP — do not enqueue",
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
        `Queue submission status → ${status} (Agent #167; shadow only — no enqueue)`,
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
      (m) => m.status === "WAITING_QUEUE_SUBMISSION",
    );
    const ready = pool.filter((m) => m.status === "QUEUE_SUBMISSION_READY");
    const blocked = pool.filter((m) => m.status === "QUEUE_SUBMISSION_BLOCKED");
    const focus =
      pendingM[0] ?? ready[0] ?? blocked[0] ?? current ?? pool[0] ?? null;
    const pkg = focus ? repo.getForMission(focus.mission_id) : null;
    const latestPkg = pkg ?? repo.loadLatestPackage();

    const snapshot: QueueSubmissionSnapshot = {
      schema_version: "queue-submission-snapshot-1.0.0",
      updated_at: new Date().toISOString(),
      mission_id: focus?.mission_id ?? latestPkg?.mission_id ?? null,
      submission_id: latestPkg?.submission_id ?? null,
      submission_checksum: latestPkg?.submission_checksum ?? null,
      submission_status:
        focus?.status === "WAITING_QUEUE_SUBMISSION" ||
        focus?.status === "QUEUE_SUBMISSION_READY" ||
        focus?.status === "QUEUE_SUBMISSION_BLOCKED"
          ? focus.status
          : "NOT_STARTED",
      execution_package_id: latestPkg?.execution_package_id ?? null,
      acknowledgement_id: latestPkg?.acknowledgement_id ?? null,
      dry_run: true,
      submission_allowed: false,
      queue_insert_allowed: false,
      execution_allowed: false,
      publishing_allowed: false,
      pending: pendingM.length > 0,
      next_safe_action: latestPkg?.next_safe_action ?? null,
    };
    repo.writeLatest(snapshot);

    repo.writePending(
      pendingM.map((m) => {
        const p = repo.getForMission(m.mission_id);
        return {
          mission_id: m.mission_id,
          submission_id: p?.submission_id ?? "",
          submission_checksum: p?.submission_checksum ?? "",
          status: m.status,
        };
      }),
    );

    const health: QueueSubmissionHealth = {
      schema_version: "queue-submission-health-1.0.0",
      updated_at: new Date().toISOString(),
      pending_count: pendingM.length,
      ready_count: ready.length,
      blocked_count: blocked.length,
      package_count: repo.list().length,
      dry_run: true,
      submission_allowed: false,
      queue_insert_allowed: false,
      execution_allowed: false,
      publishing_allowed: false,
      live: false,
      mode: "shadow_submission_only",
      status:
        pendingM.length || ready.length || blocked.length || repo.list().length
          ? "healthy"
          : "idle",
    };
    repo.writeHealth(health);
  }
}

function failBuild(
  error: string,
  error_code: string,
  mission_status: MissionLifecycleStatus | null = null,
): QueueSubmissionBuildResult {
  return {
    ok: false,
    package: null,
    mission_status,
    next_safe_action: null,
    artifact_paths: [],
    error,
    error_code,
  };
}

function failReview(
  error: string,
  error_code: string,
  mission_status: MissionLifecycleStatus | null = null,
): QueueSubmissionReviewResult {
  return {
    ok: false,
    package: null,
    mission_status,
    next_safe_action: null,
    error,
    error_code,
  };
}

export function createQueueSubmissionBuilder(
  repoRoot?: string,
): QueueSubmissionBuilder {
  return new QueueSubmissionBuilder(repoRoot);
}
