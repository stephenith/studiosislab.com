/**
 * CompanyBrain — facade for Planning Engine + Mission Contract V1.
 * Single planning authority. Never executes.
 */
import { PlanningEngine } from "./PlanningEngine.js";
import { PlanRepository, resolveRepoRoot } from "./PlanRepository.js";
import { MissionPlanner } from "./MissionPlanner.js";
import { MissionRegistry } from "./MissionRegistry.js";
import { MissionDecisionManager } from "./MissionDecisionManager.js";
import { QueueAdmissionReview } from "./QueueAdmissionReview.js";
import { ExecutionPackageBuilder } from "./ExecutionPackageBuilder.js";
import { ExecutionPackageAckManager } from "./ExecutionPackageAckManager.js";
import { QueueSubmissionBuilder } from "./QueueSubmissionBuilder.js";
import type {
  CompanyBrainStatus,
  CompanyExecutionPlan,
  PlanningInput,
  PlanningResult,
} from "./types.js";
import type {
  MissionContract,
  MissionCreateInput,
  MissionCreateResult,
  MissionLifecycleStatus,
} from "./mission-types.js";
import type {
  MissionDecisionInput,
  MissionDecisionResult,
} from "./mission-decision-types.js";
import type {
  QueueDecisionInput,
  QueueDecisionResult,
} from "./queue-admission-types.js";
import type { ExecutionPackageBuildResult } from "./execution-package-types.js";
import type {
  PackageAckDecisionInput,
  PackageAckDecisionResult,
} from "./execution-package-ack-types.js";
import type {
  QueueSubmissionBuildResult,
  QueueSubmissionReviewInput,
  QueueSubmissionReviewResult,
} from "./queue-submission-types.js";

export const COMPANY_BRAIN = {
  module: "company-brain",
  version: "1.0.0",
  role: "planning_authority",
  mode: "planning_only",
  autonomous: false,
  replaces_executive_orchestrator: false,
  mission_contract: "mission-contract-1.0.0",
  prohibitions: [
    "no_execution",
    "no_queue_enqueue",
    "no_workers",
    "no_cursor",
    "no_providers",
    "no_models_direct",
    "no_publish",
    "no_render",
  ],
} as const;

const LIFECYCLE_PROGRESS: Record<MissionLifecycleStatus, number> = {
  DRAFT: 0,
  PLANNED: 15,
  WAITING_FOUNDER: 30,
  APPROVED: 45,
  REJECTED: 45,
  CHANGES_REQUESTED: 35,
  WAITING_QUEUE_REVIEW: 55,
  READY_FOR_QUEUE: 70,
  QUEUE_BLOCKED: 50,
  WAITING_PACKAGE_ACKNOWLEDGEMENT: 78,
  PACKAGE_ACKNOWLEDGED: 85,
  PACKAGE_CHANGES_REQUESTED: 72,
  PACKAGE_REJECTED: 72,
  WAITING_QUEUE_SUBMISSION: 88,
  QUEUE_SUBMISSION_READY: 90,
  QUEUE_SUBMISSION_BLOCKED: 86,
  SHADOW_QUEUE_RECEIVED: 92,
  RUNTIME_PLAN_READY: 94,
  RUNTIME_PLAN_BLOCKED: 93,
  WAITING_RUNTIME_RELEASE: 95,
  RUNTIME_RELEASE_APPROVED: 96,
  RUNTIME_RELEASE_REJECTED: 95,
  RUNTIME_RELEASE_CHANGES_REQUESTED: 94,
  SYSTEM_READY: 98,
  SYSTEM_BLOCKED: 97,
  IN_PROGRESS: 99,
  COMPLETED: 100,
  ARCHIVED: 100,
};

export function missionProgressPct(
  status: MissionLifecycleStatus | string | null | undefined,
): number {
  if (!status) return 0;
  return LIFECYCLE_PROGRESS[status as MissionLifecycleStatus] ?? 0;
}

