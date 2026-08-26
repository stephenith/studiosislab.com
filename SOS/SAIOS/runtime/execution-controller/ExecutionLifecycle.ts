/**
 * ExecutionLifecycle — controller-local lifecycle orchestration (Agent #179).
 * Design/scaffold only. Never mutates MissionLifecycleStatus beyond SYSTEM_READY.
 * Never spawns workers, touches queue/scheduler/providers, or enables LIVE.
 */
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { MissionRegistry } from "../../core/company-brain/MissionRegistry.js";
import { RuntimePlanRepository } from "../planner/RuntimePlanRepository.js";
import { RuntimeReleaseRepository } from "../runtime-release/RuntimeReleaseRepository.js";
import { SystemReadinessRepository } from "../system-readiness/SystemReadinessRepository.js";
import { createExecutionControllerRecord } from "./ExecutionAuthorization.js";
import { ExecutionControllerRepository } from "./ExecutionControllerRepository.js";
import { ExecutionLifecycleReporter } from "./ExecutionLifecycleReporter.js";
import {
  validateExecutionControllerOpen,
  validateExecutionControllerReview,
} from "./ExecutionLifecycleValidator.js";
import {
  assertExecutionControllerTransition,
} from "./ExecutionControllerStateMachine.js";
import type {
  ExecutionControllerHealth,
  ExecutionControllerLifecycleStatus,
  ExecutionControllerRecord,
  ExecutionControllerResult,
  ExecutionControllerReviewInput,
  ExecutionControllerSnapshot,
} from "./ExecutionControllerTypes.js";
import {
  EXECUTION_CONTROLLER_FOUNDER_ACTOR,
  EXECUTION_CONTROLLER_SAFETY_FLAGS_LOCKED,
} from "./ExecutionControllerTypes.js";

function resolveRepoRoot(fromDir = import.meta.dirname): string {
  return resolve(fromDir, "../../../..");
}

function fail(
  error: string,
  error_code: string,
  mission_status: string | null = null,
): ExecutionControllerResult {
  return {
    ok: false,
    record: null,
    mission_status,
    next_safe_action: "Fix blockers · scaffold only · execution remains impossible",
    error,
    error_code,
  };
}

export class ExecutionLifecycle {
  readonly registry: MissionRegistry;
  readonly reporter: ExecutionLifecycleReporter;
  readonly root: string;

  constructor(repoRoot?: string) {
    this.root = repoRoot ?? resolveRepoRoot();
    this.registry = new MissionRegistry(this.root);
    this.reporter = new ExecutionLifecycleReporter();
  }

  private repo(fixture?: boolean): ExecutionControllerRepository {
    return new ExecutionControllerRepository(this.root, {
      fixture: Boolean(fixture),
    });
  }

  getForMission(missionId: string, fixture?: boolean) {
    const fromFixture = this.repo(true).getForMission(missionId);
    if (fixture) return fromFixture;
    return this.repo(false).getForMission(missionId) ?? fromFixture;
  }

