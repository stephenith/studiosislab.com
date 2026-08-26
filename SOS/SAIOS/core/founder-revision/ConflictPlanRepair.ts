/**
 * Deterministic conflict-report + frozen-op preservation for one-shot ConflictPlanRepair.
 * Does NOT choose geometry, merge ops, drop ops, or relabel Founder attribution.
 */
import type { CanvasOperation, RevisionPlan } from "./revision-task-types.js";
import {
  geomAxesPresent,
  operationMutationFingerprint,
  operationsConflictOnSharedGeometry,
  targetIdsOf,
} from "./PlanMutationConflicts.js";

/** Local copy — avoid circular import with RevisionPromptBuilder. */
function normalizeFounderFeedbackItem(s: string): string {
  return s
    .replace(/^\*+\s*/, "")
    .replace(/^\d+\.\s*/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export type ConflictPairType = "geometry_axis" | "exact_duplicate";

export type PlanMutationConflictPair = {
  type: ConflictPairType;
  operation_index_a: number;
  operation_index_b: number;
  shared_target_ids: string[];
  overlapping_axes: string[];
  fingerprint_a: string;
  fingerprint_b: string;
};

export type ConflictScopeKey = string; // `${targetId}::${axis}`

export type PrimaryConflictReport = {
  ok: boolean;
  pairs: PlanMutationConflictPair[];
  /** Narrow editable scope: target-id + geometry axis. */
  conflict_scope_keys: ConflictScopeKey[];
  /** Indices of primary ops that touch at least one conflict-scope key. */
  conflict_scope_operation_indices: number[];
  /** Indices of primary ops outside conflict scope (must be preserved). */
  frozen_operation_indices: number[];
  errors: string[];
};

export type FrozenPreservationResult = {
  ok: boolean;
  expected_count: number;
  actual_count: number;
  missing_fingerprints: string[];
  unexpected_extra_frozen_like_count: number;
  errors: string[];
};

export type ConflictRepairValidationSummary = {
  shape_ok: boolean;
  attribution_ok: boolean;
  internal_conflicts_ok: boolean;
  frozen_preservation_ok: boolean;
  completeness_ok: boolean;
  accepted: boolean;
  errors: string[];
};

export type ConflictRepairFailureKind =
  | null
  | "provider"
  | "incomplete_json"
  | "repair_plan_invalid"
  | "still_conflicts"
  | "preservation_failed"
  | "incomplete_coverage"
  | "other";

export type ConflictRepairSummary = {
  attempted: boolean;
  accepted: boolean;
  conflict_pair_count: number;
  conflict_scope_key_count: number;
  frozen_operation_count: number;
  repaired_operation_count: number;
  provider_request_id: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  failure_kind: ConflictRepairFailureKind;
  error: string | null;
  preservation: FrozenPreservationResult | null;
  validation: ConflictRepairValidationSummary | null;
};

export type ConflictRepairEvidence = {
  summary: ConflictRepairSummary;
  conflict_report: PrimaryConflictReport;
  repair_prompt: { objective: string; instructions: string } | null;
  repair_raw_structured: Record<string, unknown> | null;
  repaired_plan: RevisionPlan | null;
  primary_plan: RevisionPlan | null;
  provider_request_id: string | null;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
};

function stableValuesJson(values: Record<string, unknown>): string {
  const keys = Object.keys(values).sort();
  const ordered: Record<string, unknown> = {};
  for (const k of keys) ordered[k] = values[k];
  return JSON.stringify(ordered);
}

function stableSelectorJson(
  selector: CanvasOperation["selector"] | undefined,
): string {
  if (!selector || typeof selector !== "object") return "";
  const keys = Object.keys(selector).sort() as (keyof NonNullable<
    CanvasOperation["selector"]
  >)[];
  const ordered: Record<string, unknown> = {};
  for (const k of keys) {
    const v = selector[k];
    if (v !== undefined) ordered[k] = v;
  }
  return JSON.stringify(ordered);
}

function normalizedTargetKey(op: CanvasOperation): string {
  if (op.target_ids && op.target_ids.length > 0) {
    return `ids:${[...op.target_ids]
      .map((s) => s.trim())
      .filter(Boolean)
      .sort()
      .join(",")}`;
  }
  if (op.target_id) return `id:${op.target_id.trim()}`;
  return "id:";
}

function normalizedSecondaryItems(op: CanvasOperation): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of op.founder_feedback_items ?? []) {
    const n = normalizeFounderFeedbackItem(String(raw ?? ""));
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  out.sort();
  return out;
}

/**
 * Preservation fingerprint for frozen ops.
 * Includes attribution/intent/selector metadata (unlike operationMutationFingerprint).
 * Confidence excluded. Order of founder_feedback_items normalized.
 */
export function operationPreservationFingerprint(op: CanvasOperation): string {
  return JSON.stringify({
    op: op.op,
    target: normalizedTargetKey(op),
    values: stableValuesJson(op.values ?? {}),
    intended_change: String(op.intended_change ?? "").trim(),
    before_summary: String(op.before_summary ?? "").trim(),
    founder_feedback_item: String(op.founder_feedback_item ?? "").trim(),
    founder_feedback_items: normalizedSecondaryItems(op),
    selector: stableSelectorJson(op.selector),
  });
}

export function conflictScopeKey(targetId: string, axis: string): ConflictScopeKey {
  return `${targetId.trim()}::${axis}`;
}

function opConflictScopeKeys(op: CanvasOperation): ConflictScopeKey[] {
  const axes = [...geomAxesPresent(op.values ?? {})];
  const targets = targetIdsOf(op);
  const keys: ConflictScopeKey[] = [];
  for (const t of targets) {
    for (const axis of axes) {
      keys.push(conflictScopeKey(t, axis));
    }
  }
  return keys;
}

/**
 * True when the operation touches any conflict-scope target+axis key.
 * Multi-axis ops are wholly in scope if any axis is conflicted.
 */
export function operationInConflictScope(
  op: CanvasOperation,
  conflictScopeKeys: ReadonlySet<ConflictScopeKey> | readonly ConflictScopeKey[],
): boolean {
  const set =
    conflictScopeKeys instanceof Set
      ? conflictScopeKeys
      : new Set(conflictScopeKeys);
  if (set.size === 0) return false;
  for (const key of opConflictScopeKeys(op)) {
    if (set.has(key)) return true;
  }
  return false;
}

/**
 * Structured primary conflict report (geometry + exact duplicates).
 * Scope keys are narrow: targetId::axis only for overlapping conflict axes.
 */
export function buildPrimaryConflictReport(
  operations: CanvasOperation[],
): PrimaryConflictReport {
  const pairs: PlanMutationConflictPair[] = [];
  const scopeKeys = new Set<ConflictScopeKey>();
  const errors: string[] = [];
  const seenFp = new Map<string, number>();

  for (let i = 0; i < operations.length; i++) {
    const op = operations[i]!;
    const fp = operationMutationFingerprint(op);
    const prev = seenFp.get(fp);
    if (prev != null) {
      const shared = targetIdsOf(op);
      const axes = [...geomAxesPresent(op.values ?? {})].sort();
      pairs.push({
        type: "exact_duplicate",
        operation_index_a: prev,
        operation_index_b: i,
        shared_target_ids: shared,
        overlapping_axes: axes,
        fingerprint_a: fp,
        fingerprint_b: fp,
      });
      errors.push(
        `plan mutation conflict: operations[${prev}] and operations[${i}] are exact duplicate mutations (op+target+values)`,
      );
      for (const t of shared) {
        for (const axis of axes) {
          scopeKeys.add(conflictScopeKey(t, axis));
        }
      }
    } else {
      seenFp.set(fp, i);
    }
  }

  for (let i = 0; i < operations.length; i++) {
    for (let j = i + 1; j < operations.length; j++) {
      const a = operations[i]!;
      const b = operations[j]!;
      const fpA = operationMutationFingerprint(a);
      const fpB = operationMutationFingerprint(b);
      if (fpA === fpB) continue;
      const hit = operationsConflictOnSharedGeometry(a, b);
      if (!hit.conflict) continue;
      const axes = [...hit.axes].sort();
      const shared = [...hit.sharedTargets].sort();
      pairs.push({
        type: "geometry_axis",
        operation_index_a: i,
        operation_index_b: j,
        shared_target_ids: shared,
        overlapping_axes: axes,
        fingerprint_a: fpA,
        fingerprint_b: fpB,
      });
      errors.push(
        `plan mutation conflict: operations[${i}] and operations[${j}] conflict on shared target geometry (${shared.join(",")}) axes=[${axes.join(",")}]`,
      );
      for (const t of shared) {
        for (const axis of axes) {
          scopeKeys.add(conflictScopeKey(t, axis));
        }
      }
    }
  }

  const conflict_scope_keys = [...scopeKeys].sort();
  const scopeSet = new Set(conflict_scope_keys);
  const conflict_scope_operation_indices: number[] = [];
  const frozen_operation_indices: number[] = [];
  for (let i = 0; i < operations.length; i++) {
    if (operationInConflictScope(operations[i]!, scopeSet)) {
      conflict_scope_operation_indices.push(i);
    } else {
      frozen_operation_indices.push(i);
    }
  }

  return {
    ok: pairs.length === 0,
    pairs,
    conflict_scope_keys,
    conflict_scope_operation_indices,
    frozen_operation_indices,
    errors,
  };
}

function multisetCounts(fps: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const fp of fps) m.set(fp, (m.get(fp) ?? 0) + 1);
  return m;
}

