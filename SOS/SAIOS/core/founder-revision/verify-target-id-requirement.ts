/**
 * Focused verify: inventory-backed target_id requirement in RevisionPromptBuilder.
 * Includes revtask-05667cbb-641 target_ids-on-single-target fixtures.
 * No OpenAI. No production task mutation.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  CANONICAL_COLLISION_BOUNDS_QA,
  CANONICAL_VISUAL_CONSISTENCY_QA,
} from "./RequestedChangeClassification.js";
import {
  buildRevisionPlannerPrompt,
  validatePlanCoversRequestedChanges,
  validateRevisionPlan,
} from "./RevisionPromptBuilder.js";
import { listRevisionTasks } from "./RevisionTaskStore.js";
import type { RevisionPlan, RevisionTask } from "./revision-task-types.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/founder-revision/verify-target-id-requirement.json",
);

type Check = { name: string; pass: boolean; detail: string };

function assert(cond: boolean, name: string, detail: string): Check {
  return { name, pass: cond, detail };
}

const baseFields = {
  before_summary: "Current inventory object state",
  intended_change: "test change",
  founder_feedback_item: "Founder feedback item",
  confidence: 0.9,
};

function main(): void {
  const checks: Check[] = [];
  const beforeFp = listRevisionTasks().map(
    (t) => `${t.task_id}:${t.status}:${t.updated_at}`,
  );
  let openaiCalls = 0;

  const valid = validateRevisionPlan({
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "ok",
    operations: [
      {
        op: "update_text",
        target_id: "block-summary-1-t2",
        values: { text: "Revised body" },
        ...baseFields,
      },
    ],
  });
  checks.push(
    assert(
      valid.ok === true &&
        valid.plan?.operations[0]?.target_id === "block-summary-1-t2",
      "single_target_with_valid_target_id_passes",
      valid.errors.join("; ") || "ok",
    ),
  );

  const noId = validateRevisionPlan({
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "bad",
    operations: [
      {
        op: "update_text",
        values: { text: "x" },
        ...baseFields,
      },
    ],
  });
  checks.push(
    assert(
      !noId.ok &&
        noId.errors.some(
          (e) =>
            e.includes("operations[0]") &&
            e.includes("update_text") &&
            e.includes("target_id"),
        ),
      "single_target_without_target_id_fails",
      noId.errors.join("; "),
    ),
  );

  const selectorOnly = validateRevisionPlan({
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "bad",
    operations: [
      {
        op: "adjust_font_size",
        selector: { type: "Textbox", section: "summary" },
        values: { fontSize: 12 },
        ...baseFields,
      },
    ],
  });
  checks.push(
    assert(
      !selectorOnly.ok &&
        selectorOnly.errors.some(
          (e) =>
            e.includes("selector is invalid for single-target") ||
            e.includes("selector-only is invalid"),
        ),
      "single_target_selector_only_fails",
      selectorOnly.errors.join("; "),
    ),
  );

  const inventedRole = validateRevisionPlan({
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "bad",
    operations: [
      {
        op: "update_text",
        selector: {
          type: "Textbox",
          section: "summary",
          text_includes: "SUMMARY",
          role: "filled-label",
        },
        values: { text: "SUMMARY" },
        ...baseFields,
      },
    ],
  });
  checks.push(
    assert(
      !inventedRole.ok &&
        inventedRole.errors.some(
          (e) =>
            e.includes("operations[0]") &&
            e.includes("update_text") &&
            e.includes("target_id"),
        ),
      "invented_role_selector_without_target_id_fails",
      inventedRole.errors.join("; "),
    ),
  );

  // Exact op from revtask-72e97bae-3ef evidence (must fail BEFORE SelectorResolution).
  const evidenceOp = validateRevisionPlan({
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "evidence replay",
    operations: [
      {
        op: "adjust_font_size",
        selector: {
          text_includes: "SUMMARY",
          section: "summary",
          type: "Textbox",
          role: "filled-label",
        },
        before_summary: "SUMMARY heading textbox in summary section",
        intended_change: "Increase SUMMARY label font size",
        values: { fontSize: 13 },
        founder_feedback_item: "Improve the Skills section layout",
        confidence: 0.9,
      },
    ],
  });
  checks.push(
    assert(
      evidenceOp.ok === false &&
        evidenceOp.plan === null &&
        evidenceOp.errors.some(
          (e) =>
            e.includes("operations[0]") &&
            e.includes("adjust_font_size") &&
            (e.includes("target_id is required") ||
              e.includes("selector is invalid for single-target")),
        ),
      "evidence_adjust_font_size_filled_label_rejected_before_execution",
      evidenceOp.errors.join("; "),
    ),
  );

  // Mixed plan: valid ops must not allow invalid adjust_font_size to pass the plan.
  const mixed = validateRevisionPlan({
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "mixed",
    operations: [
      {
        op: "update_text",
        target_id: "block-summary-1-t2",
        values: { text: "ok" },
        ...baseFields,
      },
      {
        op: "adjust_font_size",
        selector: {
          text_includes: "SUMMARY",
          section: "summary",
          type: "Textbox",
          role: "filled-label",
        },
        values: { fontSize: 13 },
        ...baseFields,
      },
    ],
  });
  checks.push(
    assert(
      mixed.ok === false &&
        mixed.plan === null &&
        mixed.errors.some((e) => e.includes("operations[1] adjust_font_size")),
      "mixed_plan_rejects_selector_only_adjust_font_size",
      mixed.errors.join("; "),
    ),
  );

  const emptyId = validateRevisionPlan({
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "bad",
    operations: [
      {
        op: "move_object",
        target_id: "   ",
        values: { top: 10 },
        ...baseFields,
      },
    ],
  });
  checks.push(
    assert(
      !emptyId.ok &&
        emptyId.errors.some(
          (e) =>
            e.includes("operations[0]") &&
            e.includes("move_object") &&
            e.includes("non-empty"),
        ),
      "empty_target_id_fails",
      emptyId.errors.join("; "),
    ),
  );

  const alignOk = validateRevisionPlan({
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "align",
    operations: [
      {
        op: "align_objects",
        target_ids: [
          "block-summary-1-t1",
          "block-experience-2-t1",
          "block-skills-4-t1",
        ],
        values: { align_left: 72 },
        ...baseFields,
      },
    ],
  });
  checks.push(
    assert(
      alignOk.ok === true &&
        (alignOk.plan?.operations[0]?.target_ids?.length ?? 0) >= 2,
      "align_objects_with_target_ids_ge_2_valid",
      alignOk.errors.join("; ") || "ok",
    ),
  );

  const alignSelectorOnly = validateRevisionPlan({
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "align sel",
    operations: [
      {
        op: "align_objects",
        selector: { type: "Textbox", section: "experience" },
        values: { align_left: 72 },
        ...baseFields,
      },
    ],
  });
  checks.push(
    assert(
      alignSelectorOnly.ok === false &&
        alignSelectorOnly.errors.some(
          (e) =>
            e.includes("operations[0] align_objects") &&
            e.includes("target_ids"),
        ),
      "align_objects_selector_only_fails",
      alignSelectorOnly.errors.join("; "),
    ),
  );

  const groupOk = validateRevisionPlan({
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "group",
    operations: [
      {
        op: "group_objects",
        target_ids: ["block-skills-4-t1", "block-skills-4-t2"],
        values: {},
        ...baseFields,
      },
    ],
  });
  checks.push(
    assert(
      groupOk.ok === true,
      "group_objects_with_target_ids_ge_2_valid",
      groupOk.errors.join("; ") || "ok",
    ),
  );

  const groupSelectorOnly = validateRevisionPlan({
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "group sel",
    operations: [
      {
        op: "group_objects",
        selector: { section: "skills" },
        values: {},
        ...baseFields,
      },
    ],
  });
  checks.push(
    assert(
      groupSelectorOnly.ok === false &&
        groupSelectorOnly.errors.some(
          (e) =>
            e.includes("operations[0] group_objects") &&
            e.includes("target_ids"),
        ),
      "group_objects_selector_only_fails",
      groupSelectorOnly.errors.join("; "),
    ),
  );

  checks.push(
    assert(
      !selectorOnly.ok &&
        selectorOnly.errors[0]?.includes("operations[0]") === true &&
        selectorOnly.errors[0]?.includes("adjust_font_size") === true,
      "error_includes_operation_index_and_type",
      selectorOnly.errors.join("; "),
    ),
  );

  // --- A/B/C: target_ids forbidden on single-target ops ---
  const setPosTargetIds = validateRevisionPlan({
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "bad",
    operations: [
      {
        op: "set_position",
        target_ids: ["block-summary-1-r0", "block-experience-2-r0"],
        values: { top: 100 },
        ...baseFields,
      },
    ],
  });
  checks.push(
    assert(
      !setPosTargetIds.ok &&
        setPosTargetIds.errors.some(
          (e) =>
            e.includes("operations[0] set_position") &&
            e.includes("target_ids is invalid for single-target"),
        ),
      "A_set_position_target_ids_only_rejected",
      setPosTargetIds.errors.join("; "),
    ),
  );

  const adjSpacingDeprecated = validateRevisionPlan({
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "bad",
    operations: [
      {
        op: "adjust_spacing",
        target_id: "block-experience-2-t2",
        values: { delta_top: -10 },
        ...baseFields,
      },
    ],
  });
  checks.push(
    assert(
      !adjSpacingDeprecated.ok &&
        adjSpacingDeprecated.errors.some(
          (e) =>
            e.includes("adjust_spacing") &&
            (e.includes("deprecated") || e.includes("not allowlisted")),
        ),
      "B_adjust_spacing_deprecated_for_new_plans",
      adjSpacingDeprecated.errors.join("; "),
    ),
  );

  const moveObjectTargetIds = validateRevisionPlan({
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "bad",
    operations: [
      {
        op: "move_object",
        target_ids: ["block-experience-2-t2", "block-experience-2-t3"],
        values: { delta_top: -10 },
        ...baseFields,
      },
    ],
  });
  checks.push(
    assert(
      !moveObjectTargetIds.ok &&
        moveObjectTargetIds.errors.some((e) =>
          e.includes("target_ids is invalid for single-target"),
        ),
      "B2_move_object_target_ids_only_rejected",
      moveObjectTargetIds.errors.join("; "),
    ),
  );

  const updateTextTargetIds = validateRevisionPlan({
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "bad",
    operations: [
      {
        op: "update_text",
        target_ids: ["block-summary-1-t1", "block-experience-2-t1"],
        values: { text: "SUMMARY" },
        ...baseFields,
      },
    ],
  });
  checks.push(
    assert(
      !updateTextTargetIds.ok &&
        updateTextTargetIds.errors.some((e) =>
          e.includes("target_ids is invalid for single-target"),
        ),
      "C_update_text_target_ids_only_rejected",
      updateTextTargetIds.errors.join("; "),
    ),
  );

  // D — set_position + target_id passes
  const setPosOk = validateRevisionPlan({
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "ok",
    operations: [
      {
        op: "set_position",
        target_id: "block-summary-1-r0",
        values: { top: 130, left: 48 },
        ...baseFields,
      },
    ],
  });
  checks.push(
    assert(
      setPosOk.ok === true,
      "D_set_position_with_target_id_passes",
      setPosOk.errors.join("; ") || "ok",
    ),
  );

  // H — empty target_id + target_ids present → misuse error, no fallback
  const emptyPlusIds = validateRevisionPlan({
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "bad",
    operations: [
      {
        op: "set_position",
        target_id: "",
        target_ids: ["a", "b"],
        values: { top: 10 },
        ...baseFields,
      },
    ],
  });
  checks.push(
    assert(
      !emptyPlusIds.ok &&
        emptyPlusIds.errors.some((e) =>
          e.includes("target_ids is invalid for single-target"),
        ) &&
        !emptyPlusIds.ok,
      "H_empty_target_id_plus_target_ids_no_fallback",
      emptyPlusIds.errors.join("; "),
    ),
  );

  // I — exact latest production failure shapes (revtask-05667cbb-641)
  const prodFixture = validateRevisionPlan({
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "production replay",
    operations: [
      {
        op: "set_position",
        target_ids: [
          "block-summary-1-r0",
          "block-experience-2-r0",
          "block-education-3-r0",
          "block-skills-4-r0",
          "block-certifications-5-r0",
          "block-languages-6-r0",
        ],
        values: {
          align_left: 48,
          vertical_spacing_standardized: true,
        },
        before_summary: "Section heading rectangles",
        intended_change: "Align all dark-blue section heading rectangles",
        founder_feedback_item:
          "Standardize the vertical spacing system throughout the resume: keep consistent spacing from each section heading to its body content and consistent spacing between the end of one section and the beginning of the next section.",
        confidence: 0.95,
      },
      {
        op: "adjust_spacing",
        target_id: "block-experience-2-t2",
        values: { spacing: 18 },
        before_summary: "Experience spacing",
        intended_change: "Normalize Experience spacing",
        founder_feedback_item:
          "Normalize the spacing inside the Experience section so job titles, employment dates, bullet groups, and the transitions between different employers follow one consistent vertical rhythm without unusually large or compressed gaps.",
        confidence: 0.95,
      },
      {
        op: "set_position",
        target_ids: [
          "block-summary-1-t2",
          "block-experience-2-r0",
          "block-education-3-r0",
        ],
        values: { qa_pass_boundaries: true },
        before_summary: "page",
        intended_change: "QA bounds pass",
        founder_feedback_item: CANONICAL_COLLISION_BOUNDS_QA,
        confidence: 0.98,
      },
      {
        op: "update_text",
        target_ids: [
          "block-summary-1-t1",
          "block-experience-2-t1",
          "block-education-3-t1",
        ],
        values: {
          fontFamily: "Roboto",
          fontSize: 16,
          fontWeight: 600,
          fill: "#ffffff",
        },
        before_summary: "headings",
        intended_change: "visual consistency QA",
        founder_feedback_item: CANONICAL_VISUAL_CONSISTENCY_QA,
        confidence: 0.98,
      },
    ],
  });
  checks.push(
    assert(
      !prodFixture.ok &&
        prodFixture.errors.some((e) => e.includes("operations[0] set_position")) &&
        prodFixture.errors.some(
          (e) =>
            e.includes("adjust_spacing") &&
            (e.includes("deprecated") || e.includes("not allowlisted")),
        ) &&
        prodFixture.errors.some((e) => e.includes("operations[2] set_position")) &&
        prodFixture.errors.some((e) => e.includes("operations[3] update_text")) &&
        prodFixture.errors.some(
          (e) =>
            e.includes("target_ids is invalid for single-target") ||
            e.includes("values.spacing") ||
            e.includes("values.text string"),
        ),
      "I_exact_production_ops_5_18_24_25_shapes_rejected",
      prodFixture.errors.join(" | "),
    ),
  );

  // L — placeholder / pseudo spacing values rejected even with valid target_id
  const placeholderVals = validateRevisionPlan({
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "bad values",
    operations: [
      {
        op: "set_position",
        target_id: "block-summary-1-r0",
        values: { vertical_spacing_standardized: true },
        ...baseFields,
      },
      {
        op: "set_position",
        target_id: "block-experience-2-t2",
        values: { spacing: 18 },
        ...baseFields,
      },
      {
        op: "move_object",
        target_id: "block-skills-4-t2",
        values: { gap_px: 10 },
        ...baseFields,
      },
      {
        op: "update_text",
        target_id: "block-summary-1-t1",
        values: { fontSize: 16, fill: "#ffffff" },
        ...baseFields,
      },
    ],
  });
  checks.push(
    assert(
      !placeholderVals.ok &&
        placeholderVals.errors.some((e) =>
          e.includes("values.vertical_spacing_standardized"),
        ) &&
        placeholderVals.errors.some((e) => e.includes("values.spacing")) &&
        placeholderVals.errors.some((e) => e.includes("values.gap_px")) &&
        placeholderVals.errors.some((e) => e.includes("values.text string")) &&
        placeholderVals.errors.length >= 4,
      "L_unsupported_placeholder_values_rejected",
      placeholderVals.errors.join(" | "),
    ),
  );

  // J — verification items with zero ops still pass plan completeness
  const mutFb = "Move the Education heading down 20px.";
  const planMutOnly: RevisionPlan = {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "mutations only",
    notes: [],
    operations: [
      {
        op: "set_position",
        target_id: "block-education-3-t1",
        before_summary: "edu heading",
        intended_change: "move down",
        values: { top: 800 },
        founder_feedback_item: mutFb,
        confidence: 0.9,
      },
    ],
  };
  const cover = validatePlanCoversRequestedChanges(planMutOnly, [
    mutFb,
    CANONICAL_COLLISION_BOUNDS_QA,
    CANONICAL_VISUAL_CONSISTENCY_QA,
  ]);
  checks.push(
    assert(
      cover.ok === true,
      "J_verification_items_zero_ops_plan_completeness_pass",
      cover.errors.join("; ") || "ok",
    ),
  );

  const task: RevisionTask = {
    schema_version: "founder-revision-task-1.0.0",
    task_id: "revtask-verify-tid",
    decision_id: "fd-verify-tid",
    review_id: "rev-verify-tid",
    prior_candidate_id: "cand-x",
    prior_canvas_path: "canvas.json",
    founder_reason: "test",
    requested_changes: ["fix summary body"],
    role: "Analyst",
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
    inventory: [
      {
        id: "block-summary-1-t1",
        index: 0,
        type: "Textbox",
        text: "SUMMARY",
        left: 94,
        top: 163,
        width: 100,
        height: 15,
        fill: null,
        stroke: null,
        fontSize: 12,
        fontFamily: null,
        fontWeight: null,
        lineHeight: null,
        role: null,
        section: "summary",
        locked: false,
        system: false,
        group_id: null,
      },
      {
        id: "block-summary-1-t2",
        index: 1,
        type: "Textbox",
        text: "Body paragraph",
        left: 80,
        top: 185,
        width: 650,
        height: 62,
        fill: null,
        stroke: null,
        fontSize: 11,
        fontFamily: null,
        fontWeight: null,
        lineHeight: null,
        role: null,
        section: "summary",
        locked: false,
        system: false,
        group_id: null,
      },
    ],
    page_width: 794,
    page_height: 1123,
    preview_width: 794,
    preview_height: 1123,
  });
  checks.push(
    assert(
      prompt.instructions.includes("TARGETING CONTRACT") &&
        prompt.instructions.includes("MUST NOT include target_ids") &&
        prompt.instructions.includes("one operation = one inventory object") &&
        prompt.instructions.includes("ZERO dummy mutation operations") &&
        prompt.instructions.includes("vertical_spacing_standardized") &&
        prompt.instructions.includes("Never invent or infer roles") &&
        prompt.instructions.includes("filled-label") &&
        prompt.instructions.includes("NOT the SUMMARY heading") &&
        prompt.instructions.includes("MULTI-TARGET OPERATIONS") &&
        prompt.instructions.includes("target_ids is REQUIRED") &&
        prompt.instructions.includes("TARGET CANDIDATE HINTS"),
      "K_prompt_contains_targeting_contract_rules",
      "rules present",
    ),
  );

  checks.push(
    assert(openaiCalls === 0, "no_openai_during_verification", `n=${openaiCalls}`),
  );

  const afterFp = listRevisionTasks().map(
    (t) => `${t.task_id}:${t.status}:${t.updated_at}`,
  );
  checks.push(
    assert(
      JSON.stringify(beforeFp) === JSON.stringify(afterFp),
      "production_tasks_untouched",
      `before=${beforeFp.length} after=${afterFp.length}`,
    ),
  );

  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.filter((c) => !c.pass);
  const report = {
    ok: failed.length === 0,
    passed,
    total: checks.length,
    checks,
    at: new Date().toISOString(),
  };
  mkdirSync(join(OUT, ".."), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) {
    console.error(
      "FAILED",
      failed.map((f) => f.name),
    );
    process.exit(1);
  }
  console.log(`OK ${passed}/${checks.length}`);
}

main();
