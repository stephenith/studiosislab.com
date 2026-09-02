/**
 * Phase 6E combined replay — production-shaped no-network.
 * Marketing-Manager-shaped memory + named spacing pair + recovery.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { FounderPreferenceMemoryStore } from "../founder-memory/FounderPreferenceMemoryStore.js";
import { planFounderCanvasRevision } from "./RevisionPlanner.js";
import { buildCanvasInventory, type FabricCanvasDoc } from "./CanvasInventory.js";
import { executeCanvasOperations } from "./CanvasOperationExecutor.js";
import { buildFeedbackCoverage } from "./FeedbackCoverage.js";
import { buildPlanWithDeterministicSpacingOwnership } from "./DeterministicSpacingPlan.js";
import { canRecoverFailedRevision } from "./FailedRevisionRecovery.js";
import { summarizeFounderReviewProjection } from "../founder-review/FounderReviewProjection.js";
import {
  createRevisionTask,
  setRevisionTasksDirForTests,
  updateRevisionTask,
} from "./RevisionTaskStore.js";
import type { RevisionTask } from "./revision-task-types.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/founder-revision/verify-revision-closure-e2e-6e.json",
);

type Check = { name: string; pass: boolean; detail: string };
function assert(cond: boolean, name: string, detail: string): Check {
  return { name, pass: !!cond, detail };
}

function tb(id: string, top: number, text: string, height: number, section = "experience") {
  return {
    type: "textbox",
    id,
    left: 80,
    top,
    width: 650,
    height,
    fontSize: 10.5,
    lineHeight: 1.4666666666666666,
    text,
    data: { section },
  };
}

function shapedCanvas(): FabricCanvasDoc {
  return {
    version: "5.3.0",
    width: 794,
    height: 1123,
    objects: [
      {
        type: "rect",
        id: "page-bg",
        left: 0,
        top: 0,
        width: 794,
        height: 1123,
        fill: "#ffffff",
        data: { system: true, role: "pageBackground" },
      },
      tb("block-experience-2-t1", 269, "EXPERIENCE", 15),
      tb("block-experience-2-t2", 291, "Marketing Manager — Vistara Innovations", 16),
      tb("block-experience-2-t3", 309, "March 2020 – Present", 14),
      tb(
        "block-experience-2-t7",
        431,
        "• Implemented advanced analytics dashboards to track campaign performance in real time, enabling agile optimizations that improved ROI by 25%.",
        31,
      ),
      tb("block-experience-2-t8", 475.333, "Senior Marketing Specialist — Northwind Labs", 16),
      tb("block-experience-2-t9", 493.333, "June 2017 – February 2020", 14),
      tb(
        "block-experience-2-t10",
        512.333,
        "• Supported launch and growth of cross-channel campaigns contributing to 30% revenue growth YoY within the first year of tenure.",
        31,
      ),
      tb(
        "block-experience-2-t11",
        546.667,
        "• Optimized digital ad spend through A/B testing and audience segmentation, increasing click-through rate (CTR) by 20% and lowering CPA by 15%.",
        31,
      ),
      tb(
        "block-experience-2-t12",
        581,
        "• Coordinated brand refresh initiatives driving a 15% lift in brand recognition metrics across target demographics.",
        31,
      ),
      tb(
        "block-experience-2-t13",
        615.333,
        "• Conducted quarterly market analysis supporting strategic adjustments that led to a 10% increase in customer retention.",
        31,
      ),
    ],
  };
}

const FB =
  "Reduce the excessive vertical gap before the “Conducted quarterly market analysis supporting strategic adjustments…” bullet so all bullets under Senior Marketing Specialist — Northwind Labs follow a consistent compact vertical rhythm.";

function task(candId: string): RevisionTask {
  return {
    schema_version: "founder-revision-task-1.0.0",
    task_id: "revtask-6e-e2e",
    decision_id: "fd-6e-e2e",
    review_id: `founder-review-${candId}`,
    prior_candidate_id: candId,
    prior_canvas_path: `SOS/07_LOGS/saios/first-production-cycle/candidates/${candId}/canvas.json`,
    founder_reason: "Nexera-shaped spacing defect",
    requested_changes: [FB],
    role: "Marketing Manager",
    design_family: null,
    status: "PLANNING",
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
}

async function main(): Promise<void> {
  const checks: Check[] = [];
  const root = mkdtempSync(join(tmpdir(), "aios-6e-e2e-"));
  try {
    const candId = "cand-6e-e2e-creative";
    const candDir = join(
      root,
      "SOS/07_LOGS/saios/first-production-cycle/candidates",
      candId,
    );
    mkdirSync(candDir, { recursive: true });
    const canvas = shapedCanvas();
    writeFileSync(join(candDir, "canvas.json"), JSON.stringify(canvas, null, 2));
    writeFileSync(
      join(candDir, "production-target.json"),
      JSON.stringify({
        title: "Marketing Manager",
        category: "marketing",
        role_family: "marketing_manager",
        design_family: "creative",
        architecture: "section_index",
      }),
    );
    writeFileSync(
      join(candDir, "candidate.json"),
      JSON.stringify({
        candidate_id: candId,
        status: "WAITING_FOUNDER",
        target: { title: "Marketing Manager" },
      }),
    );

    const store = new FounderPreferenceMemoryStore(root);
    store.upsertActive({
      issue_type: "SPACING",
      raw_founder_feedback: "Keep creative layouts compact with consistent bullet rhythm.",
      normalized_rule: "Keep creative layouts compact with consistent bullet rhythm.",
      signal_type: "CONSTRAINT",
      confidence: "high",
      status: "CONFIRMED",
      scope: "DESIGN_FAMILY",
      candidate_id: candId,
      review_id: "rev-6e-e2e",
      decision_id: "fd-seed",
      revision_task_id: null,
      role: null,
      category: "marketing",
      role_family: null,
      design_family: "creative",
      architecture: "section_index",
      section: null,
      component: null,
      positive_or_negative: "negative",
      source_decision: "CHANGES_REQUESTED",
      acceptance_result: "accepted",
      active: true,
      confidence_merge: false,
    });

    const planned = await planFounderCanvasRevision({
      task: task(candId),
      inventory: buildCanvasInventory(canvas),
      page_width: 794,
      page_height: 1123,
      repoRoot: root,
      execute: async () => ({
        status: "COMPLETED",
        structured_output: {
          schema_version: "founder-canvas-revision-plan-1.0.0",
          summary: "AI overshoot fixture",
          operations: [
            {
              op: "set_position",
              target_id: "block-experience-2-t13",
              before_summary: "final bullet",
              intended_change: "move up too far",
              values: { top: 595 },
              founder_feedback_item: FB,
              confidence: 0.98,
            },
          ],
          notes: [],
        },
        provider_request_id: "verify-6e-e2e",
        model_identifier_internal: "verify",
        input_tokens: 10,
        output_tokens: 10,
      }),
    });

    const sel = planned.prompt.founder_memory_selection;
    checks.push(
      assert(
        sel?.FOUNDER_MEMORY_CONSUMED === true &&
          sel.context.design_family === "creative" &&
          (sel.prompt_block ?? "").trim().length > 0,
        "E2E_MEMORY_SELECTED",
        JSON.stringify(sel?.context),
      ),
    );
    checks.push(
      assert(
        planned.ok === true &&
          planned.prompt.instructions.includes("CURRENT FOUNDER REQUEST") &&
          planned.prompt.instructions.indexOf("CURRENT FOUNDER REQUEST") <
            planned.prompt.instructions.indexOf("RELEVANT FOUNDER MEMORY"),
        "E2E_PRECEDENCE",
        planned.ok ? "ok" : planned.error ?? "fail",
      ),
    );

    const owned = buildPlanWithDeterministicSpacingOwnership({
      priorCanvas: canvas,
      requested_changes: [FB],
      aiPlan: planned.ok ? planned.plan : {
        schema_version: "founder-canvas-revision-plan-1.0.0",
        summary: "fallback",
        operations: [],
        notes: [],
      },
    });
    const kept595 = owned.plan?.operations.some(
      (o) => o.op === "set_position" && Number(o.values?.top) === 595,
    );
    checks.push(
      assert(owned.ok === true && kept595 !== true, "E2E_UNSAFE_AI_BLOCKED_SAFE_PLAN", `mode=${owned.ownership_mode}`),
    );

    const exec = executeCanvasOperations({
      canvas,
      operations: owned.plan?.operations ?? [],
    });
    const cov = buildFeedbackCoverage({
      requested_changes: [FB],
      plan: owned.plan!,
      log: exec.log,
      beforeCanvas: canvas,
      afterCanvas: exec.canvas,
    });
    checks.push(
      assert(
        cov.all_addressed === true || cov.items[0]?.status === "addressed",
        "E2E_COVERAGE_PASS",
        `${cov.items[0]?.status} ${cov.items[0]?.evidence.notes}`,
      ),
    );
    checks.push(
      assert(
        owned.ok === true &&
          exec.ok === true &&
          (cov.all_addressed || cov.items[0]?.status === "addressed"),
        "E2E_READY_EQUIVALENT",
        "ownership+coverage would proceed to READY_FOR_FOUNDER_REVIEW",
      ),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }

  const recRoot = mkdtempSync(join(tmpdir(), "aios-6e-e2e-fail-"));
  const recTasks = join(recRoot, "SOS/07_LOGS/saios/founder-revision/tasks");
  mkdirSync(recTasks, { recursive: true });
  setRevisionTasksDirForTests(recTasks);
  try {
    const id = "cand-6e-e2e-fail";
    const reviewId = `founder-review-${id}`;
    const dir = join(recRoot, "SOS/07_LOGS/saios/first-production-cycle/candidates", id);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "candidate.json"),
      JSON.stringify({
        schema_version: 1,
        candidate_id: id,
        task_id: `task-${id}`,
        review_id: reviewId,
        cycle_id: `cycle-${id}`,
        created_at: "2026-09-02T19:00:00.000Z",
        status: "WAITING_FOUNDER",
        publication_allowed: false,
        target: { title: "X", category: "marketing" },
      }),
    );
    writeFileSync(join(dir, "preview.png"), "png");
    writeFileSync(join(dir, "thumbnail.png"), "png");
    mkdirSync(join(recRoot, "SOS/07_LOGS/saios/founder-decisions"), { recursive: true });
    writeFileSync(
      join(recRoot, "SOS/07_LOGS/saios/founder-decisions/decisions.jsonl"),
      `${JSON.stringify({
        decision_id: "fd-e2e-fail",
        review_id: reviewId,
        task_id: `task-${id}`,
        cycle_id: `cycle-${id}`,
        decision: "CHANGES_REQUESTED",
        created_at: "2026-09-02T19:01:00.000Z",
        fixture: false,
      })}\n`,
    );
    const t = createRevisionTask({
      decision_id: "fd-e2e-fail",
      review_id: reviewId,
      prior_candidate_id: id,
      prior_canvas_path: "x",
      founder_reason: "no safe move",
      requested_changes: [FB],
      role: "X",
    });
    const failedTask = updateRevisionTask(t.task.task_id, {
      status: "FAILED_GATE",
      error: "no safe spacing",
    });
    const s = summarizeFounderReviewProjection(recRoot);
    const item = s.items.find((i) => i.review_id === reviewId);
    checks.push(
      assert(
        item?.status === "revision_failed" &&
          canRecoverFailedRevision(recRoot, reviewId) &&
          failedTask.status === "FAILED_GATE",
        "E2E_FAILED_PATH_RECOVERY",
        `status=${item?.status} recover=${canRecoverFailedRevision(recRoot, reviewId)} task=${failedTask.status}`,
      ),
    );
  } finally {
    setRevisionTasksDirForTests(null);
    rmSync(recRoot, { recursive: true, force: true });
  }

  const failed = checks.filter((c) => !c.pass);
  const report = {
    schema_version: "phase-6e-closure-e2e-1.0.0",
    generated_at: new Date().toISOString(),
    pass: failed.length === 0,
    checks,
    publication_allowed: false,
    live: false,
  };
  mkdirSync(join(OUT, ".."), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
  if (failed.length) {
    console.error(JSON.stringify(report, null, 2));
    process.exit(1);
  }
  console.log(`PHASE 6E E2E PASS ${checks.length}/${checks.length}`);
}

void main();
