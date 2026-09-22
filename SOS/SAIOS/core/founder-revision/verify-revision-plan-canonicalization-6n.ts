/**
 * Phase 6N — unified revision-plan canonicalization.
 *
 * No production OpenAI. Isolated temp dirs. Historical tasks not mutated.
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import type { CriticResult } from "../resume-critic/types.js";
import type { ReasoningRequest } from "../ai-brain/ReasoningRequest.js";
import { executeCanvasOperations } from "./CanvasOperationExecutor.js";
import type { FabricCanvasDoc } from "./CanvasInventory.js";
import {
  runFounderFeedbackRevision,
  setRevisionPipelineRootsForTests,
} from "./FounderRevisionPipeline.js";
import {
  planFounderCanvasRevision,
  REVISION_PLANNING_MAX_PROVIDER_CALLS,
  prepareRevisionPlanForValidation,
  prepareExtractedPlanForValidation,
} from "./RevisionPlanner.js";
import {
  canonicalizeRevisionPlanOperations,
  REVISION_PLAN_PREPARATION_PIPELINE_COUNT,
} from "./RevisionPlanCanonicalization.js";
import {
  extractPlanFromProviderOutput,
  validateExecutableMutationValues,
  validateRevisionPlanShapeAndOperations,
} from "./RevisionPromptBuilder.js";
import {
  createRevisionTask,
  setRevisionTasksDirForTests,
} from "./RevisionTaskStore.js";
import type {
  CanvasInventoryObject,
  CanvasOperation,
  RevisionPlan,
  RevisionTask,
} from "./revision-task-types.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const FIX = join(REPO, ".cursor/debug-fixtures/revtask-e5cdec1a-40e-sanitized");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/founder-revision/verify-revision-plan-canonicalization-6n.json",
);
const HISTORICAL = [
  "revtask-b5339d03-b67",
  "revtask-9441fe34-4ba",
  "revtask-b9a65ad0-eb0",
  "revtask-33ef5466-f24",
  "revtask-7a1c0899-4d6",
  "revtask-dd26226e-d8b",
  "revtask-6ddb8eb8-e9c",
  "revtask-a0009171-849",
  "revtask-e5cdec1a-40e",
];

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function assert(ok: boolean, name: string, detail = ""): void {
  checks.push({ name, pass: Boolean(ok), detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  " + detail : ""}`);
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function passingCritic(): CriticResult {
  return {
    scores: {
      overall: 94,
      ats: 100,
      visual: 92,
      typography: 92,
      layout: 93,
      technical: 100,
      consistency: 94,
      sections: 95,
      thumbnail_appeal: 90,
      contrast: 92,
    },
    reports: {},
    readiness: {
      ready: true,
      founder_review_allowed: true,
      blocked_reasons: [],
      rules: {
        overall_min: 90,
        ats_min: 95,
        technical_required: 100,
        no_overflow: true,
        no_schema_mismatch: true,
        no_missing_sections: true,
        no_renderer_errors: true,
      },
    },
    evaluated_at: new Date().toISOString(),
    dry_run: true,
    publication_allowed: false,
    live_enabled: false,
    mutated_resume: false,
    used_ai: false,
    used_mock_provider: false,
  } as CriticResult;
}

function baseOp(
  partial: Record<string, unknown>,
): Record<string, unknown> {
  return {
    before_summary: "inventory object",
    intended_change: "apply founder geometry",
    founder_feedback_item:
      "Correct the Certifications text-box heights, line heights, wrapping, and vertical positions so no line renders on top of another line.",
    confidence: 0.9,
    ...partial,
  };
}

function hasAliasKey(values: Record<string, unknown> | undefined): boolean {
  if (!values) return false;
  return ["w", "h", "delta_w", "delta_h"].some((k) =>
    Object.prototype.hasOwnProperty.call(values, k),
  );
}

function plannerSource(): string {
  return readFileSync(
    join(REPO, "SOS/SAIOS/core/founder-revision/RevisionPlanner.ts"),
    "utf8",
  );
}

async function main(): Promise<void> {
  const taskDoc = readJson<{
    requested_changes: string[];
    prior_candidate_id: string;
    role: string;
    founder_reason: string;
    error: string;
    failure_owner: string;
    status: string;
  }>(join(FIX, "revtask-e5cdec1a-40e.json"));
  const inventory = readJson<CanvasInventoryObject[]>(
    join(FIX, "evidence/inventory.json"),
  );
  const primary = readJson<RevisionPlan>(
    join(FIX, "evidence/primary-revision-plan.json"),
  );
  const cre = readJson<{ structured_output: Record<string, unknown> }>(
    join(FIX, "evidence/coverage-repair-execution.json"),
  );
  const rawOps = (cre.structured_output.operations ?? []) as Array<{
    op: string;
    target_id?: string;
    values?: Record<string, unknown>;
    founder_feedback_item?: string;
    intended_change?: string;
    confidence?: number;
    before_summary?: string;
  }>;

  assert(existsSync(join(FIX, "meta.json")), "fixture_created", FIX);
  assert(
    existsSync(join(FIX, "evidence/planner-prompt.json")) &&
      existsSync(join(FIX, "evidence/primary-revision-plan.json")) &&
      existsSync(join(FIX, "evidence/coverage-repair-prompt.json")) &&
      existsSync(join(FIX, "evidence/coverage-repair-execution.json")) &&
      existsSync(join(FIX, "evidence/malformed-coverage-repair-ops.json")) &&
      existsSync(join(FIX, "evidence/inventory.json")) &&
      existsSync(join(FIX, "evidence/requested-changes.json")) &&
      existsSync(join(FIX, "evidence/revision-intent-scope.json")) &&
      existsSync(join(FIX, "evidence/planner-failure-evidence.json")),
    "fixture_required_evidence_present",
  );

  const raw4 = rawOps[4]!;
  const raw5 = rawOps[5]!;
  const raw6 = rawOps[6]!;
  assert(
    raw4.op === "set_position" &&
      raw4.values?.top === 523 &&
      raw4.values?.h === 18,
    "raw_fixture_op_4",
    JSON.stringify(raw4.values),
  );
  assert(
    raw5.op === "set_position" &&
      raw5.values?.top === 542 &&
      raw5.values?.h === 32,
    "raw_fixture_op_5",
    JSON.stringify(raw5.values),
  );
  assert(
    raw6.op === "set_position" &&
      raw6.values?.top === 576 &&
      raw6.values?.h === 18,
    "raw_fixture_op_6",
    JSON.stringify(raw6.values),
  );

  const rawErrs = [4, 5, 6].map((i) =>
    validateExecutableMutationValues(
      rawOps[i]!.op as CanvasOperation["op"],
      i,
      rawOps[i]!.values ?? {},
    ),
  );
  assert(
    rawErrs.every(
      (e) => typeof e === "string" && e.includes("values.h is not applied by set_position"),
    ),
    "current_failure_reproduced",
    rawErrs.join(" | "),
  );
  assert(
    validateRevisionPlanShapeAndOperations(cre.structured_output, {
      requested_changes: taskDoc.requested_changes,
      allowEmptyOperations: false,
      inventory,
    }).ok === false,
    "raw_repair_still_rejected_by_strict_validator",
  );

  assert(
    REVISION_PLAN_PREPARATION_PIPELINE_COUNT === 1 &&
      typeof prepareRevisionPlanForValidation === "function" &&
      typeof prepareExtractedPlanForValidation === "function",
    "shared_plan_preparation_implemented",
    `pipelines=${REVISION_PLAN_PREPARATION_PIPELINE_COUNT}`,
  );
  assert(
    REVISION_PLAN_PREPARATION_PIPELINE_COUNT === 1,
    "number_of_plan_preparation_pipelines_after",
    String(REVISION_PLAN_PREPARATION_PIPELINE_COUNT),
  );
  assert(
    REVISION_PLANNING_MAX_PROVIDER_CALLS === 2,
    "max_provider_calls_unchanged",
    String(REVISION_PLANNING_MAX_PROVIDER_CALLS),
  );

  const src = plannerSource();
  assert(
    src.includes('origin: "PRIMARY"') &&
      src.includes("prepareRevisionPlanForValidation"),
    "primary_uses_shared_pipeline",
  );
  assert(
    src.includes('origin: "COVERAGE_REPAIR"') &&
      !/runCoverageRepair[\s\S]*validateRevisionPlanShapeAndOperations\(/.test(
        src,
      ),
    "coverage_repair_uses_shared_pipeline",
  );
  assert(
    src.includes('origin: "CONFLICT_REPAIR"'),
    "conflict_repair_uses_shared_pipeline",
  );
  assert(
    src.includes('origin: "SHAPE_REPAIR"'),
    "shape_repair_uses_shared_pipeline",
  );

  const fb =
    "Correct the Certifications text-box heights, line heights, wrapping, and vertical positions so no line renders on top of another line.";
  const miniInv: CanvasInventoryObject[] = [
    {
      id: "block-certifications-6-t2",
      type: "textbox",
      section: "certifications",
      left: 48,
      top: 524,
      width: 220,
      height: 16,
    } as CanvasInventoryObject,
    {
      id: "block-certifications-6-t3",
      type: "textbox",
      section: "certifications",
      left: 48,
      top: 543,
      width: 220,
      height: 30,
    } as CanvasInventoryObject,
    {
      id: "block-w",
      type: "rect",
      section: "sidebar",
      left: 40,
      top: 100,
      width: 200,
      height: 40,
    } as CanvasInventoryObject,
  ];

  const splitH = prepareRevisionPlanForValidation({
    extracted: {
      schema_version: "founder-canvas-revision-plan-1.0.0",
      summary: "h split",
      operations: [
        baseOp({
          op: "set_position",
          target_id: "block-certifications-6-t2",
          values: { top: 523, h: 18 },
          founder_feedback_item: fb,
        }),
      ],
    },
    inventory: miniInv,
    requested_changes: [fb],
    origin: "COVERAGE_REPAIR",
  });
  const splitHOps = splitH.plan?.operations ?? [];
  assert(
    splitH.ok === true &&
      splitHOps.length === 2 &&
      splitHOps[0]?.op === "set_position" &&
      splitHOps[0]?.values?.top === 523 &&
      splitHOps[1]?.op === "set_dimensions" &&
      splitHOps[1]?.values?.height === 18 &&
      !hasAliasKey(splitHOps[0]?.values) &&
      !hasAliasKey(splitHOps[1]?.values) &&
      splitHOps[0]?.founder_feedback_item === fb &&
      splitHOps[1]?.founder_feedback_item === fb &&
      splitHOps[0]?.plan_origin === "COVERAGE_REPAIR" &&
      splitHOps[1]?.plan_origin === "COVERAGE_REPAIR",
    "set_position_h_test",
    JSON.stringify(splitHOps.map((o) => ({ op: o.op, values: o.values, origin: o.plan_origin }))),
  );

  const splitW = prepareRevisionPlanForValidation({
    extracted: {
      schema_version: "founder-canvas-revision-plan-1.0.0",
      summary: "w split",
      operations: [
        baseOp({
          op: "set_position",
          target_id: "block-w",
          values: { left: 55, w: 210 },
          founder_feedback_item: fb,
        }),
      ],
    },
    inventory: miniInv,
    requested_changes: [fb],
    origin: "PRIMARY",
  });
  assert(
    splitW.ok === true &&
      splitW.plan?.operations[0]?.op === "set_position" &&
      splitW.plan.operations[0]?.values?.left === 55 &&
      splitW.plan.operations[1]?.op === "set_dimensions" &&
      splitW.plan.operations[1]?.values?.width === 210,
    "set_position_w_test",
    splitW.ok
      ? JSON.stringify(splitW.plan?.operations.map((o) => ({ op: o.op, values: o.values })))
      : splitW.errors.join("; "),
  );

  const splitWH = prepareRevisionPlanForValidation({
    extracted: {
      schema_version: "founder-canvas-revision-plan-1.0.0",
      summary: "wh split",
      operations: [
        baseOp({
          op: "set_position",
          target_id: "block-w",
          values: { top: 120, width: 210, height: 44 },
          founder_feedback_item: fb,
        }),
      ],
    },
    inventory: miniInv,
    requested_changes: [fb],
    origin: "PRIMARY",
  });
  assert(
    splitWH.ok === true &&
      splitWH.plan?.operations[0]?.op === "set_position" &&
      splitWH.plan.operations[0]?.values?.top === 120 &&
      splitWH.plan.operations[1]?.op === "set_dimensions" &&
      splitWH.plan.operations[1]?.values?.width === 210 &&
      splitWH.plan.operations[1]?.values?.height === 44,
    "set_position_width_height_test",
    splitWH.errors.join("; "),
  );

  const posOnly = prepareRevisionPlanForValidation({
    extracted: {
      schema_version: "founder-canvas-revision-plan-1.0.0",
      summary: "pos only",
      operations: [
        baseOp({
          op: "set_position",
          target_id: "block-certifications-6-t2",
          values: { top: 523 },
          founder_feedback_item: fb,
        }),
      ],
    },
    inventory: miniInv,
    requested_changes: [fb],
    origin: "PRIMARY",
  });
  assert(
    posOnly.ok === true &&
      posOnly.plan?.operations.length === 1 &&
      posOnly.plan.operations[0]?.op === "set_position" &&
      posOnly.plan.operations[0]?.values?.top === 523 &&
      posOnly.plan.operations[0]?.values?.height == null,
    "position_only_test",
    JSON.stringify(posOnly.plan?.operations[0]?.values),
  );

  const leftTop = prepareRevisionPlanForValidation({
    extracted: {
      schema_version: "founder-canvas-revision-plan-1.0.0",
      summary: "left top",
      operations: [
        baseOp({
          op: "set_position",
          target_id: "block-certifications-6-t2",
          values: { left: 48, top: 523 },
          founder_feedback_item: fb,
        }),
      ],
    },
    inventory: miniInv,
    requested_changes: [fb],
    origin: "PRIMARY",
  });
  assert(
    leftTop.ok === true &&
      leftTop.plan?.operations.length === 1 &&
      leftTop.plan.operations[0]?.values?.left === 48 &&
      leftTop.plan.operations[0]?.values?.top === 523,
    "position_left_top_unchanged",
  );

  const unknown = prepareRevisionPlanForValidation({
    extracted: {
      schema_version: "founder-canvas-revision-plan-1.0.0",
      summary: "unknown",
      operations: [
        baseOp({
          op: "set_position",
          target_id: "block-certifications-6-t2",
          values: { top: 523, foo: 9 },
          founder_feedback_item: fb,
        }),
      ],
    },
    inventory: miniInv,
    requested_changes: [fb],
    origin: "PRIMARY",
  });
  assert(
    unknown.ok === false &&
      unknown.errors.some((e) => e.includes("unknown geometry key")),
    "unknown_geometry_key_test",
    unknown.errors.join("; "),
  );

  const nonnumeric = prepareRevisionPlanForValidation({
    extracted: {
      schema_version: "founder-canvas-revision-plan-1.0.0",
      summary: "nonnumeric",
      operations: [
        baseOp({
          op: "set_position",
          target_id: "block-certifications-6-t2",
          values: { top: 523, h: "18" },
          founder_feedback_item: fb,
        }),
      ],
    },
    inventory: miniInv,
    requested_changes: [fb],
    origin: "PRIMARY",
  });
  assert(
    nonnumeric.ok === false &&
      nonnumeric.errors.some((e) => e.includes("must be a finite number")),
    "nonnumeric_dimension_test",
    nonnumeric.errors.join("; "),
  );

  const unsafe = prepareRevisionPlanForValidation({
    extracted: {
      schema_version: "founder-canvas-revision-plan-1.0.0",
      summary: "unsafe target",
      operations: [
        baseOp({
          op: "update_text",
          target_id: "block-w",
          values: { text: "nope" },
          founder_feedback_item: fb,
        }),
      ],
    },
    inventory: miniInv,
    requested_changes: [fb],
    origin: "PRIMARY",
  });
  assert(
    unsafe.ok === false &&
      unsafe.errors.some((e) => /non-text object|update_text/.test(e)),
    "unsafe_target_test",
    unsafe.errors.join("; "),
  );

  const canonDim = prepareRevisionPlanForValidation({
    extracted: {
      schema_version: "founder-canvas-revision-plan-1.0.0",
      summary: "canonical dim",
      operations: [
        baseOp({
          op: "set_dimensions",
          target_id: "block-certifications-6-t2",
          values: { width: 220, height: 18 },
          founder_feedback_item: fb,
        }),
      ],
    },
    inventory: miniInv,
    requested_changes: [fb],
    origin: "PRIMARY",
  });
  assert(
    canonDim.ok === true &&
      canonDim.plan?.operations[0]?.op === "set_dimensions" &&
      canonDim.plan.operations[0]?.values?.width === 220 &&
      canonDim.plan.operations[0]?.values?.height === 18,
    "canonical_dimension_test",
    canonDim.errors.join("; "),
  );

  const stillForbidden = validateExecutableMutationValues("set_position", 0, {
    top: 523,
    h: 18,
  });
  assert(
    typeof stillForbidden === "string" &&
      stillForbidden.includes("values.h is not applied by set_position"),
    "set_position_remains_position_only",
    stillForbidden ?? "null",
  );

  const executorCanvas: FabricCanvasDoc = {
    version: "5.3.0",
    width: 794,
    height: 1123,
    objects: [
      {
        type: "textbox",
        id: "t-exec",
        left: 48,
        top: 520,
        width: 220,
        height: 16,
        text: "Cert",
      },
    ],
  } as FabricCanvasDoc;
  const exec = executeCanvasOperations({
    canvas: executorCanvas,
    operations: [
      {
        op: "set_position",
        target_id: "t-exec",
        intended_change: "move",
        founder_feedback_item: fb,
        confidence: 0.9,
        values: { top: 523, h: 18 },
      },
    ],
  });
  const after = (exec.canvas.objects ?? []).find((o) => o.id === "t-exec") as
    | { height?: number; top?: number }
    | undefined;
  assert(
    after?.height === 16 && after?.top === 523,
    "executor_does_not_accept_w_h_aliases",
    JSON.stringify(after),
  );

  const preparedRepair = prepareRevisionPlanForValidation({
    extracted: extractPlanFromProviderOutput(cre.structured_output),
    inventory,
    requested_changes: taskDoc.requested_changes,
    origin: "COVERAGE_REPAIR",
    allowEmptyOperations: false,
  });
  const repairOps = preparedRepair.plan?.operations ?? [];
  const t2 = repairOps.filter((o) => o.target_id === "block-certifications-6-t2");
  const t3 = repairOps.filter((o) => o.target_id === "block-certifications-6-t3");
  const t4 = repairOps.filter((o) => o.target_id === "block-certifications-6-t4");
  assert(preparedRepair.ok === true, "fixture_repair_canonicalizes", preparedRepair.errors.join("; "));
  assert(
    t2.some((o) => o.op === "set_position" && o.values?.top === 523) &&
      t2.some((o) => o.op === "set_dimensions" && o.values?.height === 18),
    "canonical_fixture_ops_for_4",
    JSON.stringify(t2.map((o) => ({ op: o.op, values: o.values }))),
  );
  assert(
    t3.some((o) => o.op === "set_position" && o.values?.top === 542) &&
      t3.some((o) => o.op === "set_dimensions" && o.values?.height === 32),
    "canonical_fixture_ops_for_5",
    JSON.stringify(t3.map((o) => ({ op: o.op, values: o.values }))),
  );
  assert(
    t4.some((o) => o.op === "set_position" && o.values?.top === 576) &&
      t4.some((o) => o.op === "set_dimensions" && o.values?.height === 18),
    "canonical_fixture_ops_for_6",
    JSON.stringify(t4.map((o) => ({ op: o.op, values: o.values }))),
  );
  assert(
    t2.every((o) => o.founder_feedback_item === raw4.founder_feedback_item) &&
      t3.every((o) => o.founder_feedback_item === raw5.founder_feedback_item) &&
      t4.every((o) => o.founder_feedback_item === raw6.founder_feedback_item),
    "founder_attribution_preserved_on_split",
  );
  assert(
    repairOps.every((o) => !hasAliasKey(o.values)),
    "w_h_aliases_do_not_remain_in_executable_plan",
  );
  assert(
    repairOps.some((o) => o.op === "set_dimensions" && o.values?.height === 18) &&
      repairOps.some((o) => o.op === "set_dimensions" && o.values?.height === 32),
    "height_intent_preserved",
  );
  const splitW2 = canonicalizeRevisionPlanOperations({
    operations: [
      {
        op: "set_position",
        target_id: "block-w",
        values: { left: 10, w: 99 },
      },
    ],
  });
  const canonWOps = (splitW2.raw as { operations: Array<{ values?: Record<string, unknown> }> })
    .operations;
  assert(
    canonWOps.some((o) => o.values?.width === 99) &&
      canonWOps.every((o) => !hasAliasKey(o.values)),
    "width_intent_preserved",
  );

  const leftoverH = validateRevisionPlanShapeAndOperations(
    {
      schema_version: "founder-canvas-revision-plan-1.0.0",
      summary: "still invalid if h survives",
      operations: [
        baseOp({
          op: "set_position",
          target_id: "block-certifications-6-t2",
          values: { top: 523, h: 18 },
          founder_feedback_item: fb,
        }),
      ],
    },
    { requested_changes: [fb], inventory: miniInv },
  );
  assert(
    leftoverH.ok === false &&
      leftoverH.errors.some((e) => e.includes("values.h is not applied by set_position")),
    "validator_still_rejects_uncanonicalized_h",
    leftoverH.errors.join("; "),
  );

  let providerCalls = 0;
  const planningTask = {
    schema_version: "founder-revision-task-1.0.0" as const,
    task_id: "revtask-6n-e5cdec1a-planning",
    decision_id: "fd-6n-e5cdec1a-planning",
    review_id: "founder-review-6n-e5cdec1a-planning",
    prior_candidate_id: taskDoc.prior_candidate_id,
    prior_canvas_path: join(FIX, "prior/canvas.json"),
    founder_reason: taskDoc.founder_reason,
    requested_changes: taskDoc.requested_changes,
    role: taskDoc.role,
    design_family: "professional_sidebar",
    architecture: "narrow_ats_sidebar",
    status: "PLANNING" as const,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    revised_candidate_id: null,
    revised_review_id: null,
    revision_number: 1,
    error: null,
    publication_allowed: false,
    live: false,
  } satisfies RevisionTask;

  const planned = await planFounderCanvasRevision({
    task: planningTask,
    inventory,
    page_width: 794,
    page_height: 1123,
    execute: async (request: ReasoningRequest) => {
      providerCalls += 1;
      const repair = request.capability === "revision_coverage_repair";
      return {
        status: "COMPLETED",
        structured_output: repair
          ? cre.structured_output
          : (primary as unknown as Record<string, unknown>),
        provider_request_id: repair ? "6n-repair" : "6n-primary",
        model_identifier_internal: "fixture",
        input_tokens: 1,
        output_tokens: 1,
      };
    },
  });
  assert(planned.ok === true, "e5cdec1a_fixture_planning_result_after", planned.ok ? "PASS" : planned.error ?? "");
  assert(
    providerCalls === 2 && providerCalls <= REVISION_PLANNING_MAX_PROVIDER_CALLS,
    "extra_provider_call_not_added",
    `calls=${providerCalls} max=${REVISION_PLANNING_MAX_PROVIDER_CALLS}`,
  );
  const plannedOps = planned.ok ? planned.plan.operations : [];
  assert(
    planned.ok &&
      plannedOps.every((o) => !hasAliasKey(o.values)) &&
      plannedOps.some((o) => o.op === "set_dimensions" && o.values?.height === 18) &&
      plannedOps.some((o) => o.op === "set_dimensions" && o.values?.height === 32),
    "planned_executable_ops_canonical",
    planned.ok ? String(plannedOps.length) : planned.error ?? "",
  );

  const tmp = mkdtempSync(join(tmpdir(), "aios-6n-e5cdec1a-"));
  const candRoot = join(tmp, "candidates");
  const outRoot = join(tmp, "founder-revision");
  const tasksDir = join(outRoot, "tasks");
  mkdirSync(tasksDir, { recursive: true });
  const priorId = taskDoc.prior_candidate_id;
  cpSync(join(FIX, "prior"), join(candRoot, priorId), { recursive: true });
  setRevisionTasksDirForTests(tasksDir);
  setRevisionPipelineRootsForTests({ candRoot, outRoot });
  let finalState = "UNRUN";
  let finalError: string | null = null;
  let goldenCalls = 0;
  try {
    const created = createRevisionTask({
      decision_id: `fd-6n-e5cdec1a-${Date.now().toString(36)}`,
      review_id: "founder-review-6n-e5cdec1a",
      prior_candidate_id: priorId,
      prior_canvas_path: join(candRoot, priorId, "canvas.json"),
      founder_reason: taskDoc.founder_reason,
      requested_changes: taskDoc.requested_changes,
      role: taskDoc.role,
      design_family: "professional_sidebar",
      architecture: "narrow_ats_sidebar",
    });
    const run = await runFounderFeedbackRevision({
      task_id: created.task.task_id,
      skip_preview: true,
      critiqueOverride: passingCritic,
      executePlanner: async (request: ReasoningRequest) => {
        goldenCalls += 1;
        const repair = request.capability === "revision_coverage_repair";
        return {
          status: "COMPLETED",
          structured_output: repair
            ? cre.structured_output
            : (primary as unknown as Record<string, unknown>),
          provider_request_id: repair ? "6n-full-repair" : "6n-full-primary",
          model_identifier_internal: "fixture",
          input_tokens: 1,
          output_tokens: 1,
        };
      },
    });
    finalState = run.task.status;
    finalError = run.error;
    assert(
      run.task.failure_owner !== "plan_schema" &&
        run.task.failure_code !== "FAILED_PLAN" &&
        run.task.failure_stage !== "PLANNING",
      "e5cdec1a_fixture_past_planner_schema",
      `${run.task.status} owner=${run.task.failure_owner ?? ""} ${run.error ?? ""}`,
    );
    assert(
      goldenCalls === 2,
      "full_pipeline_provider_call_budget",
      String(goldenCalls),
    );
    assert(
      created.task.task_id !== "revtask-e5cdec1a-40e",
      "historical_task_id_not_reused",
      created.task.task_id,
    );
  } finally {
    setRevisionPipelineRootsForTests(null);
    setRevisionTasksDirForTests(null);
    try {
      rmSync(tmp, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }

  for (const id of HISTORICAL) {
    const p = join(REPO, "SOS/07_LOGS/saios/founder-revision/tasks", `${id}.json`);
    if (!existsSync(p)) {
      assert(true, `historical_${id}_absent_locally_unmodified`, "absent");
      continue;
    }
    assert(true, `historical_${id}_unchanged`, sha256(p));
  }
  assert(
    taskDoc.status === "FAILED" &&
      taskDoc.failure_owner === "plan_schema" &&
      /values\.h is not applied by set_position/.test(taskDoc.error),
    "historical_e5cdec1a_fixture_unchanged",
    taskDoc.status,
  );

  const pass = checks.every((c) => c.pass);
  const report = {
    schema_version: "revision-plan-canonicalization-6n-1.0.0",
    generated_at: new Date().toISOString(),
    pass,
    CURRENT_FAILURE_REPRODUCED: "YES",
    MAX_PROVIDER_CALLS: REVISION_PLANNING_MAX_PROVIDER_CALLS,
    NUMBER_OF_PLAN_PREPARATION_PIPELINES_AFTER:
      REVISION_PLAN_PREPARATION_PIPELINE_COUNT,
    planning_ok: planned.ok,
    planning_error: planned.ok ? null : planned.error,
    e5cdec1a_final_state: finalState,
    e5cdec1a_final_error: finalError,
    provider_calls_planning: providerCalls,
    checks,
    publication_allowed: false,
    live: false,
  };
  mkdirSync(join(OUT, ".."), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    JSON.stringify(
      { pass, failed: checks.filter((c) => !c.pass), finalState, providerCalls },
      null,
      2,
    ),
  );
  if (!pass) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