  /**
   * SYSTEM_READY (mission) → WAITING_EXECUTION_AUTHORIZATION (controller-local).
   * Does not change mission status.
   */
  openForAuthorization(
    missionId: string,
    opts?: { fixture?: boolean },
  ): ExecutionControllerResult {
    if (process.env.SOS_AIOS_LIVE === "1") {
      return fail("LIVE must be OFF", "LIVE_ON");
    }

    const fixture = Boolean(opts?.fixture);
    const store = this.repo(fixture);
    const mission = this.registry.get(missionId);
    const plan = new RuntimePlanRepository(this.root, {
      fixture,
    }).getForMission(missionId);
    const readiness = new SystemReadinessRepository(this.root, {
      fixture,
    }).getForMission(missionId);
    const releases = new RuntimeReleaseRepository(this.root, { fixture })
      .listDecisions()
      .filter(
        (d) =>
          d.mission_id === missionId &&
          d.decision === "APPROVED" &&
          d.status === "CONSUMED",
      );
    const release = releases.length ? releases[releases.length - 1]! : null;

    const already =
      readiness != null &&
      store.hasReadyController(
        missionId,
        readiness.checksum_chain.certificate_checksum,
      );

    const existing = store.getForMission(missionId);
    if (
      existing &&
      existing.controller_status === "WAITING_EXECUTION_AUTHORIZATION"
    ) {
      return {
        ok: true,
        record: existing,
        mission_status: mission?.status ?? "SYSTEM_READY",
        next_safe_action: existing.next_safe_action,
      };
    }

    const validation = validateExecutionControllerOpen(
      mission,
      plan,
      release,
      readiness,
      { already_ready: already },
    );
    if (!validation.ok) {
      const first = validation.errors[0]!;
      return fail(
        first.message,
        first.code,
        mission?.status ?? null,
      );
    }

    const record = createExecutionControllerRecord({
      mission_id: mission!.mission_id,
      mission_version: mission!.mission_version,
      runtime_plan_id: plan!.runtime_plan_id,
      runtime_release_id: release!.release_id,
      system_readiness_id: readiness!.certificate_id,
      department: plan!.department ?? "unknown",
      controller_status: "WAITING_EXECUTION_AUTHORIZATION",
      checksum_chain: {
        submission_checksum:
          plan!.submission_checksum ??
          readiness!.checksum_chain.submission_checksum,
        execution_package_checksum:
          plan!.execution_package_checksum ??
          readiness!.checksum_chain.execution_package_checksum,
        acknowledgement_checksum:
          plan!.acknowledgement_checksum ??
          readiness!.checksum_chain.acknowledgement_checksum,
        shadow_queue_checksum:
          readiness!.checksum_chain.shadow_submission_checksum,
        plan_checksum: plan!.plan_checksum,
        release_checksum: release!.plan_checksum,
        readiness_checksum: readiness!.checksum_chain.certificate_checksum,
      },
      worker_inventory: {
        declared: plan!.worker_order ?? [],
        resolved: [],
        missing: [],
        informational: true,
        invoked: false,
      },
      estimated_cost_usd: plan!.estimated_cost_usd ?? null,
      estimated_duration_ms: null,
      next_safe_action:
        "Authorize execution-controller scaffold · does not enable execution",
      fixture,
    });

    store.save(record);
    const now = new Date().toISOString();
    store.appendEvent({
      event_id: `xcevt-${randomUUID().slice(0, 8)}`,
      event_type: "CONTROLLER_OPENED",
      at: now,
      mission_id: missionId,
      controller_id: record.controller_id,
      summary: `Opened controller scaffold ${record.controller_id}`,
      fixture,
    });
    store.appendHistory({
      history_id: `xchist-${randomUUID().slice(0, 8)}`,
      at: now,
      mission_id: missionId,
      from_status: "SYSTEM_READY",
      to_status: "WAITING_EXECUTION_AUTHORIZATION",
      actor: EXECUTION_CONTROLLER_FOUNDER_ACTOR,
      reason: "Controller-local open · mission remains SYSTEM_READY",
      fixture,
    });

    this.refreshSnapshots(fixture);
    this.reporter.writeMarkdown(store);
    this.assertSafety(record);

    return {
      ok: true,
      record,
      mission_status: mission!.status,
      next_safe_action: record.next_safe_action,
    };
  }

