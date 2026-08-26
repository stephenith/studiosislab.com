/**
 * Founder-gated OpenAI revision planner.
 * Uses revision_planning capability.
 * LIVE must remain OFF. No publication.
 *
 * Primary holistic planner first.
 * - Internal geometry conflicts → exactly ONE ConflictPlanRepair (complete plan).
 *   CoveragePlanRepair is NEVER called in that branch (max 2 provider calls).
 * - No conflicts but missing MUTATION_REQUIRED coverage → exactly ONE CoveragePlanRepair
 *   (append ops); merged plan must pass full validateRevisionPlan.
 * ConflictPlanRepair XOR CoveragePlanRepair — never both in one invocation.
 */
import { randomUUID } from "node:crypto";
import { OpenAIProvider } from "../providers/openai/OpenAIProvider.js";
import type { ReasoningRequest } from "../ai-brain/ReasoningRequest.js";
import { canUseFounderOpenAIOneTest } from "../resume-integration/FounderOpenAIOneTest.js";
import type {
  CanvasInventoryObject,
  CanvasOperation,
  RevisionPlan,
  RevisionTask,
} from "./revision-task-types.js";
import {
  buildConflictRepairSummary,
  buildPrimaryConflictReport,
  validateFrozenOperationPreservation,
  type ConflictRepairEvidence,
  type ConflictRepairFailureKind,
  type ConflictRepairValidationSummary,
  type PrimaryConflictReport,
} from "./ConflictPlanRepair.js";
import {
  buildCoverageRepairSummary,
  detectRepairMergeConflicts,
  detectRepairPrimaryAxisOccupiedConflicts,
  mergePrimaryAndRepairPlans,
  type CoverageRepairSummary,
} from "./CoveragePlanRepair.js";
import {
  detectInternalPlanMutationConflicts,
  targetIdsOf,
} from "./PlanMutationConflicts.js";
import { canonicalizeRevisionPlanHorizontalOwnership } from "./EquivalentHorizontalOwnership.js";
import {
  buildRevisionConflictRepairPrompt,
  buildRevisionCoverageRepairPrompt,
  buildRevisionPlannerPrompt,
  extractPlanFromProviderOutput,
  findUncoveredRequestedChanges,
  normalizeFounderFeedbackItem,
  validateRevisionPlan,
  validateRevisionPlanShapeAndOperations,
  type UncoveredRequestedChange,
} from "./RevisionPromptBuilder.js";

/** Bounded output budget for ~15–30 inventory-backed operations (Founder revision). */
export const REVISION_PLANNING_MAX_OUTPUT_TOKENS = 12_000;

/** Smaller budget for one-shot coverage repair (few ops). */
export const REVISION_COVERAGE_REPAIR_MAX_OUTPUT_TOKENS = 4_000;

/** Conflict repair returns a complete plan — same budget class as primary. */
export const REVISION_CONFLICT_REPAIR_MAX_OUTPUT_TOKENS =
  REVISION_PLANNING_MAX_OUTPUT_TOKENS;

export type PlannerExecuteFn = (request: ReasoningRequest) => Promise<{
  status: string;
  structured_output: Record<string, unknown> | null;
  provider_request_id?: string | null;
  model_identifier_internal?: string | null;
  input_tokens?: number | null;
  output_tokens?: number | null;
  error_details?: { message?: string; code?: string } | null;
  safety_flags?: unknown;
}>;

export type CoverageRepairEvidence = {
  summary: CoverageRepairSummary;
  repair_prompt: { objective: string; instructions: string } | null;
  repair_raw_structured: Record<string, unknown> | null;
  repair_plan: RevisionPlan | null;
  primary_plan: RevisionPlan | null;
  provider_request_id: string | null;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
};

export type PlannerResult =
  | {
      ok: true;
      plan: RevisionPlan;
      provider: "openai";
      provider_request_id: string | null;
      model: string | null;
      input_tokens: number | null;
      output_tokens: number | null;
      raw_structured: Record<string, unknown>;
      prompt: { objective: string; instructions: string };
      coverage_repair: CoverageRepairEvidence | null;
      conflict_repair: ConflictRepairEvidence | null;
    }
  | {
      ok: false;
      error: string;
      status: "FAILED_PROVIDER" | "FAILED_PLAN";
      prompt: { objective: string; instructions: string } | null;
      raw_structured?: Record<string, unknown> | null;
      /** Provider-boundary diagnostics (truncation / incomplete JSON). */
      provider_diagnostics?: Record<string, unknown> | null;
      coverage_repair?: CoverageRepairEvidence | null;
      conflict_repair?: ConflictRepairEvidence | null;
      /** Structurally valid primary plan when completeness-only failure / repair attempted. */
      primary_plan?: RevisionPlan | null;
    };

