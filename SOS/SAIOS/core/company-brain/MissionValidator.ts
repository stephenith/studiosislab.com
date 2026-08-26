/**
 * Mission lifecycle + contract validation (Agent #162).
 * Reports errors only — never mutates runtime or executes.
 */
import type {
  MissionContract,
  MissionLifecycleStatus,
  MissionValidationIssue,
  MissionValidationResult,
} from "./mission-types.js";
import { MISSION_SCHEMA_VERSION } from "./mission-types.js";

/** V1 active statuses (Agents #162–#166). Execution stages remain inactive. */
export const V1_ACTIVE_STATUSES: MissionLifecycleStatus[] = [
  "PLANNED",
  "WAITING_FOUNDER",
  "APPROVED",
  "REJECTED",
  "CHANGES_REQUESTED",
  "WAITING_QUEUE_REVIEW",
  "READY_FOR_QUEUE",
  "QUEUE_BLOCKED",
  "WAITING_PACKAGE_ACKNOWLEDGEMENT",
  "PACKAGE_ACKNOWLEDGED",
  "PACKAGE_CHANGES_REQUESTED",
  "PACKAGE_REJECTED",
  "WAITING_QUEUE_SUBMISSION",
  "QUEUE_SUBMISSION_READY",
  "QUEUE_SUBMISSION_BLOCKED",
  "SHADOW_QUEUE_RECEIVED",
  "RUNTIME_PLAN_READY",
  "RUNTIME_PLAN_BLOCKED",
  "WAITING_RUNTIME_RELEASE",
  "RUNTIME_RELEASE_APPROVED",
  "RUNTIME_RELEASE_REJECTED",
  "RUNTIME_RELEASE_CHANGES_REQUESTED",
  "SYSTEM_READY",
  "SYSTEM_BLOCKED",
];

/** Allowed transitions. IN_PROGRESS+ not activated (no execution). */
export const LIFECYCLE_TRANSITIONS: Record<
  MissionLifecycleStatus,
  MissionLifecycleStatus[]
> = {
  DRAFT: ["PLANNED", "ARCHIVED"],
  PLANNED: ["WAITING_FOUNDER", "ARCHIVED"],
  WAITING_FOUNDER: [
    "APPROVED",
    "REJECTED",
    "CHANGES_REQUESTED",
    "PLANNED",
    "ARCHIVED",
  ],
  APPROVED: ["WAITING_QUEUE_REVIEW", "ARCHIVED"],
  REJECTED: ["ARCHIVED", "PLANNED"],
  CHANGES_REQUESTED: ["PLANNED", "WAITING_FOUNDER", "ARCHIVED"],
  WAITING_QUEUE_REVIEW: ["READY_FOR_QUEUE", "QUEUE_BLOCKED", "APPROVED", "ARCHIVED"],
  READY_FOR_QUEUE: ["WAITING_PACKAGE_ACKNOWLEDGEMENT", "ARCHIVED"],
  QUEUE_BLOCKED: ["WAITING_QUEUE_REVIEW", "APPROVED", "ARCHIVED"],
  WAITING_PACKAGE_ACKNOWLEDGEMENT: [
    "PACKAGE_ACKNOWLEDGED",
    "PACKAGE_CHANGES_REQUESTED",
    "PACKAGE_REJECTED",
    "ARCHIVED",
  ],
  PACKAGE_ACKNOWLEDGED: ["WAITING_QUEUE_SUBMISSION", "ARCHIVED"],
  PACKAGE_CHANGES_REQUESTED: ["READY_FOR_QUEUE", "WAITING_PACKAGE_ACKNOWLEDGEMENT", "ARCHIVED"],
  PACKAGE_REJECTED: ["ARCHIVED", "READY_FOR_QUEUE"],
  WAITING_QUEUE_SUBMISSION: [
    "QUEUE_SUBMISSION_READY",
    "QUEUE_SUBMISSION_BLOCKED",
    "ARCHIVED",
  ],
  QUEUE_SUBMISSION_READY: ["SHADOW_QUEUE_RECEIVED", "ARCHIVED"],
  QUEUE_SUBMISSION_BLOCKED: ["WAITING_QUEUE_SUBMISSION", "ARCHIVED"],
  SHADOW_QUEUE_RECEIVED: ["RUNTIME_PLAN_READY", "RUNTIME_PLAN_BLOCKED", "ARCHIVED"],
  RUNTIME_PLAN_READY: ["WAITING_RUNTIME_RELEASE", "ARCHIVED"],
  RUNTIME_PLAN_BLOCKED: ["SHADOW_QUEUE_RECEIVED", "ARCHIVED"],
  WAITING_RUNTIME_RELEASE: [
    "RUNTIME_RELEASE_APPROVED",
    "RUNTIME_RELEASE_REJECTED",
    "RUNTIME_RELEASE_CHANGES_REQUESTED",
    "ARCHIVED",
  ],
  RUNTIME_RELEASE_APPROVED: ["SYSTEM_READY", "SYSTEM_BLOCKED", "ARCHIVED"],
  RUNTIME_RELEASE_REJECTED: ["ARCHIVED", "RUNTIME_PLAN_READY"],
  RUNTIME_RELEASE_CHANGES_REQUESTED: [
    "WAITING_RUNTIME_RELEASE",
    "RUNTIME_PLAN_READY",
    "ARCHIVED",
  ],
  SYSTEM_READY: ["ARCHIVED"],
  SYSTEM_BLOCKED: ["ARCHIVED", "RUNTIME_RELEASE_APPROVED"],
  IN_PROGRESS: ["COMPLETED", "ARCHIVED"],
  COMPLETED: ["ARCHIVED"],
  ARCHIVED: [],
};

