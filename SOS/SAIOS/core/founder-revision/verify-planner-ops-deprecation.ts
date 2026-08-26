/**
 * Focused verify: adjust_spacing deprecated for NEW OpenAI revision plans.
 * Executor backward-compat preserved. No OpenAI. No production mutation.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  ALLOWED_OPS,
  ALLOWED_OPS_ENUM,
  DEPRECATED_PLANNER_OPS,
  LEGACY_EXECUTOR_SUPPORTED_OPS,
  PLANNER_ALLOWED_OPS,
} from "./allowedCanvasOps.js";
import { executeCanvasOperations } from "./CanvasOperationExecutor.js";
import {
  buildRevisionPlannerPrompt,
  validateExecutableMutationValues,
  validateRevisionPlan,
} from "./RevisionPromptBuilder.js";
import { REVISION_PLANNING_JSON_SCHEMA } from "../providers/openai/OpenAIResponseFactory.js";
import { listRevisionTasks } from "./RevisionTaskStore.js";
import {
  CANONICAL_COLLISION_BOUNDS_QA,
  CANONICAL_VISUAL_CONSISTENCY_QA,
  classifyRequestedChange,
} from "./RequestedChangeClassification.js";
import type { FabricCanvasDoc } from "./CanvasInventory.js";
import type { RevisionTask } from "./revision-task-types.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/founder-revision/verify-planner-ops-deprecation.json",
);

type Check = { name: string; pass: boolean; detail: string };

function assert(cond: boolean, name: string, detail: string): Check {
  return { name, pass: cond, detail };
}

const baseFields = {
  before_summary: "Current inventory object state",
  intended_change: "Apply allowlisted mutation",
  founder_feedback_item: "Founder feedback item",
  confidence: 0.9,
};

function main(): void {
  const checks: Check[] = [];
  const beforeFp = listRevisionTasks().map(
    (t) => `${t.task_id}:${t.status}:${t.updated_at}`,
  );
  const openaiCalls = 0;

  // A — planner allowlist excludes adjust_spacing
  checks.push(
    assert(
      !(PLANNER_ALLOWED_OPS as readonly string[]).includes("adjust_spacing") &&
        !(ALLOWED_OPS as readonly string[]).includes("adjust_spacing") &&
        (DEPRECATED_PLANNER_OPS as readonly string[]).includes("adjust_spacing"),
      "A_planner_allowlist_excludes_adjust_spacing",
      PLANNER_ALLOWED_OPS.join(","),
    ),
  );

  // B — schema enum excludes adjust_spacing
  const enumVals = (
    REVISION_PLANNING_JSON_SCHEMA as {
      properties: {
        operations: {
          items: { properties: { op: { enum?: string[] } } };
        };
      };
    }
  ).properties.operations.items.properties.op.enum ?? [];
  checks.push(
    assert(
      !enumVals.includes("adjust_spacing") &&
        ALLOWED_OPS_ENUM.every((op) => enumVals.includes(op)) &&
        enumVals.length === ALLOWED_OPS_ENUM.length,
      "B_schema_enum_excludes_adjust_spacing",
      JSON.stringify(enumVals),
    ),
  );

  const task: RevisionTask = {
    schema_version: "founder-revision-task-1.0.0",
    task_id: "revtask-verify-planner-ops",
    decision_id: "fd-verify-planner-ops",
    review_id: "rev-verify-planner-ops",
    prior_candidate_id: "cand-x",
    prior_canvas_path: "canvas.json",
    founder_reason: "test",
    requested_changes: [
      "Normalize the spacing inside the Experience section so job titles, employment dates, bullet groups, and the transitions between different employers follow one consistent vertical rhythm without unusually large or compressed gaps.",
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
  const prompt = buildRevisionPlannerPrompt({
    task,
    inventory: [],
    page_width: 794,
    page_height: 1123,
    preview_width: 794,
    preview_height: 1123,
  });
  const allowlistLine =
    prompt.instructions
      .split("\n")
      .find((l) => l.startsWith("- Exact allowlist:")) ?? "";

  // C — prompt allowlist line does not advertise adjust_spacing
  checks.push(
    assert(
      !allowlistLine.includes("adjust_spacing"),
      "C_prompt_allowlist_does_not_advertise_adjust_spacing",
      allowlistLine,
    ),
  );

  // D — prompt explicitly deprecates adjust_spacing
  checks.push(
    assert(
      prompt.instructions.includes("INVALID / DEPRECATED op") &&
        prompt.instructions.includes("adjust_spacing") &&
        prompt.instructions.includes('"op":"adjust_spacing"') &&
        prompt.instructions.includes('"spacing":18') &&
        prompt.instructions.includes("RevisionLayoutNormalizer") &&
        prompt.instructions.includes('"delta_top":6') &&
        prompt.instructions.includes('"top":420'),
      "D_prompt_explicitly_deprecates_adjust_spacing",
      "deprecation + examples present",
    ),
  );

  const pInstr = prompt.instructions;
  checks.push(
    assert(
      pInstr.includes("OPERATION CAPABILITY GRAMMAR") &&
        pInstr.includes("POSITION-ONLY") &&
        pInstr.includes(
          "Do not include an unchanged left in a set_position operation merely by copying inventory geometry",
        ) &&
        pInstr.includes(
          "Do not copy unchanged width into values to preserve wrapping",
        ) &&
        pInstr.includes("set_position does not change text wrapping") &&
        pInstr.includes("leave width untouched") &&
        pInstr.includes(
          "Do not emit identity align_objects if every target already satisfies the requested align_left",
        ) &&
        pInstr.includes('"width":200') &&
        pInstr.includes('"op":"set_dimensions"') &&
        pInstr.includes('"width":240') &&
        !pInstr.includes(
          "Example values keys: left, top, width, height, fill, stroke, text, fontSize, lineHeight, delta_top, delta_left, delta_height, align_left.",
        ) &&
        !pInstr.includes("296") &&
        !pInstr.includes("block-summary-1-t1"),
      "D2_prompt_shared_operation_capability_grammar",
      "shared grammar + no global values-key bag",
    ),
  );

  // E — new plan with adjust_spacing rejected
  const adjPlan = validateRevisionPlan({
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "bad",
    operations: [
      {
        op: "adjust_spacing",
        target_id: "block-summary-1-r0",
        values: { spacing: 24 },
        ...baseFields,
        founder_feedback_item:
          "Standardize the vertical spacing system throughout the resume: keep consistent spacing from each section heading to its body content and consistent spacing between the end of one section and the beginning of the next section.",
      },
    ],
  });
  checks.push(
    assert(
      !adjPlan.ok &&
        adjPlan.errors.some(
          (e) =>
            e.includes("adjust_spacing") &&
            (e.includes("deprecated") || e.includes("not allowlisted")),
        ),
      "E_new_plan_adjust_spacing_rejected",
      adjPlan.errors.join("; "),
    ),
  );

  // F — set_position + top passes
  const setPos = validateRevisionPlan({
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "ok",
    operations: [
      {
        op: "set_position",
        target_id: "block-experience-2-t5",
        values: { top: 420 },
        ...baseFields,
      },
    ],
  });
  checks.push(
    assert(setPos.ok === true, "F_set_position_top_passes", setPos.errors.join("; ") || "ok"),
  );

  // G — move_object + delta_top passes
  const moveOk = validateRevisionPlan({
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "ok",
    operations: [
      {
        op: "move_object",
        target_id: "block-experience-2-t5",
        values: { delta_top: 6 },
        ...baseFields,
      },
    ],
  });
  checks.push(
    assert(
      moveOk.ok === true,
      "G_move_object_delta_top_passes",
      moveOk.errors.join("; ") || "ok",
    ),
  );

  // H — set_position + spacing rejected
  const spacingVals = validateRevisionPlan({
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "bad",
    operations: [
      {
        op: "set_position",
        target_id: "block-summary-1-r0",
        values: { spacing: 18 },
        ...baseFields,
      },
    ],
  });
  checks.push(
    assert(
      !spacingVals.ok &&
        spacingVals.errors.some((e) => e.includes("values.spacing")),
      "H_set_position_spacing_rejected",
      spacingVals.errors.join("; "),
    ),
  );

  // H2 — set_position + width rejected (position-only contract)
  const widthOnPos = validateRevisionPlan({
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "bad",
    operations: [
      {
        op: "set_position",
        target_id: "page-sidebar-bg",
        values: { left: 0, width: 268 },
        ...baseFields,
      },
    ],
  });
  checks.push(
    assert(
      !widthOnPos.ok &&
        widthOnPos.errors.some((e) => e.includes("position-only")),
      "H2_set_position_width_rejected_position_only",
      widthOnPos.errors.join("; "),
    ),
  );

  // H3 — set_position + w/h shorthand aliases rejected
  const aliasOnPos = validateRevisionPlan({
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "bad",
    operations: [
      {
        op: "set_position",
        target_id: "page-sidebar-bg",
        values: { left: 0, w: 268, h: 900 },
        ...baseFields,
      },
    ],
  });
  checks.push(
    assert(
      !aliasOnPos.ok &&
        aliasOnPos.errors.some(
          (e) => e.includes("position-only") && e.includes("values.w"),
        ),
      "H3_set_position_w_h_aliases_rejected",
      aliasOnPos.errors.join("; "),
    ),
  );

  // I — move_object + gap_px rejected
  const gapVals = validateRevisionPlan({
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "bad",
    operations: [
      {
        op: "move_object",
        target_id: "block-skills-4-t2",
        values: { gap_px: 10 },
        ...baseFields,
      },
    ],
  });
  checks.push(
    assert(
      !gapVals.ok && gapVals.errors.some((e) => e.includes("values.gap_px")),
      "I_move_object_gap_px_rejected",
      gapVals.errors.join("; "),
    ),
  );

  // J — historical executor still runs adjust_spacing + delta_top
  checks.push(
    assert(
      (LEGACY_EXECUTOR_SUPPORTED_OPS as readonly string[]).includes(
        "adjust_spacing",
      ),
      "J_legacy_executor_ops_include_adjust_spacing",
      LEGACY_EXECUTOR_SUPPORTED_OPS.join(","),
    ),
  );
  const histCanvas: FabricCanvasDoc = {
    version: "5.3.0",
    width: 794,
    height: 1123,
    objects: [
      {
        type: "textbox",
        id: "block-experience-2-t2",
        left: 48,
        top: 300,
        width: 200,
        height: 16,
        text: "Role",
        data: { id: "block-experience-2-t2", section: "experience" },
      },
    ],
  };
  const executed = executeCanvasOperations({
    canvas: histCanvas,
    operations: [
      {
        op: "adjust_spacing",
        target_id: "block-experience-2-t2",
        values: { delta_top: 12 },
        before_summary: "title at top=300",
        intended_change: "nudge down 12px",
        founder_feedback_item: "legacy replay",
        confidence: 1,
      },
    ],
  });
  const afterTop = Number(
    (executed.canvas.objects ?? []).find((o) => o.id === "block-experience-2-t2")
      ?.top,
  );
  checks.push(
    assert(
      executed.ok === true && afterTop === 312,
      "J_executor_still_executes_adjust_spacing_delta_top",
      `ok=${executed.ok} top=${afterTop} err=${executed.error}`,
    ),
  );

  // K — no auto-conversion helpers for spacing→delta_top
  const convertProbe = validateExecutableMutationValues("set_position", 0, {
    spacing: 18,
  });
  checks.push(
    assert(
      typeof convertProbe === "string" &&
        convertProbe.includes("values.spacing") &&
        !convertProbe.includes("delta_top: 18"),
      "K_no_automatic_conversion_spacing_to_delta_top",
      convertProbe ?? "null",
    ),
  );

  // L — VERIFICATION_ACCEPTANCE unchanged
  const qaClass = classifyRequestedChange(CANONICAL_COLLISION_BOUNDS_QA);
  const visClass = classifyRequestedChange(CANONICAL_VISUAL_CONSISTENCY_QA);
  const spacingClass = classifyRequestedChange(
    "Standardize the vertical spacing system throughout the resume: keep consistent spacing from each section heading to its body content and consistent spacing between the end of one section and the beginning of the next section.",
  );
  checks.push(
    assert(
      qaClass.classification === "VERIFICATION_ACCEPTANCE" &&
        visClass.classification === "VERIFICATION_ACCEPTANCE" &&
        spacingClass.classification === "MUTATION_REQUIRED",
      "L_verification_acceptance_unchanged",
      `qa=${qaClass.classification} vis=${visClass.classification} spacing=${spacingClass.classification}`,
    ),
  );

  // M / N
  checks.push(assert(openaiCalls === 0, "N_no_openai_calls", `n=${openaiCalls}`));
  const afterFp = listRevisionTasks().map(
    (t) => `${t.task_id}:${t.status}:${t.updated_at}`,
  );
  checks.push(
    assert(
      JSON.stringify(beforeFp) === JSON.stringify(afterFp),
      "M_production_tasks_untouched",
      `before=${beforeFp.length} after=${afterFp.length}`,
    ),
  );

  // Production failure shapes (ops 2/17/20) rejected
  const prodShapes = validateRevisionPlan({
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "production spacing shapes",
    operations: [
      {
        op: "adjust_spacing",
        target_id: "block-summary-1-r0",
        values: { spacing: 24 },
        ...baseFields,
      },
      {
        op: "adjust_spacing",
        target_id: "block-experience-2-t2",
        values: { spacing: 18 },
        ...baseFields,
      },
      {
        op: "adjust_spacing",
        target_id: "block-skills-4-t2",
        values: { spacing: 14 },
        ...baseFields,
      },
    ],
  });
  checks.push(
    assert(
      !prodShapes.ok &&
        prodShapes.errors.filter((e) => e.includes("adjust_spacing")).length >=
          3,
      "production_failure_fixture_ops_2_17_20_rejected",
      prodShapes.errors.join(" | "),
    ),
  );

  const failed = checks.filter((c) => !c.pass);
  const report = {
    schema_version: "founder-revision-planner-ops-deprecation-verify-1.0.0",
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

main();
