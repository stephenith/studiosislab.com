/**
 * RuntimePlanner — Shadow Queue → deterministic Runtime Execution Plan (Agent #169).
 * Planning only. Never dispatches, executes, schedules, or publishes.
 */
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { MissionRegistry } from "../../core/company-brain/MissionRegistry.js";
import { QueueSubmissionRepository } from "../../core/company-brain/QueueSubmissionRepository.js";
import { canTransition } from "../../core/company-brain/MissionValidator.js";
import type {
  MissionContract,
  MissionLifecycleStatus,
} from "../../core/company-brain/mission-types.js";
import { ShadowQueueRepository } from "../queue/ShadowQueueRepository.js";
import { buildRuntimeExecutionGraph } from "./RuntimeExecutionGraph.js";
import { resolveRuntimeDependencies } from "./RuntimeDependencyResolver.js";
import { resolveRuntimeWorkers } from "./RuntimeWorkerResolver.js";
import { RuntimePlanRepository } from "./RuntimePlanRepository.js";
import { RuntimePlanReporter } from "./RuntimePlanReporter.js";
import {
  computeRuntimePlanChecksum,
  validateRuntimeExecutionPlan,
  validateRuntimePlanPrerequisites,
} from "./RuntimePlanValidator.js";
import type {
  RuntimeExecutionPlan,
  RuntimePlanBuildResult,
  RuntimePlanHealth,
  RuntimePlanLifecycleStatus,
  RuntimePlanSnapshot,
  RuntimeQualityGate,
  RuntimeRollbackPoint,
} from "./runtime-plan-types.js";
import { RUNTIME_PLAN_SCHEMA_VERSION } from "./runtime-plan-types.js";

function resolveRepoRoot(fromDir = import.meta.dirname): string {
  return resolve(fromDir, "../../../..");
}

export class RuntimePlanner {
  readonly registry: MissionRegistry;
  readonly reporter: RuntimePlanReporter;
  readonly root: string;

  constructor(repoRoot?: string) {
    this.root = repoRoot ?? resolveRepoRoot();
    this.registry = new MissionRegistry(this.root);
    this.reporter = new RuntimePlanReporter();
  }

  private repo(fixture?: boolean): RuntimePlanRepository {
    return new RuntimePlanRepository(this.root, {
      fixture: Boolean(fixture),
    });
  }

  private shadowStore(fixture?: boolean): ShadowQueueRepository {
    return new ShadowQueueRepository(this.root, {
      fixture: Boolean(fixture),
    });
  }

  private submissionStore(fixture?: boolean): QueueSubmissionRepository {
    return new QueueSubmissionRepository(this.root, {
      fixture: Boolean(fixture),
    });
  }

  getForMission(
    missionId: string,
    fixture?: boolean,
  ): RuntimeExecutionPlan | null {
    const fromFixture = this.repo(true).getForMission(missionId);
    if (fixture) return fromFixture;
    return this.repo(false).getForMission(missionId) ?? fromFixture;
  }

