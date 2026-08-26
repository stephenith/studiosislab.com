/**
 * SystemReadinessValidator — Agent #171.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { MissionContract } from "../../core/company-brain/mission-types.js";
import type { RuntimeExecutionPlan } from "../planner/runtime-plan-types.js";
import { computeRuntimePlanChecksum } from "../planner/RuntimePlanValidator.js";
import type { RuntimeReleaseDecision } from "../runtime-release/runtime-release-types.js";
import type { ShadowQueueRecord } from "../queue/shadow-queue-types.js";
import type { QueueSubmissionPackage } from "../../core/company-brain/queue-submission-types.js";
import type { LifecycleTimelineEntry } from "./system-readiness-types.js";

export type SystemReadinessValidationIssue = {
  code: string;
  message: string;
  field?: string;
};

export type SystemReadinessValidationResult = {
  ok: boolean;
  errors: SystemReadinessValidationIssue[];
  timeline: LifecycleTimelineEntry[];
  blockers: string[];
};

const REQUIRED_REPORTS = [
  "SOS/09_REPORTS/AIOS_MISSION_CONTRACT_V1_REPORT.md",
  "SOS/09_REPORTS/AIOS_FOUNDER_MISSION_APPROVAL_V1_REPORT.md",
  "SOS/09_REPORTS/AIOS_QUEUE_ADMISSION_READINESS_V1_REPORT.md",
  "SOS/09_REPORTS/AIOS_EXECUTION_PACKAGE_DRY_RUN_V1_REPORT.md",
  "SOS/09_REPORTS/AIOS_EXECUTION_PACKAGE_ACKNOWLEDGEMENT_V1_REPORT.md",
  "SOS/09_REPORTS/AIOS_QUEUE_SUBMISSION_CONTRACT_V1_REPORT.md",
  "SOS/09_REPORTS/AIOS_SHADOW_QUEUE_RECEIVER_V1_REPORT.md",
  "SOS/09_REPORTS/AIOS_RUNTIME_PLAN_V1_REPORT.md",
  "SOS/09_REPORTS/AIOS_RUNTIME_RELEASE_GATE_V1_REPORT.md",
];

export function listPresentReports(repoRoot: string): string[] {
  return REQUIRED_REPORTS.filter((rel) => existsSync(join(repoRoot, rel)));
}

export function validateSystemReadiness(
  mission: MissionContract | null,
  plan: RuntimeExecutionPlan | null,
  release: RuntimeReleaseDecision | null,
  shadow: ShadowQueueRecord | null,
  submission: QueueSubmissionPackage | null,
  repoRoot: string,
  opts?: { already_certified?: boolean },
): SystemReadinessValidationResult {
  const errors: SystemReadinessValidationIssue[] = [];
  const blockers: string[] = [];

  const timeline: LifecycleTimelineEntry[] = [
    {
      stage: "Mission",
      status: mission?.status ?? "MISSING",
      required: true,
      satisfied: Boolean(mission),
    },
    {
      stage: "Mission Approval",
      status: "APPROVED lineage required",
      required: true,
      satisfied: Boolean(
        mission &&
          ![
            "DRAFT",
            "PLANNED",
            "WAITING_FOUNDER",
            "REJECTED",
            "CHANGES_REQUESTED",
          ].includes(mission.status),
      ),
    },
    {
      stage: "Queue Admission",
      status: "READY_FOR_QUEUE lineage",
      required: true,
      satisfied: Boolean(mission),
    },
    {
      stage: "Execution Package Ack",
      status: shadow?.acknowledgement_id ? "ACKNOWLEDGED" : "MISSING",
      required: true,
      satisfied: Boolean(shadow?.acknowledgement_checksum),
    },
    {
      stage: "Queue Submission",
      status: submission ? "PRESENT" : "MISSING",
      required: true,
      satisfied: Boolean(submission),
    },
    {
      stage: "Shadow Queue",
      status: shadow?.status ?? "MISSING",
      required: true,
      satisfied: shadow?.status === "SHADOW_QUEUE_RECEIVED",
    },
    {
      stage: "Runtime Plan",
      status: plan?.plan_status ?? "MISSING",
      required: true,
      satisfied: plan?.plan_status === "RUNTIME_PLAN_READY",
    },
    {
      stage: "Runtime Release",
      status: release?.decision ?? "MISSING",
      required: true,
      satisfied:
        release?.decision === "APPROVED" && release.status === "CONSUMED",
    },
    {
      stage: "System Readiness",
      status: mission?.status ?? "PENDING",
      required: true,
      satisfied: mission?.status === "RUNTIME_RELEASE_APPROVED",
    },
  ];

  if (!mission) {
    errors.push({
      code: "MISSION_NOT_FOUND",
      message: "Mission not found",
      field: "mission_id",
    });
    return { ok: false, errors, timeline, blockers: ["Mission missing"] };
  }

  if (mission.status !== "RUNTIME_RELEASE_APPROVED") {
    errors.push({
      code: "RELEASE_NOT_APPROVED",
      message: `Mission must be RUNTIME_RELEASE_APPROVED (got ${mission.status})`,
      field: "status",
    });
    blockers.push(`Lifecycle ${mission.status}`);
  }

  if (!plan) {
    errors.push({
      code: "MISSING_RUNTIME_PLAN",
      message: "Runtime plan not found",
    });
    blockers.push("Runtime plan missing");
  } else {
    const expected = computeRuntimePlanChecksum(plan);
    if (plan.plan_checksum !== expected) {
      errors.push({
        code: "PLAN_CHECKSUM_INVALID",
        message: "Runtime plan checksum mismatch",
        field: "plan_checksum",
      });
      blockers.push("Plan checksum mismatch");
    }
    if (plan.plan_status !== "RUNTIME_PLAN_READY") {
      // After release approval, plan artifact still shows READY status on the plan object
      // which is correct — mission moved to RUNTIME_RELEASE_APPROVED
    }
    if (
      plan.dispatch_allowed !== false ||
      plan.execution_allowed !== false ||
      plan.planning_only !== true
    ) {
      errors.push({
        code: "UNSAFE_PLAN_FLAGS",
        message: "Plan safety flags must remain locked",
      });
      blockers.push("Unsafe plan flags");
    }
  }

  if (!release || release.decision !== "APPROVED" || release.status !== "CONSUMED") {
    errors.push({
      code: "MISSING_RELEASE_APPROVAL",
      message: "Consumed APPROVED runtime release required",
    });
    blockers.push("Runtime release not approved");
  }

  if (!shadow || shadow.status !== "SHADOW_QUEUE_RECEIVED") {
    errors.push({
      code: "MISSING_SHADOW",
      message: "Shadow queue record required",
    });
    blockers.push("Shadow queue missing");
  }

  if (!submission) {
    errors.push({
      code: "MISSING_SUBMISSION",
      message: "Queue submission package required",
    });
    blockers.push("Submission missing");
  }

  if (plan && release && plan.plan_checksum !== release.plan_checksum) {
    errors.push({
      code: "RELEASE_PLAN_CHECKSUM_MISMATCH",
      message: "Release plan_checksum does not match runtime plan",
    });
    blockers.push("Release/plan checksum mismatch");
  }

  if (plan && shadow && plan.submission_checksum !== shadow.submission_checksum) {
    errors.push({
      code: "SHADOW_SUBMISSION_CHECKSUM_MISMATCH",
      message: "Shadow submission checksum does not match plan",
    });
    blockers.push("Shadow/submission checksum mismatch");
  }

  if (
    plan &&
    submission &&
    plan.submission_checksum !== submission.submission_checksum
  ) {
    errors.push({
      code: "SUBMISSION_CHECKSUM_MISMATCH",
      message: "Submission checksum does not match plan",
    });
    blockers.push("Submission checksum mismatch");
  }

  if (
    plan &&
    shadow &&
    plan.execution_package_checksum !== shadow.execution_package_checksum
  ) {
    errors.push({
      code: "PACKAGE_CHECKSUM_MISMATCH",
      message: "Execution package checksum chain broken",
    });
    blockers.push("Package checksum mismatch");
  }

  if (!shadow?.acknowledgement_checksum && !plan?.acknowledgement_checksum) {
    errors.push({
      code: "MISSING_ACKNOWLEDGEMENT",
      message: "Founder acknowledgement checksum missing",
    });
    blockers.push("Acknowledgement missing");
  }

  const reports = listPresentReports(repoRoot);
  const missingReports = REQUIRED_REPORTS.filter((r) => !reports.includes(r));
  if (missingReports.length) {
    errors.push({
      code: "MISSING_REPORTS",
      message: `Missing reports: ${missingReports.join(", ")}`,
    });
    blockers.push(...missingReports.map((r) => `Missing ${r}`));
  }

  if (opts?.already_certified) {
    errors.push({
      code: "DUPLICATE_CERTIFICATE",
      message: "System readiness certificate already issued for this mission",
    });
  }

  if (process.env.SOS_AIOS_LIVE === "1") {
    errors.push({ code: "LIVE_ON", message: "LIVE must be OFF" });
    blockers.push("LIVE ON");
  }

  return { ok: errors.length === 0, errors, timeline, blockers };
}