export class CompanyBrain {
  readonly engine: PlanningEngine;
  readonly repo: PlanRepository;
  readonly missions: MissionRegistry;
  readonly missionPlanner: MissionPlanner;
  readonly decisions: MissionDecisionManager;
  readonly queueAdmission: QueueAdmissionReview;
  readonly executionPackages: ExecutionPackageBuilder;
  readonly packageAcks: ExecutionPackageAckManager;
  readonly queueSubmissions: QueueSubmissionBuilder;

  constructor(repoRoot?: string) {
    const root = repoRoot ?? resolveRepoRoot();
    this.engine = new PlanningEngine(root);
    this.repo = new PlanRepository(root);
    this.missions = new MissionRegistry(root);
    this.missionPlanner = new MissionPlanner(root);
    this.decisions = new MissionDecisionManager(root);
    this.queueAdmission = new QueueAdmissionReview(root);
    this.executionPackages = new ExecutionPackageBuilder(root);
    this.packageAcks = new ExecutionPackageAckManager(root);
    this.queueSubmissions = new QueueSubmissionBuilder(root);
  }

  /**
   * Create a structured ExecutionPlan and persist it.
   * Does NOT enqueue, execute, or call providers.
   * Prefer createMission() — plans are derived from Mission Contracts.
   */
  createPlan(input: PlanningInput): PlanningResult {
    if (process.env.SOS_AIOS_LIVE === "1") {
      throw new Error("CompanyBrain refuses SOS_AIOS_LIVE=1");
    }

    const plan = this.engine.plan(input);
    const status = this.buildStatus(plan, this.missions.getCurrent());
    const paths = this.repo.persist(plan, status);

    return {
      overall: plan.execution_status === "BLOCKED" ? "FAIL" : "PASS",
      plan,
      status,
      persisted: true,
      artifact_paths: paths,
    };
  }

  /**
   * Convert founder objective → Mission Contract + derived ExecutionPlan.
   * Mission remains PLANNED / WAITING_FOUNDER only. Never executes.
   */
  createMission(input: MissionCreateInput): MissionCreateResult {
    if (process.env.SOS_AIOS_LIVE === "1") {
      throw new Error("CompanyBrain refuses SOS_AIOS_LIVE=1");
    }
    return this.missionPlanner.createMission({
      ...input,
      await_founder: input.await_founder ?? true,
    });
  }

  getStatus(): CompanyBrainStatus {
    return (
      this.repo.loadStatus() ??
      this.buildStatus(null, this.missions.getCurrent())
    );
  }

  getLatestPlan(): CompanyExecutionPlan | null {
    return this.repo.loadLatestPlan();
  }

  getCurrentMission(): MissionContract | null {
    return this.missions.getCurrent();
  }

  /**
   * Record a founder mission decision. Never executes / enqueues / publishes.
   */
  recordMissionDecision(input: MissionDecisionInput): MissionDecisionResult {
    if (process.env.SOS_AIOS_LIVE === "1") {
      throw new Error("CompanyBrain refuses SOS_AIOS_LIVE=1");
    }
    return this.decisions.recordDecision(input);
  }

  submitMissionForFounder(
    missionId: string,
    opts?: { fixture?: boolean },
  ): MissionDecisionResult {
    return this.decisions.submitForFounderApproval(missionId, opts);
  }

  startQueueReview(
    missionId: string,
    opts?: { fixture?: boolean },
  ): QueueDecisionResult {
    if (process.env.SOS_AIOS_LIVE === "1") {
      throw new Error("CompanyBrain refuses SOS_AIOS_LIVE=1");
    }
    return this.queueAdmission.startReview(missionId, opts);
  }

  recordQueueDecision(input: QueueDecisionInput): QueueDecisionResult {
    if (process.env.SOS_AIOS_LIVE === "1") {
      throw new Error("CompanyBrain refuses SOS_AIOS_LIVE=1");
    }
    return this.queueAdmission.recordDecision(input);
  }