  /**
   * Founder scaffold authorization only.
   * Advances controller-local:
   * WAITING_EXECUTION_AUTHORIZATION → EXECUTION_AUTHORIZED
   * → WAITING_EXECUTION_CONTROLLER → EXECUTION_CONTROLLER_READY → STOP
   */
  recordReview(input: ExecutionControllerReviewInput): ExecutionControllerResult {
    if (process.env.SOS_AIOS_LIVE === "1") {
      return fail("LIVE must be OFF", "LIVE_ON");
    }

    const fixture = Boolean(input.fixture);
    const store = this.repo(fixture);
    const mission = this.registry.get(input.mission_id);
    let existing =
      (input.controller_id
        ? store.get(input.controller_id)
        : null) ?? store.getForMission(input.mission_id);

    const readiness = new SystemReadinessRepository(this.root, {
      fixture,
    }).getForMission(input.mission_id);
    const already =
      readiness != null &&
      store.hasReadyController(
        input.mission_id,
        readiness.checksum_chain.certificate_checksum,
      );

    if (!existing && mission?.status === "SYSTEM_READY") {
      const opened = this.openForAuthorization(input.mission_id, { fixture });
      if (!opened.ok || !opened.record) {
        return opened;
      }
      existing = opened.record;
    }

    const validation = validateExecutionControllerReview(
      input,
      mission,
      existing,
      { already_ready: already },
    );
    if (!validation.ok) {
      const first = validation.errors[0]!;
      return {
        ok: false,
        record: existing,
        mission_status: mission?.status ?? null,
        next_safe_action:
          "Fix review blockers · scaffold only · execution remains impossible",
        error: first.message,
        error_code: first.code,
        duplicate: first.code === "DUPLICATE_CONTROLLER",
      };
    }

    const now = new Date().toISOString();
    let current = existing!;

    if (input.decision === "BLOCK_CONTROLLER_SCAFFOLD" ||
      input.decision === "REQUEST_CONTROLLER_CHANGES") {
      if (current.controller_status === "EXECUTION_CONTROLLER_BLOCKED") {
        return {
          ok: true,
          record: current,
          mission_status: mission!.status,
          next_safe_action: current.next_safe_action,
        };
      }
      assertExecutionControllerTransition(
        current.controller_status,
        "EXECUTION_CONTROLLER_BLOCKED",
      );
      current = this.persistStatus(
        current,
        "EXECUTION_CONTROLLER_BLOCKED",
        fixture,
        input.actor,
        String(input.reason ?? input.notes ?? "Controller scaffold blocked"),
        "CONTROLLER_BLOCKED",
      );
      this.refreshSnapshots(fixture);
      this.reporter.writeMarkdown(store);
      return {
        ok: true,
        record: current,
        mission_status: mission!.status,
        next_safe_action: current.next_safe_action,
      };
    }

    // APPROVE_CONTROLLER_SCAFFOLD — walk the design lifecycle to READY, then STOP.
    const path: ExecutionControllerLifecycleStatus[] = [
      "EXECUTION_AUTHORIZED",
      "WAITING_EXECUTION_CONTROLLER",
      "EXECUTION_CONTROLLER_READY",
    ];

    if (current.controller_status === "EXECUTION_CONTROLLER_BLOCKED") {
      assertExecutionControllerTransition(
        "EXECUTION_CONTROLLER_BLOCKED",
        "WAITING_EXECUTION_AUTHORIZATION",
      );
      current = this.persistStatus(
        current,
        "WAITING_EXECUTION_AUTHORIZATION",
        fixture,
        input.actor,
        "Re-opened after block",
        "CONTROLLER_OPENED",
      );
    }

    for (const next of path) {
      assertExecutionControllerTransition(current.controller_status, next);
      current = this.persistStatus(
        current,
        next,
        fixture,
        input.actor,
        String(
          input.reason ??
            "Founder authorized execution-controller scaffold (not execution)",
        ),
        next === "EXECUTION_CONTROLLER_READY"
          ? "CONTROLLER_READY"
          : "CONTROLLER_AUTHORIZED",
      );
    }

    this.refreshSnapshots(fixture);
    this.reporter.writeMarkdown(this.repo(fixture));
    this.assertSafety(current);

    return {
      ok: true,
      record: current,
      mission_status: mission!.status,
      next_safe_action: current.next_safe_action,
    };
  }