export type { ConflictRepairEvidence, PrimaryConflictReport };

function buildPrimaryRequest(
  task: RevisionTask,
  prompt: { objective: string; instructions: string },
): ReasoningRequest {
  return {
    request_id: `req-revplan-${randomUUID().slice(0, 10)}`,
    task_id: task.task_id,
    department: "resume",
    capability: "revision_planning",
    objective: prompt.objective,
    instructions: prompt.instructions,
    context_references: [
      task.prior_candidate_id,
      task.decision_id,
      task.prior_canvas_path,
    ],
    memory_references: [],
    expected_response_schema: {
      schema_version: "founder-canvas-revision-plan-1.0.0",
      summary: "string",
      notes: "string[]",
      operations: [
        {
          op: "allowlisted CanvasOpType",
          target_id:
            "string (required for single-target ops; NOT valid as sole target for align_objects/group_objects)",
          before_summary: "string (required, non-empty)",
          intended_change: "string (required, non-empty)",
          values: "object (required)",
          founder_feedback_item: "string (required primary exact Founder line)",
          founder_feedback_items:
            "optional string[] of additional exact overlapping MUTATION_REQUIRED Founder lines for the SAME physical mutation",
          confidence: "number 0..1 (required)",
          target_ids:
            "REQUIRED string[] with minimum 2 inventory IDs for align_objects/group_objects",
          selector:
            "NOT valid as the sole targeting mechanism for align_objects/group_objects (target_ids required)",
        },
      ],
    },
    quality_tier: "strong",
    priority: "high",
    maximum_input_tokens: 8000,
    maximum_output_tokens: REVISION_PLANNING_MAX_OUTPUT_TOKENS,
    estimated_cost_ceiling_usd: 0.25,
    timeout_ms: 120_000,
    retry_policy: { max_retries: 0, backoff_ms: 0, retry_on: [] },
    fallback_policy: {
      enabled: false,
      allow_provider_fallback: false,
      allow_local_to_api: false,
      respect_privacy: true,
      respect_budget: true,
      respect_founder_gates: true,
      respect_live_gates: true,
    },
    privacy_classification: "INTERNAL",
    created_at: new Date().toISOString(),
    deadline: null,
    dry_run: false,
    founder_approval_requirement: true,
  };
}

function buildRepairRequest(
  task: RevisionTask,
  prompt: { objective: string; instructions: string },
): ReasoningRequest {
  const base = buildPrimaryRequest(task, prompt);
  return {
    ...base,
    // Dedicated capability → CoveragePlanRepair JSON schema (strict:false advisory).
    capability: "revision_coverage_repair",
    request_id: `req-revplan-repair-${randomUUID().slice(0, 10)}`,
    maximum_output_tokens: REVISION_COVERAGE_REPAIR_MAX_OUTPUT_TOKENS,
    estimated_cost_ceiling_usd: 0.08,
    maximum_input_tokens: 6000,
    timeout_ms: 90_000,
  };
}

function buildConflictRepairRequest(
  task: RevisionTask,
  prompt: { objective: string; instructions: string },
): ReasoningRequest {
  const base = buildPrimaryRequest(task, prompt);
  return {
    ...base,
    request_id: `req-revplan-conflict-repair-${randomUUID().slice(0, 10)}`,
    maximum_output_tokens: REVISION_CONFLICT_REPAIR_MAX_OUTPUT_TOKENS,
    estimated_cost_ceiling_usd: 0.25,
    maximum_input_tokens: 8000,
    timeout_ms: 120_000,
  };
}

function isIncompleteProviderWrapper(so: Record<string, unknown>): boolean {
  const soNotes = Array.isArray(so.notes) ? so.notes.map(String) : [];
  return (
    soNotes.includes("openai_response_was_not_json_object") ||
    soNotes.includes("revision_planning_incomplete_json") ||
    soNotes.includes("openai_output_truncated")
  );
}

function hasValidOperationConfidence(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return false;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 1;
}

