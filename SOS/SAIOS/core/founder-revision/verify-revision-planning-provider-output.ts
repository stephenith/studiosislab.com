/**
 * Focused verify: revision_planning provider parse / truncation fail-closed.
 * No OpenAI. No production task mutation.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  buildInputPrompt,
  textFormatForRequest,
  tryParseStructuredOutput,
} from "../providers/openai/OpenAIResponseFactory.js";
import { createOpenAIProvider } from "../providers/openai/OpenAIProvider.js";
import type { OpenAIResponsesClient } from "../providers/openai/OpenAIProvider.js";
import {
  REVISION_PLANNING_MAX_OUTPUT_TOKENS,
  planFounderCanvasRevision,
} from "./RevisionPlanner.js";
import {
  buildRevisionPlannerPrompt,
  extractPlanFromProviderOutput,
  validateRevisionPlan,
  validateRevisionPlanShapeAndOperations,
} from "./RevisionPromptBuilder.js";
import { listRevisionTasks } from "./RevisionTaskStore.js";
import type { ReasoningRequest } from "../ai-brain/ReasoningRequest.js";
import type { RevisionTask } from "./revision-task-types.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/founder-revision/verify-revision-planning-provider-output.json",
);

type Check = { name: string; pass: boolean; detail: string };

function assert(cond: boolean, name: string, detail: string): Check {
  return { name, pass: cond, detail };
}

function baseRequest(
  capability: ReasoningRequest["capability"] = "revision_planning",
): ReasoningRequest {
  return {
    request_id: "req-verify-revplan-provider",
    task_id: "revtask-verify-provider",
    department: "resume",
    capability,
    objective: "plan revision",
    instructions: "return plan json",
    context_references: [],
    memory_references: [],
    expected_response_schema: { schema_version: "x" },
    quality_tier: "strong",
    priority: "high",
    maximum_input_tokens: 8000,
    maximum_output_tokens: REVISION_PLANNING_MAX_OUTPUT_TOKENS,
    estimated_cost_ceiling_usd: 0.25,
    timeout_ms: 60_000,
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

const COMPLETE_PLAN = {
  schema_version: "founder-canvas-revision-plan-1.0.0",
  summary: "Complete plan",
  notes: [] as string[],
  operations: [
    {
      op: "set_position",
      target_id: "block-summary-1-t2",
      before_summary: "Textbox at top=200",
      intended_change: "Move summary body down slightly",
      values: { top: 210 },
      founder_feedback_item: "Improve spacing below the header.",
      confidence: 0.9,
    },
    {
      op: "adjust_font_size",
      target_id: "block-skills-4-t1",
      before_summary: "Heading fontSize=12",
      intended_change: "Increase skills heading size",
      values: { fontSize: 13 },
      founder_feedback_item: "Improve the Skills section formatting.",
      confidence: 0.9,
    },
  ],
};

const TRUNCATED_JSON = `{
  "schema_version": "founder-canvas-revision-plan-1.0.0",
  "summary": "This revision plan addresses all Founder feedback",
  "operations": [
    {
      "op": "set_position",
      "target_id": "block-summary-1`;

async function main(): Promise<void> {
  // Stub provider path still goes through OpenAI request validation gates.
  process.env.SOS_AIOS_LIVE = "0";
  process.env.SOS_AI_FOUNDER_OPENAI_ONE_TEST = "1";
  if (!process.env.OPENAI_API_KEY?.trim()) {
    process.env.OPENAI_API_KEY = "sk-verify-stub-not-a-real-key";
  }

  const checks: Check[] = [];
  const beforeFp = listRevisionTasks().map(
    (t) => `${t.task_id}:${t.status}:${t.updated_at}`,
  );
  const openaiCalls = 0;

  // A — complete plan object via tryParse
  const parseA = tryParseStructuredOutput(
    JSON.stringify(COMPLETE_PLAN),
    baseRequest(),
  );
  checks.push(
    assert(
      parseA.ok === true &&
        Array.isArray(parseA.ok ? parseA.structured.operations : null) &&
        (parseA.ok ? (parseA.structured.operations as unknown[]).length : 0) ===
          2,
      "A_complete_plan_object_parses",
      parseA.ok ? "ok" : parseA.message,
    ),
  );

  // B — raw complete JSON text
  const parseB = tryParseStructuredOutput(
    `${JSON.stringify(COMPLETE_PLAN)}\n`,
    baseRequest(),
  );
  checks.push(
    assert(
      parseB.ok === true,
      "B_raw_complete_json_text_parses",
      parseB.ok ? "ok" : parseB.message,
    ),
  );

  // C — truncated JSON → fail closed, no summary wrapper
  const parseC = tryParseStructuredOutput(TRUNCATED_JSON, baseRequest(), {
    response_status: "incomplete",
    incomplete_reason: "max_output_tokens",
    provider_request_id: "resp_verify_trunc",
    output_tokens: 4000,
  });
  checks.push(
    assert(
      parseC.ok === false &&
        (parseC.ok === false
          ? parseC.code === "openai_output_truncated" ||
            parseC.code === "revision_planning_incomplete_json"
          : false) &&
        !(
          parseC.ok === false &&
          JSON.stringify(parseC).includes("openai_response_was_not_json_object")
        ),
      "C_truncated_json_fails_no_fake_wrapper",
      parseC.ok ? "unexpected ok" : `${parseC.code} ${parseC.message.slice(0, 160)}`,
    ),
  );

  const stubTrunc: OpenAIResponsesClient = {
    responses: {
      async create() {
        return {
          id: "resp_trunc",
          model: "gpt-4.1-mini",
          status: "incomplete",
          incomplete_details: { reason: "max_output_tokens" },
          output_text: TRUNCATED_JSON,
          usage: { input_tokens: 2000, output_tokens: 4000 },
        };
      },
    },
  };
  const providerTrunc = createOpenAIProvider(stubTrunc);
  const execTrunc = await providerTrunc.execute(baseRequest());
  checks.push(
    assert(
      execTrunc.status === "FAILED" &&
        execTrunc.structured_output === null &&
        String(execTrunc.error_details?.message ?? "").includes(
          "openai_output_truncated",
        ),
      "C_provider_execute_truncated_failed_not_completed",
      `${execTrunc.status} ${execTrunc.error_details?.message?.slice(0, 120)}`,
    ),
  );

  // D — historical wrapper must not become a valid plan
  const histWrapper = {
    capability: "revision_planning",
    provider: "openai",
    summary: TRUNCATED_JSON.padEnd(4000, " "),
    notes: ["openai_response_was_not_json_object"],
  };
  const extractedD = extractPlanFromProviderOutput(histWrapper);
  const validatedD = validateRevisionPlan(extractedD);
  checks.push(
    assert(
      validatedD.ok === false,
      "D_historical_wrapper_not_valid_plan",
      validatedD.errors.join("; ") || "unexpected ok",
    ),
  );

  const task: RevisionTask = {
    schema_version: "founder-revision-task-1.0.0",
    task_id: "revtask-verify-provider-out",
    decision_id: "fd-verify-provider-out",
    review_id: "rev-verify-provider-out",
    prior_candidate_id: "cand-x",
    prior_canvas_path: "canvas.json",
    founder_reason: "test",
    requested_changes: [
      "Improve spacing below the header.",
      "Improve the Skills section formatting.",
    ],
    role: "Engineer",
    design_family: null,
    status: "PENDING",
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

  const plannedHist = await planFounderCanvasRevision({
    task,
    inventory: [],
    page_width: 794,
    page_height: 1123,
    execute: async () => ({
      status: "COMPLETED",
      structured_output: histWrapper,
      provider_request_id: "resp_hist",
      model_identifier_internal: "gpt-4.1-mini",
      input_tokens: 100,
      output_tokens: 4000,
      error_details: null,
    }),
  });
  checks.push(
    assert(
      plannedHist.ok === false &&
        plannedHist.status === "FAILED_PROVIDER" &&
        plannedHist.error.includes("revision_planning_incomplete_json"),
      "D_planner_rejects_historical_wrapper_as_provider_failure",
      plannedHist.ok ? "ok" : `${plannedHist.status} ${plannedHist.error.slice(0, 120)}`,
    ),
  );

  // E — prompt has no resume_content
  const prompt = buildInputPrompt(baseRequest());
  checks.push(
    assert(
      !prompt.includes("Also include key resume_content") &&
        !prompt.includes("RoleSample") &&
        prompt.includes("operations") &&
        prompt.includes("schema_version"),
      "E_revision_planning_prompt_excludes_resume_content",
      prompt.includes("Also include key resume_content")
        ? "has generic resume envelope"
        : "ok",
    ),
  );
  const otherPrompt = buildInputPrompt(baseRequest("report_summarization"));
  checks.push(
    assert(
      otherPrompt.includes("Also include key resume_content"),
      "E_other_capabilities_still_get_generic_prompt",
      otherPrompt.includes("Also include key resume_content") ? "ok" : "missing",
    ),
  );

  // F — token budget
  checks.push(
    assert(
      REVISION_PLANNING_MAX_OUTPUT_TOKENS === 12_000,
      "F_revision_planning_max_output_tokens_12000",
      String(REVISION_PLANNING_MAX_OUTPUT_TOKENS),
    ),
  );
  const fmt = textFormatForRequest(baseRequest());
  checks.push(
    assert(
      fmt.type === "json_schema" && fmt.name === "founder_canvas_revision_plan",
      "F_revision_planning_uses_json_schema_format",
      JSON.stringify(fmt),
    ),
  );

  // Coverage-repair dedicated schema / capability (strict:false; local fail-closed)
  const repairFmt = textFormatForRequest(
    baseRequest("revision_coverage_repair"),
  );
  const repairSchema = repairFmt.schema as {
    properties?: {
      operations?: {
        minItems?: number;
        items?: { required?: string[] };
      };
    };
  };
  const repairRequired =
    repairSchema?.properties?.operations?.items?.required ?? [];
  checks.push(
    assert(
      repairFmt.type === "json_schema" &&
        repairFmt.name === "founder_canvas_coverage_repair_plan" &&
        repairFmt.strict === false &&
        (repairSchema?.properties?.operations?.minItems ?? 0) >= 1 &&
        repairRequired.includes("founder_feedback_item") &&
        repairRequired.includes("confidence") &&
        repairRequired.includes("before_summary") &&
        repairRequired.includes("intended_change") &&
        repairRequired.includes("values") &&
        !repairRequired.includes("founder_feedback_items"),
      "F_coverage_repair_dedicated_schema_strict_false",
      JSON.stringify({
        type: repairFmt.type,
        name: repairFmt.name,
        strict: repairFmt.strict,
        minItems: repairSchema?.properties?.operations?.minItems,
        required: repairRequired,
      }),
    ),
  );

  // F2 — structured-output schema explicitly declares optional founder_feedback_items
  const schema = fmt.schema as {
    properties?: {
      operations?: {
        items?: {
          required?: string[];
          properties?: Record<string, { type?: string; items?: { type?: string } }>;
        };
      };
    };
  };
  const opProps = schema?.properties?.operations?.items?.properties ?? {};
  const opRequired = schema?.properties?.operations?.items?.required ?? [];
  const secondary = opProps.founder_feedback_items;
  checks.push(
    assert(
      opProps.founder_feedback_item?.type === "string" &&
        opRequired.includes("founder_feedback_item") &&
        !opRequired.includes("founder_feedback_items") &&
        secondary?.type === "array" &&
        secondary?.items?.type === "string",
      "F2_schema_declares_optional_founder_feedback_items_array",
      JSON.stringify({
        primary: opProps.founder_feedback_item,
        secondary,
        required: opRequired,
      }),
    ),
  );

  // Provider complete path preserves operations
  const stubOk: OpenAIResponsesClient = {
    responses: {
      async create() {
        return {
          id: "resp_ok",
          model: "gpt-4.1-mini",
          status: "completed",
          output_text: JSON.stringify(COMPLETE_PLAN),
          usage: { input_tokens: 500, output_tokens: 800 },
        };
      },
    },
  };
  const execOk = await createOpenAIProvider(stubOk).execute(baseRequest());
  checks.push(
    assert(
      execOk.status === "COMPLETED" &&
        Array.isArray(execOk.structured_output?.operations) &&
        (execOk.structured_output?.operations as unknown[]).length === 2,
      "A_provider_normalization_preserves_operations",
      `${execOk.status} ops=${Array.isArray(execOk.structured_output?.operations) ? (execOk.structured_output?.operations as unknown[]).length : 0}`,
    ),
  );

  // I — production-shaped primary 1-target identity align_objects fail-closed
  const FB_VISUAL_REF =
    "Use a heading and its accent marker as a visual reference while preserving existing column anchors.";
  const FB_HEADING_ALIGN =
    "Align section headings consistently within each existing column.";
  const oneTargetNoOpPlan = {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "Dummy visual-reference coverage",
    notes: [] as string[],
    operations: [
      {
        op: "align_objects",
        target_ids: ["block-example-heading"],
        before_summary: "Heading textbox currently at left 100",
        intended_change:
          "Use heading and accent marker as a visual reference without changing geometry",
        values: { align_left: 100 },
        founder_feedback_item: FB_VISUAL_REF,
        confidence: 0.9,
      },
    ],
  };
  const visualRefTask: RevisionTask = {
    ...task,
    task_id: "revtask-verify-one-target-align",
    requested_changes: [FB_VISUAL_REF, FB_HEADING_ALIGN],
  };
  let oneTargetExecuteCalls = 0;
  const plannedOneTarget = await planFounderCanvasRevision({
    task: visualRefTask,
    inventory: [
      {
        id: "block-example-heading",
        index: 0,
        type: "textbox",
        text: "HEADING",
        left: 100,
        top: 154,
        width: 400,
        height: 14,
        fill: null,
        stroke: null,
        fontSize: 11,
        fontFamily: "Inter",
        fontWeight: 600,
        lineHeight: 1.2,
        role: null,
        section: "summary",
        locked: false,
        system: false,
        group_id: null,
      },
    ],
    page_width: 794,
    page_height: 1123,
    execute: async () => {
      oneTargetExecuteCalls += 1;
      return {
        status: "COMPLETED",
        structured_output: oneTargetNoOpPlan,
        provider_request_id: "resp-verify-one-target",
        model_identifier_internal: "test-model",
        input_tokens: 10,
        output_tokens: 20,
        error_details: null,
      };
    },
  });
  checks.push(
    assert(
      plannedOneTarget.ok === false &&
        plannedOneTarget.status === "FAILED_PLAN" &&
        plannedOneTarget.error.includes(
          "target_ids must contain at least 2 non-empty strings",
        ) &&
        plannedOneTarget.error.includes("align_objects") &&
        oneTargetExecuteCalls === 1,
      "I_primary_one_target_identity_align_objects_fails_closed",
      plannedOneTarget.ok
        ? "unexpected ok"
        : `${plannedOneTarget.status} calls=${oneTargetExecuteCalls} ${plannedOneTarget.error.slice(0, 200)}`,
    ),
  );

  const plannerPrompt = buildRevisionPlannerPrompt({
    task: visualRefTask,
    inventory: [],
    page_width: 794,
    page_height: 1123,
    preview_width: 794,
    preview_height: 1123,
  });
  const pInstr = plannerPrompt.instructions;
  checks.push(
    assert(
      pInstr.includes("HORIZONTAL ALIGNMENT COHORTS") &&
        pInstr.includes("one-element target_ids array is invalid") &&
        pInstr.includes(
          "using align_objects with one target merely to represent an absolute X",
        ) &&
        pInstr.includes("no-op invented for coverage") &&
        pInstr.includes("block-example-heading") &&
        pInstr.includes(
          "Zero new operations for that requirement is preferable",
        ) &&
        pInstr.includes(
          "Do not create a new mutation solely for this attribution",
        ) &&
        pInstr.includes("FORBIDDEN: mixing marker + heading") &&
        !pInstr.includes("296") &&
        !pInstr.includes("block-summary-1-t1"),
      "I_prompt_forbids_one_target_noop_align_and_keeps_cohorts",
      "prompt contract",
    ),
  );
  checks.push(
    assert(
      pInstr.includes("OPERATION CAPABILITY GRAMMAR") &&
        pInstr.includes("POSITION-ONLY") &&
        pInstr.includes(
          "Do not include an unchanged left in a set_position operation merely by copying inventory geometry",
        ) &&
        pInstr.includes("leave width untouched") &&
        pInstr.includes("set_position does not change text wrapping") &&
        pInstr.includes('"width":200') &&
        pInstr.includes('"op":"set_dimensions"') &&
        !pInstr.includes(
          "Example values keys: left, top, width, height, fill, stroke, text, fontSize, lineHeight, delta_top, delta_left, delta_height, align_left.",
        ),
      "I_prompt_shared_operation_capability_grammar",
      "shared grammar present; global values-key bag absent",
    ),
  );

  // J — production-shaped set_position + identity width fail-closed (05:20 semantic shape)
  const FB_REFLOW_WIDTH =
    "Reflow this section content within the existing column width so lines wrap naturally.";
  const widthOnPosPlan = {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "Position plus copied width",
    notes: [] as string[],
    operations: [
      {
        op: "set_position",
        target_id: "block-example-body",
        before_summary:
          "Textbox id=block-example-body currently at left=80 top=400 width already correct",
        intended_change:
          "Move vertically while copying current width to preserve wrapping",
        values: { top: 394, left: 80, width: 200 },
        founder_feedback_item: FB_REFLOW_WIDTH,
        confidence: 0.97,
      },
    ],
  };
  const reflowTask: RevisionTask = {
    ...task,
    task_id: "revtask-verify-set-position-width",
    requested_changes: [FB_REFLOW_WIDTH],
  };
  let widthOnPosExecuteCalls = 0;
  const plannedWidthOnPos = await planFounderCanvasRevision({
    task: reflowTask,
    inventory: [
      {
        id: "block-example-body",
        index: 0,
        type: "textbox",
        text: "Example body",
        left: 80,
        top: 400,
        width: 200,
        height: 84,
        fill: null,
        stroke: null,
        fontSize: 10.5,
        fontFamily: "Inter",
        fontWeight: 400,
        lineHeight: 1.45,
        role: null,
        section: "example",
        locked: false,
        system: false,
        group_id: null,
      },
    ],
    page_width: 794,
    page_height: 1123,
    execute: async () => {
      widthOnPosExecuteCalls += 1;
      return {
        status: "COMPLETED",
        structured_output: widthOnPosPlan,
        provider_request_id: "resp-verify-set-position-width",
        model_identifier_internal: "test-model",
        input_tokens: 10,
        output_tokens: 20,
        error_details: null,
      };
    },
  });
  checks.push(
    assert(
      plannedWidthOnPos.ok === false &&
        plannedWidthOnPos.status === "FAILED_PLAN" &&
        plannedWidthOnPos.error.includes("values.width") &&
        plannedWidthOnPos.error.includes("position-only") &&
        widthOnPosExecuteCalls === 1,
      "J_primary_set_position_identity_width_fails_closed",
      plannedWidthOnPos.ok
        ? "unexpected ok"
        : `${plannedWidthOnPos.status} calls=${widthOnPosExecuteCalls} ${plannedWidthOnPos.error.slice(0, 220)}`,
    ),
  );

  const baseMeta = {
    before_summary: "Current inventory geometry",
    intended_change: "Apply a real geometry mutation",
    confidence: 0.95,
  };
  const legalMulti = validateRevisionPlanShapeAndOperations(
    {
      schema_version: "founder-canvas-revision-plan-1.0.0",
      summary: "Legal same-role heading align",
      operations: [
        {
          op: "align_objects",
          target_ids: ["block-example-sidebar-t1", "block-example-sidebar-t2"],
          values: { align_left: 48 },
          founder_feedback_item: FB_HEADING_ALIGN,
          founder_feedback_items: [FB_VISUAL_REF],
          ...baseMeta,
          intended_change: "Align two heading labels to one lane left",
        },
      ],
    },
    { requested_changes: [FB_VISUAL_REF, FB_HEADING_ALIGN] },
  );
  checks.push(
    assert(
      legalMulti.ok === true,
      "I_legal_two_plus_same_role_align_with_visual_ref_secondary",
      legalMulti.errors.join("; ") || "ok",
    ),
  );

  const legalSet = validateRevisionPlanShapeAndOperations(
    {
      schema_version: "founder-canvas-revision-plan-1.0.0",
      summary: "Genuine single-object absolute move",
      operations: [
        {
          op: "set_position",
          target_id: "block-example-sidebar-t2",
          values: { top: 220 },
          founder_feedback_item: FB_HEADING_ALIGN,
          ...baseMeta,
          intended_change: "Move one heading to a new top",
        },
      ],
    },
    { requested_changes: [FB_HEADING_ALIGN] },
  );
  checks.push(
    assert(
      legalSet.ok === true,
      "I_legal_set_position_single_object_absolute",
      legalSet.errors.join("; ") || "ok",
    ),
  );

  const legalMove = validateRevisionPlanShapeAndOperations(
    {
      schema_version: "founder-canvas-revision-plan-1.0.0",
      summary: "Genuine single-object delta move",
      operations: [
        {
          op: "move_object",
          target_id: "block-example-sidebar-t2",
          values: { delta_top: 12 },
          founder_feedback_item: FB_HEADING_ALIGN,
          ...baseMeta,
          intended_change: "Nudge one heading down by 12px",
        },
      ],
    },
    { requested_changes: [FB_HEADING_ALIGN] },
  );
  checks.push(
    assert(
      legalMove.ok === true,
      "I_legal_move_object_single_object_delta",
      legalMove.errors.join("; ") || "ok",
    ),
  );

  // G / H
  checks.push(assert(openaiCalls === 0, "G_no_openai", `n=${openaiCalls}`));
  const afterFp = listRevisionTasks().map(
    (t) => `${t.task_id}:${t.status}:${t.updated_at}`,
  );
  checks.push(
    assert(
      JSON.stringify(beforeFp) === JSON.stringify(afterFp),
      "H_production_tasks_unchanged",
      `before=${beforeFp.length} after=${afterFp.length}`,
    ),
  );

  const failed = checks.filter((c) => !c.pass);
  const report = {
    ok: failed.length === 0,
    passed: checks.filter((c) => c.pass).length,
    total: checks.length,
    checks,
    at: new Date().toISOString(),
  };
  mkdirSync(join(OUT, ".."), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    failed.length === 0
      ? `OK ${report.passed}/${report.total}`
      : `FAIL ${failed.map((f) => f.name).join(", ")}`,
  );
  if (!report.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
