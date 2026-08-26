/**
 * Focused verify: mandatory intended_change + before_summary in RevisionPromptBuilder.
 * No OpenAI. No production task mutation.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  buildRevisionPlannerPrompt,
  validateRevisionPlan,
} from "./RevisionPromptBuilder.js";
import { listRevisionTasks } from "./RevisionTaskStore.js";
import type { RevisionTask } from "./revision-task-types.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/founder-revision/verify-intended-change-requirement.json",
);

type Check = { name: string; pass: boolean; detail: string };

function assert(cond: boolean, name: string, detail: string): Check {
  return { name, pass: cond, detail };
}

const baseFields = {
  before_summary: "Textbox summary body at top≈185",
  intended_change: "Replace summary body text",
  founder_feedback_item: "Rewrite the professional summary",
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
        valid.plan?.operations[0]?.intended_change ===
          baseFields.intended_change &&
        valid.plan?.operations[0]?.before_summary === baseFields.before_summary,
      "valid_op_with_target_id_before_summary_intended_change_passes",
      valid.errors.join("; ") || "ok",
    ),
  );

  const missingIntended = validateRevisionPlan({
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "bad",
    operations: [
      {
        op: "resize_object",
        target_id: "block-header-0-r0",
        before_summary: "Header rect height 54",
        values: { height: 42 },
        founder_feedback_item: "Reduce header height",
        confidence: 1,
      },
    ],
  });
  checks.push(
    assert(
      !missingIntended.ok &&
        missingIntended.errors.some((e) =>
          e.includes("operations[0].intended_change required"),
        ),
      "missing_intended_change_fails",
      missingIntended.errors.join("; "),
    ),
  );

  const emptyIntended = validateRevisionPlan({
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "bad",
    operations: [
      {
        op: "resize_object",
        target_id: "block-header-0-r0",
        before_summary: "Header rect height 54",
        intended_change: "   ",
        values: { height: 42 },
        founder_feedback_item: "Reduce header height",
        confidence: 1,
      },
    ],
  });
  checks.push(
    assert(
      !emptyIntended.ok &&
        emptyIntended.errors.some((e) =>
          e.includes("operations[0].intended_change required"),
        ),
      "empty_intended_change_fails",
      emptyIntended.errors.join("; "),
    ),
  );

  const nullIntended = validateRevisionPlan({
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "bad",
    operations: [
      {
        op: "resize_object",
        target_id: "block-header-0-r0",
        before_summary: "Header rect height 54",
        intended_change: null,
        values: { height: 42 },
        founder_feedback_item: "Reduce header height",
        confidence: 1,
      },
    ],
  });
  checks.push(
    assert(
      !nullIntended.ok &&
        nullIntended.errors.some((e) =>
          e.includes("operations[0].intended_change"),
        ),
      "null_intended_change_fails",
      nullIntended.errors.join("; "),
    ),
  );

  const missingBefore = validateRevisionPlan({
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "bad",
    operations: [
      {
        op: "move_object",
        target_id: "block-header-0-t2",
        intended_change: "Move contact text upward",
        values: { top: 89 },
        founder_feedback_item: "Reduce header height",
        confidence: 1,
      },
    ],
  });
  checks.push(
    assert(
      !missingBefore.ok &&
        missingBefore.errors.some((e) =>
          e.includes("operations[0].before_summary required"),
        ),
      "missing_before_summary_fails",
      missingBefore.errors.join("; "),
    ),
  );

  const emptyBefore = validateRevisionPlan({
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "bad",
    operations: [
      {
        op: "move_object",
        target_id: "block-header-0-t2",
        before_summary: "",
        intended_change: "Move contact text upward",
        values: { top: 89 },
        founder_feedback_item: "Reduce header height",
        confidence: 1,
      },
    ],
  });
  checks.push(
    assert(
      !emptyBefore.ok &&
        emptyBefore.errors.some((e) =>
          e.includes("operations[0].before_summary required"),
        ),
      "empty_before_summary_fails",
      emptyBefore.errors.join("; "),
    ),
  );

  // Exact planner-failure op shape (revtask-72e97bae-3ef latest): target_id present, no intended_change/before_summary.
  const evidenceShape = validateRevisionPlan({
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "evidence",
    operations: [
      {
        op: "resize_object",
        target_id: "block-header-0-r0",
        values: { height: 42 },
        founder_feedback_item: "Reduce header height to improve page balance.",
        confidence: 1,
      },
    ],
  });
  checks.push(
    assert(
      evidenceShape.ok === false &&
        evidenceShape.plan === null &&
        evidenceShape.errors.some((e) => e.includes("intended_change")),
      "exact_planner_failure_op_shape_rejected",
      evidenceShape.errors.join("; "),
    ),
  );

  const task: RevisionTask = {
    schema_version: "founder-revision-task-1.0.0",
    task_id: "revtask-verify-ic",
    decision_id: "fd-verify-ic",
    review_id: "rev-verify-ic",
    prior_candidate_id: "cand-x",
    prior_canvas_path: "canvas.json",
    founder_reason: "test",
    requested_changes: ["Rewrite summary"],
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
    inventory: [],
    page_width: 794,
    page_height: 1123,
    preview_width: 794,
    preview_height: 1123,
  });
  checks.push(
    assert(
      prompt.instructions.includes("MANDATORY OPERATION FIELDS") &&
        prompt.instructions.includes(
          "intended_change is MANDATORY for every operation",
        ) &&
        prompt.instructions.includes(
          "before_summary is MANDATORY for every operation",
        ) &&
        prompt.instructions.includes("Never omit intended_change or before_summary"),
      "prompt_contains_mandatory_intended_change_and_before_summary_rules",
      "rules present",
    ),
  );
  checks.push(
    assert(
      prompt.instructions.includes("COMPLETE EXAMPLE OPERATION") &&
        prompt.instructions.includes('"intended_change"') &&
        prompt.instructions.includes('"before_summary"') &&
        prompt.instructions.includes('"target_id"') &&
        prompt.instructions.includes('"founder_feedback_item"') &&
        prompt.instructions.includes('"confidence"') &&
        prompt.instructions.includes('"values"'),
      "example_operation_contains_all_required_fields",
      "example present",
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
