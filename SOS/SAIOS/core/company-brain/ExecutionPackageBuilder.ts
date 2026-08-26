/**
 * ExecutionPackageBuilder — immutable dry-run packages (Agent #165).
 * Never enqueues, executes, dispatches, or publishes.
 */
import { randomUUID } from "node:crypto";
import { MissionRegistry } from "./MissionRegistry.js";
import { PlanRepository, resolveRepoRoot } from "./PlanRepository.js";
import { readSystemState } from "./SystemStateReader.js";
import {
  buildExecutionGraph,
  buildWorkerGraph,
} from "./ExecutionGraphBuilder.js";
import {
  planQualityGates,
  planRollbackPoints,
} from "./ExecutionStagePlanner.js";
import { ExecutionPackageRepository } from "./ExecutionPackageRepository.js";
import { ExecutionPackageReporter } from "./ExecutionPackageReporter.js";
import { validateExecutionPackage } from "./ExecutionPackageValidator.js";
import { computeExecutionPackageChecksum } from "./ExecutionPackageAcknowledgement.js";
import type {
  ExecutionPackage,
  ExecutionPackageBuildResult,
} from "./execution-package-types.js";
import { EXECUTION_PACKAGE_SCHEMA_VERSION } from "./execution-package-types.js";
import type { MissionLifecycleStatus } from "./mission-types.js";

export class ExecutionPackageBuilder {
  readonly registry: MissionRegistry;
  readonly plans: PlanRepository;
  readonly reporter: ExecutionPackageReporter;
  readonly root: string;

  constructor(repoRoot?: string) {
    this.root = repoRoot ?? resolveRepoRoot();
    this.registry = new MissionRegistry(this.root);
    this.plans = new PlanRepository(this.root);
    this.reporter = new ExecutionPackageReporter();
  }

  private repo(fixture?: boolean): ExecutionPackageRepository {
    return new ExecutionPackageRepository(this.root, {
      fixture: Boolean(fixture),
    });
  }