/** Deterministic provenance key: op type + target identity + primary founder_feedback_item. */
function operationConfidenceProvenanceKey(op: CanvasOperation): string {
  const ids = targetIdsOf(op);
  const target =
    ids.length > 0
      ? `ids:${[...ids]
          .map((s) => s.trim())
          .filter(Boolean)
          .sort()
          .join(",")}`
      : op.target_id
        ? `id:${op.target_id.trim()}`
        : "id:";
  return JSON.stringify({
    op: op.op,
    target,
    founder_feedback_item: normalizeFounderFeedbackItem(
      String(op.founder_feedback_item ?? ""),
    ),
  });
}

/**
 * Conflict-repair only: restore missing confidence from the already-validated
 * primary plan when deterministic operation provenance matches (op + targets +
 * founder_feedback_item). Does not invent defaults — unmatched ops stay missing
 * so validateRevisionPlanShapeAndOperations fails closed.
 */
export function restoreMissingConfidenceFromPrimary(
  primaryPlan: RevisionPlan,
  extracted: unknown,
): unknown {
  if (!extracted || typeof extracted !== "object" || Array.isArray(extracted)) {
    return extracted;
  }
  const root = extracted as Record<string, unknown>;
  const ops = root.operations;
  if (!Array.isArray(ops)) return extracted;

  const primaryByProvenance = new Map<string, number>();
  for (const primaryOp of primaryPlan.operations) {
    const key = operationConfidenceProvenanceKey(primaryOp);
    if (!primaryByProvenance.has(key)) {
      primaryByProvenance.set(key, primaryOp.confidence);
    }
  }

  const sameLength = ops.length === primaryPlan.operations.length;

  const restoredOps = ops.map((rawOp, index) => {
    if (!rawOp || typeof rawOp !== "object" || Array.isArray(rawOp)) {
      return rawOp;
    }
    const opRecord = { ...(rawOp as Record<string, unknown>) };
    if (hasValidOperationConfidence(opRecord.confidence)) {
      return opRecord;
    }

    const repairedOp = opRecord as unknown as CanvasOperation;
    const provenanceKey = operationConfidenceProvenanceKey(repairedOp);
    let confidence = primaryByProvenance.get(provenanceKey);

    if (confidence == null && sameLength) {
      const primaryAtIndex = primaryPlan.operations[index];
      if (
        primaryAtIndex &&
        operationConfidenceProvenanceKey(primaryAtIndex) === provenanceKey &&
        hasValidOperationConfidence(primaryAtIndex.confidence)
      ) {
        confidence = primaryAtIndex.confidence;
      }
    }

    if (confidence != null && hasValidOperationConfidence(confidence)) {
      opRecord.confidence = confidence;
    }
    return opRecord;
  });

  return { ...root, operations: restoredOps };
}

