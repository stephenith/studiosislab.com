/**
 * Phase 6E — Precise Founder spacing-relation targeting.
 * No OpenAI. No production mutation. No hard-coded Nexera IDs in production code.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { FabricCanvasDoc } from "./CanvasInventory.js";
import { executeCanvasOperations } from "./CanvasOperationExecutor.js";
import { buildFeedbackCoverage } from "./FeedbackCoverage.js";
import { buildPlanWithDeterministicSpacingOwnership } from "./DeterministicSpacingPlan.js";
import {
  resolveFounderSpacingRelation,
  evaluateFounderSpacingIntentsResolved,
} from "./FounderSpacingRelation.js";
import type { RevisionPlan } from "./revision-task-types.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/founder-revision/verify-precise-spacing-relation-6e.json",
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

function tb(
  id: string,
  top: number,
  text: string,
  height: number,
  extras: Record<string, unknown> = {},
) {
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
    data: { section: "experience", ...(extras.data as object) },
    ...extras,
  };
}

function twoRoleCanvas(): FabricCanvasDoc {
  return {
    version: "5.3.0",
    width: 794,
    height: 1123,
    objects: [
      pageBg(),
      tb("block-experience-2-t1", 269, "EXPERIENCE", 15, {
        data: { section: "experience", role: "heading" },
      }),
      tb("block-experience-2-t2", 291, "Marketing Manager — Vistara Innovations", 16),
      tb("block-experience-2-t3", 309, "March 2020 – Present", 14),
      tb(
        "block-experience-2-t4",
        328,
        "• Led end-to-end management of 15+ marketing campaigns, achieving an average 28% increase in conversion rates and reducing cost-per-acquisition (CPA) by 18%.",
        31,
      ),
      tb(
        "block-experience-2-t5",
        362.333,
        "• Developed segmented email marketing workflows contributing to a 35% uplift in lead engagement and a 22% increase in MQLs.",
        31,
      ),
      tb(
        "block-experience-2-t6",
        396.667,
        "• Collaborated with product and sales teams to refine messaging and positioning, resulting in a 40% boost in qualified pipeline value within 12 months.",
        31,
      ),
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

const NAMED_BEFORE =
  "Reduce the excessive vertical gap before the “Conducted quarterly market analysis supporting strategic adjustments…” bullet so all bullets under Senior Marketing Specialist — Northwind Labs follow a consistent compact vertical rhythm.";

function main(): void {
  const checks: Check[] = [];
  const canvas = twoRoleCanvas();

  const a = resolveFounderSpacingRelation({
    requestedChange: NAMED_BEFORE,
    canvas,
  });
  checks.push(
    assert(
      a.kind === "NAMED_PAIR" &&
        a.upper_id === "block-experience-2-t12" &&
        a.lower_id === "block-experience-2-t13",
      "A_named_target_plus_prior_sibling",
      JSON.stringify(a),
    ),
  );

  const b = resolveFounderSpacingRelation({
    requestedChange:
      "Reduce the excessive vertical gap before the “Conducted quarterly market analysis supporting strategic adjustments…” bullet.",
    canvas,
  });
  checks.push(
    assert(
      b.kind === "NAMED_PAIR" &&
        b.upper_id === "block-experience-2-t12" &&
        b.lower_id === "block-experience-2-t13",
      "B_quoted_bullet_without_section_word",
      JSON.stringify(b),
    ),
  );

  const c = resolveFounderSpacingRelation({
    requestedChange:
      "Reduce the excessive vertical gap before the “Conducted quarterly market analysis…” bullet in the Experience section.",
    canvas,
  });
  checks.push(
    assert(
      c.kind === "NAMED_PAIR" &&
        c.lower_id === "block-experience-2-t13" &&
        c.upper_id === "block-experience-2-t12",
      "C_specific_pair_wins_over_dominant_section",
      JSON.stringify(c),
    ),
  );

  const d = resolveFounderSpacingRelation({
    requestedChange:
      "Tighten the vertical spacing between EXPERIENCE bullet points to create a more consistent and compact reading rhythm.",
    canvas,
  });
  checks.push(
    assert(
      d.kind === "SECTION_RHYTHM" &&
        d.upper_id === "block-experience-2-t7" &&
        d.lower_id === "block-experience-2-t10",
      "D_generic_experience_uses_section_rhythm",
      JSON.stringify(d),
    ),
  );

  const dup = twoRoleCanvas();
  (dup.objects ?? []).push(
    tb(
      "block-experience-2-t99",
      800,
      "• Conducted quarterly market analysis supporting strategic adjustments that led to a 10% increase in customer retention.",
      31,
    ),
  );
  const e = resolveFounderSpacingRelation({
    requestedChange: NAMED_BEFORE,
    canvas: dup,
  });
  checks.push(
    assert(e.kind === "AMBIGUOUS", "E_ambiguous_named_bullet_fail_closed", JSON.stringify(e)),
  );

  const f = resolveFounderSpacingRelation({
    requestedChange:
      "Reduce the excessive vertical gap before the “Supported launch and growth of cross-channel campaigns…” bullet.",
    canvas,
  });
  checks.push(
    assert(
      f.upper_id !== "block-experience-2-t7" &&
        f.lower_id === "block-experience-2-t10" &&
        (f.kind === "NAMED_PAIR" || f.kind === "UNEVALUABLE") &&
        !f.notes.includes("t7"),
      "F_first_bullet_does_not_pair_across_role",
      JSON.stringify(f),
    ),
  );

  const unsafeAi: RevisionPlan = {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "overshoot",
    operations: [
      {
        op: "set_position",
        target_id: "block-experience-2-t13",
        before_summary: "final bullet",
        intended_change: "move up too far",
        values: { top: 595 },
        founder_feedback_item: NAMED_BEFORE,
        confidence: 0.98,
      },
    ],
    notes: [],
  };
  const owned = buildPlanWithDeterministicSpacingOwnership({
    priorCanvas: canvas,
    requested_changes: [NAMED_BEFORE],
    aiPlan: unsafeAi,
  });
  const keptUnsafe =
    owned.plan?.operations.some(
      (o) =>
        o.op === "set_position" &&
        o.target_id === "block-experience-2-t13" &&
        Number(o.values?.top) === 595,
    ) === true;
  checks.push(
    assert(owned.ok === true && keptUnsafe === false, "H_unsafe_ai_rejected", `mode=${owned.ownership_mode} kept=${keptUnsafe} err=${owned.error}`),
  );
  checks.push(
    assert(
      owned.ok === true && (owned.plan?.operations.length ?? 0) > 0,
      "I_deterministic_safe_alternative_used",
      `mode=${owned.ownership_mode} ops=${owned.plan?.operations.length}`,
    ),
  );

  const after = executeCanvasOperations({
    canvas,
    operations: owned.plan?.operations ?? [],
  });
  const afterIntents = evaluateFounderSpacingIntentsResolved({
    requested_changes: [NAMED_BEFORE],
    beforeCanvas: canvas,
    afterCanvas: after.canvas,
  });
  checks.push(
    assert(
      after.ok && afterIntents.all_satisfied && afterIntents.intents[0]?.satisfied === true,
      "G_safe_compaction_pass",
      JSON.stringify(afterIntents.intents[0] ?? null),
    ),
  );

  const cov = buildFeedbackCoverage({
    requested_changes: [NAMED_BEFORE],
    plan: owned.plan!,
    log: after.log,
    beforeCanvas: canvas,
    afterCanvas: after.canvas,
  });
  checks.push(
    assert(
      cov.items[0]?.status === "addressed" &&
        (cov.items[0]?.evidence.notes ?? "").includes("named pair"),
      "RELATION_SPECIFIC_COVERAGE",
      cov.items[0]?.evidence.notes ?? "",
    ),
  );

  const jammed: FabricCanvasDoc = {
    version: "5.3.0",
    width: 794,
    height: 1123,
    objects: [
      pageBg(),
      tb("block-experience-2-t8", 200, "Role — Acme", 16),
      tb("block-experience-2-t12", 220, "• Coordinated brand refresh initiatives driving a 15% lift.", 16),
      tb(
        "block-experience-2-t13",
        236,
        "• Conducted quarterly market analysis supporting strategic adjustments that led to a 10% increase in customer retention.",
        31,
      ),
      tb("block-projects-3-t1", 268, "PROJECTS", 15, {
        data: { section: "projects", role: "heading" },
      }),
    ],
  };
  const jammedOwned = buildPlanWithDeterministicSpacingOwnership({
    priorCanvas: jammed,
    requested_changes: [NAMED_BEFORE],
    aiPlan: {
      schema_version: "founder-canvas-revision-plan-1.0.0",
      summary: "no room",
      operations: [
        {
          op: "set_position",
          target_id: "block-experience-2-t13",
          intended_change: "overlap",
          values: { top: 221 },
          founder_feedback_item: NAMED_BEFORE,
          confidence: 1,
        },
      ],
      notes: [],
    },
  });
  checks.push(
    assert(
      jammedOwned.fail_closed === true || jammedOwned.ok === false,
      "J_no_safe_alternative_fail_closed",
      `ok=${jammedOwned.ok} fail_closed=${jammedOwned.fail_closed} mode=${jammedOwned.ownership_mode}`,
    ),
  );

  const failed = checks.filter((c) => !c.pass);
  const report = {
    schema_version: "phase-6e-precise-spacing-1.0.0",
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
  console.log(`PHASE 6E PRECISE SPACING PASS ${checks.length}/${checks.length}`);
}

main();