  private persistStatus(
    prior: ExecutionControllerRecord,
    to: ExecutionControllerLifecycleStatus,
    fixture: boolean,
    actor: string,
    reason: string,
    eventType:
      | "CONTROLLER_OPENED"
      | "CONTROLLER_AUTHORIZED"
      | "CONTROLLER_READY"
      | "CONTROLLER_BLOCKED",
  ): ExecutionControllerRecord {
    const store = this.repo(fixture);
    const next_safe_action =
      to === "EXECUTION_CONTROLLER_READY"
        ? "STOP · execution-controller scaffold ready · execution remains impossible"
        : to === "EXECUTION_CONTROLLER_BLOCKED"
          ? "Resolve blockers · re-open controller scaffold · execution remains impossible"
          : "Continue controller scaffold authorization · execution remains impossible";

    const finalRecord = createExecutionControllerRecord({
      controller_id: prior.controller_id,
      created_at: prior.created_at,
      mission_id: prior.mission_id,
      mission_version: prior.mission_version,
      runtime_plan_id: prior.runtime_plan_id,
      runtime_release_id: prior.runtime_release_id,
      system_readiness_id: prior.system_readiness_id,
      department: prior.department,
      controller_status: to,
      checksum_chain: {
        submission_checksum: prior.checksum_chain.submission_checksum,
        execution_package_checksum:
          prior.checksum_chain.execution_package_checksum,
        acknowledgement_checksum: prior.checksum_chain.acknowledgement_checksum,
        shadow_queue_checksum: prior.checksum_chain.shadow_queue_checksum,
        plan_checksum: prior.checksum_chain.plan_checksum,
        release_checksum: prior.checksum_chain.release_checksum,
        readiness_checksum: prior.checksum_chain.readiness_checksum,
      },
      worker_inventory: prior.worker_inventory,
      estimated_cost_usd: prior.estimated_cost_usd,
      estimated_duration_ms: prior.estimated_duration_ms,
      next_safe_action,
      fixture,
    });

    store.save(finalRecord);
    const now = finalRecord.updated_at;
    store.appendEvent({
      event_id: `xcevt-${randomUUID().slice(0, 8)}`,
      event_type: eventType,
      at: now,
      mission_id: finalRecord.mission_id,
      controller_id: finalRecord.controller_id,
      summary: `${prior.controller_status} → ${to}`,
      fixture,
    });
    store.appendHistory({
      history_id: `xchist-${randomUUID().slice(0, 8)}`,
      at: now,
      mission_id: finalRecord.mission_id,
      from_status: prior.controller_status,
      to_status: to,
      actor: actor || EXECUTION_CONTROLLER_FOUNDER_ACTOR,
      reason,
      fixture,
    });
    return finalRecord;
  }

  refreshSnapshots(fixture?: boolean): void {
    const repo = this.repo(fixture);
    const records = repo.list();
    const latest = records.length ? records[records.length - 1]! : null;
    const pending = records.filter(
      (r) =>
        r.controller_status === "WAITING_EXECUTION_AUTHORIZATION" ||
        r.controller_status === "EXECUTION_AUTHORIZED" ||
        r.controller_status === "WAITING_EXECUTION_CONTROLLER",
    );
    const ready = records.filter(
      (r) => r.controller_status === "EXECUTION_CONTROLLER_READY",
    );
    const blocked = records.filter(
      (r) => r.controller_status === "EXECUTION_CONTROLLER_BLOCKED",
    );

    const snapshot: ExecutionControllerSnapshot = {
      schema_version: "execution-controller-snapshot-1.0.0",
      updated_at: new Date().toISOString(),
      mission_id: latest?.mission_id ?? null,
      controller_id: latest?.controller_id ?? null,
      controller_status: latest?.controller_status ?? null,
      runtime_plan_id: latest?.runtime_plan_id ?? null,
      runtime_release_id: latest?.runtime_release_id ?? null,
      system_readiness_id: latest?.system_readiness_id ?? null,
      plan_checksum: latest?.checksum_chain.plan_checksum ?? null,
      readiness_checksum: latest?.checksum_chain.readiness_checksum ?? null,
      next_safe_action: latest?.next_safe_action ?? null,
      pending: pending.length > 0,
      safety_flags: EXECUTION_CONTROLLER_SAFETY_FLAGS_LOCKED,
    };
    repo.writeLatest(snapshot);

    const health: ExecutionControllerHealth = {
      schema_version: "execution-controller-health-1.0.0",
      updated_at: new Date().toISOString(),
      pending_count: pending.length,
      ready_count: ready.length,
      blocked_count: blocked.length,
      record_count: records.length,
      status: records.length ? "healthy" : "idle",
      mode: "controller_scaffold_only",
      safety_flags: EXECUTION_CONTROLLER_SAFETY_FLAGS_LOCKED,
      live: false,
    };
    repo.writeHealth(health);
  }

  private assertSafety(record: ExecutionControllerRecord): void {
    const f = record.safety_flags;
    if (
      f.execution_allowed !== false ||
      f.dispatch_allowed !== false ||
      f.worker_spawn_allowed !== false ||
      f.queue_insert_allowed !== false ||
      f.provider_allowed !== false ||
      f.publishing_allowed !== false ||
      f.live_enabled !== false ||
      f.scheduler_allowed !== false
    ) {
      throw new Error("Safety invariant violated");
    }
  }
}
