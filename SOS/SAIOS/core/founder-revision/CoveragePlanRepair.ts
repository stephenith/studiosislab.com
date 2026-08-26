/**
 * Deterministic merge + conflict guards for one-shot coverage repair plans.
 * No auto-relabeling of primary operations. No execution.
 */
import type { CanvasOperation, RevisionPlan } from "./revision-task-types.js";
import type { UncoveredRequestedChange } from "./RevisionPromptBuilder.js";
import { findUncoveredRequestedChanges } from "./RevisionPromptBuilder.js";
import {
  geomAxesPresent,
  targetIdsOf,
} from "./PlanMutationConflicts.js";

export {
  detectRepairMergeConflicts,
  operationMutationFingerprint,
} from "./PlanMutationConflicts.js";

/** Primary plan target::axis keys already mutated (pre-execution planning semantics). */
export function buildPrimaryOccupiedGeometryScopes(
  primaryOps: CanvasOperation[],
): Set<string> {
  const occupied = new Set<string>();
  for (const op of primaryOps) {
    const axes = geomAxesPresent(op.values ?? {});
    for (const tid of targetIdsOf(op)) {
      for (const axis of axes) {
        occupied.add(`${tid}::${axis}`);
      }
    }
  }
  return occupied;
}

/**
 * Fail closed when repair touches a target::axis already owned by primary.
 * Runs before detectRepairMergeConflicts for clearer COVERAGE_REPAIR_PRIMARY_AXIS_CONFLICT errors.
 */
export function detectRepairPrimaryAxisOccupiedConflicts(
  primaryOps: CanvasOperation[],
  repairOps: CanvasOperation[],
): { ok: boolean; errors: string[] } {
  const occupied = buildPrimaryOccupiedGeometryScopes(primaryOps);
  const errors: string[] = [];
  for (let ri = 0; ri < repairOps.length; ri++) {
    const repair = repairOps[ri]!;
    const axes = geomAxesPresent(repair.values ?? {});
    if (axes.size === 0) continue;
    for (const tid of targetIdsOf(repair)) {
      for (const axis of axes) {
        const key = `${tid}::${axis}`;
        if (occupied.has(key)) {
          errors.push(
            `COVERAGE_REPAIR_PRIMARY_AXIS_CONFLICT: repair operations[${ri}] conflicts with primary on occupied ${key}`,
          );
        }
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

export function mergePrimaryAndRepairPlans(
  primary: RevisionPlan,
  repair: RevisionPlan,
): RevisionPlan {
  return {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: primary.summary,
    notes: [
      ...(primary.notes ?? []),
      ...(repair.notes ?? []),
      "coverage_repair_merged",
    ],
    operations: [...primary.operations, ...repair.operations],
  };
}

export type CoverageRepairSummary = {
  attempted: boolean;
  missing_before: UncoveredRequestedChange[];
  repair_operation_count: number;
  missing_after: UncoveredRequestedChange[];
  merged_validation_pass: boolean;
  provider_request_id: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  error: string | null;
  failure_kind:
    | null
    | "provider"
    | "repair_plan_invalid"
    | "primary_axis_conflict"
    | "merge_conflict"
    | "merged_incomplete"
    | "other";
};

export function buildCoverageRepairSummary(input: {
  attempted: boolean;
  missing_before: UncoveredRequestedChange[];
  repair_operation_count: number;
  merged_plan: RevisionPlan | null;
  requested_changes: string[];
  merged_validation_pass: boolean;
  provider_request_id: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  error: string | null;
  failure_kind: CoverageRepairSummary["failure_kind"];
}): CoverageRepairSummary {
  const missing_after =
    input.merged_plan != null
      ? findUncoveredRequestedChanges(
          input.merged_plan,
          input.requested_changes,
        )
      : input.missing_before;
  return {
    attempted: input.attempted,
    missing_before: input.missing_before,
    repair_operation_count: input.repair_operation_count,
    missing_after,
    merged_validation_pass: input.merged_validation_pass,
    provider_request_id: input.provider_request_id,
    input_tokens: input.input_tokens,
    output_tokens: input.output_tokens,
    error: input.error,
    failure_kind: input.failure_kind,
  };
}
