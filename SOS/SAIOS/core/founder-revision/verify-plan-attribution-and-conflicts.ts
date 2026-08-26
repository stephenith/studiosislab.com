/**
 * Focused verify: multi-attribution coverage + primary-plan geometry conflicts.
 * Production context: revtask-5585617a-58a (READ-ONLY).
 * No OpenAI. No production task/evidence mutation.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { executeCanvasOperations } from "./CanvasOperationExecutor.js";
import { buildFeedbackCoverage } from "./FeedbackCoverage.js";
import {
  detectInternalPlanMutationConflicts,
  detectRepairMergeConflicts,
} from "./PlanMutationConflicts.js";
import { planFounderCanvasRevision } from "./RevisionPlanner.js";
import {
  detectRepairPrimaryAxisOccupiedConflicts,
} from "./CoveragePlanRepair.js";
import {
  canonicalizeEquivalentHorizontalOwnership,
  operationGenuinelySupportsHeadingMarkerReference,
  operationGenuinelySupportsSectionGrouping,
} from "./EquivalentHorizontalOwnership.js";
import {
  CANONICAL_COLLISION_BOUNDS_QA,
  CANONICAL_VISUAL_CONSISTENCY_QA,
  classifyRequestedChange,
  verificationCheckTypes,
} from "./RequestedChangeClassification.js";
import {
  buildRevisionPlannerPrompt,
  findUncoveredRequestedChanges,
  normalizeFounderFeedbackItem,
  operationFounderAttributions,
  validatePlanCoversRequestedChanges,
  validateRevisionPlan,
  validateRevisionPlanShapeAndOperations,
} from "./RevisionPromptBuilder.js";
import { listRevisionTasks } from "./RevisionTaskStore.js";
import {
  REVISION_PLANNING_JSON_SCHEMA,
  textFormatForRequest,
} from "../providers/openai/OpenAIResponseFactory.js";
import type { ReasoningRequest } from "../ai-brain/ReasoningRequest.js";
import type { FabricCanvasDoc } from "./CanvasInventory.js";
import type {
  CanvasOperation,
  OperationLogEntry,
  RevisionPlan,
  RevisionTask,
} from "./revision-task-types.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/founder-revision/verify-plan-attribution-and-conflicts.json",
);

type Check = { name: string; pass: boolean; detail: string };

function assert(cond: boolean, name: string, detail: string): Check {
  return { name, pass: cond, detail };
}

const FB_REBALANCE =
  "Rebalance the left sidebar so Skills, Projects, Certifications, and Languages stack cleanly without large empty gaps.";
const FB_BALANCE =
  "Improve the overall visual balance between the left and right columns after repositioning.";
const FB_OTHER = "Tighten Experience entry spacing.";
const FB_VERIFY = CANONICAL_COLLISION_BOUNDS_QA;

function baseOp(
  partial: Partial<CanvasOperation> &
    Pick<CanvasOperation, "op" | "founder_feedback_item" | "values">,
): CanvasOperation {
  return {
    before_summary: "prior object state",
    intended_change: "apply mutation",
    confidence: 0.9,
    target_id: partial.target_id ?? "block-skills-4-t2",
    ...partial,
  };
}

function plan(ops: CanvasOperation[]): RevisionPlan {
  return {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "fixture",
    notes: [],
    operations: ops,
  };
}

function canvas(): FabricCanvasDoc {
  return {
    version: "5.3.0",
    width: 794,
    height: 1123,
    objects: [
      {
        type: "textbox",
        id: "block-skills-4-t2",
        left: 40,
        top: 220,
        width: 200,
        height: 40,
        text: "Python",
        data: { id: "block-skills-4-t2", section: "skills" },
      },
      {
        type: "textbox",
        id: "block-skills-4-t3",
        left: 40,
        top: 300,
        width: 200,
        height: 40,
        text: "SQL",
        data: { id: "block-skills-4-t3", section: "skills" },
      },
      {
        type: "textbox",
        id: "h-a",
        left: 284,
        top: 200,
        width: 160,
        height: 20,
        text: "A",
        data: { id: "h-a" },
      },
      {
        type: "textbox",
        id: "h-b",
        left: 300,
        top: 240,
        width: 160,
        height: 20,
        text: "B",
        data: { id: "h-b" },
      },
    ],
  } as FabricCanvasDoc;
}

async function main(): Promise<void> {
  const checks: Check[] = [];
  const beforeFp = listRevisionTasks().map(
    (t) => `${t.task_id}:${t.status}:${t.updated_at}`,
  );
  let openaiCalls = 0;

  // 1 — legacy primary-only attribution still passes
  const legacy = validateRevisionPlanShapeAndOperations(
    plan([
      baseOp({
        op: "set_position",
        values: { top: 188 },
        founder_feedback_item: FB_REBALANCE,
      }),
    ]),
    { requested_changes: [FB_REBALANCE, FB_BALANCE] },
  );
  checks.push(
    assert(
      legacy.ok === true &&
        !legacy.plan?.operations[0]?.founder_feedback_items,
      "1_legacy_primary_only_passes",
      legacy.errors.join("; ") || "ok",
    ),
  );

  // 2 — one real op + secondary covers both
  const multiOp = baseOp({
    op: "set_position",
    values: { top: 188 },
    founder_feedback_item: FB_REBALANCE,
    founder_feedback_items: [FB_BALANCE],
  });
  const multiPlan = plan([multiOp]);
  const cover = validatePlanCoversRequestedChanges(multiPlan, [
    FB_REBALANCE,
    FB_BALANCE,
  ]);
  const uncovered = findUncoveredRequestedChanges(multiPlan, [
    FB_REBALANCE,
    FB_BALANCE,
  ]);
  checks.push(
    assert(
      cover.ok === true &&
        uncovered.length === 0 &&
        operationFounderAttributions(multiOp).length === 2,
      "2_multi_attribution_covers_both",
      JSON.stringify({ cover, uncovered, attrs: operationFounderAttributions(multiOp) }),
    ),
  );

  // 3 — paraphrase secondary does not cover
  const paraphrasePlan = plan([
    baseOp({
      op: "set_position",
      values: { top: 188 },
      founder_feedback_item: FB_REBALANCE,
      founder_feedback_items: [
        "Improve column balance somehow after moving things.",
      ],
    }),
  ]);
  checks.push(
    assert(
      findUncoveredRequestedChanges(paraphrasePlan, [FB_REBALANCE, FB_BALANCE])
        .map((u) => u.text)
        .includes(FB_BALANCE),
      "3_paraphrase_secondary_does_not_cover",
      "ok",
    ),
  );

  // 4 — unknown secondary fails when requested_changes supplied
  const unknown = validateRevisionPlanShapeAndOperations(paraphrasePlan, {
    requested_changes: [FB_REBALANCE, FB_BALANCE],
  });
  checks.push(
    assert(
      unknown.ok === false &&
        unknown.errors.some((e) =>
          e.includes("not an exact requested_changes match"),
        ),
      "4_unknown_secondary_fails",
      unknown.errors.join("; "),
    ),
  );

  // 5 — VERIFICATION_ACCEPTANCE secondary fails
  const verifyAttr = validateRevisionPlanShapeAndOperations(
    plan([
      baseOp({
        op: "set_position",
        values: { top: 188 },
        founder_feedback_item: FB_REBALANCE,
        founder_feedback_items: [FB_VERIFY],
      }),
    ]),
    {
      requested_changes: [
        FB_REBALANCE,
        FB_VERIFY,
        CANONICAL_VISUAL_CONSISTENCY_QA,
      ],
    },
  );
  checks.push(
    assert(
      verifyAttr.ok === false &&
        verifyAttr.errors.some((e) =>
          e.includes("must not claim VERIFICATION_ACCEPTANCE"),
        ),
      "5_verification_secondary_fails",
      verifyAttr.errors.join("; "),
    ),
  );

  // 6 — duplicate secondary strings normalize/dedupe (documented: keep first)
  const dedupe = validateRevisionPlanShapeAndOperations(
    plan([
      baseOp({
        op: "set_position",
        values: { top: 188 },
        founder_feedback_item: FB_REBALANCE,
        founder_feedback_items: [
          FB_BALANCE,
          `  ${FB_BALANCE}  `,
          FB_BALANCE,
        ],
      }),
    ]),
    { requested_changes: [FB_REBALANCE, FB_BALANCE] },
  );
  checks.push(
    assert(
      dedupe.ok === true &&
        dedupe.plan?.operations[0]?.founder_feedback_items?.length === 1,
      "6_duplicate_secondary_deduped",
      JSON.stringify(dedupe.plan?.operations[0]?.founder_feedback_items),
    ),
  );

  // 7 — one execution, FeedbackCoverage evidences both items via same log index
  const exec = executeCanvasOperations({
    canvas: canvas(),
    operations: multiPlan.operations,
  });
  checks.push(
    assert(
      exec.ok === true && exec.log.length === 1 && exec.log[0]?.index === 0,
      "7a_executes_once",
      `logLen=${exec.log.length}`,
    ),
  );
  const cov = buildFeedbackCoverage({
    requested_changes: [FB_REBALANCE, FB_BALANCE],
    plan: multiPlan,
    log: exec.log,
    beforeCanvas: canvas(),
    afterCanvas: exec.canvas,
  });
  const item0 = cov.items.find((i) => i.founder_feedback_item === FB_REBALANCE);
  const item1 = cov.items.find((i) => i.founder_feedback_item === FB_BALANCE);
  // Multi-attribution still maps both items to the same executed op index.
  // Broad visual-balance secondary cannot be promoted to addressed from ops alone.
  checks.push(
    assert(
      item0?.status === "addressed" &&
        item1?.status === "partially_addressed" &&
        item0.evidence.operation_evidence?.length === 1 &&
        item1.evidence.operation_evidence?.length === 1 &&
        String(item1.evidence.notes ?? "").includes("broad visual-balance"),
      "7b_feedback_coverage_both_via_same_op",
      JSON.stringify({
        i0: item0?.status,
        i1: item1?.status,
        notes0: item0?.evidence.notes,
        notes1: item1?.evidence.notes,
      }),
    ),
  );

  // 8 — prefix-only attribution no longer passes
  const prefixFb =
    "Rebalance the left sidebar so Skills, Projects, Certifications, and Languages stack cleanly without large empty gaps. EXTRA TRAILING TEXT THAT DIFFERS.";
  const prefixPlan = plan([
    baseOp({
      op: "set_position",
      values: { top: 188 },
      founder_feedback_item: prefixFb.slice(0, 60),
    }),
  ]);
  const prefixLog: OperationLogEntry[] = [
    {
      index: 0,
      op: "set_position",
      target_id: "block-skills-4-t2",
      founder_feedback_item: prefixFb.slice(0, 60),
      ok: true,
      before: { id: "block-skills-4-t2", top: 220 },
      after: { id: "block-skills-4-t2", top: 188 },
      error: null,
    },
  ];
  const prefixCov = buildFeedbackCoverage({
    requested_changes: [prefixFb],
    plan: prefixPlan,
    log: prefixLog,
    beforeCanvas: canvas(),
    afterCanvas: canvas(),
  });
  checks.push(
    assert(
      prefixCov.items[0]?.status === "not_addressed" &&
        normalizeFounderFeedbackItem(prefixFb.slice(0, 60)) !==
          normalizeFounderFeedbackItem(prefixFb),
      "8_prefix_containment_no_longer_passes",
      String(prefixCov.items[0]?.status),
    ),
  );

  // 9 — production fixture: top=282 then top=268 fails before repair
  const conflict282 = detectInternalPlanMutationConflicts([
    baseOp({
      op: "set_position",
      target_id: "block-skills-4-t3",
      values: { top: 282 },
      founder_feedback_item: FB_REBALANCE,
    }),
    baseOp({
      op: "set_position",
      target_id: "block-skills-4-t3",
      values: { top: 268 },
      founder_feedback_item: FB_OTHER,
    }),
  ]);
  checks.push(
    assert(
      conflict282.ok === false &&
        conflict282.errors.some(
          (e) =>
            e.includes("operations[0]") &&
            e.includes("operations[1]") &&
            e.includes("block-skills-4-t3") &&
            e.includes("top"),
        ),
      "9_skills_t3_282_vs_268_fails",
      conflict282.errors.join("; "),
    ),
  );
  const fullConflict = validateRevisionPlan(
    plan([
      baseOp({
        op: "set_position",
        target_id: "block-skills-4-t3",
        values: { top: 282 },
        founder_feedback_item: FB_REBALANCE,
      }),
      baseOp({
        op: "set_position",
        target_id: "block-skills-4-t3",
        values: { top: 268 },
        founder_feedback_item: FB_OTHER,
      }),
    ]),
    { requested_changes: [FB_REBALANCE, FB_OTHER] },
  );
  checks.push(
    assert(
      fullConflict.ok === false &&
        (fullConflict.errors[0] ?? "").includes("plan mutation conflict"),
      "9b_validateRevisionPlan_rejects_before_completeness",
      fullConflict.errors.join("; "),
    ),
  );

  // 10 — left-only + top-only allowed
  const axisOk = detectInternalPlanMutationConflicts([
    baseOp({
      op: "set_position",
      values: { left: 60 },
      founder_feedback_item: FB_REBALANCE,
    }),
    baseOp({
      op: "set_position",
      values: { top: 200 },
      founder_feedback_item: FB_BALANCE,
    }),
  ]);
  checks.push(
    assert(axisOk.ok === true, "10_left_and_top_independent_allowed", axisOk.errors.join("; ") || "ok"),
  );

  // 11 — exact duplicate primary mutation fails
  const dup = baseOp({
    op: "set_position",
    values: { top: 188 },
    founder_feedback_item: FB_REBALANCE,
  });
  const dupConflict = detectInternalPlanMutationConflicts([dup, { ...dup, founder_feedback_item: FB_BALANCE }]);
  checks.push(
    assert(
      dupConflict.ok === false &&
        dupConflict.errors.some((e) => e.includes("exact duplicate")),
      "11_exact_duplicate_fails",
      dupConflict.errors.join("; "),
    ),
  );

  // 12 — left mutation + align_objects conflicting align_left fails
  const alignConflict = detectInternalPlanMutationConflicts([
    baseOp({
      op: "set_position",
      target_id: "h-a",
      values: { left: 40 },
      founder_feedback_item: FB_REBALANCE,
    }),
    baseOp({
      op: "align_objects",
      target_id: undefined,
      target_ids: ["h-a", "h-b"],
      values: { align_left: 284 },
      founder_feedback_item: FB_BALANCE,
    }),
  ]);
  checks.push(
    assert(
      alignConflict.ok === false &&
        alignConflict.errors.some((e) => e.includes("left")),
      "12_align_left_conflicts_with_left_mutation",
      alignConflict.errors.join("; "),
    ),
  );

  // 13 — existing repair-vs-primary conflict still works
  const repairConflict = detectRepairMergeConflicts(
    [
      baseOp({
        op: "set_position",
        target_id: "block-skills-4-t3",
        values: { top: 282 },
        founder_feedback_item: FB_REBALANCE,
      }),
    ],
    [
      baseOp({
        op: "set_position",
        target_id: "block-skills-4-t3",
        values: { top: 268 },
        founder_feedback_item: FB_BALANCE,
      }),
    ],
  );
  checks.push(
    assert(
      repairConflict.ok === false &&
        repairConflict.errors.some((e) =>
          e.includes("coverage repair merge conflict"),
        ),
      "13_repair_vs_primary_conflict_still_fails",
      repairConflict.errors.join("; "),
    ),
  );

  // 14 — missing genuine item still triggers exactly one repair
  // 15 — multi-attribution-covered item does NOT trigger repair
  const task: RevisionTask = {
    schema_version: "founder-revision-task-1.0.0",
    task_id: "task-plan-integrity-fixture",
    decision_id: "dec-x",
    review_id: "rev-x",
    prior_candidate_id: "cand-x",
    prior_canvas_path: "x.json",
    founder_reason: "fixture",
    requested_changes: [FB_REBALANCE, FB_BALANCE, FB_OTHER],
    role: "Operations Analyst",
    design_family: null,
    status: "PLANNED",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    revised_candidate_id: null,
    revised_review_id: null,
    revision_number: 1,
    error: null,
    openai_execution_path: null,
    publication_allowed: false,
    live: false,
  };

  let repairCalls = 0;
  const primaryOnlyMulti: RevisionPlan = plan([
    baseOp({
      op: "set_position",
      values: { top: 188 },
      founder_feedback_item: FB_REBALANCE,
      founder_feedback_items: [FB_BALANCE],
    }),
  ]);
  const planned = await planFounderCanvasRevision({
    task,
    inventory: [],
    page_width: 794,
    page_height: 1123,
    execute: async (req) => {
      openaiCalls += 1;
      if (String(req.request_id).includes("repair")) {
        repairCalls += 1;
        return {
          status: "COMPLETED",
          structured_output: plan([
            baseOp({
              op: "set_position",
              target_id: "block-skills-4-t3",
              values: { top: 310 },
              founder_feedback_item: FB_OTHER,
            }),
          ]) as unknown as Record<string, unknown>,
          provider_request_id: "repair-1",
          input_tokens: 1,
          output_tokens: 1,
        };
      }
      return {
        status: "COMPLETED",
        structured_output: primaryOnlyMulti as unknown as Record<
          string,
          unknown
        >,
        provider_request_id: "primary-1",
        input_tokens: 1,
        output_tokens: 1,
      };
    },
  });
  checks.push(
    assert(
      planned.ok === true &&
        repairCalls === 1 &&
        openaiCalls === 2 &&
        (planned.coverage_repair?.summary.missing_before.length ?? 0) === 1 &&
        planned.coverage_repair?.summary.missing_before[0]?.text === FB_OTHER,
      "14_genuine_missing_triggers_one_repair",
      JSON.stringify({
        ok: planned.ok,
        repairCalls,
        openaiCalls,
        missing: planned.coverage_repair?.summary.missing_before,
        err: planned.error,
      }),
    ),
  );
  checks.push(
    assert(
      (planned.coverage_repair?.summary.missing_before ?? []).every(
        (m) => m.text !== FB_BALANCE && m.text !== FB_REBALANCE,
      ),
      "15_multi_attribution_does_not_trigger_repair",
      JSON.stringify(planned.coverage_repair?.summary.missing_before),
    ),
  );

  // Primary internal conflict → exactly one ConflictPlanRepair; no CoveragePlanRepair;
  // invalid repaired plan remains fail-closed; max 2 provider calls; no canvas execution.
  let openaiConflict = 0;
  let conflictRepairCalls = 0;
  let coverageRepairOnConflict = 0;
  const conflictPrimary = await planFounderCanvasRevision({
    task: {
      ...task,
      requested_changes: [FB_REBALANCE, FB_OTHER],
    },
    inventory: [],
    page_width: 794,
    page_height: 1123,
    execute: async (req) => {
      openaiConflict += 1;
      const rid = String(req.request_id);
      if (rid.includes("conflict-repair")) conflictRepairCalls += 1;
      if (rid.includes("revplan-repair") && !rid.includes("conflict")) {
        coverageRepairOnConflict += 1;
      }
      // Always return the same conflicting plan (invalid conflict repair).
      return {
        status: "COMPLETED",
        structured_output: plan([
          baseOp({
            op: "set_position",
            target_id: "block-skills-4-t3",
            values: { top: 282 },
            founder_feedback_item: FB_REBALANCE,
          }),
          baseOp({
            op: "set_position",
            target_id: "block-skills-4-t3",
            values: { top: 268 },
            founder_feedback_item: FB_OTHER,
          }),
        ]) as unknown as Record<string, unknown>,
        provider_request_id: rid.includes("conflict")
          ? "conflict-repair-still-bad"
          : "primary-conflict",
        input_tokens: 1,
        output_tokens: 1,
      };
    },
  });
  checks.push(
    assert(
      conflictPrimary.ok === false &&
        conflictPrimary.status === "FAILED_PLAN" &&
        conflictRepairCalls === 1 &&
        coverageRepairOnConflict === 0 &&
        openaiConflict === 2 &&
        conflictPrimary.conflict_repair?.summary.attempted === true &&
        conflictPrimary.coverage_repair == null &&
        String(conflictPrimary.error ?? "").includes("still conflicts"),
      "9c_primary_conflict_triggers_one_conflict_repair_fail_closed",
      JSON.stringify({
        ok: conflictPrimary.ok,
        status: conflictPrimary.ok ? null : conflictPrimary.status,
        conflictRepairCalls,
        coverageRepairOnConflict,
        openaiConflict,
        err: conflictPrimary.ok ? null : conflictPrimary.error,
        conflictAttempted: conflictPrimary.ok
          ? null
          : conflictPrimary.conflict_repair?.summary.attempted,
      }),
    ),
  );
  openaiCalls += openaiConflict;

  // 9d — absolute top + relative delta_top on same target still conflicts (validator unchanged)
  const absRelConflict = detectInternalPlanMutationConflicts([
    baseOp({
      op: "set_position",
      target_id: "block-section-example-t1",
      values: { top: 436 },
      founder_feedback_item: FB_REBALANCE,
    }),
    baseOp({
      op: "move_object",
      target_id: "block-section-example-t1",
      values: { delta_top: 30 },
      founder_feedback_item: FB_BALANCE,
    }),
  ]);
  checks.push(
    assert(
      absRelConflict.ok === false &&
        absRelConflict.errors.some(
          (e) =>
            e.includes("plan mutation conflict") &&
            e.includes("block-section-example-t1") &&
            e.includes("top"),
        ),
      "9d_set_top_plus_delta_top_still_conflicts",
      absRelConflict.errors.join("; "),
    ),
  );

  // 9e — provider schema explicitly exposes optional founder_feedback_items
  const schemaOps = (
    REVISION_PLANNING_JSON_SCHEMA as {
      properties: {
        operations: {
          items: {
            required: readonly string[];
            properties: Record<
              string,
              { type?: string; items?: { type?: string } }
            >;
          };
        };
      };
    }
  ).properties.operations.items;
  checks.push(
    assert(
      schemaOps.required.includes("founder_feedback_item") &&
        !schemaOps.required.includes("founder_feedback_items") &&
        schemaOps.properties.founder_feedback_items?.type === "array" &&
        schemaOps.properties.founder_feedback_items?.items?.type === "string",
      "9e_provider_schema_optional_founder_feedback_items",
      JSON.stringify(schemaOps.properties.founder_feedback_items),
    ),
  );
  const fmt = textFormatForRequest({
    request_id: "req-schema-check",
    task_id: "t",
    department: "resume",
    capability: "revision_planning",
    objective: "o",
    instructions: "i",
    context_references: [],
    memory_references: [],
    expected_response_schema: {},
    quality_tier: "strong",
    priority: "high",
    maximum_input_tokens: 1,
    maximum_output_tokens: 1,
    estimated_cost_ceiling_usd: 0,
    timeout_ms: 1,
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
    dry_run: true,
    founder_approval_requirement: true,
  } as ReasoningRequest);
  const fmtSecondary = (
    fmt.schema as {
      properties?: {
        operations?: {
          items?: {
            properties?: { founder_feedback_items?: { type?: string } };
          };
        };
      };
    }
  )?.properties?.operations?.items?.properties?.founder_feedback_items;
  checks.push(
    assert(
      fmt.type === "json_schema" && fmtSecondary?.type === "array",
      "9e_textFormatForRequest_exposes_founder_feedback_items",
      JSON.stringify(fmtSecondary ?? null),
    ),
  );

  // 9f — rendered prompt contract for multi-attribution / coherent geometry
  const prompt = buildRevisionPlannerPrompt({
    task,
    inventory: [],
    page_width: 794,
    page_height: 1123,
    preview_width: 794,
    preview_height: 1123,
  });
  const instr = prompt.instructions;
  checks.push(
    assert(
      instr.includes("Coverage is attribution-based, not operation-count-based") &&
        instr.includes("ONE PHYSICAL MUTATION → ONE OR MORE EXACT FOUNDER ATTRIBUTIONS") &&
        instr.includes("COHERENT FINAL GEOMETRY BEFORE MULTI-ATTRIBUTION") &&
        instr.includes(
          "Do NOT emit another same-axis operation on the same target merely to obtain coverage",
        ) &&
        instr.includes(
          "fail BEFORE CoveragePlanRepair and BEFORE canvas execution",
        ) &&
        instr.includes("COMPLETE EXAMPLE OPERATION (multi-attribution") &&
        instr.includes('"founder_feedback_items"') &&
        instr.includes("block-section-example-t1") &&
        instr.includes("Never include VERIFICATION_ACCEPTANCE items") &&
        instr.includes(
          "Final collision/bounds QA items classified by the system as VERIFICATION_ACCEPTANCE require ZERO operations",
        ),
      "9f_prompt_multi_attribution_and_coherent_geometry_contract",
      "prompt contract present",
    ),
  );
  checks.push(
    assert(
      instr.includes("OPERATION CAPABILITY GRAMMAR") &&
        instr.includes(
          "Do not include an unchanged left in a set_position operation merely by copying inventory geometry",
        ) &&
        instr.includes(
          "If align_objects legitimately owns a target's left axis",
        ) &&
        instr.includes("zero new operations is valid") &&
        !instr.includes(
          "Example values keys: left, top, width, height, fill, stroke, text, fontSize, lineHeight, delta_top, delta_left, delta_height, align_left.",
        ),
      "9f2_prompt_shared_operation_grammar_identity_left_and_zero_ops",
      "shared grammar identity-left + visual-ref zero-op",
    ),
  );

  // 9g — section-unit coherence + spacing/grouping multi-attribution blocks
  checks.push(
    assert(
      instr.includes("SECTION UNIT COHERENCE") &&
        instr.includes("SECTION SPACING / GROUPING / RHYTHM MULTI-ATTRIBUTION") &&
        instr.includes("Attributing heading-marker-content grouping when the resulting geometry separates marker from heading") &&
        instr.includes("SECTION UNIT SELF-CONSISTENCY"),
      "9g_section_unit_and_grouping_attribution_prompt",
      "ok",
    ),
  );

  // 9h — primary-axis conflict helper (same-target top vs top)
  const paPrimary = baseOp({
    op: "set_position",
    target_id: "block-certifications-6-r0",
    values: { top: 380 },
    founder_feedback_item: FB_REBALANCE,
  });
  const paRepair = baseOp({
    op: "set_position",
    target_id: "block-certifications-6-r0",
    values: { top: 507 },
    founder_feedback_item: FB_BALANCE,
  });
  const paAxis = detectRepairPrimaryAxisOccupiedConflicts(
    [paPrimary],
    [paRepair],
  );
  checks.push(
    assert(
      paAxis.ok === false &&
        paAxis.errors.some((e) =>
          e.includes("COVERAGE_REPAIR_PRIMARY_AXIS_CONFLICT"),
        ),
      "9h_primary_axis_conflict_helper",
      paAxis.errors.join("; "),
    ),
  );

  // 9i — merge conflict detection unchanged alongside primary-axis check
  checks.push(
    assert(
      detectRepairMergeConflicts([paPrimary], [paRepair]).ok === false,
      "9i_merge_conflicts_still_detects_same_axis",
      "ok",
    ),
  );

  // --- Rev3 redundant horizontal ownership + semantic attribution (A–K, N, O) ---
  const FB_ALIGN_HEADINGS =
    "Align the sidebar section headings Skills, Projects, Certifications, and Languages to one consistent left anchor within the sidebar, and align their blue accent markers consistently relative to those headings.";
  const FB_OVERLAP =
    "Remove every visible text overlap and collision in the left sidebar, especially within the Skills, Projects, and Certifications sections, so every line is fully readable.";
  const FB_ITEM9 =
    "Use the Summary heading and its blue accent marker as a visual reference for a clean and consistent heading-marker relationship, while preserving the separate horizontal anchors of the sidebar and main column.";
  const FB_ITEM10 =
    "Keep each section's heading, blue accent marker, and associated content visually grouped as one unit with consistent internal spacing.";
  const FB_REV3_12 =
    "Preserve the improved Summary → Experience spacing and the current Experience layout; do not undo the spacing corrections that are already visually satisfactory.";
  const FB_REV3_13 =
    "Preserve the current dark header, two-column architecture, typography hierarchy, colors, sidebar background, and overall visual identity; fix the layout defects without redesigning the template.";
  const FB_REV3_14 =
    "After all reflow and repositioning, verify the complete final canvas for zero text-to-text overlap, zero heading-to-content collision, zero section intrusion, zero clipping, and zero out-of-bounds content.";
  const FB_REV3_15 =
    "Keep the entire resume on one page and do not remove, shorten, invent, or alter factual resume content merely to make the layout fit.";

  const posXY = baseOp({
    op: "set_position",
    target_id: "block-projects-5-t1",
    values: { left: 60, top: 280 },
    founder_feedback_item: FB_ALIGN_HEADINGS,
    founder_feedback_items: [FB_OVERLAP],
    intended_change: "Set Projects heading left and top",
    before_summary: "Projects heading Textbox currently at left=48 top=250",
  });
  const alignXY = baseOp({
    op: "align_objects",
    target_id: undefined,
    target_ids: ["block-projects-5-t1", "block-skills-4-t1"],
    values: { align_left: 60 },
    founder_feedback_item: FB_ALIGN_HEADINGS,
    intended_change: "Align sidebar headings to one left anchor",
    before_summary: "Sidebar heading textboxes at mixed left positions",
  });

  const canonA = canonicalizeEquivalentHorizontalOwnership([posXY, alignXY]);
  const posA = canonA.operations.find((o) => o.op === "set_position");
  const alignA = canonA.operations.find((o) => o.op === "align_objects");
  const detectA = detectInternalPlanMutationConflicts(canonA.operations);
  checks.push(
    assert(
      !!posA &&
        posA.values?.left === undefined &&
        posA.values?.top === 280 &&
        !!alignA &&
        alignA.values?.align_left === 60 &&
        JSON.stringify(alignA.target_ids) ===
          JSON.stringify(["block-projects-5-t1", "block-skills-4-t1"]) &&
        detectA.ok === true,
      "R3A_canonicalize_equal_left_preserves_top_and_passes_detector",
      JSON.stringify({
        posValues: posA?.values,
        alignValues: alignA?.values,
        detect: detectA,
        stripped: canonA.stripped_left_indices,
      }),
    ),
  );

  const posB = baseOp({
    op: "set_position",
    target_id: "block-projects-5-t1",
    values: { left: 40, top: 280 },
    founder_feedback_item: FB_ALIGN_HEADINGS,
  });
  const alignB = baseOp({
    op: "align_objects",
    target_id: undefined,
    target_ids: ["block-projects-5-t1", "block-skills-4-t1"],
    values: { align_left: 60 },
    founder_feedback_item: FB_BALANCE,
  });
  const canonB = canonicalizeEquivalentHorizontalOwnership([posB, alignB]);
  const detectB = detectInternalPlanMutationConflicts(canonB.operations);
  checks.push(
    assert(
      canonB.stripped_left_indices.length === 0 &&
        canonB.removed_indices.length === 0 &&
        canonB.operations[0]?.values?.left === 40 &&
        detectB.ok === false,
      "R3B_unequal_left_no_canonicalize_detector_fails",
      JSON.stringify({
        stripped: canonB.stripped_left_indices,
        detect: detectB.errors,
      }),
    ),
  );

  const posC = baseOp({
    op: "set_position",
    target_id: "block-projects-5-t1",
    values: { left: 60, top: 280 },
    founder_feedback_item: FB_ALIGN_HEADINGS,
  });
  const moveC = baseOp({
    op: "move_object",
    target_id: "block-projects-5-t1",
    values: { delta_left: 4 },
    founder_feedback_item: FB_OVERLAP,
  });
  const alignC = baseOp({
    op: "align_objects",
    target_id: undefined,
    target_ids: ["block-projects-5-t1", "block-skills-4-t1"],
    values: { align_left: 60 },
    founder_feedback_item: FB_BALANCE,
  });
  const canonC = canonicalizeEquivalentHorizontalOwnership([posC, moveC, alignC]);
  checks.push(
    assert(
      canonC.stripped_left_indices.length === 0 &&
        canonC.operations[0]?.values?.left === 60 &&
        canonC.operations[1]?.values?.delta_left === 4,
      "R3C_delta_left_involved_no_canonicalize",
      JSON.stringify({
        stripped: canonC.stripped_left_indices,
        values: canonC.operations.map((o) => o.values),
      }),
    ),
  );

  const posD = baseOp({
    op: "set_position",
    target_id: "block-projects-5-t1",
    values: { top: 280 },
    founder_feedback_item: FB_OVERLAP,
  });
  const alignD = baseOp({
    op: "align_objects",
    target_id: undefined,
    target_ids: ["block-projects-5-t1", "block-skills-4-t1"],
    values: { align_left: 60 },
    founder_feedback_item: FB_ALIGN_HEADINGS,
  });
  const canonD = canonicalizeEquivalentHorizontalOwnership([posD, alignD]);
  const detectD = detectInternalPlanMutationConflicts(canonD.operations);
  checks.push(
    assert(
      canonD.stripped_left_indices.length === 0 &&
        canonD.operations[0]?.values?.top === 280 &&
        canonD.operations[1]?.values?.align_left === 60 &&
        detectD.ok === true,
      "R3D_top_plus_align_left_valid_top_preserved",
      JSON.stringify({ detect: detectD, values: canonD.operations.map((o) => o.values) }),
    ),
  );

  const unrelatedE = baseOp({
    op: "set_position",
    target_id: "block-languages-7-t2",
    values: { top: 500, left: 48 },
    founder_feedback_item: FB_OVERLAP,
  });
  const canonE = canonicalizeEquivalentHorizontalOwnership([
    posXY,
    alignXY,
    unrelatedE,
  ]);
  const unrelatedKept = canonE.operations.find(
    (o) => o.target_id === "block-languages-7-t2",
  );
  checks.push(
    assert(
      unrelatedKept?.values?.top === 500 &&
        unrelatedKept?.values?.left === 48 &&
        canonE.operations.find((o) => o.op === "set_position" && o.target_id === "block-projects-5-t1")
          ?.values?.top === 280,
      "R3E_never_removes_unrelated_geometry",
      JSON.stringify({
        unrelated: unrelatedKept?.values,
        stripped: canonE.stripped_left_indices,
      }),
    ),
  );

  checks.push(
    assert(
      instr.includes("CANONICAL GEOMETRY OWNERSHIP") &&
        instr.includes("emit ONE mutation owner") &&
        instr.includes("do not also emit set_position.left") &&
        instr.includes("do not emit move_object.delta_left") &&
        instr.includes("INVALID: set_position(X, { left: 60, top: 280 })") &&
        instr.includes("VALID: set_position(X, { top: 280 })"),
      "R3G_primary_prompt_forbids_dual_horizontal_ownership",
      "canonical ownership block present",
    ),
  );

  const posH = canonA.operations.find(
    (o) => o.op === "set_position" && o.target_id === "block-projects-5-t1",
  );
  const alignH = canonA.operations.find((o) => o.op === "align_objects");
  const posHAttrs = posH ? operationFounderAttributions(posH) : [];
  const alignHAttrs = alignH ? operationFounderAttributions(alignH) : [];
  checks.push(
    assert(
      !!posH &&
        !posHAttrs.some((a) => normalizeFounderFeedbackItem(a) === normalizeFounderFeedbackItem(FB_ALIGN_HEADINGS)) &&
        posHAttrs.some((a) => normalizeFounderFeedbackItem(a) === normalizeFounderFeedbackItem(FB_OVERLAP)) &&
        alignHAttrs.some((a) => normalizeFounderFeedbackItem(a) === normalizeFounderFeedbackItem(FB_ALIGN_HEADINGS)),
      "R3H_horizontal_attribution_not_blindly_retained_on_top_only",
      JSON.stringify({ posHAttrs, alignHAttrs }),
    ),
  );

  const item9Align = baseOp({
    op: "align_objects",
    target_id: undefined,
    target_ids: ["block-summary-1-t1", "block-summary-1-r0"],
    values: { align_left: 284 },
    founder_feedback_item: FB_ITEM9,
    intended_change: "Align Summary heading and blue accent marker",
    before_summary: "Summary heading Textbox and marker Rect",
  });
  checks.push(
    assert(
      operationGenuinelySupportsHeadingMarkerReference(item9Align) === true &&
        instr.includes("heading-marker relationship") &&
        instr.includes("sidebar marker alignment") &&
        instr.includes("Do not create a new mutation solely for this attribution") &&
        instr.includes("Zero new operations for that requirement is preferable"),
      "R3I_item9_supportable_by_heading_marker_alignment",
      JSON.stringify({
        genuine: operationGenuinelySupportsHeadingMarkerReference(item9Align),
      }),
    ),
  );

  const eduBodyOnly = baseOp({
    op: "set_position",
    target_id: "block-education-3-t2",
    values: { top: 620 },
    founder_feedback_item: FB_ITEM10,
    intended_change: "Move Education body textbox",
    before_summary: "Education body Textbox content block-education-3-t2",
  });
  const sectionHeading = baseOp({
    op: "set_position",
    target_id: "block-skills-4-t1",
    values: { top: 188 },
    founder_feedback_item: FB_ITEM10,
    intended_change: "Move Skills heading with its section unit",
    before_summary: "Skills heading Textbox",
  });
  checks.push(
    assert(
      operationGenuinelySupportsSectionGrouping(eduBodyOnly, FB_ITEM10) === false &&
        operationGenuinelySupportsSectionGrouping(sectionHeading, FB_ITEM10) === true &&
        instr.includes("Education body-only") &&
        instr.includes("each section"),
      "R3J_item10_not_genuinely_satisfied_by_education_body_only",
      JSON.stringify({
        edu: operationGenuinelySupportsSectionGrouping(eduBodyOnly, FB_ITEM10),
        heading: operationGenuinelySupportsSectionGrouping(sectionHeading, FB_ITEM10),
      }),
    ),
  );
  const item10ExactCover = validatePlanCoversRequestedChanges(plan([eduBodyOnly]), [
    FB_ITEM10,
  ]);
  checks.push(
    assert(
      item10ExactCover.ok === true,
      "R3J_feedbackItemCovered_remains_text_exact_at_completeness",
      JSON.stringify(item10ExactCover),
    ),
  );

  const leftOnly = baseOp({
    op: "set_position",
    target_id: "block-projects-5-t1",
    values: { left: 60 },
    founder_feedback_item: FB_ALIGN_HEADINGS,
  });
  const canonLeftOnly = canonicalizeEquivalentHorizontalOwnership([
    leftOnly,
    alignXY,
  ]);
  checks.push(
    assert(
      canonLeftOnly.removed_indices.length === 1 &&
        canonLeftOnly.operations.length === 1 &&
        canonLeftOnly.operations[0]?.op === "align_objects" &&
        detectInternalPlanMutationConflicts(canonLeftOnly.operations).ok === true,
      "R3A2_left_only_set_position_removed_when_geometry_empty",
      JSON.stringify({
        removed: canonLeftOnly.removed_indices,
        ops: canonLeftOnly.operations.map((o) => o.op),
      }),
    ),
  );

  const detectK = detectInternalPlanMutationConflicts([posB, alignB]);
  checks.push(
    assert(
      detectK.ok === false && detectK.errors.some((e) => e.includes("left")),
      "R3K_different_value_set_position_align_objects_hard_conflict",
      detectK.errors.join("; "),
    ),
  );

  const cl12 = classifyRequestedChange(FB_REV3_12);
  const cl13 = classifyRequestedChange(FB_REV3_13);
  const cl14 = classifyRequestedChange(FB_REV3_14);
  const cl15 = classifyRequestedChange(FB_REV3_15);
  checks.push(
    assert(
      cl12.classification === "VERIFICATION_ACCEPTANCE" &&
        verificationCheckTypes(cl12).includes("LAYOUT_PRESERVATION") &&
        cl13.classification === "VERIFICATION_ACCEPTANCE" &&
        verificationCheckTypes(cl13).includes("ARCHITECTURE_PRESERVATION") &&
        cl14.classification === "VERIFICATION_ACCEPTANCE" &&
        verificationCheckTypes(cl14).includes("COLLISION_BOUNDS") &&
        cl15.classification === "VERIFICATION_ACCEPTANCE" &&
        verificationCheckTypes(cl15).includes("PAGE_FIT") &&
        verificationCheckTypes(cl15).includes("CONTENT_PRESERVATION"),
      "R3N_items_12_15_verification_check_types_unchanged",
      JSON.stringify({ cl12, cl13, cl14, cl15 }),
    ),
  );

  checks.push(
    assert(
      instr.includes("content-bottom >= next-section heading/marker top") &&
        instr.includes("VERTICAL SECTION STACK") &&
        instr.includes("Do not solve horizontal ownership while leaving vertical section units overlapping"),
      "R3O_section_unit_forbids_content_bottom_gte_next_heading_top",
      "section-stack forbidden phrase present",
    ),
  );

  // 16 / 17
  const afterFp = listRevisionTasks().map(
    (t) => `${t.task_id}:${t.status}:${t.updated_at}`,
  );
  checks.push(
    assert(
      openaiCalls === 4,
      "16_openai_only_injected_fixture_calls",
      `n=${openaiCalls} (injected execute only; no live provider; coverage path 2 + conflict path 2)`,
    ),
  );
  checks.push(
    assert(
      JSON.stringify(beforeFp) === JSON.stringify(afterFp),
      "17_production_task_fingerprint_unchanged",
      "ok",
    ),
  );

  const failed = checks.filter((c) => !c.pass);
  const report = {
    ok: failed.length === 0,
    at: new Date().toISOString(),
    openai_calls_injected: openaiCalls,
    live_openai: false,
    checks,
    failed: failed.map((c) => c.name),
    notes: {
      duplicate_secondary_policy:
        "exact-normalized duplicates in founder_feedback_items are deduped (keep first)",
    },
  };
  mkdirSync(join(REPO, "SOS/07_LOGS/saios/founder-revision"), {
    recursive: true,
  });
  writeFileSync(OUT, JSON.stringify(report, null, 2));
  if (!report.ok) {
    console.error(
      "verify-plan-attribution-and-conflicts FAILED:\n",
      failed.map((c) => `${c.name}: ${c.detail}`).join("\n"),
    );
    process.exit(1);
  }
  console.log(
    `verify-plan-attribution-and-conflicts OK (${checks.length} checks)`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