async function runConflictPlanRepair(input: {
  task: RevisionTask;
  inventory: CanvasInventoryObject[];
  page_width: number;
  page_height: number;
  primaryPlan: RevisionPlan;
  conflictReport: PrimaryConflictReport;
  execute: PlannerExecuteFn;
}): Promise<{
  ok: boolean;
  plan: RevisionPlan | null;
  error: string | null;
  status: "FAILED_PROVIDER" | "FAILED_PLAN" | null;
  evidence: ConflictRepairEvidence;
}> {
  const repairPrompt = buildRevisionConflictRepairPrompt({
    task: input.task,
    inventory: input.inventory,
    page_width: input.page_width,
    page_height: input.page_height,
    primaryPlan: input.primaryPlan,
    conflictReport: input.conflictReport,
  });

  const emptyEvidence = (
    partial: Partial<ConflictRepairEvidence> & {
      summary: ConflictRepairEvidence["summary"];
    },
  ): ConflictRepairEvidence => ({
    repair_prompt: repairPrompt,
    repair_raw_structured: null,
    repaired_plan: null,
    primary_plan: input.primaryPlan,
    conflict_report: input.conflictReport,
    provider_request_id: null,
    model: null,
    input_tokens: null,
    output_tokens: null,
    ...partial,
  });

  const fail = (
    error: string,
    status: "FAILED_PROVIDER" | "FAILED_PLAN",
    failure_kind: ConflictRepairFailureKind,
    extra: Partial<ConflictRepairEvidence> = {},
    validation: ConflictRepairValidationSummary | null = null,
    preservation: ConflictRepairEvidence["summary"]["preservation"] = null,
  ) => ({
    ok: false as const,
    plan: null,
    error,
    status,
    evidence: emptyEvidence({
      ...extra,
      summary: buildConflictRepairSummary({
        attempted: true,
        accepted: false,
        conflict_report: input.conflictReport,
        repaired_plan: extra.repaired_plan ?? null,
        provider_request_id: extra.provider_request_id ?? null,
        input_tokens: extra.input_tokens ?? null,
        output_tokens: extra.output_tokens ?? null,
        failure_kind,
        error,
        preservation,
        validation,
      }),
    }),
  });

  try {
    const response = await input.execute(
      buildConflictRepairRequest(input.task, repairPrompt),
    );
    const providerMeta = {
      provider_request_id: response.provider_request_id ?? null,
      model: response.model_identifier_internal ?? null,
      input_tokens: response.input_tokens ?? null,
      output_tokens: response.output_tokens ?? null,
    };

    if (response.status !== "COMPLETED" || !response.structured_output) {
      const errMsg =
        response.error_details?.message ??
        `conflict repair failed: provider status ${response.status}`;
      return fail(
        errMsg.startsWith("conflict repair")
          ? errMsg
          : `conflict repair failed: ${errMsg}`,
        "FAILED_PROVIDER",
        "provider",
        { ...providerMeta, repair_raw_structured: response.structured_output },
      );
    }

    const so = response.structured_output;
    if (isIncompleteProviderWrapper(so)) {
      return fail(
        "conflict repair failed: revision_planning_incomplete_json",
        "FAILED_PROVIDER",
        "incomplete_json",
        { ...providerMeta, repair_raw_structured: so },
      );
    }

    const extracted = extractPlanFromProviderOutput(so);
    const withRestoredConfidence = restoreMissingConfidenceFromPrimary(
      input.primaryPlan,
      extracted,
    );
    const shape = validateRevisionPlanShapeAndOperations(withRestoredConfidence, {
      requested_changes: input.task.requested_changes,
    });
    if (!shape.ok || !shape.plan) {
      const errMsg = `conflict repair failed: ${shape.errors.join("; ")}`;
      return fail(errMsg, "FAILED_PLAN", "repair_plan_invalid", {
        ...providerMeta,
        repair_raw_structured: so,
      }, {
        shape_ok: false,
        attribution_ok: false,
        internal_conflicts_ok: false,
        frozen_preservation_ok: false,
        completeness_ok: false,
        accepted: false,
        errors: shape.errors,
      });
    }

    const repairedPlan = canonicalizeRevisionPlanHorizontalOwnership(shape.plan);
    const internal = detectInternalPlanMutationConflicts(repairedPlan.operations);
    if (!internal.ok) {
      const errMsg = `conflict repair still conflicts: ${internal.errors.join("; ")}`;
      return fail(
        errMsg,
        "FAILED_PLAN",
        "still_conflicts",
        {
          ...providerMeta,
          repair_raw_structured: so,
          repaired_plan: repairedPlan,
        },
        {
          shape_ok: true,
          attribution_ok: true,
          internal_conflicts_ok: false,
          frozen_preservation_ok: false,
          completeness_ok: false,
          accepted: false,
          errors: internal.errors,
        },
      );
    }

    const preservation = validateFrozenOperationPreservation(
      input.primaryPlan.operations,
      repairedPlan.operations,
      input.conflictReport,
    );
    if (!preservation.ok) {
      const errMsg = `conflict repair preservation failed: ${preservation.errors.join("; ")}`;
      return fail(
        errMsg,
        "FAILED_PLAN",
        "preservation_failed",
        {
          ...providerMeta,
          repair_raw_structured: so,
          repaired_plan: repairedPlan,
        },
        {
          shape_ok: true,
          attribution_ok: true,
          internal_conflicts_ok: true,
          frozen_preservation_ok: false,
          completeness_ok: false,
          accepted: false,
          errors: preservation.errors,
        },
        preservation,
      );
    }

    const full = validateRevisionPlan(repairedPlan, {
      requested_changes: input.task.requested_changes,
    });
    if (!full.ok || !full.plan) {
      const errMsg = `conflict repair incomplete: ${full.errors.join("; ")}`;
      return fail(
        errMsg,
        "FAILED_PLAN",
        "incomplete_coverage",
        {
          ...providerMeta,
          repair_raw_structured: so,
          repaired_plan: repairedPlan,
        },
        {
          shape_ok: true,
          attribution_ok: true,
          internal_conflicts_ok: true,
          frozen_preservation_ok: true,
          completeness_ok: false,
          accepted: false,
          errors: full.errors,
        },
        preservation,
      );
    }

    const validation: ConflictRepairValidationSummary = {
      shape_ok: true,
      attribution_ok: true,
      internal_conflicts_ok: true,
      frozen_preservation_ok: true,
      completeness_ok: true,
      accepted: true,
      errors: [],
    };

    return {
      ok: true,
      plan: full.plan,
      error: null,
      status: null,
      evidence: emptyEvidence({
        ...providerMeta,
        repair_raw_structured: so,
        repaired_plan: full.plan,
        summary: buildConflictRepairSummary({
          attempted: true,
          accepted: true,
          conflict_report: input.conflictReport,
          repaired_plan: full.plan,
          ...providerMeta,
          failure_kind: null,
          error: null,
          preservation,
          validation,
        }),
      }),
    };
  } catch (e) {
    const errMsg = `conflict repair failed: ${
      e instanceof Error ? e.message : String(e)
    }`;
    return fail(errMsg, "FAILED_PROVIDER", "provider");
  }
}

