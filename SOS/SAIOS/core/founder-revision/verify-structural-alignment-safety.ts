/**
 * Focused verify: generalized verification classification + inventory-aware
 * align_objects structural/bounds safety.
 * Production failure shape from revtask-5585617a-58a (READ-ONLY fixture).
 * No OpenAI. No production task/evidence mutation.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { executeCanvasOperations } from "./CanvasOperationExecutor.js";
import {
  CANONICAL_COLLISION_BOUNDS_QA,
  CANONICAL_COLLISION_BOUNDS_QA_V2,
  CANONICAL_VISUAL_CONSISTENCY_QA,
  CANONICAL_VISUAL_CONSISTENCY_QA_V2,
  classifyRequestedChange,
} from "./RequestedChangeClassification.js";
import {
  buildRevisionCoverageRepairPrompt,
  buildRevisionPlannerPrompt,
  findUncoveredRequestedChanges,
  validatePlanCoversRequestedChanges,
} from "./RevisionPromptBuilder.js";
import {
  ALIGN_LEFT_OUTSIDE_TARGET_LANE,
  CROSS_LANE_ALIGNMENT_NOT_ALLOWED,
  MIXED_SECTION_UNIT_ALIGNMENT_NOT_ALLOWED,
  validateAlignObjectsSafety,
  validateRevisionPlanAgainstInventory,
} from "./StructuralAlignmentSafety.js";
import { detectLayoutLanesFromCanvas } from "./RevisionLayoutNormalizer.js";
import { listRevisionTasks } from "./RevisionTaskStore.js";
import type { FabricCanvasDoc } from "./CanvasInventory.js";
import type { RevisionPlan, RevisionTask } from "./revision-task-types.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/founder-revision/verify-structural-alignment-safety.json",
);

type Check = { name: string; pass: boolean; detail: string };

function assert(cond: boolean, name: string, detail: string): Check {
  return { name, pass: cond, detail };
}

const PAGE_W = 794;
const PAGE_H = 1123;

function canvasFrom(objects: Record<string, unknown>[]): FabricCanvasDoc {
  return {
    version: "5.3.0",
    width: PAGE_W,
    height: PAGE_H,
    objects,
  } as FabricCanvasDoc;
}

function headerBand(): Record<string, unknown> {
  return {
    type: "rect",
    id: "block-header-0-r0",
    left: 0,
    top: 0,
    width: 794,
    height: 120,
    fill: "#0a2540",
    data: { role: "header-band", section: "header", id: "block-header-0-r0" },
  };
}

function sectionRect(
  id: string,
  left: number,
  top: number,
  width = 460,
): Record<string, unknown> {
  return {
    type: "rect",
    id,
    left,
    top,
    width,
    height: 28,
    fill: "#0a2540",
    data: { role: "section-heading-bg", section: "summary", id },
  };
}

function headerText(
  id: string,
  left: number,
  top: number,
): Record<string, unknown> {
  return {
    type: "textbox",
    id,
    left,
    top,
    width: 200,
    height: 24,
    text: "Jane Doe",
    fontSize: 22,
    data: { role: "header-name", section: "header", id },
  };
}

function alignPlan(
  ids: string[],
  alignLeft: number,
  founderItem = "Align section headings.",
): RevisionPlan {
  return {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "align fixture",
    notes: [],
    operations: [
      {
        op: "align_objects",
        target_ids: ids,
        before_summary: "targets at mixed lefts",
        intended_change: "Align left edges",
        values: { align_left: alignLeft },
        founder_feedback_item: founderItem,
        confidence: 0.9,
      },
    ],
  };
}

/** Minimal two-column body geometry approximating VP Ops Rev2 failure class. */
function twoLaneVpOpsStyleCanvas(): FabricCanvasDoc {
  const heading = (
    id: string,
    section: string,
    left: number,
    top: number,
    text: string,
  ): Record<string, unknown> => ({
    type: "textbox",
    id,
    left,
    top,
    width: 180,
    height: 18,
    text,
    fontSize: 12,
    fontWeight: "bold",
    data: { role: "section-heading", section, id },
  });
  const body = (
    id: string,
    section: string,
    left: number,
    top: number,
  ): Record<string, unknown> => ({
    type: "textbox",
    id,
    left,
    top,
    width: 200,
    height: 40,
    text: `${section} body`,
    fontSize: 10,
    data: { role: "body", section, id },
  });
  const accent = (
    id: string,
    section: string,
    left: number,
    top: number,
  ): Record<string, unknown> => ({
    type: "rect",
    id,
    left,
    top,
    width: 4,
    height: 16,
    fill: "#0a2540",
    data: { role: "section-heading-accent", section, id },
  });
  // lane-0 / sidebar ~60; lane-1 / main ~296
  return canvasFrom([
    headerBand(),
    accent("block-skills-4-r0", "skills", 48, 154),
    heading("block-skills-4-t1", "skills", 60, 154, "SKILLS"),
    body("block-skills-4-t2", "skills", 48, 176),
    accent("block-projects-5-r0", "projects", 48, 280),
    heading("block-projects-5-t1", "projects", 60, 280, "PROJECTS"),
    body("block-projects-5-t2", "projects", 48, 302),
    accent("block-certifications-6-r0", "certifications", 48, 400),
    heading("block-certifications-6-t1", "certifications", 60, 400, "CERTIFICATIONS"),
    body("block-certifications-6-t2", "certifications", 48, 422),
    accent("block-languages-7-r0", "languages", 48, 500),
    heading("block-languages-7-t1", "languages", 60, 500, "LANGUAGES"),
    body("block-languages-7-t2", "languages", 48, 522),
    accent("block-summary-1-r0", "summary", 284, 154),
    heading("block-summary-1-t1", "summary", 296, 154, "SUMMARY"),
    body("block-summary-1-t2", "summary", 284, 176),
    accent("block-experience-2-r0", "experience", 284, 280),
    heading("block-experience-2-t1", "experience", 296, 280, "EXPERIENCE"),
    body("block-experience-2-t2", "experience", 284, 302),
    accent("block-education-3-r0", "education", 284, 500),
    heading("block-education-3-t1", "education", 296, 500, "EDUCATION"),
    body("block-education-3-t2", "education", 284, 522),
  ]);
}

