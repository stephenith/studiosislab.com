/**
 * Phase 6E — Live planner-path revision memory context.
 * Goes through planFounderCanvasRevision (the caller that omitted repoRoot).
 * No network. No production mutation.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { FounderPreferenceMemoryStore } from "../founder-memory/FounderPreferenceMemoryStore.js";
import { planFounderCanvasRevision } from "./RevisionPlanner.js";
import { buildCanvasInventory } from "./CanvasInventory.js";
import type { RevisionTask } from "./revision-task-types.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/founder-revision/verify-revision-live-path-memory-6e.json",
);

type Check = { name: string; pass: boolean; detail: string };
function assert(cond: boolean, name: string, detail: string): Check {
  return { name, pass: !!cond, detail };
}

function task(partial: Partial<RevisionTask> = {}): RevisionTask {
  return {
    schema_version: "founder-revision-task-1.0.0",
    task_id: "revtask-6e-mem",
    decision_id: "fd-6e-mem",
    review_id: "founder-review-cand-6e-mem",
    prior_candidate_id: "cand-6e-mem-creative",
    prior_canvas_path:
      "SOS/07_LOGS/saios/first-production-cycle/candidates/cand-6e-mem-creative/canvas.json",
    founder_reason: "Tighten one Experience bullet gap",
    requested_changes: [
      "Reduce the excessive vertical gap before the “Conducted quarterly market analysis supporting strategic adjustments…” bullet so bullets follow a compact rhythm.",
    ],
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
    ...partial,
  };
}

async function main(): Promise<void> {
  const checks: Check[] = [];
  const root = mkdtempSync(join(tmpdir(), "aios-6e-mem-"));
  try {
    const candId = "cand-6e-mem-creative";
    const candDir = join(
      root,
      "SOS/07_LOGS/saios/first-production-cycle/candidates",
      candId,
    );
    mkdirSync(candDir, { recursive: true });
    writeFileSync(
      join(candDir, "production-target.json"),
      JSON.stringify(
        {
          title: "Marketing Manager",
          category: "marketing",
          role_family: "marketing_manager",
          design_family: "creative",
          architecture: "section_index",
          objective: "Marketing Manager resume with campaign metrics focus",
        },
        null,
        2,
      ),
    );
    writeFileSync(
      join(candDir, "candidate.json"),
      JSON.stringify(
        {
          candidate_id: candId,
          status: "WAITING_FOUNDER",
          target: { title: "Marketing Manager", category: "marketing" },
        },
        null,
        2,
      ),
    );
    const canvas = {
      version: "5.3.0",
      width: 794,
      height: 1123,
      objects: [
        {
          type: "textbox",
          id: "block-experience-2-t13",
          left: 80,
          top: 200,
          width: 650,
          height: 31,
          fontSize: 10.5,
          lineHeight: 1.4,
          text: "• Conducted quarterly market analysis supporting strategic adjustments that led to a 10% increase in customer retention.",
          data: { section: "experience" },
        },
      ],
    };
    writeFileSync(join(candDir, "canvas.json"), JSON.stringify(canvas, null, 2));

    const store = new FounderPreferenceMemoryStore(root);
    const rule = store.upsertActive({
      issue_type: "SPACING",
      raw_founder_feedback:
        "Keep creative single-column layouts compact with consistent bullet rhythm.",
      normalized_rule:
        "Keep creative single-column layouts compact with consistent bullet rhythm.",
      signal_type: "CONSTRAINT",
      confidence: "high",
      status: "CONFIRMED",
      scope: "DESIGN_FAMILY",
      candidate_id: candId,
      review_id: "rev-6e-mem",
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

    const inventory = buildCanvasInventory(canvas);
    const planned = await planFounderCanvasRevision({
      task: task({ prior_candidate_id: candId, design_family: null }),
      inventory,
      page_width: 794,
      page_height: 1123,
      repoRoot: root,
      execute: async () => ({
        status: "COMPLETED",
        structured_output: {
          schema_version: "founder-canvas-revision-plan-1.0.0",
          summary: "fixture",
          operations: [
            {
              op: "set_position",
              target_id: "block-experience-2-t13",
              before_summary: "final bullet",
              intended_change: "nudge",
              values: { top: 190 },
              founder_feedback_item:
                "Reduce the excessive vertical gap before the “Conducted quarterly market analysis supporting strategic adjustments…” bullet so bullets follow a compact rhythm.",
              confidence: 0.9,
            },
          ],
          notes: [],
        },
        provider_request_id: "verify-6e-mem",
        model_identifier_internal: "verify",
        input_tokens: 1,
        output_tokens: 1,
      }),
    });

    const sel = planned.prompt.founder_memory_selection;
    checks.push(
      assert(
        sel?.context.design_family === "creative" &&
          sel.context.architecture === "section_index",
        "LIVE_PATH_CONTEXT_FROM_ARTIFACTS",
        JSON.stringify(sel?.context ?? null),
      ),
    );
    checks.push(
      assert(
        sel?.FOUNDER_MEMORY_CONSUMED === true &&
          (sel.memory_ids ?? []).includes(rule.memory_id) &&
          (sel.prompt_block ?? "").trim().length > 0,
        "EXPECTED_CREATIVE_MEMORY_SELECTED",
        `ids=${JSON.stringify(sel?.memory_ids)} consumed=${sel?.FOUNDER_MEMORY_CONSUMED} chars=${(sel?.prompt_block ?? "").length}`,
      ),
    );
    checks.push(
      assert(
        (planned.prompt.instructions ?? "").includes("CURRENT FOUNDER REQUEST") &&
          (planned.prompt.instructions ?? "").indexOf("CURRENT FOUNDER REQUEST") <
            (planned.prompt.instructions ?? "").indexOf("RELEVANT FOUNDER MEMORY") &&
          (planned.prompt.instructions ?? "").includes(sel?.prompt_block?.slice(0, 40) ?? "___none___"),
        "MEMORY_BLOCK_IN_PROVIDER_PROMPT",
        "prompt order / block",
      ),
    );

    const plannerSrc = readFileSync(
      join(REPO, "SOS/SAIOS/core/founder-revision/RevisionPlanner.ts"),
      "utf8",
    );
    checks.push(
      assert(
        plannerSrc.includes("repoRoot = input.repoRoot ?? REPO") &&
          plannerSrc.includes("repoRoot,"),
        "PLANNER_DEFAULTS_REPOROOT",
        "live signature cannot omit enrichment",
      ),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }

  const failed = checks.filter((c) => !c.pass);
  const report = {
    schema_version: "phase-6e-live-path-memory-1.0.0",
    generated_at: new Date().toISOString(),
    REVISION_LIVE_PATH_MEMORY_CONTEXT: failed.length === 0 ? "PASS" : "FAIL",
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
  console.log(`PHASE 6E LIVE-PATH MEMORY PASS ${checks.length}/${checks.length}`);
}

void main();
