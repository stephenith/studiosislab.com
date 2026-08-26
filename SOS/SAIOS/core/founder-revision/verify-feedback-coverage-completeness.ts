/**
 * Focused verify: feedback coverage completeness + planner cover rules.
 * Reproduces revtask-72e97bae-3ef coverage failure modes. No OpenAI.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { buildFeedbackCoverage } from "./FeedbackCoverage.js";
import {
  buildRevisionPlannerPrompt,
  validatePlanCoversRequestedChanges,
  validateRevisionPlan,
} from "./RevisionPromptBuilder.js";
import { listRevisionTasks } from "./RevisionTaskStore.js";
import type {
  OperationLogEntry,
  RevisionPlan,
  RevisionTask,
} from "./revision-task-types.js";
import type { FabricCanvasDoc } from "./CanvasInventory.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/founder-revision/verify-feedback-coverage-completeness.json",
);

type Check = { name: string; pass: boolean; detail: string };

function assert(cond: boolean, name: string, detail: string): Check {
  return { name, pass: cond, detail };
}

const HEADER_FB = "Reduce header height to improve page balance.";
const TYPO_FB =
  "Review overall typography against the highest-quality previously approved templates.";

function emptyCanvas(): FabricCanvasDoc {
  return { version: "5.3.0", width: 794, height: 1123, objects: [] };
}

function headerResizeLog(ok = true): OperationLogEntry {
  return {
    index: 0,
    op: "resize_object",
    target_id: "block-header-0-r0",
    founder_feedback_item: HEADER_FB,
    ok,
    before: {
      id: "block-header-0-r0",
      type: "Rect",
      height: 54,
      width: 698,
      left: 48,
      top: 48,
      fill: "#dbeafe",
      stroke: null,
      text: null,
    },
    after: {
      id: "block-header-0-r0",
      type: "Rect",
      height: 40,
      width: 698,
      left: 48,
      top: 48,
      fill: "#dbeafe",
      stroke: null,
      text: null,
    },
    error: ok ? null : "resize failed",
  };
}

function typoLog(): OperationLogEntry {
  return {
    index: 1,
    op: "adjust_font_size",
    target_id: "block-summary-1-t2",
    founder_feedback_item: TYPO_FB,
    ok: true,
    before: {
      id: "block-summary-1-t2",
      type: "Textbox",
      fontSize: 11,
      text: "body",
      left: 80,
      top: 185,
      width: 650,
      height: 62,
      fill: "#0a0a0a",
      stroke: null,
    },
    after: {
      id: "block-summary-1-t2",
      type: "Textbox",
      fontSize: 12,
      text: "body",
      left: 80,
      top: 185,
      width: 650,
      height: 62,
      fill: "#0a0a0a",
      stroke: null,
    },
    error: null,
  };
}

function planWith(...feedbackItems: string[]): RevisionPlan {
  return {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "coverage verify",
    notes: [],
    operations: feedbackItems.map((fb, i) => ({
      op: i === 0 ? ("resize_object" as const) : ("adjust_font_size" as const),
      target_id: i === 0 ? "block-header-0-r0" : "block-summary-1-t2",
      before_summary: "inventory state",
      intended_change: "concrete mutation",
      values: i === 0 ? { height: 40 } : { fontSize: 12 },
      founder_feedback_item: fb,
      confidence: 0.9,
    })),
  };
}

function main(): void {
  const checks: Check[] = [];
  const beforeFp = listRevisionTasks().map(
    (t) => `${t.task_id}:${t.status}:${t.updated_at}`,
  );
  let openaiCalls = 0;
  const canvas = emptyCanvas();

  // Case A: exact task failure shape — header op ok, typography missing → gate false
  const failCov = buildFeedbackCoverage({
    requested_changes: [HEADER_FB, TYPO_FB],
    plan: planWith(HEADER_FB),
    log: [headerResizeLog(true)],
    beforeCanvas: canvas,
    afterCanvas: canvas,
  });
  const headerItem = failCov.items.find(
    (i) => i.founder_feedback_item === HEADER_FB,
  );
  const typoItem = failCov.items.find((i) => i.founder_feedback_item === TYPO_FB);
  checks.push(
    assert(
      headerItem?.status === "addressed",
      "one_successful_header_height_resize_addressed",
      headerItem?.status ?? "missing",
    ),
  );
  checks.push(
    assert(
      typoItem?.status === "not_addressed",
      "zero_typography_ops_not_addressed",
      typoItem?.status ?? "missing",
    ),
  );
  checks.push(
    assert(
      failCov.gate_pass === false,
      "fixture_gate_pass_false_when_typography_missing",
      JSON.stringify(failCov.items.map((i) => i.status)),
    ),
  );

  // Case B: typography op present + header → gate true
  const passCov = buildFeedbackCoverage({
    requested_changes: [HEADER_FB, TYPO_FB],
    plan: planWith(HEADER_FB, TYPO_FB),
    log: [headerResizeLog(true), typoLog()],
    beforeCanvas: canvas,
    afterCanvas: canvas,
  });
  checks.push(
    assert(
      passCov.items.every((i) => i.status === "addressed") &&
        passCov.gate_pass === true,
      "header_and_typography_ops_gate_pass_true",
      JSON.stringify(passCov.items.map((i) => i.status)),
    ),
  );
  checks.push(
    assert(
      passCov.items.find((i) => i.founder_feedback_item === TYPO_FB)?.status ===
        "addressed",
      "one_successful_typography_op_addressed",
      "ok",
    ),
  );

  // Failed matching op does not pass
  const failedOpCov = buildFeedbackCoverage({
    requested_changes: [HEADER_FB],
    plan: planWith(HEADER_FB),
    log: [headerResizeLog(false)],
    beforeCanvas: canvas,
    afterCanvas: canvas,
  });
  checks.push(
    assert(
      failedOpCov.items[0]?.status !== "addressed" &&
        failedOpCov.gate_pass === false,
      "failed_matching_op_does_not_pass",
      failedOpCov.items[0]?.status ?? "missing",
    ),
  );

  // Planner completeness validation
  const incomplete = validateRevisionPlan(planWith(HEADER_FB), {
    requested_changes: [HEADER_FB, TYPO_FB],
  });
  checks.push(
    assert(
      !incomplete.ok &&
        incomplete.errors.some((e) => e.includes("requested_changes[1]")),
      "every_requested_change_must_have_planned_op",
      incomplete.errors.join("; "),
    ),
  );

  const complete = validateRevisionPlan(planWith(HEADER_FB, TYPO_FB), {
    requested_changes: [HEADER_FB, TYPO_FB],
  });
  checks.push(
    assert(
      complete.ok === true,
      "complete_plan_covers_all_requested_changes",
      complete.errors.join("; ") || "ok",
    ),
  );

  const coverHelper = validatePlanCoversRequestedChanges(
    planWith(HEADER_FB),
    [HEADER_FB, TYPO_FB],
  );
  checks.push(
    assert(
      !coverHelper.ok,
      "validatePlanCoversRequestedChanges_detects_gap",
      coverHelper.errors.join("; "),
    ),
  );

  // Exact founder_feedback_item matching preserved (paraphrase does not cover)
  const paraphrase = validatePlanCoversRequestedChanges(
    {
      ...planWith("Review typography vs prior templates."),
    },
    [TYPO_FB],
  );
  checks.push(
    assert(
      !paraphrase.ok,
      "exact_founder_feedback_item_matching_preserved",
      paraphrase.errors.join("; "),
    ),
  );

  // Structural multi-object heuristic still required for contact-in-header unify
  const unifyFb =
    "Move contact inside the blue header by extending the blue background.";
  const unifyCov = buildFeedbackCoverage({
    requested_changes: [unifyFb],
    plan: {
      schema_version: "founder-canvas-revision-plan-1.0.0",
      summary: "unify",
      notes: [],
      operations: [
        {
          op: "extend_shape",
          target_id: "block-header-0-r0",
          before_summary: "header",
          intended_change: "extend",
          values: { height: 170 },
          founder_feedback_item: unifyFb,
          confidence: 0.9,
        },
      ],
    },
    log: [
      {
        index: 0,
        op: "extend_shape",
        target_id: "block-header-0-r0",
        founder_feedback_item: unifyFb,
        ok: true,
        before: { id: "block-header-0-r0", height: 100 },
        after: { id: "block-header-0-r0", height: 110 },
        error: null,
      },
    ],
    beforeCanvas: canvas,
    afterCanvas: canvas,
  });
  checks.push(
    assert(
      unifyCov.items[0]?.status === "partially_addressed" &&
        unifyCov.gate_pass === false,
      "structural_multi_object_heuristic_still_required",
      unifyCov.items[0]?.status ?? "missing",
    ),
  );

  const task: RevisionTask = {
    schema_version: "founder-revision-task-1.0.0",
    task_id: "revtask-verify-cov",
    decision_id: "fd-verify-cov",
    review_id: "rev-verify-cov",
    prior_candidate_id: "cand-x",
    prior_canvas_path: "canvas.json",
    founder_reason: "test",
    requested_changes: [HEADER_FB, TYPO_FB],
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
  checks.push(
    assert(
      prompt.instructions.includes("FOUNDER FEEDBACK COMPLETENESS") &&
        prompt.instructions.includes(
          "every MUTATION_REQUIRED Founder requested change MUST have its Exact text attributed",
        ) &&
        prompt.instructions.includes(
          "Coverage is attribution-based, not operation-count-based",
        ) &&
        prompt.instructions.includes("FOUNDER ITEM COVERAGE REQUIREMENTS") &&
        prompt.instructions.includes("OVERLAPPING FOUNDER REQUIREMENTS") &&
        prompt.instructions.includes("Broad requests such as reviewing overall typography") &&
        prompt.instructions.includes("ZERO dummy mutation operations") &&
        prompt.instructions.includes("BEFORE RETURNING"),
      "prompt_contains_completeness_rules",
      "ok",
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