  buildExecutionPackage(
    missionId: string,
    opts?: { fixture?: boolean },
  ): ExecutionPackageBuildResult {
    if (process.env.SOS_AIOS_LIVE === "1") {
      throw new Error("CompanyBrain refuses SOS_AIOS_LIVE=1");
    }
    return this.executionPackages.buildForMission(missionId, opts);
  }

  recordPackageAcknowledgement(
    input: PackageAckDecisionInput,
  ): PackageAckDecisionResult {
    if (process.env.SOS_AIOS_LIVE === "1") {
      throw new Error("CompanyBrain refuses SOS_AIOS_LIVE=1");
    }
    return this.packageAcks.recordDecision(input);
  }

  buildQueueSubmission(
    missionId: string,
    opts?: { fixture?: boolean },
  ): QueueSubmissionBuildResult {
    if (process.env.SOS_AIOS_LIVE === "1") {
      throw new Error("CompanyBrain refuses SOS_AIOS_LIVE=1");
    }
    return this.queueSubmissions.buildForMission(missionId, opts);
  }

  recordQueueSubmissionReview(
    input: QueueSubmissionReviewInput,
  ): QueueSubmissionReviewResult {
    if (process.env.SOS_AIOS_LIVE === "1") {
      throw new Error("CompanyBrain refuses SOS_AIOS_LIVE=1");
    }
    return this.queueSubmissions.recordReview(input);
  }

  private buildStatus(
    plan: CompanyExecutionPlan | null,
    mission: MissionContract | null,
  ): CompanyBrainStatus {
    const latest = plan ?? this.repo.loadLatestPlan();
    const currentMission = mission ?? this.missions.getCurrent();
    let planning_state: CompanyBrainStatus["planning_state"] = "idle";
    if (latest?.execution_status === "BLOCKED") planning_state = "blocked";
    else if (
      latest?.execution_status === "PLANNED" ||
      latest?.execution_status === "AWAITING_FOUNDER_APPROVAL"
    ) {
      planning_state =
        latest.execution_status === "AWAITING_FOUNDER_APPROVAL"
          ? "awaiting_founder"
          : "planned";
    }
    if (currentMission?.status === "WAITING_FOUNDER") {
      planning_state = "awaiting_founder";
    }

    const founderApproval =
      currentMission?.status === "WAITING_FOUNDER"
        ? "WAITING_FOUNDER"
        : currentMission?.founder_approval_required
          ? "REQUIRED"
          : latest?.founder_approval_required
            ? "REQUIRED"
            : "N/A";

    return {
      module: "company-brain",
      version: "1.0.0",
      mode: "planning_only",
      autonomous: false,
      can_execute: false,
      can_enqueue: false,
      can_call_providers: false,
      can_publish: false,
      planning_state,
      current_objective:
        currentMission?.founder_objective ?? latest?.objective ?? null,
      latest_plan_id: latest?.plan_id ?? null,
      pending_approval:
        currentMission?.status === "WAITING_FOUNDER" ||
        currentMission?.status === "PLANNED" ||
        (Boolean(latest) &&
          latest!.founder_approval_required &&
          (latest!.execution_status === "PLANNED" ||
            latest!.execution_status === "AWAITING_FOUNDER_APPROVAL")),
      latest_plan: latest,
      generated_at: new Date().toISOString(),
      source: "SOS/07_LOGS/saios/company-brain/status.json",
      current_mission_id: currentMission?.mission_id ?? null,
      current_mission_status: currentMission?.status ?? null,
      current_mission_name: currentMission?.mission_name ?? null,
      current_mission_priority: currentMission?.priority ?? null,
      current_mission_risk: currentMission?.risk_level ?? null,
      current_mission_progress_pct: currentMission
        ? missionProgressPct(currentMission.status)
        : null,
      founder_approval_status: founderApproval,
    };
  }
}

export function createCompanyBrain(repoRoot?: string): CompanyBrain {
  return new CompanyBrain(repoRoot);
}