function issue(
  severity: "error" | "warning",
  code: string,
  message: string,
  field?: string,
): MissionValidationIssue {
  return {
    id: `mv-${code.toLowerCase()}`,
    severity,
    code,
    message,
    field,
  };
}

export function detectDependencyLoops(
  edges: Array<{ from: string; to: string }>,
): string[] | null {
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    if (!adj.has(e.from)) adj.set(e.from, []);
    adj.get(e.from)!.push(e.to);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];

  function dfs(n: string): boolean {
    if (visiting.has(n)) {
      stack.push(n);
      return true;
    }
    if (visited.has(n)) return false;
    visiting.add(n);
    for (const m of adj.get(n) ?? []) {
      if (dfs(m)) {
        stack.push(n);
        return true;
      }
    }
    visiting.delete(n);
    visited.add(n);
    return false;
  }

  for (const n of adj.keys()) {
    if (dfs(n)) return stack.reverse();
  }
  return null;
}

export function validateMissionContract(
  mission: MissionContract,
  opts?: { known_ids?: Set<string>; is_update?: boolean },
): MissionValidationResult {
  const errors: MissionValidationIssue[] = [];
  const warnings: MissionValidationIssue[] = [];

  if (mission.schema_version !== MISSION_SCHEMA_VERSION) {
    errors.push(
      issue(
        "error",
        "INVALID_SCHEMA_VERSION",
        `Expected ${MISSION_SCHEMA_VERSION}`,
        "schema_version",
      ),
    );
  }

  if (!mission.mission_id?.trim()) {
    errors.push(issue("error", "MISSING_MISSION_ID", "mission_id required", "mission_id"));
  }

  if (
    opts?.known_ids?.has(mission.mission_id) &&
    !opts.is_update
  ) {
    errors.push(
      issue(
        "error",
        "DUPLICATE_MISSION_ID",
        `Mission ID already registered: ${mission.mission_id}`,
        "mission_id",
      ),
    );
  }

  if (!mission.mission_name?.trim()) {
    errors.push(issue("error", "MISSING_MISSION_NAME", "mission_name required", "mission_name"));
  }

  if (!mission.founder_objective?.trim()) {
    errors.push(
      issue("error", "MISSING_OBJECTIVE", "founder_objective required", "founder_objective"),
    );
  }

  if (!mission.success_kpis?.length) {
    errors.push(
      issue("error", "MISSING_KPIS", "At least one success KPI is required", "success_kpis"),
    );
  } else if (!mission.success_kpis.some((k) => k.required)) {
    warnings.push(
      issue("warning", "NO_REQUIRED_KPI", "No required KPI marked", "success_kpis"),
    );
  }

  if (!V1_ACTIVE_STATUSES.includes(mission.status)) {
    errors.push(
      issue(
        "error",
        "INVALID_LIFECYCLE_V1",
        `V1 may only use active governance statuses (got ${mission.status})`,
        "status",
      ),
    );
  }

  if (mission.current_stage !== mission.status) {
    warnings.push(
      issue(
        "warning",
        "STAGE_STATUS_MISMATCH",
        `current_stage (${mission.current_stage}) != status (${mission.status})`,
        "current_stage",
      ),
    );
  }

  if (mission.execution_allowed !== false) {
    errors.push(
      issue("error", "EXECUTION_MUST_BE_FALSE", "execution_allowed must be false", "execution_allowed"),
    );
  }
  if (mission.queue_admission_allowed !== false) {
    errors.push(
      issue(
        "error",
        "QUEUE_MUST_BE_FALSE",
        "queue_admission_allowed must be false",
        "queue_admission_allowed",
      ),
    );
  }
  if (mission.publishing_allowed !== false) {
    errors.push(
      issue(
        "error",
        "PUBLISH_MUST_BE_FALSE",
        "publishing_allowed must be false",
        "publishing_allowed",
      ),
    );
  }
  if (mission.founder_approval_required !== true) {
    errors.push(
      issue(
        "error",
        "FOUNDER_APPROVAL_REQUIRED",
        "founder_approval_required must be true",
        "founder_approval_required",
      ),
    );
  }

  if (!mission.estimated_departments?.length) {
    errors.push(
      issue(
        "error",
        "MISSING_DEPARTMENTS",
        "Mission must list at least one department",
        "estimated_departments",
      ),
    );
  } else {
    const scoped = mission.estimated_departments.filter(
      (d) =>
        d.role_in_plan === "primary" || d.role_in_plan === "supporting",
    );
    if (scoped.length === 0) {
      errors.push(
        issue(
          "error",
          "MISSING_DEPARTMENTS",
          "No primary/supporting departments in mission",
          "estimated_departments",
        ),
      );
    } else if (!scoped.some((d) => d.enabled)) {
      warnings.push(
        issue(
          "warning",
          "NO_ENABLED_DEPARTMENTS",
          "Primary/supporting departments are disabled (informational planning only)",
          "estimated_departments",
        ),
      );
    }
  }

  const loop = detectDependencyLoops(mission.dependency_graph.edges);
  if (loop) {
    errors.push(
      issue(
        "error",
        "DEPENDENCY_LOOP",
        `Dependency loop detected: ${loop.join(" → ")}`,
        "dependency_graph",
      ),
    );
  }

  for (const edge of mission.dependency_graph.edges) {
    if (
      !mission.dependency_graph.nodes.includes(edge.from) ||
      !mission.dependency_graph.nodes.includes(edge.to)
    ) {
      errors.push(
        issue(
          "error",
          "DEPENDENCY_NODE_MISSING",
          `Edge ${edge.id} references unknown node`,
          "dependency_graph",
        ),
      );
    }
  }

  if (mission.mission_version < 1) {
    errors.push(
      issue("error", "INVALID_VERSION", "mission_version must be >= 1", "mission_version"),
    );
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}

export function canTransition(
  from: MissionLifecycleStatus,
  to: MissionLifecycleStatus,
): boolean {
  return (LIFECYCLE_TRANSITIONS[from] ?? []).includes(to);
}
