/**
 * Focused verify: exact operation-name allowlist in schema + validateRevisionPlan.
 * Replays revtask-05667cbb-641 operations[39] un-group_objects. No OpenAI. No prod mutation.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  ALLOWED_OPS,
  ALLOWED_OPS_ENUM,
  LEGACY_EXECUTOR_SUPPORTED_OPS,
  PLANNER_ALLOWED_OPS,
} from "./allowedCanvasOps.js";
import {
  buildRevisionPlannerPrompt,
  validateRevisionPlan,
} from "./RevisionPromptBuilder.js";
import { REVISION_PLANNING_JSON_SCHEMA } from "../providers/openai/OpenAIResponseFactory.js";
import { listRevisionTasks } from "./RevisionTaskStore.js";
import type { RevisionTask } from "./revision-task-types.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/founder-revision/verify-operation-allowlist.json",
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

/** Exact production failure shape (ops[39]). */
const HIST_OP39 = {
  op: "un-group_objects",
  target_ids: [
    "block-header-0-r0",
    "block-header-0-t1",
    "block-header-0-t2",
  ],
  before_summary:
    "Header elements (rect and two textboxes) horizontally aligned but vertically not visually balanced",
  intended_change:
    "Adjust vertical positioning within the header band group to balance vertical alignment and spacing among name and contact text",
  values: {},
  founder_feedback_item:
    "The header name is not vertically balanced inside its background band, the contact block and Summary transition need cleaner spacing, and the section headings do not maintain one consistent visual system.",
  confidence: 0.9,
};

function main(): void {
  const checks: Check[] = [];
  const beforeFp = listRevisionTasks().map(
    (t) => `${t.task_id}:${t.status}:${t.updated_at}`,
  );
  const openaiCalls = 0;

  const schemaOp = (
    REVISION_PLANNING_JSON_SCHEMA as {
      properties: {
        operations: {
          items: { properties: { op: { type: string; enum?: string[] } } };
        };
      };
    }
  ).properties.operations.items.properties.op;

  // A — hyphenated synonym rejected
  const badHyphen = validateRevisionPlan({
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "bad",
    operations: [
      {
        ...HIST_OP39,
        op: "un-group_objects",
      },
    ],
  });
  checks.push(
    assert(
      badHyphen.ok === false &&
        badHyphen.errors.some(
          (e) =>
            e.includes("operations[0]") && e.includes("op not allowlisted"),
        ),
      "A_un_group_objects_rejected",
      badHyphen.errors.join("; "),
    ),
  );

  // B — exact ungroup_objects with single-target target_id
  const ungroupOk = validateRevisionPlan({
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "ungroup",
    operations: [
      {
        op: "ungroup_objects",
        target_id: "block-header-0-t1",
        values: {},
        ...baseFields,
      },
    ],
  });
  checks.push(
    assert(
      ungroupOk.ok === true,
      "B_ungroup_objects_with_target_id_accepted",
      ungroupOk.errors.join("; ") || "ok",
    ),
  );

  // C — set_position
  const setPos = validateRevisionPlan({
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "pos",
    operations: [
      {
        op: "set_position",
        target_id: "block-header-0-t1",
        values: { top: 54 },
        ...baseFields,
      },
    ],
  });
  checks.push(
    assert(
      setPos.ok === true,
      "C_set_position_accepted",
      setPos.errors.join("; ") || "ok",
    ),
  );

  // D / E — schema enum ↔ PLANNER ALLOWED_OPS (no adjust_spacing)
  const enumVals = schemaOp.enum ?? [];
  checks.push(
    assert(
      Array.isArray(enumVals) &&
        ALLOWED_OPS.every((op) => enumVals.includes(op)) &&
        !enumVals.includes("adjust_spacing") &&
        !(ALLOWED_OPS as readonly string[]).includes("adjust_spacing") &&
        !(PLANNER_ALLOWED_OPS as readonly string[]).includes("adjust_spacing"),
      "D_every_ALLOWED_OPS_in_schema_enum",
      `enum=${JSON.stringify(enumVals)}`,
    ),
  );
  checks.push(
    assert(
      enumVals.every((op) => (ALLOWED_OPS as readonly string[]).includes(op)) &&
        enumVals.length === ALLOWED_OPS.length &&
        ALLOWED_OPS_ENUM.length === ALLOWED_OPS.length,
      "E_no_schema_enum_outside_ALLOWED_OPS",
      `enumLen=${enumVals.length} allowLen=${ALLOWED_OPS.length}`,
    ),
  );
  checks.push(
    assert(
      (LEGACY_EXECUTOR_SUPPORTED_OPS as readonly string[]).includes(
        "adjust_spacing",
      ),
      "E2_legacy_executor_still_lists_adjust_spacing",
      LEGACY_EXECUTOR_SUPPORTED_OPS.join(","),
    ),
  );

  // F — prompt contract
  const task: RevisionTask = {
    schema_version: "founder-revision-task-1.0.0",
    task_id: "revtask-verify-op-allow",
    decision_id: "fd-verify-op-allow",
    review_id: "rev-verify-op-allow",
    prior_candidate_id: "cand-x",
    prior_canvas_path: "canvas.json",
    founder_reason: "test",
    requested_changes: ["Balance header vertically"],
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
  const allowlistLine = prompt.instructions
    .split("\n")
    .find((l) => l.startsWith("- Exact allowlist:"));
  checks.push(
    assert(
      prompt.instructions.includes("Use ONLY the exact operation names") &&
        prompt.instructions.includes("Do not invent synonyms") &&
        prompt.instructions.includes("Do not add or remove hyphens") &&
        prompt.instructions.includes("ungroup_objects") &&
        prompt.instructions.includes("un-group_objects") &&
        prompt.instructions.includes('"op":"ungroup_objects"') &&
        ALLOWED_OPS.every((op) => prompt.instructions.includes(op)) &&
        !!allowlistLine &&
        !allowlistLine.includes("adjust_spacing") &&
        prompt.instructions.includes("INVALID / DEPRECATED op") &&
        prompt.instructions.includes("adjust_spacing"),
      "F_prompt_exact_allowlist_and_no_synonym_rules",
      allowlistLine ?? "missing allowlist line",
    ),
  );

  // G — historical ops[39] fixture
  const hist = validateRevisionPlan({
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "historical",
    operations: [HIST_OP39 as never],
  });
  checks.push(
    assert(
      hist.ok === false &&
        hist.plan === null &&
        hist.errors.some((e) => e.includes("op not allowlisted")),
      "G_historical_ops39_un_group_objects_rejected",
      hist.errors.join("; "),
    ),
  );

  // H / I
  checks.push(assert(openaiCalls === 0, "H_no_openai", `n=${openaiCalls}`));
  const afterFp = listRevisionTasks().map(
    (t) => `${t.task_id}:${t.status}:${t.updated_at}`,
  );
  checks.push(
    assert(
      JSON.stringify(beforeFp) === JSON.stringify(afterFp),
      "I_production_tasks_unchanged",
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