async function runCoverageRepair(input: {
  task: RevisionTask;
  inventory: CanvasInventoryObject[];
  page_width: number;
  page_height: number;
  primaryPlan: RevisionPlan;
  missing: UncoveredRequestedChange[];
  execute: PlannerExecuteFn;
}): Promise<{
  ok: boolean;
  merged: RevisionPlan | null;
  error: string | null;
  status: "FAILED_PROVIDER" | "FAILED_PLAN" | null;
  evidence: CoverageRepairEvidence;
}> {
  const repairPrompt = buildRevisionCoverageRepairPrompt({
    task: input.task,
    inventory: input.inventory,
    page_width: input.page_width,
    page_height: input.page_height,
    missing: input.missing,
    primaryOperations: input.primaryPlan.operations,
  });

  const emptyEvidence = (
    partial: Partial<CoverageRepairEvidence> & {
      summary: CoverageRepairSummary;
    },
  ): CoverageRepairEvidence => ({
    repair_prompt: repairPrompt,
    repair_raw_structured: null,
    repair_plan: null,
    primary_plan: input.primaryPlan,
    provider_request_id: null,
    model: null,
    input_tokens: null,
    output_tokens: null,
    ...partial,
  });

  try {
    const response = await input.execute(
      buildRepairRequest(input.task, repairPrompt),
    );
    const providerMeta = {
      provider_request_id: response.provider_request_id ?? null,
      model: response.model_identifier_internal ?? null,
      input_tokens: response.input_tokens ?? null,
      output_tokens: response.output_tokens ?? null,
    };

    if (response.status !== "COMPLETED" || !response.structured_output) {
      const errMsg =
        response.error_details?.message ??
        `coverage repair failed: provider status ${response.status}`;
      return {
        ok: false,
        merged: null,
        error: errMsg.startsWith("coverage repair")
          ? errMsg
          : `coverage repair failed: ${errMsg}`,
        status: "FAILED_PROVIDER",
        evidence: emptyEvidence({
          ...providerMeta,
          repair_raw_structured: response.structured_output,
          summary: buildCoverageRepairSummary({
            attempted: true,
            missing_before: input.missing,
            repair_operation_count: 0,
            merged_plan: null,
            requested_changes: input.task.requested_changes,
            merged_validation_pass: false,
            ...providerMeta,
            error: errMsg,
            failure_kind: "provider",
          }),
        }),
      };
    }

    const so = response.structured_output;
    if (isIncompleteProviderWrapper(so)) {
      const errMsg =
        "coverage repair failed: revision_planning_incomplete_json";
      return {
        ok: false,
        merged: null,
        error: errMsg,
        status: "FAILED_PROVIDER",
        evidence: emptyEvidence({
          ...providerMeta,
          repair_raw_structured: so,
          summary: buildCoverageRepairSummary({
            attempted: true,
            missing_before: input.missing,
            repair_operation_count: 0,
            merged_plan: null,
            requested_changes: input.task.requested_changes,
            merged_validation_pass: false,
            ...providerMeta,
            error: errMsg,
            failure_kind: "provider",
          }),
        }),
      };
    }

    const extracted = extractPlanFromProviderOutput(so);
    // Coverage repair is invoked only when MUTATION_REQUIRED items are missing.
    // A successful repair response must include ≥1 operation (empty is invalid).
    const repairShape = validateRevisionPlanShapeAndOperations(extracted, {
      allowEmptyOperations: false,
      requested_changes: input.task.requested_changes,
    });
    if (!repairShape.ok || !repairShape.plan) {
      const errMsg = `coverage repair failed: ${repairShape.errors.join("; ")}`;
      return {
        ok: false,
        merged: null,
        error: errMsg,
        status: "FAILED_PLAN",
        evidence: emptyEvidence({
          ...providerMeta,
          repair_raw_structured: so,
          summary: buildCoverageRepairSummary({
            attempted: true,
            missing_before: input.missing,
            repair_operation_count: 0,
            merged_plan: null,
            requested_changes: input.task.requested_changes,
            merged_validation_pass: false,
            ...providerMeta,
            error: errMsg,
            failure_kind: "repair_plan_invalid",
          }),
        }),
      };
    }

    const repairPlan = canonicalizeRevisionPlanHorizontalOwnership(repairShape.plan);
    const repairInternal = detectInternalPlanMutationConflicts(
      repairPlan.operations,
    );
    if (!repairInternal.ok) {
      const errMsg = repairInternal.errors.join("; ");
      return {
        ok: false,
        merged: null,
        error: errMsg,
        status: "FAILED_PLAN",
        evidence: emptyEvidence({
          ...providerMeta,
          repair_raw_structured: so,
          repair_plan: repairPlan,
          summary: buildCoverageRepairSummary({
            attempted: true,
            missing_before: input.missing,
            repair_operation_count: repairPlan.operations.length,
            merged_plan: null,
            requested_changes: input.task.requested_changes,
            merged_validation_pass: false,
            ...providerMeta,
            error: errMsg,
            failure_kind: "repair_plan_invalid",
          }),
        }),
      };
    }

    const primaryAxisOccupied = detectRepairPrimaryAxisOccupiedConflicts(
      input.primaryPlan.operations,
      repairPlan.operations,
    );
    if (!primaryAxisOccupied.ok) {
      const errMsg = primaryAxisOccupied.errors.join("; ");
      return {
        ok: false,
        merged: null,
        error: errMsg,
        status: "FAILED_PLAN",
        evidence: emptyEvidence({
          ...providerMeta,
          repair_raw_structured: so,
          repair_plan: repairPlan,
          summary: buildCoverageRepairSummary({
            attempted: true,
            missing_before: input.missing,
            repair_operation_count: repairPlan.operations.length,
            merged_plan: null,
            requested_changes: input.task.requested_changes,
            merged_validation_pass: false,
            ...providerMeta,
            error: errMsg,
            failure_kind: "primary_axis_conflict",
          }),
        }),
      };
    }

    const conflicts = detectRepairMergeConflicts(
      input.primaryPlan.operations,
      repairPlan.operations,
    );
    if (!conflicts.ok) {
      const errMsg = conflicts.errors.join("; ");
      return {
        ok: false,
        merged: null,
        error: errMsg,
        status: "FAILED_PLAN",
        evidence: emptyEvidence({
          ...providerMeta,
          repair_raw_structured: so,
          repair_plan: repairPlan,
          summary: buildCoverageRepairSummary({
            attempted: true,
            missing_before: input.missing,
            repair_operation_count: repairPlan.operations.length,
            merged_plan: null,
            requested_changes: input.task.requested_changes,
            merged_validation_pass: false,
            ...providerMeta,
            error: errMsg,
            failure_kind: "merge_conflict",
          }),
        }),
      };
    }

    const merged = canonicalizeRevisionPlanHorizontalOwnership(
      mergePrimaryAndRepairPlans(input.primaryPlan, repairPlan),
    );
    const mergedInternal = detectInternalPlanMutationConflicts(
      merged.operations,
    );
    if (!mergedInternal.ok) {
      const errMsg = mergedInternal.errors.join("; ");
      return {
        ok: false,
        merged: null,
        error: errMsg,
        status: "FAILED_PLAN",
        evidence: emptyEvidence({
          ...providerMeta,
          repair_raw_structured: so,
          repair_plan: repairPlan,
          summary: buildCoverageRepairSummary({
            attempted: true,
            missing_before: input.missing,
            repair_operation_count: repairPlan.operations.length,
            merged_plan: merged,
            requested_changes: input.task.requested_changes,
            merged_validation_pass: false,
            ...providerMeta,
            error: errMsg,
            failure_kind: "merge_conflict",
          }),
        }),
      };
    }

    const full = validateRevisionPlan(merged, {
      requested_changes: input.task.requested_changes,
    });
    if (!full.ok || !full.plan) {
      const errMsg = `coverage repair incomplete: ${full.errors.join("; ")}`;
      return {
        ok: false,
        merged: null,
        error: errMsg,
        status: "FAILED_PLAN",
        evidence: emptyEvidence({
          ...providerMeta,
          repair_raw_structured: so,
          repair_plan: repairPlan,
          summary: buildCoverageRepairSummary({
            attempted: true,
            missing_before: input.missing,
            repair_operation_count: repairPlan.operations.length,
            merged_plan: merged,
            requested_changes: input.task.requested_changes,
            merged_validation_pass: false,
            ...providerMeta,
            error: errMsg,
            failure_kind: "merged_incomplete",
          }),
        }),
      };
    }

    return {
      ok: true,
      merged: full.plan,
      error: null,
      status: null,
      evidence: emptyEvidence({
        ...providerMeta,
        repair_raw_structured: so,
        repair_plan: repairPlan,
        summary: buildCoverageRepairSummary({
          attempted: true,
          missing_before: input.missing,
          repair_operation_count: repairPlan.operations.length,
          merged_plan: full.plan,
          requested_changes: input.task.requested_changes,
          merged_validation_pass: true,
          ...providerMeta,
          error: null,
          failure_kind: null,
        }),
      }),
    };
  } catch (e) {
    const errMsg = `coverage repair failed: ${
      e instanceof Error ? e.message : String(e)
    }`;
    return {
      ok: false,
      merged: null,
      error: errMsg,
      status: "FAILED_PROVIDER",
      evidence: emptyEvidence({
        summary: buildCoverageRepairSummary({
          attempted: true,
          missing_before: input.missing,
          repair_operation_count: 0,
          merged_plan: null,
          requested_changes: input.task.requested_changes,
          merged_validation_pass: false,
          provider_request_id: null,
          input_tokens: null,
          output_tokens: null,
          error: errMsg,
          failure_kind: "provider",
        }),
      }),
    };
  }
}