/**
 * Two-column geometry matching the 26 Aug 2026 revtask-1ae261a9-127
 * operations[2] pattern: sidebar content flush to the lane right edge.
 * Fixture-only numbers — not runtime constants.
 */
function productionFlushSidebarCanvas(): FabricCanvasDoc {
  const heading = (
    id: string,
    section: string,
    left: number,
    top: number,
    text: string,
    width: number,
  ): Record<string, unknown> => ({
    type: "textbox",
    id,
    left,
    top,
    width,
    height: 14,
    text,
    fontSize: 12,
    fontWeight: "bold",
    data: { role: "section-heading", section, id },
  });
  const body = (
    id: string,
    section: string,
    left: number,
    top: number,
    width: number,
  ): Record<string, unknown> => ({
    type: "textbox",
    id,
    left,
    top,
    width,
    height: 40,
    text: `${section} body`,
    fontSize: 10,
    data: { role: "body", section, id },
  });
  const marker = (
    id: string,
    section: string,
    left: number,
    top: number,
  ): Record<string, unknown> => ({
    type: "rect",
    id,
    left,
    top,
    width: 4,
    height: 14,
    fill: "#0a2540",
    data: { role: "section-marker", section, id },
  });
  return canvasFrom([
    headerBand(),
    marker("block-skills-4-r0", "skills", 48, 148),
    heading("block-skills-4-t1", "skills", 60, 154, "SKILLS", 208),
    body("block-skills-4-t2", "skills", 48, 176, 220),
    body("block-skills-4-t3", "skills", 48, 264, 220),
    marker("block-projects-5-r0", "projects", 48, 322),
    heading("block-projects-5-t1", "projects", 60, 322, "PROJECTS", 208),
    body("block-projects-5-t2", "projects", 48, 387, 220),
    marker("block-certifications-6-r0", "certifications", 48, 507),
    heading(
      "block-certifications-6-t1",
      "certifications",
      60,
      507,
      "CERTIFICATIONS",
      208,
    ),
    body("block-certifications-6-t2", "certifications", 48, 529, 220),
    marker("block-languages-7-r0", "languages", 48, 594),
    heading("block-languages-7-t1", "languages", 60, 594, "LANGUAGES", 208),
    body("block-languages-7-t2", "languages", 48, 616, 220),
    marker("block-summary-1-r0", "summary", 284, 154),
    heading("block-summary-1-t1", "summary", 296, 154, "SUMMARY", 450),
    body("block-summary-1-t2", "summary", 284, 176, 462),
    marker("block-experience-2-r0", "experience", 284, 280),
    heading("block-experience-2-t1", "experience", 296, 280, "EXPERIENCE", 450),
    body("block-experience-2-t2", "experience", 284, 302, 462),
    marker("block-education-3-r0", "education", 284, 500),
    heading("block-education-3-t1", "education", 296, 500, "EDUCATION", 450),
    body("block-education-3-t2", "education", 284, 522, 462),
  ]);
}