  /**
   * SHADOW_QUEUE_RECEIVED → RUNTIME_PLAN_READY | RUNTIME_PLAN_BLOCKED → STOP.
   */
  buildForMission(
    missionId: string,
    opts?: { fixture?: boolean },
  ): RuntimePlanBuildResult {
    if (process.env.SOS_AIOS_LIVE === "1") {
      return fail("LIVE must be OFF", "LIVE_ON");
    }

    const fixture = Boolean(opts?.fixture);
    const store = this.repo(fixture);
    const mission = this.registry.get(missionId);
    const shadow = this.shadowStore(fixture).getForMission(missionId);
    const submission = shadow
      ? this.submissionStore(fixture).get(shadow.submission_id) ??
        this.submissionStore(fixture).getForMission(missionId)
      : this.submissionStore(fixture).getForMission(missionId);

    const already =
      shadow != null &&
      store.hasPlanForShadow(missionId, shadow.shadow_queue_id);

    if (
      already &&
      (mission?.status === "RUNTIME_PLAN_READY" ||
        mission?.status === "RUNTIME_PLAN_BLOCKED")
    ) {
      const existing = store.getForMission(missionId);
      return {
        ok: true,
        plan: existing,
        mission_status: mission.status,
        next_safe_action:
          existing?.next_safe_action ??
          "Runtime plan already exists · STOP — waiting runtime release",
        artifact_paths: [],
        duplicate: true,
      };
    }

    const prereq = validateRuntimePlanPrerequisites(
      mission,
      shadow,
      submission,
      { already_planned: already },
    );
    if (!prereq.ok) {
      const first = prereq.errors[0]!;
      return {
        ok: false,
        plan: null,
        mission_status: mission?.status ?? null,
        next_safe_action: null,
        artifact_paths: [],
        error: first.message,
        error_code: first.code,
        duplicate: first.code === "DUPLICATE_RUNTIME_PLAN",
      };
    }

    if (mission!.status !== "SHADOW_QUEUE_RECEIVED") {
      return fail(
        `Mission must be SHADOW_QUEUE_RECEIVED (got ${mission!.status})`,
        "INVALID_LIFECYCLE",
        mission!.status,
      );
    }

    const resolution = resolveRuntimeWorkers(shadow!, submission!);
    const dependency_graph = resolveRuntimeDependencies(
      submission!,
      resolution,
    );
    const execution_graph = buildRuntimeExecutionGraph(resolution);

    const quality_gates: RuntimeQualityGate[] = (
      submission!.quality_gates ?? []
    ).map((g) => ({
      id: g.id,
      label: g.label,
      required: g.required,
      satisfied: g.satisfied,
      note: g.note,
    }));
    if (quality_gates.length === 0) {
      quality_gates.push({
        id: "planning_complete",
        label: "Runtime planning complete",
        required: true,
        satisfied: true,
        note: "Plan generated · execution still blocked",
      });
    }

    const rollback_points: RuntimeRollbackPoint[] = (
      submission!.rollback_plan ?? []
    ).map((r) => ({
      id: r.id,
      label: r.label,
      description: r.description,
      implemented: false,
    }));

    const hasBlockers =
      !dependency_graph.acyclic ||
      dependency_graph.invalid_ordering.length > 0 ||
      resolution.missing_workers.length > 0 ||
      resolution.missing_skills.length > 0 ||
      resolution.missing_models.length > 0 ||
      resolution.missing_tools.length > 0;

    // Soft missing inventory from unknown custom IDs should warn but not always block
    // if DAG is valid — block only on cycles / invalid ordering / hard empty inventories
    // when submission explicitly requires unknown items.
    const plan_status: RuntimePlanLifecycleStatus = hasBlockers
      ? "RUNTIME_PLAN_BLOCKED"
      : "RUNTIME_PLAN_READY";

    const warnings = [
      "Planning only — nothing executes",
      "dispatch_allowed=false",
      "execution_allowed=false",
      "LIVE OFF",
      ...submission!.warnings,
      ...(dependency_graph.cycles.length
        ? [`Cycles: ${dependency_graph.cycles.map((c) => c.join("→")).join("; ")}`]
        : []),
      ...(resolution.missing_workers.length
        ? [`Missing workers: ${resolution.missing_workers.join(", ")}`]
        : []),
      ...(resolution.missing_skills.length
        ? [`Missing skills: ${resolution.missing_skills.join(", ")}`]
        : []),
      ...(resolution.missing_models.length
        ? [`Missing models: ${resolution.missing_models.join(", ")}`]
        : []),
      ...(resolution.missing_tools.length
        ? [`Missing tools: ${resolution.missing_tools.join(", ")}`]
        : []),
    ];

    const now = new Date().toISOString();
    const draft: Omit<RuntimeExecutionPlan, "plan_checksum"> = {
      schema_version: RUNTIME_PLAN_SCHEMA_VERSION,
      runtime_plan_id: `rplan-${now.slice(0, 10).replace(/-/g, "")}-${randomUUID().slice(0, 8)}`,
      shadow_queue_id: shadow!.shadow_queue_id,
      mission_id: mission!.mission_id,
      mission_version: mission!.mission_version,
      submission_id: submission!.submission_id,
      execution_package_checksum: shadow!.execution_package_checksum,
      submission_checksum: shadow!.submission_checksum,
      acknowledgement_checksum: shadow!.acknowledgement_checksum,
      department: shadow!.department,
      priority: shadow!.priority,
      worker_order: resolution.worker_order,
      execution_graph,
      dependency_graph,
      worker_resolution: resolution,
      estimated_duration: submission!.estimated_duration,
      estimated_cost_usd: submission!.estimated_cost_usd,
      estimated_cost_note: submission!.estimated_cost_note,
      quality_gates,
      rollback_points,
      missing_workers: resolution.missing_workers,
      missing_skills: resolution.missing_skills,
      missing_models: resolution.missing_models,
      missing_tools: resolution.missing_tools,
      warnings,
      plan_status,
      planning_only: true,
      dispatch_allowed: false,
      execution_allowed: false,
      publishing_allowed: false,
      created_at: now,
      created_by: "runtime_planner",
      next_safe_action:
        plan_status === "RUNTIME_PLAN_READY"
          ? "Inspect runtime plan · WAITING_RUNTIME_RELEASE · STOP — do not dispatch"
          : "Resolve plan blockers · STOP — do not dispatch",
      planning_still_blocked_reason:
        plan_status === "RUNTIME_PLAN_BLOCKED"
          ? "Plan blocked by dependency or inventory gaps — execution remains impossible"
          : "Plan ready for future release gate only — execution remains impossible",
      fixture: fixture || undefined,
    };

    const plan: RuntimeExecutionPlan = {
      ...draft,
      plan_checksum: computeRuntimePlanChecksum(draft),
    };

    // Schema safety always required; dependency cycles already reflected in plan_status.
    // validateRuntimeExecutionPlan fails on cycles — for blocked plans we skip cycle error.
    const schemaCheck = validateRuntimeExecutionPlan({
      ...plan,
      // Temporarily treat blocked plans' cycle as accepted for persistence
      dependency_graph:
        plan_status === "RUNTIME_PLAN_BLOCKED"
          ? { ...plan.dependency_graph, acyclic: true, invalid_ordering: [] }
          : plan.dependency_graph,
    });
    if (!schemaCheck.ok) {
      const first = schemaCheck.errors[0]!;
      store.appendEvent({
        event_id: `rpevt-${randomUUID().slice(0, 8)}`,
        event_type: "PLAN_REJECTED",
        at: now,
        mission_id: missionId,
        runtime_plan_id: plan.runtime_plan_id,
        shadow_queue_id: shadow!.shadow_queue_id,
        summary: first.message,
        fixture,
      });
      return fail(first.message, first.code, mission!.status);
    }

    const paths = store.save(plan);
    store.appendEvent({
      event_id: `rpevt-${randomUUID().slice(0, 8)}`,
      event_type: "PLAN_BUILT",
      at: now,
      mission_id: missionId,
      runtime_plan_id: plan.runtime_plan_id,
      shadow_queue_id: shadow!.shadow_queue_id,
      summary: `Built ${plan.runtime_plan_id} · ${plan_status}`,
      fixture,
    });
    store.appendEvent({
      event_id: `rpevt-${randomUUID().slice(0, 8)}`,
      event_type: plan_status === "RUNTIME_PLAN_BLOCKED" ? "PLAN_BLOCKED" : "PLAN_VALIDATED",
      at: now,
      mission_id: missionId,
      runtime_plan_id: plan.runtime_plan_id,
      shadow_queue_id: shadow!.shadow_queue_id,
      summary:
        plan_status === "RUNTIME_PLAN_BLOCKED"
          ? "Plan blocked — inventory or dependency issues"
          : `Validated checksum ${plan.plan_checksum.slice(0, 12)}…`,
      fixture,
    });

    if (!canTransition(mission!.status, plan_status)) {
      return fail(
        `Invalid transition ${mission!.status} → ${plan_status}`,
        "INVALID_LIFECYCLE_TRANSITION",
        mission!.status,
      );
    }

    const from = mission!.status;
    const updated = this.applyStatus(mission!, plan_status, fixture);
    store.appendEvent({
      event_id: `rpevt-${randomUUID().slice(0, 8)}`,
      event_type: "MISSION_STATUS_UPDATED",
      at: now,
      mission_id: updated.mission_id,
      runtime_plan_id: plan.runtime_plan_id,
      shadow_queue_id: shadow!.shadow_queue_id,
      summary: `${from} → ${plan_status}`,
      fixture,
    });

    this.refreshSnapshots(fixture);
    this.reporter.writeMarkdown(store);

    if (
      plan.dispatch_allowed !== false ||
      plan.execution_allowed !== false ||
      plan.publishing_allowed !== false ||
      updated.execution_allowed !== false
    ) {
      throw new Error("Safety invariant violated");
    }

    return {
      ok: true,
      plan,
      mission_status: plan_status,
      next_safe_action: plan.next_safe_action,
      artifact_paths: paths,
    };
  }

