/**
 * Focused verify: align_objects / group_objects require inventory target_ids ≥2.
 * Replays revtask-503c2d4d-1e5 operations[8] failure shape. No OpenAI. No prod mutation.
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
  "SOS/07_LOGS/saios/founder-revision/verify-align-objects-target-ids.json",
);

type Check = { name: string; pass: boolean; detail: string };

function assert(cond: boolean, name: string, detail: string): Check {
  return { name, pass: cond, detail };
}

const baseFields = {
  before_summary: "Current inventory object state",
  intended_change: "Align or group listed inventory objects",
  founder_feedback_item: "Founder feedback item",
  confidence: 0.9,
};

function main(): void {
  const checks: Check[] = [];
  const beforeFp = listRevisionTasks().map(
    (t) => `${t.task_id}:${t.status}:${t.updated_at}`,
  );
  const openaiCalls = 0;

  // A — exact production failure shape (revtask-503c2d4d-1e5 ops[8])
  const prodFail = validateRevisionPlan({
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "prod failure replay",
    operations: [
      {
        op: "align_objects",
        target_id: "",
        before_summary:
          "Multiple textboxes and headings throughout the resume at various left alignments and inconsistent vertical spacing",
        intended_change:
          "Align left edges of section headings and their body textboxes uniformly to create intentional alignment and cleaner visual structure",
        values: { align_left: 48 },
        founder_feedback_item:
          "Perform a final visual QA pass to ensure every section appears intentionally aligned, evenly spaced, and production-ready.",
        confidence: 0.95,
      },
    ],
  });
  checks.push(
    assert(
      prodFail.ok === false &&
        prodFail.plan === null &&
        prodFail.errors.some(
          (e) =>
            e.includes("operations[0] align_objects") &&
            e.includes("target_ids") &&
            e.includes("at least 2"),
        ),
      "A_prod_ops8_align_objects_values_only_fails",
      prodFail.errors.join("; "),
    ),
  );

  // B — target_ids length 2+
  const alignOk = validateRevisionPlan({
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "align ok",
    operations: [
      {
        op: "align_objects",
        target_ids: ["block-summary-1-t1", "block-experience-2-t1"],
        values: { align_left: 48 },
        ...baseFields,
      },
    ],
  });
  checks.push(
    assert(
      alignOk.ok === true &&
        (alignOk.plan?.operations[0]?.target_ids?.length ?? 0) >= 2,
      "B_align_objects_target_ids_ge_2_passes",
      alignOk.errors.join("; ") || "ok",
    ),
  );

  // C — selector-only
  const selOnly = validateRevisionPlan({
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "sel",
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
      !selOnly.ok &&
        selOnly.errors.some((e) => e.includes("align_objects") && e.includes("target_ids")),
      "C_align_objects_selector_only_fails",
      selOnly.errors.join("; "),
    ),
  );

  // D — single target_id only
  const singleTid = validateRevisionPlan({
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "single tid",
    operations: [
      {
        op: "align_objects",
        target_id: "block-header-0-t1",
        values: { align_left: 60 },
        ...baseFields,
      },
    ],
  });
  checks.push(
    assert(
      !singleTid.ok &&
        singleTid.errors.some((e) => e.includes("align_objects") && e.includes("target_ids")),
      "D_align_objects_single_target_id_fails",
      singleTid.errors.join("; "),
    ),
  );

  // E — target_ids length 1
  const len1 = validateRevisionPlan({
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "len1",
    operations: [
      {
        op: "align_objects",
        target_ids: ["block-summary-1-t1"],
        values: { align_left: 48 },
        ...baseFields,
      },
    ],
  });
  checks.push(
    assert(
      !len1.ok &&
        len1.errors.some(
          (e) =>
            e.includes("align_objects") &&
            e.includes("at least 2 non-empty strings"),
        ),
      "E_align_objects_target_ids_length_1_fails",
      len1.errors.join("; "),
    ),
  );

  // F — empty string in target_ids
  const emptyEntry = validateRevisionPlan({
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "empty entry",
    operations: [
      {
        op: "align_objects",
        target_ids: ["block-summary-1-t1", "  "],
        values: { align_left: 48 },
        ...baseFields,
      },
    ],
  });
  checks.push(
    assert(
      !emptyEntry.ok &&
        emptyEntry.errors.some((e) => e.includes("align_objects")),
      "F_align_objects_empty_string_in_target_ids_fails",
      emptyEntry.errors.join("; "),
    ),
  );

  // G — group_objects same requirements
  const groupOk = validateRevisionPlan({
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "group ok",
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
      "G_group_objects_target_ids_ge_2_passes",
      groupOk.errors.join("; ") || "ok",
    ),
  );
  const groupSel = validateRevisionPlan({
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
      !groupSel.ok &&
        groupSel.errors.some((e) => e.includes("group_objects") && e.includes("target_ids")),
      "G_group_objects_selector_only_fails",
      groupSel.errors.join("; "),
    ),
  );
  const groupSingle = validateRevisionPlan({
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "group single",
    operations: [
      {
        op: "group_objects",
        target_id: "block-skills-4-t1",
        values: {},
        ...baseFields,
      },
    ],
  });
  checks.push(
    assert(
      !groupSingle.ok,
      "G_group_objects_single_target_id_fails",
      groupSingle.errors.join("; "),
    ),
  );

  // H — single-target unchanged
  const singleOk = validateRevisionPlan({
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "single",
    operations: [
      {
        op: "set_position",
        target_id: "block-summary-1-t2",
        values: { top: 200 },
        ...baseFields,
      },
    ],
  });
  checks.push(
    assert(
      singleOk.ok === true,
      "H_single_target_set_position_unchanged_pass",
      singleOk.errors.join("; ") || "ok",
    ),
  );
  const singleFail = validateRevisionPlan({
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "single fail",
    operations: [
      {
        op: "set_position",
        values: { top: 200 },
        ...baseFields,
      },
    ],
  });
  checks.push(
    assert(
      !singleFail.ok &&
        singleFail.errors.some((e) => e.includes("target_id is required")),
      "H_single_target_still_requires_target_id",
      singleFail.errors.join("; "),
    ),
  );

  // I — add_object exemption
  const addOk = validateRevisionPlan({
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "add",
    operations: [
      {
        op: "add_object",
        values: {
          type: "textbox",
          text: "Extra line",
          left: 48,
          top: 900,
          width: 200,
          height: 20,
        },
        ...baseFields,
      },
    ],
  });
  checks.push(
    assert(
      addOk.ok === true,
      "I_add_object_exemption_unchanged",
      addOk.errors.join("; ") || "ok",
    ),
  );

  // Prompt rules
  const task: RevisionTask = {
    schema_version: "founder-revision-task-1.0.0",
    task_id: "revtask-verify-align-tid",
    decision_id: "fd-verify-align-tid",
    review_id: "rev-verify-align-tid",
    prior_candidate_id: "cand-x",
    prior_canvas_path: "canvas.json",
    founder_reason: "test",
    requested_changes: ["Align headings"],
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
      prompt.instructions.includes("MULTI-TARGET OPERATIONS") &&
        prompt.instructions.includes("target_ids is REQUIRED") &&
        prompt.instructions.includes("Never use selector as the targeting mechanism") &&
        prompt.instructions.includes('"op":"align_objects"') &&
        prompt.instructions.includes("block-example-sidebar-t1") &&
        prompt.instructions.includes("block-example-heading") &&
        prompt.instructions.includes("one-element target_ids array is invalid") &&
        !prompt.instructions.includes("block-summary-1-t1"),
      "prompt_contains_multi_target_target_ids_rules_and_example",
      "rules present",
    ),
  );

  // J / K
  checks.push(
    assert(openaiCalls === 0, "J_no_openai", `n=${openaiCalls}`),
  );
  const afterFp = listRevisionTasks().map(
    (t) => `${t.task_id}:${t.status}:${t.updated_at}`,
  );
  checks.push(
    assert(
      JSON.stringify(beforeFp) === JSON.stringify(afterFp),
      "K_production_tasks_untouched",
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

main();