function oneColumnCanvas(): FabricCanvasDoc {
  const heading = (
    id: string,
    section: string,
    top: number,
    text: string,
  ): Record<string, unknown> => ({
    type: "textbox",
    id,
    left: 48,
    top,
    width: 400,
    height: 18,
    text,
    fontSize: 12,
    data: { role: "section-heading", section, id },
  });
  const body = (
    id: string,
    section: string,
    top: number,
  ): Record<string, unknown> => ({
    type: "textbox",
    id,
    left: 48,
    top,
    width: 698,
    height: 40,
    text: `${section} body`,
    fontSize: 10,
    data: { role: "body", section, id },
  });
  return canvasFrom([
    heading("h-summary", "summary", 140, "SUMMARY"),
    body("b-summary", "summary", 162),
    heading("h-experience", "experience", 240, "EXPERIENCE"),
    body("b-experience", "experience", 262),
    heading("h-education", "education", 360, "EDUCATION"),
    body("b-education", "education", 382),
  ]);
}

function main(): void {
  const checks: Check[] = [];
  const beforeFp = listRevisionTasks().map(
    (t) => `${t.task_id}:${t.status}:${t.updated_at}`,
  );
  const openaiCalls = 0;

  // A — production final collision/page-bounds QA
  const a = classifyRequestedChange(CANONICAL_COLLISION_BOUNDS_QA_V2);
  checks.push(
    assert(
      a.classification === "VERIFICATION_ACCEPTANCE" &&
        a.check_type === "COLLISION_BOUNDS",
      "A_prod_collision_bounds_qa_v2_verification",
      JSON.stringify(a),
    ),
  );
  const aCover = validatePlanCoversRequestedChanges(
    {
      schema_version: "founder-canvas-revision-plan-1.0.0",
      summary: "empty",
      operations: [],
    },
    [CANONICAL_COLLISION_BOUNDS_QA_V2],
  );
  checks.push(
    assert(
      aCover.ok === true,
      "A_zero_ops_completeness_for_collision_v2",
      aCover.errors.join("; ") || "ok",
    ),
  );

  // B — production final visual-consistency QA
  const b = classifyRequestedChange(CANONICAL_VISUAL_CONSISTENCY_QA_V2);
  checks.push(
    assert(
      b.classification === "VERIFICATION_ACCEPTANCE" &&
        b.check_type === "VISUAL_CONSISTENCY",
      "B_prod_visual_consistency_qa_v2_verification",
      JSON.stringify(b),
    ),
  );

  // C — concrete collision repair
  checks.push(
    assert(
      classifyRequestedChange(
        "Correct all collisions in Education and Skills.",
      ).classification === "MUTATION_REQUIRED",
      "C_concrete_collision_repair_mutation",
      "must remain mutation",
    ),
  );

  // D — concrete Check Certifications mutation
  checks.push(
    assert(
      classifyRequestedChange(
        "Check the Certifications section after repositioning its heading and ensure the body text clears the heading rectangle.",
      ).classification === "MUTATION_REQUIRED",
      "D_check_certifications_mutation",
      "must remain mutation",
    ),
  );

  // E — destructive production alignment (header-band + content @ 284)
  const prodCanvas = canvasFrom([
    headerBand(),
    sectionRect("block-summary-1-r0", 284, 200),
    sectionRect("block-experience-2-r0", 284, 400),
    sectionRect("block-education-3-r0", 284, 700),
  ]);
  const prodPlan = alignPlan(
    [
      "block-header-0-r0",
      "block-summary-1-r0",
      "block-experience-2-r0",
      "block-education-3-r0",
    ],
    284,
  );
  const eGate = validateRevisionPlanAgainstInventory({
    canvas: prodCanvas,
    plan: prodPlan,
  });
  checks.push(
    assert(
      eGate.ok === false &&
        eGate.errors.some((e) => e.includes("mixed structural")) &&
        eGate.errors.some((e) => e.includes("outside page bounds")),
      "E_prod_destructive_align_rejected",
      eGate.errors.join("; "),
    ),
  );
  const eExec = executeCanvasOperations({
    canvas: structuredClone(prodCanvas),
    operations: prodPlan.operations,
  });
  checks.push(
    assert(
      eExec.ok === false &&
        String(eExec.error ?? "").includes("outside page bounds"),
      "E_executor_defense_rejects_prod_align",
      String(eExec.error),
    ),
  );
  // J — no clamp/rewrite: header left still 0 after failed exec
  const headerAfter = (eExec.canvas.objects as Array<Record<string, unknown>>).find(
    (o) => o.id === "block-header-0-r0",
  );
  checks.push(
    assert(
      Number(headerAfter?.left) === 0,
      "J_no_clamp_or_rewrite_on_reject",
      `left=${String(headerAfter?.left)}`,
    ),
  );

  // F — two normal section heading rects @ 284
  const fCanvas = canvasFrom([
    sectionRect("h-summary", 200, 200, 160),
    sectionRect("h-experience", 300, 400, 160),
  ]);
  const fGate = validateRevisionPlanAgainstInventory({
    canvas: fCanvas,
    plan: alignPlan(["h-summary", "h-experience"], 284),
  });
  checks.push(
    assert(fGate.ok === true, "F_ordinary_heading_align_pass", fGate.errors.join("; ") || "ok"),
  );

  // G — compatible header text objects
  const gCanvas = canvasFrom([
    headerText("name-1", 40, 40),
    headerText("contact-1", 80, 70),
  ]);
  const gGate = validateRevisionPlanAgainstInventory({
    canvas: gCanvas,
    plan: alignPlan(["name-1", "contact-1"], 48),
  });
  checks.push(
    assert(gGate.ok === true, "G_header_text_align_pass", gGate.errors.join("; ") || "ok"),
  );

  // H — full-width structural cohort at x=0 (same geometry class, in bounds) → PASS
  const hCanvas = canvasFrom([
    {
      type: "rect",
      id: "band-a",
      left: 0,
      top: 0,
      width: 794,
      height: 80,
      data: { role: "header-band", id: "band-a" },
    },
    {
      type: "rect",
      id: "band-b",
      left: 0,
      top: 900,
      width: 794,
      height: 40,
      data: { role: "decorative", id: "band-b" },
    },
  ]);
  const hGate = validateRevisionPlanAgainstInventory({
    canvas: hCanvas,
    plan: alignPlan(["band-a", "band-b"], 0),
  });
  checks.push(
    assert(
      hGate.ok === true,
      "H_all_structural_fullwidth_align_left_0_pass",
      hGate.errors.join("; ") ||
        "documented: all-structural cohort may pass when align_left keeps every target within page bounds",
    ),
  );

  // I — any target right edge exceeds page width
  const iSafety = validateAlignObjectsSafety({
    targets: [
      sectionRect("wide", 0, 100, 500) as never,
      sectionRect("narrow", 0, 200, 160) as never,
    ],
    target_ids: ["wide", "narrow"],
    align_left: 400,
    page_width: PAGE_W,
    page_height: PAGE_H,
  });
  checks.push(
    assert(
      iSafety.ok === false &&
        iSafety.errors.some((e) => e.includes("outside page bounds")),
      "I_oob_right_edge_fails_before_execution",
      iSafety.errors.join("; "),
    ),
  );

  // K — verification items excluded from CoveragePlanRepair missing set
  const kMissing = findUncoveredRequestedChanges(
    {
      schema_version: "founder-canvas-revision-plan-1.0.0",
      summary: "mutations only",
      operations: [
        {
          op: "set_position",
          target_id: "x",
          before_summary: "x",
          intended_change: "move x",
          values: { left: 10, top: 10 },
          founder_feedback_item: "Move the Skills heading so it does not overlap body text.",
          confidence: 0.9,
        },
      ],
    },
    [
      "Move the Skills heading so it does not overlap body text.",
      CANONICAL_COLLISION_BOUNDS_QA_V2,
      CANONICAL_VISUAL_CONSISTENCY_QA_V2,
      CANONICAL_COLLISION_BOUNDS_QA,
      CANONICAL_VISUAL_CONSISTENCY_QA,
    ],
  );
  checks.push(
    assert(
      kMissing.length === 0,
      "K_verification_excluded_from_uncovered_mutations",
      JSON.stringify(kMissing),
    ),
  );

  // L — exact canonical forms still pass
  checks.push(
    assert(
      classifyRequestedChange(CANONICAL_COLLISION_BOUNDS_QA).check_type ===
        "COLLISION_BOUNDS" &&
        classifyRequestedChange(CANONICAL_VISUAL_CONSISTENCY_QA).check_type ===
          "VISUAL_CONSISTENCY",
      "L_exact_canonical_forms_still_pass",
      "ok",
    ),
  );

  // M — generic QA alone does not admit verification
  checks.push(
    assert(
      classifyRequestedChange("QA").classification === "MUTATION_REQUIRED" &&
        classifyRequestedChange("perform QA").classification ===
          "MUTATION_REQUIRED" &&
        classifyRequestedChange("final check").classification ===
          "MUTATION_REQUIRED",
      "M_generic_qa_not_verification",
      "ok",
    ),
  );

  // Additional mutation anti-bypass from spec
  for (const [name, text] of [
    [
      "standardize_spacing_mutation",
      "Standardize spacing throughout the resume.",
    ],
    ["align_heading_rects_mutation", "Align all section heading rectangles."],
    [
      "improve_visual_consistency_mutation",
      "Improve visual consistency by changing all headings to 16px.",
    ],
  ] as const) {
    checks.push(
      assert(
        classifyRequestedChange(text).classification === "MUTATION_REQUIRED",
        name,
        text,
      ),
    );
  }

  // --- Cross-lane align_objects safety (VP Ops Rev2 failure class) ---
  const twoLane = twoLaneVpOpsStyleCanvas();
  const twoLaneDetection = detectLayoutLanesFromCanvas(twoLane);
  checks.push(
    assert(
      twoLaneDetection.lane_count === 2,
      "TWO_LANE_DETECTION_PROOF",
      `lane_count=${twoLaneDetection.lane_count} lanes=${JSON.stringify(twoLaneDetection.lanes.map((l) => ({ id: l.lane_id, left: l.bounds_left, right: l.bounds_right, sections: l.section_order })))}`,
    ),
  );

  const mixedTargets = [
    "block-summary-1-t1",
    "block-experience-2-t1",
    "block-education-3-t1",
    "block-skills-4-t1",
    "block-projects-5-t1",
    "block-certifications-6-t1",
    "block-languages-7-t1",
  ];
  const badCrossLanePlan = alignPlan(mixedTargets, 60);
  const textSnapshot = (c: FabricCanvasDoc): string =>
    JSON.stringify(
      (c.objects ?? []).map((o) => {
        const r = o as Record<string, unknown>;
        return { id: r.id, text: r.text ?? null };
      }),
    );
  const beforeTexts = textSnapshot(twoLane);
  const beforeGeom = JSON.stringify(
    (twoLane.objects ?? []).map((o) => {
      const r = o as Record<string, unknown>;
      return { id: r.id, left: r.left, top: r.top };
    }),
  );

  const crossGate = validateRevisionPlanAgainstInventory({
    canvas: twoLane,
    plan: badCrossLanePlan,
  });
  checks.push(
    assert(
      crossGate.ok === false &&
        crossGate.errors.some((e) =>
          e.includes(CROSS_LANE_ALIGNMENT_NOT_ALLOWED),
        ),
      "CROSS_LANE_ALIGN_REJECT",
      crossGate.errors.join("; "),
    ),
  );
  const crossExec = executeCanvasOperations({
    canvas: structuredClone(twoLane),
    operations: badCrossLanePlan.operations,
  });
  checks.push(
    assert(
      crossExec.ok === false &&
        String(crossExec.error ?? "").includes(
          CROSS_LANE_ALIGNMENT_NOT_ALLOWED,
        ),
      "CROSS_LANE_ALIGN_EXECUTOR_REJECT",
      String(crossExec.error),
    ),
  );
  const afterGeomCross = JSON.stringify(
    (crossExec.canvas.objects ?? []).map((o) => {
      const r = o as Record<string, unknown>;
      return { id: r.id, left: r.left, top: r.top };
    }),
  );
  checks.push(
    assert(
      afterGeomCross === beforeGeom,
      "CROSS_LANE_ALIGN_CANVAS_UNMODIFIED",
      "geometry must match prior after reject",
    ),
  );
  checks.push(
    assert(
      textSnapshot(twoLane) === beforeTexts &&
        textSnapshot(crossExec.canvas) === beforeTexts,
      "CONTENT_UNCHANGED",
      "safety must not mutate textual content",
    ),
  );

  // Right-lane headings cannot be pulled to sidebar x=60
  const rightOnly = [
    "block-summary-1-t1",
    "block-experience-2-t1",
    "block-education-3-t1",
  ];
  const rightToSidebar = validateRevisionPlanAgainstInventory({
    canvas: twoLane,
    plan: alignPlan(rightOnly, 60),
  });
  checks.push(
    assert(
      rightToSidebar.ok === false &&
        rightToSidebar.errors.some((e) =>
          e.includes(ALIGN_LEFT_OUTSIDE_TARGET_LANE),
        ),
      "RIGHT_TO_SIDEBAR_ALIGN_REJECT",
      rightToSidebar.errors.join("; "),
    ),
  );
  const rightExec = executeCanvasOperations({
    canvas: structuredClone(twoLane),
    operations: alignPlan(rightOnly, 60).operations,
  });
  checks.push(
    assert(
      rightExec.ok === false &&
        String(rightExec.error ?? "").includes(ALIGN_LEFT_OUTSIDE_TARGET_LANE),
      "RIGHT_TO_SIDEBAR_EXECUTOR_REJECT",
      String(rightExec.error),
    ),
  );

  // Same-lane main headings may align together at main-column left
  const sameLane = validateRevisionPlanAgainstInventory({
    canvas: twoLane,
    plan: alignPlan(rightOnly, 296),
  });
  checks.push(
    assert(
      sameLane.ok === true,
      "SAME_LANE_ALIGN_PASS",
      sameLane.errors.join("; ") || "ok",
    ),
  );
  const sameLaneExec = executeCanvasOperations({
    canvas: structuredClone(twoLane),
    operations: alignPlan(rightOnly, 296).operations,
  });
  checks.push(
    assert(
      sameLaneExec.ok === true,
      "SAME_LANE_ALIGN_EXECUTOR_PASS",
      String(sameLaneExec.error ?? "ok"),
    ),
  );

  // Within-lane small horizontal adjust (main 296 → 300) remains legal
  const withinLane = validateRevisionPlanAgainstInventory({
    canvas: twoLane,
    plan: alignPlan(rightOnly, 300),
  });
  checks.push(
    assert(
      withinLane.ok === true,
      "WITHIN_LANE_LEFT_ADJUST_PASS",
      withinLane.errors.join("; ") || "ok",
    ),
  );

  // One-column templates continue to allow ordinary heading alignment
  const oneCol = oneColumnCanvas();
  const oneColDetect = detectLayoutLanesFromCanvas(oneCol);
  const oneColGate = validateRevisionPlanAgainstInventory({
    canvas: oneCol,
    plan: alignPlan(["h-summary", "h-experience", "h-education"], 48),
  });
  checks.push(
    assert(
      oneColDetect.lane_count <= 1 && oneColGate.ok === true,
      "ONE_COLUMN_ALIGN_PASS",
      `lanes=${oneColDetect.lane_count}; ${oneColGate.errors.join("; ") || "ok"}`,
    ),
  );

  // --- 26 Aug production alignment failure class ---
  const flush = productionFlushSidebarCanvas();
  const flushDetect = detectLayoutLanesFromCanvas(flush);
  checks.push(
    assert(
      flushDetect.lane_count === 2,
      "PROD_FLUSH_TWO_LANE_DETECTION",
      `lane_count=${flushDetect.lane_count} lanes=${JSON.stringify(
        flushDetect.lanes.map((l) => ({
          id: l.lane_id,
          left: l.bounds_left,
          right: l.bounds_right,
        })),
      )}`,
    ),
  );

  const headingAlign = validateRevisionPlanAgainstInventory({
    canvas: flush,
    plan: alignPlan(
      [
        "block-skills-4-t1",
        "block-projects-5-t1",
        "block-certifications-6-t1",
        "block-languages-7-t1",
      ],
      60,
    ),
  });
  checks.push(
    assert(
      headingAlign.ok === true,
      "LEGAL_HEADING_ALIGN_IN_LANE_PASS",
      headingAlign.errors.join("; ") || "ok",
    ),
  );

  const bodyAlign = validateRevisionPlanAgainstInventory({
    canvas: flush,
    plan: alignPlan(
      [
        "block-skills-4-t2",
        "block-skills-4-t3",
        "block-projects-5-t2",
        "block-certifications-6-t2",
        "block-languages-7-t2",
      ],
      48,
    ),
  });
  checks.push(
    assert(
      bodyAlign.ok === true,
      "LEGAL_BODY_ALIGN_IN_LANE_PASS",
      bodyAlign.errors.join("; ") || "ok",
    ),
  );

  const bodyOverflow = validateRevisionPlanAgainstInventory({
    canvas: flush,
    plan: alignPlan(["block-skills-4-t2", "block-skills-4-t3"], 60),
  });
  checks.push(
    assert(
      bodyOverflow.ok === false &&
        bodyOverflow.errors.some((e) =>
          e.includes(ALIGN_LEFT_OUTSIDE_TARGET_LANE),
        ) &&
        bodyOverflow.errors.some((e) => e.includes("proposed_right=280")) &&
        bodyOverflow.errors.some((e) => e.includes("effective_width=220")) &&
        !bodyOverflow.errors.some((e) =>
          e.includes(MIXED_SECTION_UNIT_ALIGNMENT_NOT_ALLOWED),
        ),
      "BODY_RIGHT_EDGE_OVERFLOW_REJECT",
      bodyOverflow.errors.join("; "),
    ),
  );

  const mixedOp2 = validateRevisionPlanAgainstInventory({
    canvas: flush,
    plan: alignPlan(
      [
        "block-skills-4-r0",
        "block-skills-4-t1",
        "block-skills-4-t2",
        "block-skills-4-t3",
      ],
      60,
    ),
  });
  checks.push(
    assert(
      mixedOp2.ok === false &&
        mixedOp2.errors.some((e) =>
          e.includes(MIXED_SECTION_UNIT_ALIGNMENT_NOT_ALLOWED),
        ) &&
        mixedOp2.errors.some((e) => e.includes("marker:")) &&
        mixedOp2.errors.some((e) => e.includes("heading:")) &&
        mixedOp2.errors.some((e) => e.includes("body:")),
      "PROD_OP2_MIXED_SECTION_UNIT_REJECT",
      mixedOp2.errors.join("; "),
    ),
  );
  const mixedExec = executeCanvasOperations({
    canvas: structuredClone(flush),
    operations: alignPlan(
      [
        "block-skills-4-r0",
        "block-skills-4-t1",
        "block-skills-4-t2",
        "block-skills-4-t3",
      ],
      60,
    ).operations,
  });
  checks.push(
    assert(
      mixedExec.ok === false &&
        String(mixedExec.error ?? "").includes(
          MIXED_SECTION_UNIT_ALIGNMENT_NOT_ALLOWED,
        ),
      "PROD_OP2_MIXED_EXECUTOR_UNMODIFIED",
      String(mixedExec.error),
    ),
  );

  const markerHeading = validateRevisionPlanAgainstInventory({
    canvas: flush,
    plan: alignPlan(["block-skills-4-r0", "block-skills-4-t1"], 60),
  });
  checks.push(
    assert(
      markerHeading.ok === false &&
        markerHeading.errors.some((e) =>
          e.includes(MIXED_SECTION_UNIT_ALIGNMENT_NOT_ALLOWED),
        ),
      "MARKER_HEADING_OFFSET_NOT_COLLAPSED",
      markerHeading.errors.join("; "),
    ),
  );

  const summaryMarkerHeading = validateRevisionPlanAgainstInventory({
    canvas: flush,
    plan: alignPlan(["block-summary-1-r0", "block-summary-1-t1"], 284),
  });
  checks.push(
    assert(
      summaryMarkerHeading.ok === false &&
        summaryMarkerHeading.errors.some((e) =>
          e.includes(MIXED_SECTION_UNIT_ALIGNMENT_NOT_ALLOWED),
        ),
      "COVERAGE_REPAIR_SUMMARY_MARKER_HEADING_REJECT",
      summaryMarkerHeading.errors.join("; "),
    ),
  );

  const markerOnly = validateRevisionPlanAgainstInventory({
    canvas: flush,
    plan: alignPlan(
      [
        "block-skills-4-r0",
        "block-projects-5-r0",
        "block-certifications-6-r0",
        "block-languages-7-r0",
      ],
      48,
    ),
  });
  checks.push(
    assert(
      markerOnly.ok === true,
      "LEGAL_MARKER_ALIGN_IN_LANE_PASS",
      markerOnly.errors.join("; ") || "ok",
    ),
  );

  const bodyNotPulledToHeading = validateAlignObjectsSafety({
    targets: (flush.objects ?? []).filter((o) => {
      const id = (o as { id?: string }).id;
      return id === "block-skills-4-t2" || id === "block-skills-4-t3";
    }) as Array<Record<string, unknown>>,
    target_ids: ["block-skills-4-t2", "block-skills-4-t3"],
    align_left: 60,
    page_width: PAGE_W,
    page_height: PAGE_H,
    canvas: flush,
  });
  checks.push(
    assert(
      bodyNotPulledToHeading.ok === false &&
        bodyNotPulledToHeading.errors.some((e) =>
          e.includes(ALIGN_LEFT_OUTSIDE_TARGET_LANE),
        ),
      "BODY_NOT_PULLED_TO_HEADING_ANCHOR",
      bodyNotPulledToHeading.errors.join("; "),
    ),
  );

  const promptTask: RevisionTask = {
    schema_version: "founder-revision-task-1.0.0",
    task_id: "verify-align-cohorts",
    decision_id: "fd-verify",
    review_id: "founder-review-verify",
    prior_candidate_id: "cand-verify",
    prior_canvas_path: "verify",
    founder_reason: "verify",
    requested_changes: [
      "Align the sidebar section headings consistently within the sidebar.",
      "Align markers consistently relative to those headings.",
    ],
    role: "verify",
    design_family: null,
    status: "PENDING",
    created_at: "2026-08-26T00:00:00.000Z",
    updated_at: "2026-08-26T00:00:00.000Z",
    error: null,
    revised_candidate_id: null,
    revised_review_id: null,
    revision_number: 1,
    openai_execution_path: null,
    publication_allowed: false,
    live: false,
  };
  const primaryPrompt = buildRevisionPlannerPrompt({
    task: promptTask,
    inventory: [],
    page_width: PAGE_W,
    page_height: PAGE_H,
    preview_width: PAGE_W,
    preview_height: PAGE_H,
  });
  checks.push(
    assert(
      primaryPrompt.instructions.includes("HORIZONTAL ALIGNMENT COHORTS") &&
        primaryPrompt.instructions.includes(
          "Objects belonging to one section do NOT necessarily share one left coordinate",
        ) &&
        primaryPrompt.instructions.includes(
          "It does NOT mean assign marker and heading the same align_left",
        ) &&
        primaryPrompt.instructions.includes(
          "means heading labels only",
        ) &&
        primaryPrompt.instructions.includes(
          "established lane/column band",
        ) &&
        primaryPrompt.instructions.includes(
          "one-element target_ids array is invalid",
        ) &&
        primaryPrompt.instructions.includes(
          "no-op invented for coverage",
        ),
      "PRIMARY_PROMPT_HORIZONTAL_COHORTS",
      "ok",
    ),
  );
  const repairPrompt = buildRevisionCoverageRepairPrompt({
    task: promptTask,
    inventory: [],
    page_width: PAGE_W,
    page_height: PAGE_H,
    missing: [
      {
        index: 9,
        text: "Use the Summary heading and its blue accent marker as a visual reference for a clean and consistent heading-marker relationship, while preserving the separate horizontal anchors of the sidebar and main column.",
      },
    ],
    primaryOperations: [],
  });
  checks.push(
    assert(
        repairPrompt.instructions.includes("HORIZONTAL ALIGNMENT COHORTS") &&
        repairPrompt.instructions.includes(
          "HEADING-MARKER VISUAL REFERENCE (coverage repair",
        ) &&
        repairPrompt.instructions.includes(
          "collapses the established marker↔heading offset",
        ) &&
        repairPrompt.instructions.includes(
          "one-element target_ids array is invalid",
        ),
      "COVERAGE_REPAIR_PROMPT_HORIZONTAL_COHORTS",
      "ok",
    ),
  );

  // Existing structural rejection paths remain intact (explicit re-check)
  checks.push(
    assert(
      eGate.ok === false &&
        eGate.errors.some((e) => e.includes("mixed structural")) &&
        iSafety.ok === false &&
        iSafety.errors.some((e) => e.includes("outside page bounds")),
      "EXISTING_STRUCTURAL_REJECTIONS_STILL_PASS",
      "mixed structural + OOB still reject",
    ),
  );

  const afterFp = listRevisionTasks().map(
    (t) => `${t.task_id}:${t.status}:${t.updated_at}`,
  );
  checks.push(
    assert(
      JSON.stringify(beforeFp) === JSON.stringify(afterFp),
      "prod_task_store_unchanged",
      "ok",
    ),
  );
  checks.push(
    assert(openaiCalls === 0, "no_openai_calls", String(openaiCalls)),
  );

  const failed = checks.filter((c) => !c.pass);
  const report = {
    ok: failed.length === 0,
    at: new Date().toISOString(),
    openai_calls: openaiCalls,
    checks,
    failed: failed.map((c) => c.name),
  };
  mkdirSync(join(REPO, "SOS/07_LOGS/saios/founder-revision"), {
    recursive: true,
  });
  writeFileSync(OUT, JSON.stringify(report, null, 2));
  if (!report.ok) {
    console.error(
      "verify-structural-alignment-safety FAILED:",
      failed.map((c) => `${c.name}: ${c.detail}`).join("\n"),
    );
    process.exit(1);
  }
  console.log(`verify-structural-alignment-safety OK (${checks.length} checks)`);
}

main();