/**
 * Repaired plan must preserve the same multiset of frozen-op preservation fingerprints.
 * Order may differ. Conflict-scope ops are not required to preserve fingerprints.
 */
export function validateFrozenOperationPreservation(
  primaryOps: CanvasOperation[],
  repairedOps: CanvasOperation[],
  report: PrimaryConflictReport,
): FrozenPreservationResult {
  const scopeSet = new Set(report.conflict_scope_keys);
  const expected = primaryOps
    .filter((op) => !operationInConflictScope(op, scopeSet))
    .map(operationPreservationFingerprint);
  const actualFrozen = repairedOps
    .filter((op) => !operationInConflictScope(op, scopeSet))
    .map(operationPreservationFingerprint);

  const expectedCounts = multisetCounts(expected);
  const actualCounts = multisetCounts(actualFrozen);
  const missing: string[] = [];
  const errors: string[] = [];

  for (const [fp, n] of expectedCounts) {
    const have = actualCounts.get(fp) ?? 0;
    if (have < n) {
      const deficit = n - have;
      for (let i = 0; i < deficit; i++) missing.push(fp);
      errors.push(
        `frozen operation preservation failed: missing ${deficit} copy/copies of fingerprint`,
      );
    }
  }

  let unexpected = 0;
  for (const [fp, n] of actualCounts) {
    const want = expectedCounts.get(fp) ?? 0;
    if (n > want) unexpected += n - want;
  }
  if (unexpected > 0) {
    errors.push(
      `frozen operation preservation failed: repaired plan has ${unexpected} unexpected frozen-scope operation(s)`,
    );
  }

  if (actualFrozen.length !== expected.length && errors.length === 0) {
    errors.push(
      `frozen operation preservation failed: expected ${expected.length} frozen ops, found ${actualFrozen.length}`,
    );
  }

  return {
    ok: errors.length === 0 && missing.length === 0 && unexpected === 0,
    expected_count: expected.length,
    actual_count: actualFrozen.length,
    missing_fingerprints: missing,
    unexpected_extra_frozen_like_count: unexpected,
    errors,
  };
}

export function buildConflictRepairSummary(input: {
  attempted: boolean;
  accepted: boolean;
  conflict_report: PrimaryConflictReport;
  repaired_plan: RevisionPlan | null;
  provider_request_id: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  failure_kind: ConflictRepairFailureKind;
  error: string | null;
  preservation: FrozenPreservationResult | null;
  validation: ConflictRepairValidationSummary | null;
}): ConflictRepairSummary {
  return {
    attempted: input.attempted,
    accepted: input.accepted,
    conflict_pair_count: input.conflict_report.pairs.length,
    conflict_scope_key_count: input.conflict_report.conflict_scope_keys.length,
    frozen_operation_count: input.conflict_report.frozen_operation_indices.length,
    repaired_operation_count: input.repaired_plan?.operations.length ?? 0,
    provider_request_id: input.provider_request_id,
    input_tokens: input.input_tokens,
    output_tokens: input.output_tokens,
    failure_kind: input.failure_kind,
    error: input.error,
    preservation: input.preservation,
    validation: input.validation,
  };
}
