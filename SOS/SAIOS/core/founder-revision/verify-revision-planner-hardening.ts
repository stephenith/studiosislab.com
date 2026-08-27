/**
 * Offline verify: Phase 4C revision-planner hardening.
 * Replays Task1 empty values:{} and Task2 spacing/direction failure shapes.
 * No OpenAI. No production task mutation.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  buildCanvasInventory,
  type FabricCanvasDoc,
} from "./CanvasInventory.js";
import {
  buildPlanWithDeterministicSpacingOwnership,
  isDeterministicLayoutNormalizerOwnedChange,
  isVerticalSpacingRhythmHeavyFeedback,
} from "./DeterministicSpacingPlan.js";
import { validatePlanGeometrySafety } from "./PlanGeometrySafety.js";
import {
  parseExplicitMoveDirections,
  stripNonExecutablePositionOpsFromRaw,
  validatePlanVerticalDirections,
} from "./PositionOpCanonicalization.js";
import { prepareExtractedPlanForValidation } from "./RevisionPlanner.js";
import {
  allRequestedChangesAllowEmptyPlan,
  buildRevisionPlannerPrompt,
  isPlanCoverageExemptRequestedChange,
  validateExecutableMutationValues,
  validateRevisionPlan,
} from "./RevisionPromptBuilder.js";
import type { RevisionPlan, RevisionTask } from "./revision-task-types.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/founder-revision/verify-revision-planner-hardening.json",
);

type Check = { name: string; pass: boolean; detail: string };

function assert(cond: boolean, name: string, detail: string): Check {
  return { name, pass: cond, detail };
}

function pageCanvas(extra: Record<string, unknown>[]): FabricCanvasDoc {
  return {
    version: "5.3.0",
    width: 794,
    height: 1123,
    objects: [
      {
        type: "rect",
        id: "page-root",
        left: 0,
        top: 0,
        width: 794,
        height: 1123,
        fill: "#ffffff",
        data: { role: "pageBackground", system: true, kind: "page-bg" },
      },
      ...extra,
    ],
  };
}

function textbox(
  id: string,
  opts: {
    left: number;
    top: number;
    width: number;
    height: number;
    text: string;
    section: string;
    role?: string;
  },
): Record<string, unknown> {
  return {
    type: "textbox",
    id,
    left: opts.left,
    top: opts.top,
    width: opts.width,
    height: opts.height,
    text: opts.text,
    fontSize: 11,
    lineHeight: 1.35,
    fill: "#111",
    data: {
      id,
      section: opts.section,
      role: opts.role ?? "body",
    },
  };
}

function baseOpFields(fb: string) {
  return {
    before_summary: "fixture object state",
    intended_change: "fixture mutation",
    founder_feedback_item: fb,
    confidence: 0.9,
  };
}

function main(): void {
  const checks: Check[] = [];

  const dummyTask: RevisionTask = {
    schema_version: "founder-revision-task-1.0.0",
    task_id: "revtask-hardening-fixture",
    decision_id: "fd-hardening",
    review_id: "founder-review-hardening",
    prior_candidate_id: "cand-hardening",
    prior_canvas_path: "fixture",
    founder_reason: "fixture",
    requested_changes: [
      "Align the SKILLS heading and SUMMARY heading to the exact same vertical starting baseline.",
      "Normalize vertical spacing between consecutive sections so the whole page follows one consistent section-to-section rhythm.",
      "Adjust the Languages section upward so the bottom margin is not too tight.",
    ],
    role: "Fixture",
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
  const inv = buildCanvasInventory(
    pageCanvas([
      textbox("block-skills-4-t1", {
        left: 60,
        top: 145,
        width: 200,
        height: 14,
        text: "SKILLS",
        section: "skills",
        role: "heading",
      }),
      textbox("block-summary-1-t1", {
        left: 296,
        top: 165,
        width: 400,
        height: 14,
        text: "SUMMARY",
        section: "summary",
        role: "heading",
      }),
    ]),
  );
  const prompt = buildRevisionPlannerPrompt({
    task: dummyTask,
    inventory: inv,
    page_width: 794,
    page_height: 1123,
    preview_width: 794,
    preview_height: 1123,
  });
  checks.push(
    assert(
      prompt.instructions.includes(
        "INVALID (schema-rejected — empty values on position op)",
      ) &&
        prompt.instructions.includes(
          "NEVER copy values:{} onto set_position or move_object",
        ),
      "prompt_forbids_empty_set_position_values",
      "empty set_position INVALID example present",
    ),
  );
  checks.push(
    assert(
      prompt.instructions.includes("DETERMINISTIC_LAYOUT_OWNED") ||
        prompt.instructions.includes("Prefer ZERO hand-placed absolute"),
      "prompt_mentions_deterministic_layout_ownership",
      "spacing ownership guidance present",
    ),
  );
  checks.push(
    assert(
      prompt.instructions.includes("move a section upward") &&
        prompt.instructions.includes("downward"),
      "prompt_binds_explicit_vertical_direction",
      "directional binding present",
    ),
  );

  const fbAlign =
    "Align the SKILLS heading and SUMMARY heading to the exact same vertical starting baseline.";
  const fbPreserve =
    "Preserve the existing two-column structure and column widths while correcting the vertical alignment and spacing.";
  const task1Raw = {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "task1-shaped identity placeholders",
    operations: [
      {
        op: "set_position",
        target_id: "block-skills-4-t1",
        values: { top: 165 },
        ...baseOpFields(fbAlign),
        intended_change: "Move SKILLS heading to top=165",
      },
      {
        op: "set_position",
        target_id: "block-summary-1-t1",
        values: {},
        ...baseOpFields(fbAlign),
        intended_change:
          "Ensure SUMMARY heading top remains at 165 for vertical alignment with SKILLS heading",
      },
      {
        op: "set_position",
        target_id: "block-summary-1-r0",
        values: {},
        ...baseOpFields(fbPreserve),
        intended_change: "Ensure SUMMARY marker stays put (identity)",
      },
    ],
  };

  const emptyErr = validateExecutableMutationValues("set_position", 2, {});
  checks.push(
    assert(
      typeof emptyErr === "string" &&
        emptyErr.includes("executable position field"),
      "validator_still_rejects_empty_values_in_isolation",
      emptyErr ?? "null",
    ),
  );

  const stripped = stripNonExecutablePositionOpsFromRaw(task1Raw);
  checks.push(
    assert(
      stripped.stripped_count === 2 &&
        Array.isArray((stripped.raw as { operations: unknown[] }).operations) &&
        (stripped.raw as { operations: unknown[] }).operations.length === 1,
      "task1_strip_removes_empty_position_ops",
      `stripped=${stripped.stripped_count}`,
    ),
  );

  const task1Prepared = prepareExtractedPlanForValidation({
    extracted: task1Raw,
    inventory: inv,
    requested_changes: [fbAlign, fbPreserve],
  });
  checks.push(
    assert(
      task1Prepared.ok === true &&
        (task1Prepared.plan?.operations.length ?? 0) === 1,
      "task1_prepare_yields_valid_plan_without_invented_coords",
      task1Prepared.ok
        ? `ops=${task1Prepared.plan!.operations.length} values=${JSON.stringify(task1Prepared.plan!.operations[0]?.values)}`
        : task1Prepared.errors.join("; "),
    ),
  );
  const onlyOp = task1Prepared.plan?.operations[0];
  checks.push(
    assert(
      onlyOp?.op === "set_position" &&
        onlyOp.target_id === "block-skills-4-t1" &&
        onlyOp.values?.top === 165,
      "task1_surviving_op_is_real_numeric_mutation",
      JSON.stringify(onlyOp?.values ?? null),
    ),
  );

  checks.push(
    assert(
      parseExplicitMoveDirections(
        "Adjust the Languages section upward so the bottom margin is not too tight",
      ).has("up"),
      "parse_upward_from_languages_feedback",
      "up detected",
    ),
  );

  const badDirectionPlan: RevisionPlan = {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "bad direction",
    operations: [
      {
        op: "set_position",
        target_id: "block-languages-6-t2",
        values: { top: 1115 },
        before_summary: "Languages body at top=1107",
        intended_change: "Move Languages section upward",
        founder_feedback_item:
          "Adjust the Languages section upward so the bottom margin is not too tight and the page ends with balanced whitespace.",
        confidence: 0.9,
      },
    ],
  };
  const dirInv = buildCanvasInventory(
    pageCanvas([
      textbox("block-languages-6-t2", {
        left: 48,
        top: 1107,
        width: 698,
        height: 16,
        text: "English, Spanish",
        section: "languages",
      }),
    ]),
  );
  const dirGate = validatePlanVerticalDirections({
    plan: badDirectionPlan,
    inventory: dirInv,
    requested_changes: [
      "Adjust the Languages section upward so the bottom margin is not too tight and the page ends with balanced whitespace.",
    ],
  });
  checks.push(
    assert(
      dirGate.ok === false &&
        dirGate.errors.some(
          (e) => e.includes("upward") && e.includes("downward"),
        ),
      "direction_gate_rejects_downward_when_upward_requested",
      dirGate.errors.join("; "),
    ),
  );

  const task2Changes = [
    "Move the Summary section down so it no longer crowds or overlaps the contact/address row.",
    "Standardize the spacing between each section heading and its first content line, especially in Summary, Education, Skills, Certifications, and Languages.",
    "Make the spacing below the Summary heading match the tighter, cleaner spacing used in the Experience section.",
    "Fix the Education section so its content sits at the same heading-to-content distance used in the best-aligned sections.",
    "Fix the Skills section so the heading does not crowd the Education content and the heading-to-content spacing is consistent.",
    "Reposition the Certifications heading so it is clearly associated with the certification bullets and not visually attached to the Skills content above.",
    "Adjust the Languages section upward so the bottom margin is not too tight and the page ends with balanced whitespace.",
    "Normalize vertical spacing between consecutive sections so the whole page follows one consistent section-to-section rhythm.",
    "Preserve the existing overall design, typography, and color style while correcting spacing and overlap issues only.",
  ];
  checks.push(
    assert(
      isVerticalSpacingRhythmHeavyFeedback(task2Changes),
      "task2_feedback_classified_spacing_heavy",
      `owned=${task2Changes.filter((c) => isDeterministicLayoutNormalizerOwnedChange(c)).length}`,
    ),
  );
  checks.push(
    assert(
      task2Changes.filter((c) => isPlanCoverageExemptRequestedChange(c))
        .length >= 5,
      "task2_most_items_coverage_exempt_or_owned",
      `exempt=${task2Changes.filter((c) => isPlanCoverageExemptRequestedChange(c)).length}`,
    ),
  );

  const LONG =
    "Strategic leadership across operations, analytics, and delivery with measurable outcomes across cross-functional teams and enterprise platforms.";
  const crowdedCanvas = pageCanvas([
    textbox("block-summary-1-t1", {
      left: 58,
      top: 125,
      width: 680,
      height: 14,
      text: "SUMMARY",
      section: "summary",
      role: "heading",
    }),
    textbox("block-summary-1-t2", {
      left: 48,
      top: 140,
      width: 690,
      height: 40,
      text: LONG,
      section: "summary",
      role: "body",
    }),
    textbox("block-education-3-t1", {
      left: 58,
      top: 780,
      width: 680,
      height: 14,
      text: "EDUCATION",
      section: "education",
      role: "heading",
    }),
    textbox("block-education-3-t2", {
      left: 48,
      top: 794,
      width: 690,
      height: 16,
      text: LONG,
      section: "education",
      role: "body",
    }),
    textbox("block-skills-4-t1", {
      left: 58,
      top: 827,
      width: 680,
      height: 14,
      text: "SKILLS",
      section: "skills",
      role: "heading",
    }),
    textbox("block-skills-4-t2", {
      left: 48,
      top: 842,
      width: 690,
      height: 50,
      text: LONG,
      section: "skills",
      role: "body",
    }),
    textbox("block-certifications-5-t1", {
      left: 58,
      top: 980,
      width: 680,
      height: 14,
      text: "CERTIFICATIONS",
      section: "certifications",
      role: "heading",
    }),
    textbox("block-certifications-5-t2", {
      left: 48,
      top: 1000,
      width: 690,
      height: 16,
      text: "PMP · AWS SA",
      section: "certifications",
      role: "body",
    }),
    textbox("block-languages-6-t1", {
      left: 58,
      top: 1080,
      width: 680,
      height: 14,
      text: "LANGUAGES",
      section: "languages",
      role: "heading",
    }),
    textbox("block-languages-6-t2", {
      left: 48,
      top: 1107,
      width: 690,
      height: 16,
      text: "English · Spanish",
      section: "languages",
      role: "body",
    }),
  ]);

  const unsafeAiPlan: RevisionPlan = {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "task2-shaped unsafe AI stack",
    operations: [
      {
        op: "set_position",
        target_id: "block-education-3-t2",
        values: { top: 815 },
        ...baseOpFields(task2Changes[3]!),
        intended_change: "Move education body",
      },
      {
        op: "set_position",
        target_id: "block-skills-4-t1",
        values: { top: 856 },
        ...baseOpFields(task2Changes[4]!),
        intended_change: "Move skills heading",
      },
      {
        op: "set_position",
        target_id: "block-languages-6-t2",
        values: { top: 1115 },
        before_summary: "Languages at 1107",
        intended_change: "Move Languages section upward",
        founder_feedback_item: task2Changes[6]!,
        confidence: 0.9,
      },
    ],
  };

  const unsafeGeo = validatePlanGeometrySafety({
    canvas: crowdedCanvas,
    plan: unsafeAiPlan,
  });
  checks.push(
    assert(
      unsafeGeo.ok === false,
      "task2_unsafe_ai_plan_still_rejected_by_geometry_gate",
      unsafeGeo.error ?? "ok unexpectedly",
    ),
  );

  const det = buildPlanWithDeterministicSpacingOwnership({
    priorCanvas: crowdedCanvas,
    requested_changes: task2Changes,
    aiPlan: unsafeAiPlan,
  });
  checks.push(
    assert(
      det.ok === true && det.plan != null,
      "task2_deterministic_spacing_plan_builds",
      det.error ?? `shifted=${det.shifted_object_count}`,
    ),
  );

  let task2GeoOk = false;
  let proposed: Array<{
    id: string;
    top: number | null;
    effective_bottom: number | null;
  }> = [];
  if (det.ok && det.plan) {
    const langBefore = 1107;
    const langOp = det.plan.operations.find(
      (o) => o.target_id === "block-languages-6-t2",
    );
    const langTop =
      typeof langOp?.values?.top === "number" ? langOp.values.top : null;
    const task2DirOk = langTop == null || langTop <= langBefore + 0.5;
    checks.push(
      assert(
        task2DirOk,
        "task2_languages_not_moved_downward_under_ownership",
        `before=${langBefore} after=${langTop}`,
      ),
    );

    const dirCheck = validatePlanVerticalDirections({
      plan: det.plan,
      inventory: buildCanvasInventory(crowdedCanvas),
      requested_changes: task2Changes,
    });
    checks.push(
      assert(
        dirCheck.ok,
        "task2_deterministic_plan_passes_direction_gate",
        dirCheck.errors.join("; ") || "ok",
      ),
    );

    const geo = validatePlanGeometrySafety({
      canvas: crowdedCanvas,
      plan: det.plan,
    });
    task2GeoOk = geo.ok;
    proposed = geo.proposed_positions.map((p) => ({
      id: p.id,
      top: p.top,
      effective_bottom: p.effective_bottom,
    }));
    checks.push(
      assert(
        geo.ok === true && geo.text_overlaps === 0 && geo.page_oob === 0,
        "task2_deterministic_plan_passes_geometry_gate",
        geo.error ??
          `overlaps=${geo.text_overlaps} oob=${geo.page_oob} shifted=${det.shifted_object_count}`,
      ),
    );

    const reval = validateRevisionPlan(det.plan, {
      requested_changes: task2Changes,
      allowEmptyOperations: allRequestedChangesAllowEmptyPlan(task2Changes),
    });
    checks.push(
      assert(
        reval.ok,
        "task2_deterministic_plan_revalidates",
        reval.errors.join("; ") || "ok",
      ),
    );
  }

  const failed = checks.filter((c) => !c.pass);
  const task1Resolved = checks
    .filter((c) => c.name.startsWith("task1_"))
    .every((c) => c.pass);
  const task2Resolved =
    checks.filter((c) => c.name.startsWith("task2_")).every((c) => c.pass) &&
    task2GeoOk;

  const report = {
    schema_version: "verify-revision-planner-hardening-1.0.0",
    at: new Date().toISOString(),
    ok: failed.length === 0,
    TASK1_CLASS_RESOLVED: task1Resolved,
    TASK2_CLASS_RESOLVED: task2Resolved,
    geometry_proof: {
      task2_geometry_ok: task2GeoOk,
      proposed_positions: proposed,
    },
    checks,
    failed: failed.map((f) => f.name),
  };

  mkdirSync(join(REPO, "SOS/07_LOGS/saios/founder-revision"), {
    recursive: true,
  });
  writeFileSync(OUT, JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
}

main();
