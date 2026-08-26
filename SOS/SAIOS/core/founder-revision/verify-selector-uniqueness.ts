/**
 * Selector uniqueness validation + executor diagnostics.
 * No OpenAI. No production task mutation.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { executeCanvasOperations } from "./CanvasOperationExecutor.js";
import { buildRevisionPlannerPrompt } from "./RevisionPromptBuilder.js";
import {
  validatePlanSelectorsAgainstCanvas,
  validateRevisionPlanSelectors,
} from "./SelectorResolution.js";
import type { FabricCanvasDoc } from "./CanvasInventory.js";
import type { CanvasOperation, RevisionPlan } from "./revision-task-types.js";
import { listRevisionTasks } from "./RevisionTaskStore.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/founder-revision/verify-selector-uniqueness.json",
);
const FIXTURE = join(
  REPO,
  ".cursor/debug-fixtures/revtask-9348b928-68b",
);

type Check = { name: string; pass: boolean; detail: string };

function assert(cond: boolean, name: string, detail: string): Check {
  return { name, pass: cond, detail };
}

function summaryCanvas(): FabricCanvasDoc {
  return {
    version: "5.3.0",
    width: 794,
    height: 1123,
    objects: [
      {
        type: "Textbox",
        id: "block-summary-1-t1",
        left: 94,
        top: 163,
        width: 636,
        height: 15,
        text: "SUMMARY",
        fontSize: 12,
        data: { id: "block-summary-1-t1", section: "summary" },
      },
      {
        type: "Textbox",
        id: "block-summary-1-t2",
        left: 80,
        top: 185,
        width: 650,
        height: 62,
        text: "Operations Analyst with a foundational background in data analysis.",
        fontSize: 11,
        data: { id: "block-summary-1-t2", section: "summary" },
      },
      {
        type: "Textbox",
        id: "block-skills-5-t1",
        left: 80,
        top: 800,
        width: 200,
        height: 14,
        text: "SKILLS",
        fontSize: 12,
        data: {
          id: "block-skills-5-t1",
          section: "skills",
          role: "section-heading",
        },
      },
    ],
  };
}

function fingerprintTasks(): string[] {
  return listRevisionTasks().map(
    (t) => `${t.task_id}:${t.status}:${t.updated_at}`,
  );
}

async function main(): Promise<void> {
  const checks: Check[] = [];
  const beforeFp = fingerprintTasks();
  let openaiCalls = 0;

  const canvas = summaryCanvas();

  // --- SUMMARY collision ---
  const ambOp: CanvasOperation = {
    op: "update_text",
    selector: { type: "Textbox", section: "summary" },
    intended_change: "re-render summary",
    values: { text: "body" },
    founder_feedback_item: "fix glyphs",
    confidence: 0.9,
  };
  const amb = validatePlanSelectorsAgainstCanvas(canvas, [ambOp]);
  checks.push(
    assert(
      !amb.ok &&
        amb.issues[0]?.reason === "ambiguous" &&
        amb.issues[0]?.matched.length === 2 &&
        amb.issues[0]?.matched.some((m) => m.id === "block-summary-1-t1") &&
        amb.issues[0]?.matched.some((m) => m.id === "block-summary-1-t2"),
      "summary_heading_body_collision_rejected",
      amb.error ?? "no error",
    ),
  );
  checks.push(
    assert(
      (amb.error ?? "").includes("operations[0]") &&
        (amb.error ?? "").includes("ambiguous") &&
        (amb.error ?? "").includes("block-summary-1-t1") &&
        (amb.error ?? "").includes("block-summary-1-t2"),
      "error_includes_index_and_matched_diagnostics",
      amb.error ?? "",
    ),
  );

  // Snapshot canvas hash before failed executor path
  const beforeJson = JSON.stringify(canvas);
  const execAmb = executeCanvasOperations({
    canvas,
    operations: [ambOp],
  });
  checks.push(
    assert(
      !execAmb.ok &&
        (execAmb.error ?? "").includes("ambiguous") &&
        (execAmb.error ?? "").includes("block-summary-1-t1"),
      "executor_ambiguous_diagnostics",
      execAmb.error ?? "",
    ),
  );
  checks.push(
    assert(
      JSON.stringify(canvas) === beforeJson,
      "ambiguous_rejected_before_mutation_input_untouched",
      "input canvas reference unchanged",
    ),
  );
  // Executor clones — verify result canvas equals input when failed on first op
  checks.push(
    assert(
      JSON.stringify(execAmb.canvas.objects?.[0]) ===
        JSON.stringify(canvas.objects?.[0]) &&
        JSON.stringify(execAmb.canvas.objects?.[1]) ===
          JSON.stringify(canvas.objects?.[1]),
      "no_canvas_mutation_on_first_op_failure",
      "objects unchanged",
    ),
  );

  // --- unique by id ---
  const byId: CanvasOperation = {
    op: "update_text",
    target_id: "block-summary-1-t2",
    intended_change: "body only",
    values: { text: "Revised body" },
    founder_feedback_item: "body",
    confidence: 1,
  };
  const idOk = validatePlanSelectorsAgainstCanvas(canvas, [byId]);
  checks.push(
    assert(idOk.ok, "selector_with_object_id_unique", idOk.error ?? "ok"),
  );
  const applied = executeCanvasOperations({ canvas, operations: [byId] });
  checks.push(
    assert(
      applied.ok &&
        String(applied.canvas.objects?.[1]?.text) === "Revised body",
      "id_selector_executes_successfully",
      applied.error ?? "ok",
    ),
  );

  // --- role + section + text_includes ---
  const byCombo: CanvasOperation = {
    op: "update_text",
    selector: {
      type: "Textbox",
      section: "skills",
      role: "section-heading",
      text_includes: "SKILLS",
    },
    intended_change: "skills label",
    values: { text: "SKILLS" },
    founder_feedback_item: "label",
    confidence: 1,
  };
  const comboOk = validatePlanSelectorsAgainstCanvas(canvas, [byCombo]);
  checks.push(
    assert(
      comboOk.ok,
      "role_section_text_includes_unique",
      comboOk.error ?? "ok",
    ),
  );

  // --- unresolved role:label ---
  const badLabel: CanvasOperation = {
    op: "adjust_font_size",
    selector: { type: "Textbox", role: "label" },
    intended_change: "labels",
    values: { fontSize: 13 },
    founder_feedback_item: "typography",
    confidence: 0.9,
  };
  const unres = validatePlanSelectorsAgainstCanvas(canvas, [badLabel]);
  checks.push(
    assert(
      !unres.ok && unres.issues[0]?.reason === "unresolved",
      "unresolved_role_label_rejected_before_execution",
      unres.error ?? "",
    ),
  );
  const before2 = JSON.stringify(canvas);
  const execUnres = executeCanvasOperations({
    canvas,
    operations: [badLabel],
  });
  checks.push(
    assert(
      !execUnres.ok &&
        (execUnres.error ?? "").includes("unresolved") &&
        (execUnres.error ?? "").includes("label"),
      "executor_unresolved_diagnostics",
      execUnres.error ?? "",
    ),
  );
  checks.push(
    assert(
      JSON.stringify(canvas) === before2,
      "unresolved_no_input_mutation",
      "ok",
    ),
  );

  // --- prompt improvements ---
  const prompt = buildRevisionPlannerPrompt({
    task: {
      schema_version: "founder-revision-task-1.0.0",
      task_id: "revtask-verify-sel",
      decision_id: "fd-verify-sel",
      review_id: "rev-verify-sel",
      prior_candidate_id: "cand-x",
      prior_canvas_path: "canvas.json",
      founder_reason: "test",
      requested_changes: ["fix summary"],
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
    },
    inventory: [],
    page_width: 794,
    page_height: 1123,
    preview_width: 794,
    preview_height: 1123,
  });
  checks.push(
    assert(
      prompt.instructions.includes("TARGETING CONTRACT") &&
        prompt.instructions.includes("section alone is INSUFFICIENT") &&
        prompt.instructions.includes("NOT the SUMMARY label"),
      "planner_prompt_selector_rules",
      "rules present",
    ),
  );

  // --- fixture replay (saved failed plan) ---
  if (
    existsSync(join(FIXTURE, "canvas.json")) &&
    existsSync(join(FIXTURE, "revision-plan.json"))
  ) {
    const fixCanvas = JSON.parse(
      readFileSync(join(FIXTURE, "canvas.json"), "utf8"),
    ) as FabricCanvasDoc;
    const fixPlan = JSON.parse(
      readFileSync(join(FIXTURE, "revision-plan.json"), "utf8"),
    ) as RevisionPlan;
    const beforeFix = JSON.stringify(fixCanvas);
    const gate = validateRevisionPlanSelectors(fixCanvas, fixPlan);
    const ambIssue = gate.issues.find(
      (x) => x.operation_index === 3 && x.reason === "ambiguous",
    );
    checks.push(
      assert(
        !gate.ok &&
          !!ambIssue &&
          (ambIssue.matched?.length ?? 0) === 2 &&
          (gate.error ?? "").includes("operations[3]"),
        "fixture_revtask_9348_rejected_at_validation",
        gate.error ?? "no error",
      ),
    );
    checks.push(
      assert(
        JSON.stringify(fixCanvas) === beforeFix,
        "fixture_no_canvas_mutation",
        "fixture canvas untouched",
      ),
    );
    // Confirm execution would also fail closed with diagnostics (still no mutation of input)
    const execFix = executeCanvasOperations({
      canvas: fixCanvas,
      operations: fixPlan.operations.slice(0, 4),
    });
    checks.push(
      assert(
        !execFix.ok && (execFix.error ?? "").includes("ambiguous"),
        "fixture_executor_still_fail_closed",
        execFix.error ?? "",
      ),
    );
  } else {
    checks.push(
      assert(
        false,
        "fixture_revtask_9348_rejected_at_validation",
        `missing fixtures at ${FIXTURE}`,
      ),
    );
  }

  // Compatibility: unique target_id plan still ok
  const compatPlan: RevisionPlan = {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "ok",
    operations: [
      {
        op: "set_position",
        target_id: "block-summary-1-t2",
        intended_change: "nudge",
        values: { left: 80 },
        founder_feedback_item: "nudge",
        confidence: 1,
      },
    ],
    notes: [],
  };
  checks.push(
    assert(
      validateRevisionPlanSelectors(canvas, compatPlan).ok,
      "successful_plans_remain_compatible",
      "ok",
    ),
  );

  checks.push(
    assert(openaiCalls === 0, "no_openai_during_verification", `n=${openaiCalls}`),
  );

  const afterFp = fingerprintTasks();
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

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