  /**
   * Build dry-run execution package for a READY_FOR_QUEUE mission.
   * By default transitions mission → WAITING_PACKAGE_ACKNOWLEDGEMENT.
   */
  buildForMission(
    missionId: string,
    opts?: { fixture?: boolean; skip_ack_transition?: boolean },
  ): ExecutionPackageBuildResult {
    if (process.env.SOS_AIOS_LIVE === "1") {
      return {
        ok: false,
        package: null,
        error: "LIVE must be OFF",
        error_code: "LIVE_ON",
        artifact_paths: [],
      };
    }

    const mission = this.registry.get(missionId);
    if (!mission) {
      return {
        ok: false,
        package: null,
        error: "Mission not found",
        error_code: "MISSION_NOT_FOUND",
        artifact_paths: [],
      };
    }

    if (
      mission.status !== "READY_FOR_QUEUE" &&
      mission.status !== "WAITING_PACKAGE_ACKNOWLEDGEMENT"
    ) {
      return {
        ok: false,
        package: null,
        error: `Mission must be READY_FOR_QUEUE (got ${mission.status})`,
        error_code: "INVALID_MISSION_STATUS",
        artifact_paths: [],
      };
    }

    // Only build new packages from READY_FOR_QUEUE (immutable once waiting)
    if (mission.status === "WAITING_PACKAGE_ACKNOWLEDGEMENT") {
      const existing = this.getForMission(missionId);
      if (existing) {
        return { ok: true, package: existing, artifact_paths: [] };
      }
      return {
        ok: false,
        package: null,
        error: "Waiting acknowledgement but package missing",
        error_code: "MISSING_PACKAGE",
        artifact_paths: [],
      };
    }

    const fixture = Boolean(opts?.fixture ?? mission.fixture);
    const state = readSystemState(this.root);
    const plan =
      this.plans.loadLatestPlan()?.mission_id === mission.mission_id
        ? this.plans.loadLatestPlan()
        : this.plans.loadLatestPlan();

    const primary =
      mission.estimated_departments.find((d) => d.role_in_plan === "primary")
        ?.department ?? "resume";

    const required_departments = mission.estimated_departments
      .filter(
        (d) => d.role_in_plan === "primary" || d.role_in_plan === "supporting",
      )
      .map((d) => d.department);

    const required_workers = [
      "designbrief",
      "resume-renderer",
      "resume-critic",
    ];
    const required_skills = [
      "resume.layout_planning",
      "resume.critic",
      "company-brain.planning",
    ];
    const required_models = ["mock-provider"];
    const required_tools = ["brain-router", "firecrawl"];

    const now = new Date().toISOString();
    const package_id = `epkg-${now.slice(0, 10).replace(/-/g, "")}-${randomUUID().slice(0, 8)}`;
    const execution_id = `exec-preview-${randomUUID().slice(0, 8)}`;

    const draft: Omit<ExecutionPackage, "checksum"> = {
      schema_version: EXECUTION_PACKAGE_SCHEMA_VERSION,
      package_id,
      execution_id,
      mission_id: mission.mission_id,
      mission_version: mission.mission_version,
      plan_id: mission.linked_plan_id ?? plan?.plan_id ?? null,
      department: primary,
      priority: mission.priority,
      objective: mission.founder_objective,
      required_departments,
      required_workers,
      required_skills,
      required_models,
      required_tools,
      knowledge_snapshot_reference: state.knowledge.snapshot_id
        ? `knowledge:${state.knowledge.snapshot_id}`
        : state.knowledge.available
          ? "knowledge:available"
          : null,
      estimated_duration: mission.estimated_duration || "~1.0h (estimate only)",
      estimated_cost_usd: null,
      estimated_cost_note:
        "Placeholder — dry_run / Mock Provider · no billing",
      estimated_outputs: [
        "designbrief.json (future)",
        "resume render artifacts (future)",
        "critic scores (future)",
        "founder review checkpoint (future)",
        "learning entries (future)",
        "queue job — NOT created by this package",
      ],
      dependency_graph: {
        nodes: mission.dependency_graph.nodes,
        edges: mission.dependency_graph.edges.map((e) => ({
          from: e.from,
          to: e.to,
          kind: e.kind,
        })),
        critical_path: mission.dependency_graph.critical_path,
      },
      worker_graph: buildWorkerGraph(mission),
      execution_graph: buildExecutionGraph(),
      rollback_points: planRollbackPoints(),
      quality_gates: planQualityGates({
        knowledge_available: state.knowledge.available,
        mission_approved_or_ready: true,
        queue_approved: true,
      }),
      founder_checkpoints: [
        "Mission Approval (completed)",
        "Queue Admission Approval (completed)",
        "Execution Package Acknowledgement (pending)",
        "Cycle Founder Review after Critic Gate (future — not entered)",
      ],
      risk_summary: {
        risk_level: mission.risk_level,
        risks: [
          ...mission.blocking_issues.map((b) => b.message).slice(0, 5),
          "Package is dry-run only — submitting to Queue is disabled",
        ],
        warnings: [
          "Publishing eligible = false",
          "No worker dispatch",
          "Canonical engine referenced but not invoked",
          "Acknowledgement is not execution approval",
        ],
      },
      publish_policy: {
        publishing_allowed: false,
        publishing_eligible: false,
        note: "Publishing remains disabled for all dry-run packages",
      },
      canonical_engine: "core.first-production-cycle",
      package_version: 1,
      dry_run: true,
      execution_allowed: false,
      queue_enqueue_allowed: false,
      publishing_allowed: false,
      created_at: now,
      created_by: "company_brain",
      next_safe_action:
        "Acknowledge exact package checksum · STOP — do not enqueue or execute",
      execution_still_blocked_reason:
        "Execution Package is a dry-run preview. Queue insertion, worker dispatch, provider calls, and publishing remain disabled. Acknowledgement does not authorize execution.",
      fixture,
    };

    const checksum = computeExecutionPackageChecksum(draft);
    const pkg: ExecutionPackage = { ...draft, checksum };

    const validation = validateExecutionPackage(pkg);
    const repo = this.repo(fixture);

    if (!validation.ok) {
      repo.appendEvent({
        event_id: `eevt-${randomUUID().slice(0, 8)}`,
        event_type: "PACKAGE_REJECTED",
        at: now,
        mission_id: mission.mission_id,
        package_id: null,
        summary: validation.errors.map((e) => e.code).join(", "),
        fixture,
      });
      return {
        ok: false,
        package: pkg,
        error: validation.errors[0]?.message ?? "validation failed",
        error_code: validation.errors[0]?.code ?? "VALIDATION_FAILED",
        artifact_paths: [],
      };
    }

    const paths = repo.save(pkg);
    repo.appendEvent({
      event_id: `eevt-${randomUUID().slice(0, 8)}`,
      event_type: "PACKAGE_BUILT",
      at: now,
      mission_id: mission.mission_id,
      package_id: pkg.package_id,
      summary: `Built dry-run package ${pkg.package_id} checksum=${checksum.slice(0, 12)}…`,
      fixture,
    });
    repo.appendEvent({
      event_id: `eevt-${randomUUID().slice(0, 8)}`,
      event_type: "PACKAGE_VALIDATED",
      at: now,
      mission_id: mission.mission_id,
      package_id: pkg.package_id,
      summary: "Package validated · execution still blocked",
      fixture,
    });
    this.reporter.writeMarkdown(repo);

    if (!opts?.skip_ack_transition) {
      const updated = {
        ...mission,
        status: "WAITING_PACKAGE_ACKNOWLEDGEMENT" as MissionLifecycleStatus,
        current_stage:
          "WAITING_PACKAGE_ACKNOWLEDGEMENT" as MissionLifecycleStatus,
        updated_at: now,
        execution_allowed: false as const,
        queue_admission_allowed: false as const,
        publishing_allowed: false as const,
        planning_notes: [
          ...mission.planning_notes,
          "Package built · waiting founder acknowledgement (Agent #166)",
        ],
        fixture,
      };
      this.registry.save(updated, { set_current: !fixture });
    }

    return {
      ok: true,
      package: pkg,
      artifact_paths: paths,
    };
  }

  getLatest(fixture?: boolean): ExecutionPackage | null {
    return this.repo(fixture).loadLatest();
  }

  getForMission(missionId: string): ExecutionPackage | null {
    const mission = this.registry.get(missionId);
    const fixture = Boolean(mission?.fixture);
    return (
      this.repo(fixture).loadLatestForMission(missionId) ??
      this.repo(false).loadLatestForMission(missionId)
    );
  }
}

export function createExecutionPackageBuilder(
  repoRoot?: string,
): ExecutionPackageBuilder {
  return new ExecutionPackageBuilder(repoRoot);
}
