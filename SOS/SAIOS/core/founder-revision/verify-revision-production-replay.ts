/**
 * Production-artifact replay for Resume Template revision completion.
 *
 * Uses sanitized immutable fixtures under .cursor/debug-fixtures/
 * (copied from production evidence — originals are never mutated).
 *
 * No OpenAI. No production task mutation. No Founder decisions.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import type { FabricCanvasDoc } from "./CanvasInventory.js";
import { executeCanvasOperations } from "./CanvasOperationExecutor.js";
import { buildFeedbackCoverage } from "./FeedbackCoverage.js";
import { buildPlanWithDeterministicSpacingOwnership } from "./DeterministicSpacingPlan.js";
import {
  evaluateFounderSpacingIntentsResolved,
  measureResolvedPairGap,
  resolveFounderSpacingRelation,
} from "./FounderSpacingRelation.js";
import { findVisualContentTextOverlaps } from "./FounderSpacingIntent.js";
import { findTextOverlapFindings } from "./RevisionAcceptanceChecks.js";
import type { RevisionPlan } from "./revision-task-types.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const FIX = join(
  REPO,
  ".cursor/debug-fixtures/revtask-349d7980-578-sanitized",
);
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/founder-revision/verify-revision-production-replay.json",
);

type Check = { name: string; pass: boolean; detail: string };
function assert(cond: boolean, name: string, detail: string): Check {
  return { name, pass: !!cond, detail };
}

function main(): void {
  const checks: Check[] = [];
  if (!existsSync(join(FIX, "meta.json")) || !existsSync(join(FIX, "canvas.json"))) {
    const report = {
      schema_version: "revision-production-replay-1.0.0",
      generated_at: new Date().toISOString(),
      pass: false,
      checks: [
        assert(false, "fixture_present", `missing sanitized fixture at ${FIX}`),
      ],
      publication_allowed: false,
      live: false,
    };
    mkdirSync(join(OUT, ".."), { recursive: true });
    writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
    console.error(JSON.stringify(report, null, 2));
    process.exit(1);
  }

  const meta = JSON.parse(readFileSync(join(FIX, "meta.json"), "utf8")) as {
    requested_changes: string[];
    ai_plan: RevisionPlan;
    source_task_id: string;
    oa_successful_replay?: {
      requested_changes: string[];
      ai_plan: RevisionPlan;
      prior_canvas_file: string;
      source_task_id: string;
    };
  };
  const canvas = JSON.parse(
    readFileSync(join(FIX, "canvas.json"), "utf8"),
  ) as FabricCanvasDoc;
  const changes = meta.requested_changes;
  const primary = changes[0]!;

  checks.push(
    assert(
      primary.includes("Coordinated brand refresh") &&
        primary.includes("Conducted quarterly market analysis") &&
        primary.includes("Nexera"),
      "REAL_TWO_ENDPOINT_FOUNDER_WORDING_INCLUDED",
      primary.slice(0, 200),
    ),
  );

  const resolved = resolveFounderSpacingRelation({
    requestedChange: primary,
    canvas,
  });
  checks.push(
    assert(
      resolved.kind === "NAMED_PAIR" &&
        resolved.upper_id === "block-experience-2-t12" &&
        resolved.lower_id === "block-experience-2-t13",
      "MM_two_endpoints_NAMED_PAIR",
      JSON.stringify(resolved),
    ),
  );
  checks.push(
    assert(
      (resolved.group_key ?? "").includes("entry"),
      "MM_same_entry_group",
      resolved.group_key,
    ),
  );
  checks.push(
    assert(
      resolved.before_gap > 10,
      "MM_before_gap_material",
      `before_gap=${resolved.before_gap}`,
    ),
  );

  // Unsafe 595-style AI must still be rejected / replaced.
  const unsafeAi: RevisionPlan = {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "unsafe overshoot",
    operations: [
      {
        op: "set_position",
        target_id: "block-experience-2-t13",
        before_summary: "final bullet",
        intended_change: "move up too far",
        values: { top: 595 },
        founder_feedback_item: primary,
        confidence: 0.98,
      },
    ],
    notes: [],
  };
  const unsafeOwned = buildPlanWithDeterministicSpacingOwnership({
    priorCanvas: canvas,
    requested_changes: changes,
    aiPlan: unsafeAi,
  });
  const keptUnsafe =
    unsafeOwned.plan?.operations.some(
      (o) =>
        o.op === "set_position" &&
        o.target_id === "block-experience-2-t13" &&
        Number(o.values?.top) === 595,
    ) === true;
  checks.push(
    assert(
      keptUnsafe === false &&
        (unsafeOwned.ok === true || unsafeOwned.fail_closed === true),
      "MM_unsafe_595_rejected",
      `ok=${unsafeOwned.ok} mode=${unsafeOwned.ownership_mode} kept=${keptUnsafe} err=${unsafeOwned.error}`,
    ),
  );

  // Production AI top≈599 must not false-fail on semantic ambiguity.
  const liveAi = meta.ai_plan;
  const owned = buildPlanWithDeterministicSpacingOwnership({
    priorCanvas: canvas,
    requested_changes: changes,
    aiPlan: liveAi,
  });
  checks.push(
    assert(
      owned.ok === true && owned.fail_closed !== true && owned.plan != null,
      "MM_safe_AI_599_survives_ownership",
      `ok=${owned.ok} mode=${owned.ownership_mode} fail_closed=${owned.fail_closed} err=${owned.error} relations=${JSON.stringify(owned.resolved_relations?.[0] ?? null)}`,
    ),
  );
  checks.push(
    assert(
      owned.named_pair_only === true,
      "MM_named_pair_only_packet",
      `named_pair_only=${owned.named_pair_only}`,
    ),
  );
  checks.push(
    assert(
      (owned.resolved_relations ?? []).some(
        (r) =>
          r.kind === "NAMED_PAIR" &&
          r.upper_id === "block-experience-2-t12" &&
          r.lower_id === "block-experience-2-t13",
      ),
      "MM_canonical_relation_on_ownership_result",
      JSON.stringify(owned.resolved_relations),
    ),
  );

  const after = executeCanvasOperations({
    canvas,
    operations: owned.plan?.operations ?? [],
  });
  checks.push(
    assert(after.ok === true, "MM_execute_ok", after.error ?? "ok"),
  );

  const afterGap =
    measureResolvedPairGap(
      after.canvas,
      "block-experience-2-t12",
      "block-experience-2-t13",
    ) ?? resolved.before_gap;
  checks.push(
    assert(
      afterGap < resolved.before_gap - 2 && afterGap >= 2,
      "MM_final_gap_improved_and_safe",
      `before=${resolved.before_gap} after=${afterGap}`,
    ),
  );
  checks.push(
    assert(
      findTextOverlapFindings(after.canvas).length === 0 &&
        findVisualContentTextOverlaps(after.canvas).length === 0,
      "MM_no_overlap",
      `policy=${findTextOverlapFindings(after.canvas).length} visual=${findVisualContentTextOverlaps(after.canvas).length}`,
    ),
  );

  const intents = evaluateFounderSpacingIntentsResolved({
    requested_changes: [primary],
    beforeCanvas: canvas,
    afterCanvas: after.canvas,
    resolved_relations: owned.resolved_relations,
  });
  checks.push(
    assert(
      intents.all_satisfied === true && intents.intents[0]?.satisfied === true,
      "MM_relation_intent_satisfied",
      JSON.stringify(intents.intents[0] ?? null),
    ),
  );

  const cov = buildFeedbackCoverage({
    requested_changes: changes,
    plan: owned.plan!,
    log: after.log,
    beforeCanvas: canvas,
    afterCanvas: after.canvas,
  });
  const primaryCov = cov.items.find(
    (i) => i.founder_feedback_item === primary,
  );
  checks.push(
    assert(
      primaryCov?.status === "addressed" &&
        String(primaryCov.evidence.notes ?? "").includes("spacing intent"),
      "MM_relation_specific_coverage",
      JSON.stringify(primaryCov ?? cov.items[0] ?? null).slice(0, 600),
    ),
  );

  // --- Successful OA production replay (must not regress) ---
  const oa = meta.oa_successful_replay;
  if (oa && existsSync(join(FIX, oa.prior_canvas_file))) {
    const oaCanvas = JSON.parse(
      readFileSync(join(FIX, oa.prior_canvas_file), "utf8"),
    ) as FabricCanvasDoc;
    const oaOwned = buildPlanWithDeterministicSpacingOwnership({
      priorCanvas: oaCanvas,
      requested_changes: oa.requested_changes,
      aiPlan: oa.ai_plan,
    });
    checks.push(
      assert(
        oaOwned.ok === true && oaOwned.plan != null,
        "OA_successful_replay_ownership_ok",
        `ok=${oaOwned.ok} mode=${oaOwned.ownership_mode} err=${oaOwned.error}`,
      ),
    );
    const oaExec = executeCanvasOperations({
      canvas: oaCanvas,
      operations: oaOwned.plan?.operations ?? [],
    });
    checks.push(
      assert(
        oaExec.ok === true &&
          findTextOverlapFindings(oaExec.canvas).length === 0,
        "OA_successful_replay_execute_safe",
        `ok=${oaExec.ok} overlaps=${findTextOverlapFindings(oaExec.canvas).length}`,
      ),
    );
  } else {
    checks.push(
      assert(false, "OA_successful_replay_fixture_present", "missing OA fixture"),
    );
  }

  // Ownership negatives on MM canvas
  const worseAi: RevisionPlan = {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "worse",
    operations: [
      {
        op: "set_position",
        target_id: "block-experience-2-t13",
        intended_change: "move down",
        values: { top: 640 },
        founder_feedback_item: primary,
        confidence: 1,
      },
    ],
    notes: [],
  };
  const worseOwned = buildPlanWithDeterministicSpacingOwnership({
    priorCanvas: canvas,
    requested_changes: [primary],
    aiPlan: worseAi,
  });
  const keptWorse =
    worseOwned.plan?.operations.some(
      (o) =>
        o.op === "set_position" &&
        o.target_id === "block-experience-2-t13" &&
        Number(o.values?.top) === 640,
    ) === true;
  checks.push(
    assert(
      keptWorse === false,
      "ownership_rejects_worse_gap",
      `ok=${worseOwned.ok} mode=${worseOwned.ownership_mode} kept=${keptWorse}`,
    ),
  );

  const unchangedAi: RevisionPlan = {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "noop",
    operations: [
      {
        op: "set_position",
        target_id: "block-experience-2-t13",
        intended_change: "identity",
        values: { top: 615.333 },
        founder_feedback_item: primary,
        confidence: 1,
      },
    ],
    notes: [],
  };
  const unchangedOwned = buildPlanWithDeterministicSpacingOwnership({
    priorCanvas: canvas,
    requested_changes: [primary],
    aiPlan: unchangedAi,
  });
  // Either det repair replaces it, or fail_closed — must not keep identity as "success" without improvement unless det repaired.
  const identityKeptAlone =
    unchangedOwned.ok === true &&
    unchangedOwned.plan?.operations.length === 1 &&
    unchangedOwned.plan.operations[0]?.op === "set_position" &&
    Math.abs(Number(unchangedOwned.plan.operations[0]?.values?.top) - 615.333) <
      0.2;
  checks.push(
    assert(
      identityKeptAlone === false,
      "ownership_rejects_unchanged_gap_without_repair",
      `ok=${unchangedOwned.ok} mode=${unchangedOwned.ownership_mode} ops=${unchangedOwned.plan?.operations.length}`,
    ),
  );

  const failed = checks.filter((c) => !c.pass);
  const report = {
    schema_version: "revision-production-replay-1.0.0",
    generated_at: new Date().toISOString(),
    pass: failed.length === 0,
    SANITIZED_MM_PRODUCTION_REPLAY: failed.some((c) =>
      c.name.startsWith("MM_"),
    )
      ? "FAIL"
      : "PASS",
    REAL_TWO_ENDPOINT_FOUNDER_WORDING_INCLUDED: checks.find(
      (c) => c.name === "REAL_TWO_ENDPOINT_FOUNDER_WORDING_INCLUDED",
    )?.pass
      ? "YES"
      : "NO",
    SUCCESSFUL_REVISION_REPLAY: checks.find((c) =>
      c.name.startsWith("OA_successful_replay_ownership"),
    )?.pass
      ? "PASS"
      : "FAIL",
    checks,
    publication_allowed: false,
    live: false,
    source_task_id: meta.source_task_id,
    fixture_dir: FIX,
  };
  mkdirSync(join(OUT, ".."), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
  if (failed.length) {
    console.error(JSON.stringify(report, null, 2));
    process.exit(1);
  }
  console.log(
    `REVISION PRODUCTION REPLAY PASS ${checks.length}/${checks.length}`,
  );
}

main();
