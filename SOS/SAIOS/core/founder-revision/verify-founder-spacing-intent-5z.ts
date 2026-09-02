/**
 * Phase 5Z — Founder spacing intent preservation + coverage truth verifier.
 * No OpenAI. No production mutation. Never retries historical tasks.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { FabricCanvasDoc } from "./CanvasInventory.js";
import { buildCanvasInventory } from "./CanvasInventory.js";
import { executeCanvasOperations } from "./CanvasOperationExecutor.js";
import { buildFeedbackCoverage } from "./FeedbackCoverage.js";
import { buildPlanWithDeterministicSpacingOwnership } from "./DeterministicSpacingPlan.js";
import {
  detectSpacingIntentDirection,
  evaluateFounderSpacingIntents,
  isFounderMeasurableSpacingIntent,
  measureDominantVisualGap,
  measureSectionVisualContentGaps,
} from "./FounderSpacingIntent.js";
import { findTextOverlapFindings } from "./RevisionAcceptanceChecks.js";
import {
  effectiveTextHeightScaled,
  visualTextContentHeightScaled,
} from "./TextEffectiveHeight.js";
import type { RevisionPlan } from "./revision-task-types.js";
import { validatePlanVerticalDirections } from "./PositionOpCanonicalization.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, "../../..");
const OUT = join(
  REPO,
  "07_LOGS/saios/founder-revision/verify-founder-spacing-intent-5z.json",
);

type Check = { name: string; pass: boolean; detail: string };
function assert(cond: boolean, name: string, detail: string): Check {
  return { name, pass: !!cond, detail };
}

function pageBg() {
  return {
    type: "rect",
    id: "page-bg",
    left: 0,
    top: 0,
    width: 794,
    height: 1123,
    fill: "#ffffff",
    data: { system: true, kind: "page-bg", role: "pageBackground" },
  };
}

function skillsOversizedCanvas(): FabricCanvasDoc {
  return {
    version: "5.3.0",
    width: 794,
    height: 1123,
    objects: [
      pageBg(),
      {
        type: "textbox",
        id: "block-skills-4-t1",
        left: 48,
        top: 154,
        width: 208,
        height: 14,
        fontSize: 11,
        lineHeight: 1.2,
        text: "SKILLS",
        data: { section: "skills", role: "heading" },
      },
      {
        type: "textbox",
        id: "block-skills-4-t2",
        left: 48,
        top: 173,
        width: 220,
        height: 92,
        fontSize: 10.5,
        lineHeight: 1.45,
        text: "Demand Generation  ·  Brand Strategy  ·  ABM  ·  SEO / Content  ·  Marketing Analytics  ·  Sales Enablement",
        data: { section: "skills", role: "body" },
      },
      {
        type: "textbox",
        id: "block-skills-4-t3",
        left: 48,
        top: 271,
        width: 220,
        height: 46,
        fontSize: 10.5,
        lineHeight: 1.45,
        text: "Tools  ·  Documentation  ·  Stakeholder Comms  ·  Process Design",
        data: { section: "skills", role: "body" },
      },
      {
        type: "textbox",
        id: "block-summary-1-t1",
        left: 284,
        top: 154,
        width: 200,
        height: 14,
        fontSize: 11,
        text: "SUMMARY",
        data: { section: "summary", role: "heading" },
      },
    ],
  };
}

function experienceSparseCanvas(): FabricCanvasDoc {
  const bullets = [
    "• Owned multi-channel campaigns that grew qualified pipeline 34% YoY.",
    "• Built messaging frameworks adopted by a 40-person sales org.",
    "• Launched two category narratives with Product and CS teams.",
  ];
  const objs: Record<string, unknown>[] = [
    pageBg(),
    {
      type: "textbox",
      id: "block-experience-2-t1",
      left: 284,
      top: 280,
      width: 200,
      height: 14,
      fontSize: 11,
      text: "EXPERIENCE",
      data: { section: "experience", role: "heading" },
    },
  ];
  let top = 300;
  bullets.forEach((text, i) => {
    objs.push({
      type: "textbox",
      id: `block-experience-2-t${i + 4}`,
      left: 284,
      top,
      width: 460,
      height: 46,
      fontSize: 10.5,
      lineHeight: 1.45,
      text,
      data: { section: "experience", role: "body" },
    });
    top += 50;
  });
  return { version: "5.3.0", width: 794, height: 1123, objects: objs };
}

const SKILLS_FB = [
  "Reduce the excessive internal vertical gap inside the SKILLS section so all skill lines read as one coherent block with consistent line spacing.",
  "Keep the SKILLS content in the same section and same order, but rebalance the text positions so the lower skills lines are not visually detached from the upper group.",
  "Do not add new sections or invent extra content; solve this by correcting spacing, alignment, and section rhythm only.",
];

const EXP_FB = [
  "Tighten the vertical spacing between EXPERIENCE bullet points and between experience role blocks to create a more consistent and compact reading rhythm.",
  "Do not add new sections or invent extra content; solve this by correcting spacing, alignment, and section rhythm only.",
];

function main(): void {
  const checks: Check[] = [];

  // --- Measurement truth ---
  const skills = skillsOversizedCanvas();
  const t2 = (skills.objects ?? []).find((o) => o.id === "block-skills-4-t2")!;
  const visualH = visualTextContentHeightScaled(t2);
  const policyH = effectiveTextHeightScaled(t2);
  const dom = measureDominantVisualGap(skills, "skills");
  checks.push(
    assert(
      visualH < 50 && policyH >= 90 && (dom?.gap ?? 0) > 45,
      "canonical_visual_gap_detects_oversized_box",
      `visualH=${visualH} policyH=${policyH} gap=${dom?.gap}`,
    ),
  );
  checks.push(
    assert(
      detectSpacingIntentDirection(SKILLS_FB[0]!) === "REDUCE_GAP",
      "skills_intent_reduce",
      detectSpacingIntentDirection(SKILLS_FB[0]!),
    ),
  );
  checks.push(
    assert(
      detectSpacingIntentDirection(EXP_FB[0]!) === "TIGHTEN_RHYTHM",
      "experience_intent_tighten",
      detectSpacingIntentDirection(EXP_FB[0]!),
    ),
  );

  // --- Ownership: AI compacting vs weak det cascade ---
  const aiPlan: RevisionPlan = {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "AI compact skills",
    operations: [
      {
        op: "set_position",
        target_id: "block-skills-4-t3",
        intended_change: "close skills gap",
        values: { top: 230 },
        founder_feedback_item: SKILLS_FB[0]!,
        confidence: 0.9,
      },
    ],
    notes: [],
  };
  const weakDetSimulate: RevisionPlan = {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "uniform +3",
    operations: ["t2", "t3"].map((suf, i) => ({
      op: "set_position" as const,
      target_id: `block-skills-4-${suf}`,
      intended_change: "nudge",
      values: { top: (suf === "t2" ? 173 : 271) + 3 },
      founder_feedback_item: SKILLS_FB[0]!,
      confidence: 1,
    })),
    notes: [],
  };
  void weakDetSimulate;

  const owned = buildPlanWithDeterministicSpacingOwnership({
    priorCanvas: skills,
    requested_changes: SKILLS_FB,
    aiPlan,
  });
  checks.push(
    assert(
      owned.ok === true &&
        (owned.ownership_mode === "AI_SPACING_PRESERVED" ||
          owned.ownership_mode === "HYBRID"),
      "ownership_preserves_ai_when_det_weaker",
      `mode=${owned.ownership_mode} err=${owned.error}`,
    ),
  );
  checks.push(
    assert(
      (owned.replaced_ai_position_ops ?? 1) === 0,
      "ai_position_not_replaced",
      String(owned.replaced_ai_position_ops),
    ),
  );

  const afterOwned = executeCanvasOperations({
    canvas: skills,
    operations: owned.plan!.operations,
  });
  const afterGap = measureDominantVisualGap(afterOwned.canvas, "skills")?.gap ?? 0;
  const beforeGap = dom!.gap;
  checks.push(
    assert(
      afterOwned.ok && afterGap < beforeGap - 2,
      "skills_gap_replay_reduced",
      `before=${beforeGap} after=${afterGap}`,
    ),
  );
  checks.push(
    assert(
      findTextOverlapFindings(afterOwned.canvas).length === 0,
      "skills_gap_no_overlap",
      String(findTextOverlapFindings(afterOwned.canvas).length),
    ),
  );

  const skillsCov = buildFeedbackCoverage({
    requested_changes: SKILLS_FB,
    plan: owned.plan!,
    log: afterOwned.log,
    beforeCanvas: skills,
    afterCanvas: afterOwned.canvas,
  });
  checks.push(
    assert(
      skillsCov.items[0]?.status === "addressed" &&
        (skillsCov.items[0]?.evidence.notes ?? "").includes("spacing intent"),
      "skills_coverage_spacing_proof",
      skillsCov.items[0]?.evidence.notes ?? "",
    ),
  );

  // --- Negative: unchanged gap cannot pass coverage ---
  const unchanged = executeCanvasOperations({
    canvas: skills,
    operations: [
      {
        op: "set_position",
        target_id: "block-skills-4-t2",
        intended_change: "uniform",
        values: { top: 176 },
        founder_feedback_item: SKILLS_FB[0]!,
        confidence: 1,
      },
      {
        op: "set_position",
        target_id: "block-skills-4-t3",
        intended_change: "uniform",
        values: { top: 274 },
        founder_feedback_item: SKILLS_FB[0]!,
        confidence: 1,
      },
    ],
  });
  const unchangedPlan: RevisionPlan = {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "uniform",
    operations: unchanged.log.map((e, i) => ({
      op: "set_position" as const,
      target_id: String(e.target_id),
      intended_change: "uniform",
      values: { top: Number((e.after as any)?.top) },
      founder_feedback_item: SKILLS_FB[0]!,
      confidence: 1,
    })),
    notes: [],
  };
  const failCov = buildFeedbackCoverage({
    requested_changes: [SKILLS_FB[0]!],
    plan: unchangedPlan,
    log: unchanged.log,
    beforeCanvas: skills,
    afterCanvas: unchanged.canvas,
  });
  checks.push(
    assert(
      failCov.items[0]?.status !== "addressed",
      "unchanged_gap_false_pass_blocked",
      failCov.items[0]?.status + " " + failCov.items[0]?.evidence.notes,
    ),
  );

  // --- Negative: larger gap when asked tighter ---
  const worse = executeCanvasOperations({
    canvas: skills,
    operations: [
      {
        op: "set_position",
        target_id: "block-skills-4-t3",
        intended_change: "worse",
        values: { top: 320 },
        founder_feedback_item: SKILLS_FB[0]!,
        confidence: 1,
      },
    ],
  });
  const worsePlan: RevisionPlan = {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "worse",
    operations: [
      {
        op: "set_position",
        target_id: "block-skills-4-t3",
        intended_change: "worse",
        values: { top: 320 },
        founder_feedback_item: SKILLS_FB[0]!,
        confidence: 1,
      },
    ],
    notes: [],
  };
  const worseCov = buildFeedbackCoverage({
    requested_changes: [SKILLS_FB[0]!],
    plan: worsePlan,
    log: worse.log,
    beforeCanvas: skills,
    afterCanvas: worse.canvas,
  });
  checks.push(
    assert(
      worseCov.items[0]?.status !== "addressed",
      "larger_gap_fails_coverage",
      worseCov.items[0]?.evidence.notes ?? "",
    ),
  );

  // --- Unsafe AI compaction blocked ---
  const unsafeAi: RevisionPlan = {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "unsafe",
    operations: [
      {
        op: "set_position",
        target_id: "block-skills-4-t3",
        intended_change: "overlap",
        values: { top: 180 },
        founder_feedback_item: SKILLS_FB[0]!,
        confidence: 1,
      },
    ],
    notes: [],
  };
  const unsafeOwned = buildPlanWithDeterministicSpacingOwnership({
    priorCanvas: skills,
    requested_changes: SKILLS_FB,
    aiPlan: unsafeAi,
  });
  // Either fail_closed, or chooses a safe plan that does not keep overlapping AI top.
  const unsafeKept =
    unsafeOwned.plan?.operations.some(
      (o) =>
        o.op === "set_position" &&
        "target_id" in o &&
        o.target_id === "block-skills-4-t3" &&
        Number((o as any).values?.top) === 180,
    ) === true;
  checks.push(
    assert(
      unsafeOwned.fail_closed === true || unsafeKept === false,
      "unsafe_ai_compaction_blocked",
      `fail_closed=${unsafeOwned.fail_closed} kept=${unsafeKept} mode=${unsafeOwned.ownership_mode}`,
    ),
  );

  // --- Experience tighten replay ---
  const exp = experienceSparseCanvas();
  const beforeExpGaps = measureSectionVisualContentGaps(exp, "experience").map(
    (g) => g.gap,
  );
  const expAi: RevisionPlan = {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "tighten exp",
    operations: [
      {
        op: "set_position",
        target_id: "block-experience-2-t5",
        intended_change: "tighten",
        values: { top: 336 },
        founder_feedback_item: EXP_FB[0]!,
        confidence: 0.9,
      },
      {
        op: "set_position",
        target_id: "block-experience-2-t6",
        intended_change: "tighten",
        values: { top: 372 },
        founder_feedback_item: EXP_FB[0]!,
        confidence: 0.9,
      },
    ],
    notes: [],
  };
  const expOwned = buildPlanWithDeterministicSpacingOwnership({
    priorCanvas: exp,
    requested_changes: EXP_FB,
    aiPlan: expAi,
  });
  checks.push(
    assert(
      expOwned.ok === true,
      "experience_ownership_ok",
      `${expOwned.ownership_mode} ${expOwned.error}`,
    ),
  );
  const expAfter = executeCanvasOperations({
    canvas: exp,
    operations: expOwned.plan!.operations,
  });
  const afterExpGaps = measureSectionVisualContentGaps(
    expAfter.canvas,
    "experience",
  ).map((g) => g.gap);
  const beforeMed =
    beforeExpGaps.reduce((a, b) => a + b, 0) / Math.max(1, beforeExpGaps.length);
  const afterMed =
    afterExpGaps.reduce((a, b) => a + b, 0) / Math.max(1, afterExpGaps.length);
  checks.push(
    assert(
      expAfter.ok && afterMed < beforeMed - 1,
      "experience_gap_replay_tightened",
      `beforeMed=${beforeMed} afterMed=${afterMed} gaps=${JSON.stringify(afterExpGaps)}`,
    ),
  );
  const expCov = buildFeedbackCoverage({
    requested_changes: EXP_FB,
    plan: expOwned.plan!,
    log: expAfter.log,
    beforeCanvas: exp,
    afterCanvas: expAfter.canvas,
  });
  checks.push(
    assert(
      expCov.items[0]?.status === "addressed",
      "experience_coverage_pass",
      expCov.items[0]?.evidence.notes ?? "",
    ),
  );

  // --- Direction still pass for preserved AI ---
  const dir = validatePlanVerticalDirections({
    plan: owned.plan!,
    inventory: buildCanvasInventory(skills),
    requested_changes: SKILLS_FB,
  });
  checks.push(assert(dir.ok, "direction_still_pass", dir.errors.join("; ")));

  // --- Unrelated section movement cannot satisfy ---
  const unrelatedPlan: RevisionPlan = {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "unrelated",
    operations: [
      {
        op: "set_position",
        target_id: "block-summary-1-t1",
        intended_change: "move summary",
        values: { top: 200 },
        founder_feedback_item: SKILLS_FB[0]!,
        confidence: 1,
      },
    ],
    notes: [],
  };
  const unrelatedExec = executeCanvasOperations({
    canvas: skills,
    operations: unrelatedPlan.operations,
  });
  const unrelatedCov = buildFeedbackCoverage({
    requested_changes: [SKILLS_FB[0]!],
    plan: unrelatedPlan,
    log: unrelatedExec.log,
    beforeCanvas: skills,
    afterCanvas: unrelatedExec.canvas,
  });
  checks.push(
    assert(
      unrelatedCov.items[0]?.status !== "addressed",
      "unrelated_section_cannot_satisfy",
      unrelatedCov.items[0]?.evidence.notes ?? "",
    ),
  );

  checks.push(
    assert(
      isFounderMeasurableSpacingIntent(SKILLS_FB[0]!) === true,
      "measurable_spacing_flag",
      "ok",
    ),
  );

  const intentsFinal = evaluateFounderSpacingIntents({
    requested_changes: SKILLS_FB,
    beforeCanvas: skills,
    afterCanvas: afterOwned.canvas,
  });
  checks.push(
    assert(
      intentsFinal.all_satisfied,
      "final_post_exec_spacing_intents",
      JSON.stringify(intentsFinal.intents.map((i) => i.notes)),
    ),
  );

  const failed = checks.filter((c) => !c.pass);
  const report = {
    schema_version: "verify-founder-spacing-intent-5z-1.0.0",
    ok: failed.length === 0,
    checks,
    failed: failed.map((c) => c.name),
    historical_tasks_retried: false,
    openai_called: false,
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(report, null, 2));
  if (!report.ok) {
    console.error("FAIL verify-founder-spacing-intent-5z", failed);
    process.exit(1);
  }
  console.log("PASS verify-founder-spacing-intent-5z", {
    checks: checks.length,
  });
}

main();
