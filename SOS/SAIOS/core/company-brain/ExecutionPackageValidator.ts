/**
 * ExecutionPackageValidator — schema + safety (Agent #165).
 * Platform consolidation (Agent #176): rejectForbiddenKeys.
 */
import type { ExecutionPackage } from "./execution-package-types.js";
import { EXECUTION_PACKAGE_SCHEMA_VERSION } from "./execution-package-types.js";
import { rejectForbiddenKeys } from "../../platform/checksums/index.js";

export type PackageValidationIssue = {
  code: string;
  message: string;
  field?: string;
};

export type PackageValidationResult = {
  ok: boolean;
  errors: PackageValidationIssue[];
  warnings: PackageValidationIssue[];
};

export function validateExecutionPackage(
  pkg: ExecutionPackage,
): PackageValidationResult {
  const errors: PackageValidationIssue[] = [];
  const warnings: PackageValidationIssue[] = [];

  if (pkg.schema_version !== EXECUTION_PACKAGE_SCHEMA_VERSION) {
    errors.push({
      code: "INVALID_SCHEMA",
      message: `Expected ${EXECUTION_PACKAGE_SCHEMA_VERSION}`,
      field: "schema_version",
    });
  }
  if (!pkg.package_id?.trim()) {
    errors.push({
      code: "MISSING_PACKAGE_ID",
      message: "package_id required",
      field: "package_id",
    });
  }
  if (!pkg.execution_id?.trim()) {
    errors.push({
      code: "MISSING_EXECUTION_ID",
      message: "execution_id required",
      field: "execution_id",
    });
  }
  if (!pkg.mission_id?.trim()) {
    errors.push({
      code: "MISSING_MISSION_ID",
      message: "mission_id required",
      field: "mission_id",
    });
  }
  if (pkg.dry_run !== true) {
    errors.push({
      code: "DRY_RUN_REQUIRED",
      message: "dry_run must be true",
      field: "dry_run",
    });
  }
  if (pkg.execution_allowed !== false) {
    errors.push({
      code: "EXECUTION_MUST_BE_FALSE",
      message: "execution_allowed must be false",
      field: "execution_allowed",
    });
  }
  if (pkg.queue_enqueue_allowed !== false) {
    errors.push({
      code: "ENQUEUE_MUST_BE_FALSE",
      message: "queue_enqueue_allowed must be false",
      field: "queue_enqueue_allowed",
    });
  }
  if (pkg.publishing_allowed !== false) {
    errors.push({
      code: "PUBLISH_MUST_BE_FALSE",
      message: "publishing_allowed must be false",
      field: "publishing_allowed",
    });
  }
  if (pkg.publish_policy.publishing_allowed !== false) {
    errors.push({
      code: "PUBLISH_POLICY_FALSE",
      message: "publish_policy.publishing_allowed must be false",
    });
  }
  if (pkg.publish_policy.publishing_eligible !== false) {
    errors.push({
      code: "PUBLISH_ELIGIBLE_FALSE",
      message: "publishing_eligible must be false",
    });
  }
  if (!pkg.execution_graph?.nodes?.length) {
    errors.push({
      code: "EMPTY_EXECUTION_GRAPH",
      message: "execution_graph requires nodes",
      field: "execution_graph",
    });
  }
  if (pkg.execution_graph?.nodes?.some((n) => n.executed !== false)) {
    errors.push({
      code: "STAGE_EXECUTED",
      message: "No execution stage may be marked executed",
      field: "execution_graph",
    });
  }
  if (!pkg.worker_graph?.nodes?.length) {
    errors.push({
      code: "EMPTY_WORKER_GRAPH",
      message: "worker_graph requires nodes",
      field: "worker_graph",
    });
  }
  if (!pkg.quality_gates?.length) {
    errors.push({
      code: "MISSING_GATES",
      message: "quality_gates required",
      field: "quality_gates",
    });
  }
  const pubGate = pkg.quality_gates.find((g) => g.id === "publishing_eligible");
  if (pubGate && pubGate.satisfied !== false) {
    errors.push({
      code: "PUBLISH_GATE_MUST_BE_FALSE",
      message: "publishing_eligible gate must be false",
    });
  }
  if (!pkg.rollback_points?.length) {
    warnings.push({
      code: "NO_ROLLBACK_POINTS",
      message: "No rollback checkpoints listed",
    });
  }
  if (pkg.canonical_engine !== "core.first-production-cycle") {
    errors.push({
      code: "WRONG_ENGINE",
      message: "canonical_engine must be core.first-production-cycle",
    });
  }
  if (!pkg.package_version || pkg.package_version < 1) {
    errors.push({
      code: "INVALID_PACKAGE_VERSION",
      message: "package_version must be >= 1",
      field: "package_version",
    });
  }
  if (!pkg.checksum?.trim()) {
    errors.push({
      code: "MISSING_CHECKSUM",
      message: "checksum required",
      field: "checksum",
    });
  }

  return { ok: errors.length === 0, errors, warnings };
}

const FORBIDDEN_QUERY_KEYS = [
  "execute",
  "dispatch",
  "enqueue",
  "publish",
  "enable_live",
] as const;

export function rejectForbiddenPayload(
  body: Record<string, unknown>,
): PackageValidationIssue | null {
  return rejectForbiddenKeys(body, FORBIDDEN_QUERY_KEYS, {
    messageForKey: (key) => `Field '${key}' is forbidden`,
  });
}