export async function planFounderCanvasRevision(input: {
  task: RevisionTask;
  inventory: CanvasInventoryObject[];
  page_width: number;
  page_height: number;
  /** Injected planner for tests — receives primary then optional one repair call. */
  execute?: PlannerExecuteFn;
}): Promise<PlannerResult> {
  const prompt = buildRevisionPlannerPrompt({
    task: input.task,
    inventory: input.inventory,
    page_width: input.page_width,
    page_height: input.page_height,
    preview_width: input.page_width,
    preview_height: input.page_height,
  });

  if (!input.execute && !canUseFounderOpenAIOneTest("INTERNAL")) {
    return {
      ok: false,
      error:
        "OpenAI Founder one-test gates closed (LIVE OFF, SOS_AI_FOUNDER_OPENAI_ONE_TEST=1, OPENAI_API_KEY, budget)",
      status: "FAILED_PROVIDER",
      prompt,
    };
  }

  const execute: PlannerExecuteFn =
    input.execute ??
    ((req: ReasoningRequest) => new OpenAIProvider().execute(req));

  try {
    const response = await execute(buildPrimaryRequest(input.task, prompt));
    if (response.status !== "COMPLETED" || !response.structured_output) {
      const errMsg =
        response.error_details?.message ??
        `provider status ${response.status}`;
      const providerDiag = {
        provider_status: response.status,
        failure_code: response.error_details?.code ?? null,
        safety_flags: response.safety_flags,
        input_tokens: response.input_tokens,
        output_tokens: response.output_tokens,
        max_output_tokens: REVISION_PLANNING_MAX_OUTPUT_TOKENS,
        provider_request_id: response.provider_request_id,
        structured_output_is_null: response.structured_output == null,
      };
      return {
        ok: false,
        error: errMsg,
        status: "FAILED_PROVIDER",
        prompt,
        raw_structured: response.structured_output,
        provider_diagnostics: providerDiag,
      };
    }
    const so = response.structured_output;
    if (isIncompleteProviderWrapper(so)) {
      return {
        ok: false,
        error:
          "revision_planning_incomplete_json: rejected synthetic provider summary wrapper (incomplete/non-JSON output)",
        status: "FAILED_PROVIDER",
        prompt,
        raw_structured: so,
        provider_diagnostics: {
          notes: Array.isArray(so.notes) ? so.notes.map(String) : [],
          output_tokens: response.output_tokens,
          max_output_tokens: REVISION_PLANNING_MAX_OUTPUT_TOKENS,
          provider_request_id: response.provider_request_id,
        },
      };
    }

    const extracted = extractPlanFromProviderOutput(so);
    const shape = validateRevisionPlanShapeAndOperations(extracted, {
      requested_changes: input.task.requested_changes,
    });
    if (!shape.ok || !shape.plan) {
      return {
        ok: false,
        error: `invalid revision plan: ${shape.errors.join("; ")}`,
        status: "FAILED_PLAN",
        prompt,
        raw_structured: so,
      };
    }

    const primaryPlan = canonicalizeRevisionPlanHorizontalOwnership(shape.plan);
    const primaryConflicts = detectInternalPlanMutationConflicts(
      primaryPlan.operations,
    );

    // Path C: primary internal conflicts → exactly one ConflictPlanRepair.
    // Never call CoveragePlanRepair in this branch (max 2 provider calls).
    if (!primaryConflicts.ok) {
      const conflictReport = buildPrimaryConflictReport(primaryPlan.operations);
      const conflictRepaired = await runConflictPlanRepair({
        task: input.task,
        inventory: input.inventory,
        page_width: input.page_width,
        page_height: input.page_height,
        primaryPlan,
        conflictReport,
        execute,
      });

      if (!conflictRepaired.ok || !conflictRepaired.plan) {
        return {
          ok: false,
          error: conflictRepaired.error ?? "conflict repair failed",
          status: conflictRepaired.status ?? "FAILED_PLAN",
          prompt,
          raw_structured: so,
          primary_plan: primaryPlan,
          coverage_repair: null,
          conflict_repair: conflictRepaired.evidence,
        };
      }

      return {
        ok: true,
        plan: conflictRepaired.plan,
        provider: "openai",
        provider_request_id: response.provider_request_id ?? null,
        model: response.model_identifier_internal ?? null,
        input_tokens: response.input_tokens ?? null,
        output_tokens: response.output_tokens ?? null,
        raw_structured: response.structured_output,
        prompt,
        coverage_repair: null,
        conflict_repair: conflictRepaired.evidence,
      };
    }

    const missing = findUncoveredRequestedChanges(
      primaryPlan,
      input.task.requested_changes,
    );

    if (missing.length === 0) {
      // Path A: complete + conflict-free → full validate (1 provider call).
      const validated = validateRevisionPlan(primaryPlan, {
        requested_changes: input.task.requested_changes,
      });
      if (!validated.ok || !validated.plan) {
        return {
          ok: false,
          error: `invalid revision plan: ${validated.errors.join("; ")}`,
          status: "FAILED_PLAN",
          prompt,
          raw_structured: so,
          primary_plan: primaryPlan,
          coverage_repair: null,
          conflict_repair: null,
        };
      }
      return {
        ok: true,
        plan: validated.plan,
        provider: "openai",
        provider_request_id: response.provider_request_id ?? null,
        model: response.model_identifier_internal ?? null,
        input_tokens: response.input_tokens ?? null,
        output_tokens: response.output_tokens ?? null,
        raw_structured: response.structured_output,
        prompt,
        coverage_repair: null,
        conflict_repair: null,
      };
    }

    // Path B: completeness-only gap → exactly one CoveragePlanRepair.
    const repaired = await runCoverageRepair({
      task: input.task,
      inventory: input.inventory,
      page_width: input.page_width,
      page_height: input.page_height,
      primaryPlan,
      missing,
      execute,
    });

    if (!repaired.ok || !repaired.merged) {
      return {
        ok: false,
        error: repaired.error ?? "coverage repair failed",
        status: repaired.status ?? "FAILED_PLAN",
        prompt,
        raw_structured: so,
        primary_plan: primaryPlan,
        coverage_repair: repaired.evidence,
        conflict_repair: null,
      };
    }

    return {
      ok: true,
      plan: repaired.merged,
      provider: "openai",
      provider_request_id: response.provider_request_id ?? null,
      model: response.model_identifier_internal ?? null,
      input_tokens: response.input_tokens ?? null,
      output_tokens: response.output_tokens ?? null,
      raw_structured: response.structured_output,
      prompt,
      coverage_repair: repaired.evidence,
      conflict_repair: null,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      status: "FAILED_PROVIDER",
      prompt,
    };
  }
}