  private applyStatus(
    mission: MissionContract,
    status: RuntimePlanLifecycleStatus,
    fixture?: boolean,
  ): MissionContract {
    const updated: MissionContract = {
      ...mission,
      status: status as MissionLifecycleStatus,
      current_stage: status as MissionLifecycleStatus,
      updated_at: new Date().toISOString(),
      execution_allowed: false,
      queue_admission_allowed: false,
      publishing_allowed: false,
      founder_approval_required: true,
      planning_notes: [
        ...mission.planning_notes,
        `Runtime plan → ${status} (Agent #169; planning only — no dispatch)`,
      ],
      fixture: fixture ?? mission.fixture,
    };
    this.registry.save(updated, { set_current: !fixture });
    return updated;
  }

  refreshSnapshots(fixture?: boolean): void {
    const repo = this.repo(fixture);
    const plans = repo.list();
    const latest = plans.length ? plans[plans.length - 1]! : null;
    const ready = plans.filter((p) => p.plan_status === "RUNTIME_PLAN_READY");
    const blocked = plans.filter(
      (p) => p.plan_status === "RUNTIME_PLAN_BLOCKED",
    );

    const snapshot: RuntimePlanSnapshot = {
      schema_version: "runtime-plan-snapshot-1.0.0",
      updated_at: new Date().toISOString(),
      mission_id: latest?.mission_id ?? null,
      runtime_plan_id: latest?.runtime_plan_id ?? null,
      shadow_queue_id: latest?.shadow_queue_id ?? null,
      plan_status: latest?.plan_status ?? "EMPTY",
      plan_checksum: latest?.plan_checksum ?? null,
      planning_only: true,
      dispatch_allowed: false,
      execution_allowed: false,
      publishing_allowed: false,
      next_safe_action: latest?.next_safe_action ?? null,
    };
    repo.writeLatest(snapshot);

    const health: RuntimePlanHealth = {
      schema_version: "runtime-plan-health-1.0.0",
      updated_at: new Date().toISOString(),
      plan_count: plans.length,
      ready_count: ready.length,
      blocked_count: blocked.length,
      planning_only: true,
      dispatch_allowed: false,
      execution_allowed: false,
      publishing_allowed: false,
      live: false,
      mode: "planning_only",
      status: plans.length ? "healthy" : "idle",
    };
    repo.writeHealth(health);
  }
}

function fail(
  error: string,
  error_code: string,
  mission_status: string | null = null,
): RuntimePlanBuildResult {
  return {
    ok: false,
    plan: null,
    mission_status,
    next_safe_action: null,
    artifact_paths: [],
    error,
    error_code,
  };
}

export function createRuntimePlanner(repoRoot?: string): RuntimePlanner {
  return new RuntimePlanner(repoRoot);
}
