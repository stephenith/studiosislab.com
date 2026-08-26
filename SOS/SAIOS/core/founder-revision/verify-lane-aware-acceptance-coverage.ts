/**
 * Deterministic verify: lane-aware visual consistency + FeedbackCoverage
 * geometry proofs for the revtask-5585617a-58a failure class.
 * No OpenAI. No VPS. No production task/evidence mutation.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  buildFeedbackCoverage,
  isBroadVisualBalanceRequest,
  isExplicitMultiObjectAlignmentRequest,
  isSectionHierarchySpacingRequest,
  isSidebarEdgeExtensionRequest,
  requiresStructuralProof,
} from "./FeedbackCoverage.js";
import {
  runCollisionBoundsCheck,
  runVisualConsistencyCheck,
} from "./RevisionAcceptanceChecks.js";
import { detectLayoutLanesFromCanvas } from "./RevisionLayoutNormalizer.js";
import { executeCanvasOperations } from "./CanvasOperationExecutor.js";
import {
  detectInternalPlanMutationConflicts,
} from "./PlanMutationConflicts.js";
import {
  validateExecutableMutationValues,
  validateRevisionPlan,
} from "./RevisionPromptBuilder.js";
import { listRevisionTasks } from "./RevisionTaskStore.js";
import type {
  CanvasOperation,
  OperationLogEntry,
  RevisionPlan,
} from "./revision-task-types.js";
import type { FabricCanvasDoc } from "./CanvasInventory.js";
import { CANONICAL_VISUAL_CONSISTENCY_QA } from "./RequestedChangeClassification.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/founder-revision/verify-lane-aware-acceptance-coverage.json",
);

type Check = { name: string; pass: boolean; detail: string };

function assert(cond: boolean, name: string, detail: string): Check {
  return { name, pass: cond, detail };
}

const SIDEBAR_FB =
  "Extend the light-blue left sidebar background fully to the left edge of the page while preserving its existing right boundary and maintaining a clean two-column layout.";
const EDU_FB =
  "Refine the Education section hierarchy and spacing so the two education entries are clearly distinguishable, consistently aligned, and visually integrated with the rest of the right column.";
const BALANCE_FB =
  "Improve the overall visual balance between the left and right columns so the page feels intentionally composed rather than heavily populated on the right and visually empty on the lower left.";
const EXPLICIT_ALIGN_FB =
  "Align all section headings to the same left edge.";
const PAGE_EDGE_PHRASE =
  "extend the panel to the left edge of the page while keeping width";
const ALIGNED_IN_COLUMN =
  "make the education entries consistently aligned within the right column";

function pageBg(): Record<string, unknown> {
  return {
    type: "rect",
    id: "page-root",
    left: 0,
    top: 0,
    width: 794,
    height: 1123,
    fill: "#ffffff",
    data: {
      role: "pageBackground",
      kind: "page-bg",
      system: true,
      id: "page-root",
    },
  };
}

function headingPair(
  label: string,
  section: string,
  top: number,
  opts: {
    left: number;
    rectLeft: number;
    padding?: number;
    rectId: string;
    textId: string;
  },
): Record<string, unknown>[] {
  const padding = opts.padding ?? 0;
  const rectId = opts.rectId;
  const textId = opts.textId;
  return [
    {
      type: "rect",
      id: rectId,
      left: opts.rectLeft,
      top,
      width: 4,
      height: 14,
      fill: "#1e40af",
      data: { id: rectId, section, role: "section-heading" },
    },
    {
      type: "textbox",
      id: textId,
      left: opts.left,
      top: top + padding,
      width: 200,
      height: 14,
      text: label,
      fill: "#0f172a",
      fontSize: 11,
      fontFamily: "Helvetica",
      fontWeight: "bold",
      data: { id: textId, section, role: "section-heading" },
    },
  ];
}

function twoColumnConsistentCanvas(): FabricCanvasDoc {
  return {
    version: "5.3.0",
    width: 794,
    height: 1123,
    objects: [
      pageBg(),
      {
        type: "rect",
        id: "page-sidebar-bg",
        left: 0,
        top: 146,
        width: 268,
        height: 900,
        fill: "#f1f5f9",
        data: { id: "page-sidebar-bg" },
      },
      ...headingPair("SKILLS", "skills", 152, {
        left: 60,
        rectLeft: 48,
        rectId: "block-skills-4-r0",
        textId: "block-skills-4-t1",
      }),
      {
        type: "textbox",
        id: "block-skills-4-t2",
        left: 48,
        top: 180,
        width: 200,
        height: 40,
        text: "Python",
        fontSize: 10,
        data: { id: "block-skills-4-t2", section: "skills" },
      },
      ...headingPair("CERTIFICATIONS", "certifications", 280, {
        left: 60,
        rectLeft: 48,
        rectId: "block-certifications-6-r0",
        textId: "block-certifications-6-t1",
      }),
      {
        type: "textbox",
        id: "block-certifications-6-t2",
        left: 48,
        top: 310,
        width: 200,
        height: 30,
        text: "AWS",
        fontSize: 10,
        data: { id: "block-certifications-6-t2", section: "certifications" },
      },
      ...headingPair("LANGUAGES", "languages", 380, {
        left: 60,
        rectLeft: 48,
        rectId: "block-languages-7-r0",
        textId: "block-languages-7-t1",
      }),
      {
        type: "textbox",
        id: "block-languages-7-t2",
        left: 48,
        top: 410,
        width: 200,
        height: 20,
        text: "English",
        fontSize: 10,
        data: { id: "block-languages-7-t2", section: "languages" },
      },
      ...headingPair("SUMMARY", "summary", 154, {
        left: 296,
        rectLeft: 284,
        rectId: "block-summary-1-r0",
        textId: "block-summary-1-t1",
      }),
      {
        type: "textbox",
        id: "block-summary-1-t2",
        left: 284,
        top: 180,
        width: 450,
        height: 40,
        text: "Summary body",
        fontSize: 10,
        data: { id: "block-summary-1-t2", section: "summary" },
      },
      ...headingPair("EXPERIENCE", "experience", 280, {
        left: 296,
        rectLeft: 284,
        rectId: "block-experience-2-r0",
        textId: "block-experience-2-t1",
      }),
      {
        type: "textbox",
        id: "block-experience-2-t2",
        left: 284,
        top: 310,
        width: 450,
        height: 80,
        text: "Experience body",
        fontSize: 10,
        data: { id: "block-experience-2-t2", section: "experience" },
      },
      ...headingPair("EDUCATION", "education", 480, {
        left: 296,
        rectLeft: 284,
        rectId: "block-education-3-r0",
        textId: "block-education-3-t1",
      }),
      {
        type: "textbox",
        id: "block-education-3-t2",
        left: 284,
        top: 510,
        width: 450,
        height: 20,
        text: "B.A. Marketing",
        fontSize: 10,
        data: { id: "block-education-3-t2", section: "education" },
      },
      {
        type: "textbox",
        id: "block-education-3-t3",
        left: 284,
        top: 540,
        width: 450,
        height: 20,
        text: "Certificate",
        fontSize: 10,
        data: { id: "block-education-3-t3", section: "education" },
      },
    ],
  } as FabricCanvasDoc;
}

function oneColumnConsistentCanvas(): FabricCanvasDoc {
  return {
    version: "5.3.0",
    width: 794,
    height: 1123,
    objects: [
      pageBg(),
      ...headingPair("SUMMARY", "summary", 160, {
        left: 48,
        rectLeft: 40,
        rectId: "block-summary-1-r0",
        textId: "block-summary-1-t1",
      }),
      {
        type: "textbox",
        id: "sum-body",
        left: 40,
        top: 190,
        width: 700,
        height: 30,
        text: "Summary",
        data: { id: "sum-body", section: "summary" },
      },
      ...headingPair("EXPERIENCE", "experience", 260, {
        left: 48,
        rectLeft: 40,
        rectId: "block-experience-2-r0",
        textId: "block-experience-2-t1",
      }),
      {
        type: "textbox",
        id: "exp-body",
        left: 40,
        top: 290,
        width: 700,
        height: 30,
        text: "Experience",
        data: { id: "exp-body", section: "experience" },
      },
      ...headingPair("EDUCATION", "education", 360, {
        left: 48,
        rectLeft: 40,
        rectId: "block-education-3-r0",
        textId: "block-education-3-t1",
      }),
      {
        type: "textbox",
        id: "edu-body",
        left: 40,
        top: 390,
        width: 700,
        height: 30,
        text: "Education",
        data: { id: "edu-body", section: "education" },
      },
    ],
  } as FabricCanvasDoc;
}

function cloneCanvas(c: FabricCanvasDoc): FabricCanvasDoc {
  return JSON.parse(JSON.stringify(c)) as FabricCanvasDoc;
}

function setObj(
  canvas: FabricCanvasDoc,
  id: string,
  patch: Record<string, unknown>,
): void {
  for (const o of canvas.objects ?? []) {
    if (o.id === id) Object.assign(o, patch);
  }
}

function planFor(
  fb: string,
  op: Partial<CanvasOperation> & { op: CanvasOperation["op"]; target_id: string },
): RevisionPlan {
  return {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "lane coverage verify",
    notes: [],
    operations: [
      {
        before_summary: "prior",
        intended_change: "apply founder geometry",
        values: {},
        founder_feedback_item: fb,
        confidence: 0.9,
        ...op,
      },
    ],
  };
}

function okLog(
  fb: string,
  targetId: string,
  index: number,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): OperationLogEntry {
  return {
    index,
    op: "set_dimensions",
    target_id: targetId,
    founder_feedback_item: fb,
    ok: true,
    before,
    after,
    error: null,
  };
}

function main(): void {
  const checks: Check[] = [];
  const beforeFp = listRevisionTasks().map(
    (t) => `${t.task_id}:${t.status}:${t.updated_at}`,
  );
  const openaiCalls = 0;

  // Facade
  const two = twoColumnConsistentCanvas();
  const lanes = detectLayoutLanesFromCanvas(two);
  checks.push(
    assert(
      lanes.lane_count === 2 &&
        lanes.section_to_lane.skills !== lanes.section_to_lane.summary &&
        !!lanes.object_id_to_lane["block-skills-4-t1"],
      "facade_two_column_section_and_object_maps",
      JSON.stringify(lanes.lanes),
    ),
  );
  const one = oneColumnConsistentCanvas();
  checks.push(
    assert(
      detectLayoutLanesFromCanvas(one).lane_count === 1,
      "facade_one_column_single_lane",
      String(detectLayoutLanesFromCanvas(one).lane_count),
    ),
  );

  // A — two-column cross-lane left difference must NOT fail
  const visA = runVisualConsistencyCheck(two, CANONICAL_VISUAL_CONSISTENCY_QA);
  checks.push(
    assert(
      visA.pass === true &&
        visA.evaluable === true &&
        !visA.findings.some((f) => f.code === "ACC_VISUAL_LEFT_MISMATCH"),
      "A_two_column_no_cross_lane_left_mismatch",
      `${visA.reason} findings=${visA.findings.length}`,
    ),
  );

  // B — same-lane left deviation fails
  const badLeft = cloneCanvas(two);
  setObj(badLeft, "block-certifications-6-t1", { left: 90 });
  setObj(badLeft, "block-certifications-6-r0", { left: 78 });
  const visB = runVisualConsistencyCheck(badLeft, CANONICAL_VISUAL_CONSISTENCY_QA);
  checks.push(
    assert(
      visB.pass === false &&
        visB.findings.some(
          (f) =>
            f.code === "ACC_VISUAL_LEFT_MISMATCH" &&
            String(f.metrics?.lane_id ?? "").startsWith("lane-"),
        ),
      "B_same_lane_left_mismatch_fails",
      JSON.stringify(visB.findings.map((f) => f.code)),
    ),
  );

  // C — same-lane padding inconsistency fails
  const badPad = cloneCanvas(two);
  setObj(badPad, "block-certifications-6-t1", { top: 288 }); // rect top 280 → pad 8 vs ref 0
  const visC = runVisualConsistencyCheck(badPad, CANONICAL_VISUAL_CONSISTENCY_QA);
  checks.push(
    assert(
      visC.pass === false &&
        visC.findings.some((f) => f.code === "ACC_VISUAL_PADDING_MISMATCH"),
      "C_same_lane_padding_mismatch_fails",
      JSON.stringify(visC.findings.map((f) => ({ code: f.code, m: f.metrics }))),
    ),
  );

  // D — one-column preserves fail-closed same-grid behavior
  const oneBad = cloneCanvas(one);
  setObj(oneBad, "block-education-3-t1", { left: 80 });
  setObj(oneBad, "block-education-3-r0", { left: 72 });
  const visD = runVisualConsistencyCheck(oneBad, CANONICAL_VISUAL_CONSISTENCY_QA);
  const visDGood = runVisualConsistencyCheck(one, CANONICAL_VISUAL_CONSISTENCY_QA);
  checks.push(
    assert(
      visDGood.pass === true && visD.pass === false,
      "D_one_column_behavior_preserved",
      `good=${visDGood.pass} bad=${visD.pass} findings=${visD.findings.length}`,
    ),
  );

  // E — collision/bounds unaffected
  const bounds = runCollisionBoundsCheck(
    two,
    "Perform a final collision and page-bounds QA pass after all repositioning: no heading, text, bullet, background shape, or section may overlap another element or extend outside the page boundaries.",
  );
  checks.push(
    assert(
      bounds.pass === true && bounds.check_type === "COLLISION_BOUNDS",
      "E_collision_bounds_global_unaffected",
      bounds.reason,
    ),
  );

  // Heuristic false-positive prevention I/J/K
  checks.push(
    assert(
      !isExplicitMultiObjectAlignmentRequest(PAGE_EDGE_PHRASE) &&
        !isExplicitMultiObjectAlignmentRequest(SIDEBAR_FB.toLowerCase()),
      "I_left_edge_of_page_not_multi_object_alignment",
      PAGE_EDGE_PHRASE,
    ),
  );
  checks.push(
    assert(
      !isExplicitMultiObjectAlignmentRequest(ALIGNED_IN_COLUMN) &&
        !isExplicitMultiObjectAlignmentRequest(EDU_FB.toLowerCase()),
      "J_aligned_within_right_column_not_peer_alignment",
      ALIGNED_IN_COLUMN,
    ),
  );
  checks.push(
    assert(
      isExplicitMultiObjectAlignmentRequest(EXPLICIT_ALIGN_FB.toLowerCase()) &&
        requiresStructuralProof(EXPLICIT_ALIGN_FB.toLowerCase()),
      "K_explicit_align_all_section_headings_still_requires_proof",
      EXPLICIT_ALIGN_FB,
    ),
  );

  // Sidebar F/G/H
  checks.push(
    assert(
      isSidebarEdgeExtensionRequest(SIDEBAR_FB.toLowerCase()) &&
        requiresStructuralProof(SIDEBAR_FB.toLowerCase()),
      "sidebar_request_requires_geometry_proof",
      "ok",
    ),
  );

  const beforeSidebar = cloneCanvas(two);
  setObj(beforeSidebar, "page-sidebar-bg", { left: 40, width: 228 });
  const afterGood = cloneCanvas(two);
  setObj(afterGood, "page-sidebar-bg", { left: 0, width: 268 });
  const afterBad = cloneCanvas(two);
  setObj(afterBad, "page-sidebar-bg", { left: 0, width: 228 });

  const sidebarPlan = planFor(SIDEBAR_FB, {
    op: "set_dimensions",
    target_id: "page-sidebar-bg",
    values: { left: 0, width: 268 },
  });
  const sidebarLogOk = [
    okLog(
      SIDEBAR_FB,
      "page-sidebar-bg",
      0,
      { id: "page-sidebar-bg", left: 40, width: 228 },
      { id: "page-sidebar-bg", left: 0, width: 228 },
    ),
  ];

  const covF = buildFeedbackCoverage({
    requested_changes: [SIDEBAR_FB],
    plan: sidebarPlan,
    log: sidebarLogOk,
    beforeCanvas: beforeSidebar,
    afterCanvas: afterGood,
  });
  checks.push(
    assert(
      covF.items[0]?.status === "addressed",
      "F_sidebar_left0_width268_addressed",
      `${covF.items[0]?.status} ${covF.items[0]?.evidence.notes}`,
    ),
  );

  const covG = buildFeedbackCoverage({
    requested_changes: [SIDEBAR_FB],
    plan: sidebarPlan,
    log: sidebarLogOk,
    beforeCanvas: beforeSidebar,
    afterCanvas: afterBad,
  });
  checks.push(
    assert(
      covG.items[0]?.status === "partially_addressed" &&
        covG.gate_pass === false,
      "G_sidebar_right_boundary_lost_partial",
      `${covG.items[0]?.status} ${covG.items[0]?.evidence.notes}`,
    ),
  );

  checks.push(
    assert(
      covG.items[0]?.status !== "addressed",
      "H_op_success_with_wrong_right_not_addressed",
      String(covG.items[0]?.status),
    ),
  );

  // Education hierarchy — relational / translation-invariant
  checks.push(
    assert(
      isSectionHierarchySpacingRequest(EDU_FB.toLowerCase()) &&
        requiresStructuralProof(EDU_FB.toLowerCase()),
      "education_requires_hierarchy_proof",
      "ok",
    ),
  );

  const eduBefore = cloneCanvas(two);
  // Baseline education tops in twoColumnConsistentCanvas: 480 / 510 / 540 (gaps 30/30)
  const eduPlan = planFor(EDU_FB, {
    op: "set_position",
    target_id: "block-education-3-t2",
    values: { top: 520 },
  });
  const eduLog: OperationLogEntry[] = [
    {
      index: 0,
      op: "set_position",
      target_id: "block-education-3-t2",
      founder_feedback_item: EDU_FB,
      ok: true,
      before: { id: "block-education-3-t2", top: 510 },
      after: { id: "block-education-3-t2", top: 520 },
      error: null,
    },
  ];

  function shiftEducationTexts(canvas: FabricCanvasDoc, delta: number): void {
    for (const o of canvas.objects ?? []) {
      const id = String(o.id ?? "");
      if (
        id === "block-education-3-t1" ||
        id === "block-education-3-t2" ||
        id === "block-education-3-t3"
      ) {
        o.top = Number(o.top ?? 0) + delta;
      }
    }
  }

  // A — uniform +10px translation, gaps unchanged → NOT addressed
  const eduPlus10 = cloneCanvas(eduBefore);
  shiftEducationTexts(eduPlus10, 10);
  const covPlus10 = buildFeedbackCoverage({
    requested_changes: [EDU_FB],
    plan: eduPlan,
    log: eduLog,
    beforeCanvas: eduBefore,
    afterCanvas: eduPlus10,
  });
  checks.push(
    assert(
      covPlus10.items[0]?.status === "partially_addressed" &&
        String(covPlus10.items[0]?.evidence.notes ?? "").includes(
          "uniform translation",
        ),
      "A_education_uniform_plus10_not_addressed",
      `${covPlus10.items[0]?.status} ${covPlus10.items[0]?.evidence.notes}`,
    ),
  );

  // B — uniform -10px translation → NOT addressed
  const eduMinus10 = cloneCanvas(eduBefore);
  shiftEducationTexts(eduMinus10, -10);
  const covMinus10 = buildFeedbackCoverage({
    requested_changes: [EDU_FB],
    plan: eduPlan,
    log: eduLog,
    beforeCanvas: eduBefore,
    afterCanvas: eduMinus10,
  });
  checks.push(
    assert(
      covMinus10.items[0]?.status === "partially_addressed",
      "B_education_uniform_minus10_not_addressed",
      `${covMinus10.items[0]?.status} ${covMinus10.items[0]?.evidence.notes}`,
    ),
  );

  // C — gap-changing meaningful hierarchy (30/30 → 40/40)
  const eduStrong = cloneCanvas(two);
  setObj(eduStrong, "block-education-3-t1", { top: 480 });
  setObj(eduStrong, "block-education-3-r0", { top: 480 });
  setObj(eduStrong, "block-education-3-t2", { top: 520 });
  setObj(eduStrong, "block-education-3-t3", { top: 560 });
  const covL = buildFeedbackCoverage({
    requested_changes: [EDU_FB],
    plan: eduPlan,
    log: eduLog,
    beforeCanvas: eduBefore,
    afterCanvas: eduStrong,
  });
  checks.push(
    assert(
      covL.items[0]?.status === "addressed",
      "C_education_gap_change_may_address",
      `${covL.items[0]?.status} ${covL.items[0]?.evidence.notes}`,
    ),
  );

  // D — production-like 1–4px weak nudges, gaps effectively unchanged
  const eduWeak = cloneCanvas(two);
  setObj(eduWeak, "block-education-3-t1", { top: 479 });
  setObj(eduWeak, "block-education-3-t2", { top: 509 });
  setObj(eduWeak, "block-education-3-t3", { top: 539 });
  const covM = buildFeedbackCoverage({
    requested_changes: [EDU_FB],
    plan: eduPlan,
    log: eduLog,
    beforeCanvas: eduBefore,
    afterCanvas: eduWeak,
  });
  checks.push(
    assert(
      covM.items[0]?.status === "partially_addressed",
      "D_education_weak_1_4px_remains_partial",
      `${covM.items[0]?.status} ${covM.items[0]?.evidence.notes}`,
    ),
  );

  // E — successful ops + unchanged gaps cannot override relational proof
  checks.push(
    assert(
      covPlus10.items[0]?.status !== "addressed" &&
        !String(covPlus10.items[0]?.evidence.notes ?? "").includes(
          "successful planned operation(s)",
        ),
      "E_education_ops_alone_cannot_override_relational_proof",
      String(covPlus10.items[0]?.evidence.notes),
    ),
  );

  // F — ordering must still be enforced (inverted tops stay partial)
  const eduUnordered = cloneCanvas(two);
  setObj(eduUnordered, "block-education-3-t1", { top: 560 });
  setObj(eduUnordered, "block-education-3-t2", { top: 520 });
  setObj(eduUnordered, "block-education-3-t3", { top: 480 });
  const covOrd = buildFeedbackCoverage({
    requested_changes: [EDU_FB],
    plan: eduPlan,
    log: eduLog,
    beforeCanvas: eduBefore,
    afterCanvas: eduUnordered,
  });
  checks.push(
    assert(
      covOrd.items[0]?.status === "partially_addressed",
      "F_education_ordering_still_enforced",
      `${covOrd.items[0]?.status} ${covOrd.items[0]?.evidence.notes}`,
    ),
  );

  // Broad balance N/O
  checks.push(
    assert(
      isBroadVisualBalanceRequest(BALANCE_FB.toLowerCase()) &&
        requiresStructuralProof(BALANCE_FB.toLowerCase()),
      "balance_requires_structural_proof",
      "ok",
    ),
  );
  const balPlan = planFor(BALANCE_FB, {
    op: "set_position",
    target_id: "block-skills-4-t1",
    values: { top: 152 },
  });
  const balLog: OperationLogEntry[] = [
    {
      index: 0,
      op: "set_position",
      target_id: "block-skills-4-t1",
      founder_feedback_item: BALANCE_FB,
      ok: true,
      before: { id: "block-skills-4-t1", top: 154 },
      after: { id: "block-skills-4-t1", top: 152 },
      error: null,
    },
  ];
  const covN = buildFeedbackCoverage({
    requested_changes: [BALANCE_FB],
    plan: balPlan,
    log: balLog,
    beforeCanvas: two,
    afterCanvas: two,
  });
  checks.push(
    assert(
      covN.items[0]?.status === "partially_addressed" &&
        covN.gate_pass === false,
      "N_two_px_heading_move_not_balance_addressed",
      `${covN.items[0]?.status} ${covN.items[0]?.evidence.notes}`,
    ),
  );
  checks.push(
    assert(
      !String(covN.items[0]?.evidence.notes ?? "").includes(
        "successful planned operation(s)",
      ) || covN.items[0]?.status !== "addressed",
      "O_op_success_alone_cannot_certify_broad_composition",
      String(covN.items[0]?.evidence.notes),
    ),
  );

  // G–J — set_position dimension keys / aliases rejected
  for (const [key, label] of [
    ["width", "G_set_position_width_rejected"],
    ["height", "H_set_position_height_rejected"],
    ["w", "I_set_position_w_alias_rejected"],
    ["h", "J_set_position_h_alias_rejected"],
  ] as const) {
    const err = validateExecutableMutationValues("set_position", 0, {
      left: 0,
      [key]: 268,
    });
    checks.push(
      assert(
        typeof err === "string" &&
          err.includes("position-only") &&
          err.includes(key),
        label,
        String(err),
      ),
    );
  }
  const planWidthReject = validateRevisionPlan({
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "bad width on set_position",
    notes: [],
    operations: [
      {
        op: "set_position",
        target_id: "page-sidebar-bg",
        before_summary: "sidebar",
        intended_change: "extend sidebar",
        values: { left: 0, width: 268 },
        founder_feedback_item: SIDEBAR_FB,
        confidence: 0.9,
      },
    ],
  });
  checks.push(
    assert(
      planWidthReject.ok === false,
      "G_plan_rejects_set_position_with_width",
      planWidthReject.errors.join("; "),
    ),
  );
  const leftTopOk = validateExecutableMutationValues("set_position", 0, {
    left: 48,
    top: 152,
  });
  checks.push(
    assert(
      leftTopOk === null,
      "L_set_position_left_top_still_valid",
      String(leftTopOk),
    ),
  );

  // Q — dimension-capable op changes sidebar width
  const execSrc = cloneCanvas(beforeSidebar);
  const exec = executeCanvasOperations({
    canvas: execSrc,
    operations: [
      {
        op: "set_dimensions",
        target_id: "page-sidebar-bg",
        before_summary: "sidebar",
        intended_change: "extend to page edge preserving right",
        values: { left: 0, width: 268 },
        founder_feedback_item: SIDEBAR_FB,
        confidence: 0.9,
      },
    ],
  });
  const sb = (exec.canvas.objects ?? []).find((o) => o.id === "page-sidebar-bg");
  checks.push(
    assert(
      exec.log[0]?.ok === true &&
        Number(sb?.left) === 0 &&
        Number(sb?.width) === 268,
      "Q_set_dimensions_applies_sidebar_left_and_width",
      JSON.stringify({ left: sb?.left, width: sb?.width, err: exec.log[0]?.error }),
    ),
  );

  // R — combined left+width on one dimension op is conflict-safe
  const conflictCheck = detectInternalPlanMutationConflicts([
    {
      op: "set_dimensions",
      target_id: "page-sidebar-bg",
      before_summary: "sidebar",
      intended_change: "extend",
      values: { left: 0, width: 268 },
      founder_feedback_item: SIDEBAR_FB,
      confidence: 0.9,
    },
  ]);
  const twoAxisIndependent = detectInternalPlanMutationConflicts([
    {
      op: "set_position",
      target_id: "page-sidebar-bg",
      before_summary: "sidebar",
      intended_change: "move left",
      values: { left: 0 },
      founder_feedback_item: SIDEBAR_FB,
      confidence: 0.9,
    },
    {
      op: "set_dimensions",
      target_id: "page-sidebar-bg",
      before_summary: "sidebar",
      intended_change: "grow width",
      values: { width: 268 },
      founder_feedback_item: SIDEBAR_FB,
      confidence: 0.9,
    },
  ]);
  checks.push(
    assert(
      conflictCheck.ok === true && twoAxisIndependent.ok === true,
      "R_sidebar_left_width_conflict_safe",
      `one=${conflictCheck.ok} two=${twoAxisIndependent.ok} err=${twoAxisIndependent.errors.join(";")}`,
    ),
  );

  // Evidence includes lane ids on findings
  checks.push(
    assert(
      visB.findings.every((f) => typeof f.metrics?.lane_id === "string"),
      "evidence_findings_include_lane_id",
      JSON.stringify(visB.findings[0]?.metrics),
    ),
  );

  const afterFp = listRevisionTasks().map(
    (t) => `${t.task_id}:${t.status}:${t.updated_at}`,
  );
  checks.push(
    assert(
      JSON.stringify(beforeFp) === JSON.stringify(afterFp),
      "no_production_task_mutation",
      `before=${beforeFp.length} after=${afterFp.length}`,
    ),
  );
  checks.push(
    assert(openaiCalls === 0, "no_openai_calls", `openaiCalls=${openaiCalls}`),
  );

  const failed = checks.filter((c) => !c.pass);
  const report = {
    ok: failed.length === 0,
    schema_version: "verify-lane-aware-acceptance-coverage-1.0.0",
    at: new Date().toISOString(),
    checks,
    failed: failed.map((f) => f.name),
    openai_calls: openaiCalls,
  };
  mkdirSync(join(REPO, "SOS/07_LOGS/saios/founder-revision"), {
    recursive: true,
  });
  writeFileSync(OUT, JSON.stringify(report, null, 2));
  if (!report.ok) {
    console.error(
      "VERIFY_LANE_AWARE_ACCEPTANCE_COVERAGE_FAIL",
      failed.map((f) => f.name).join(", "),
    );
    process.exit(1);
  }
  console.log("VERIFY_LANE_AWARE_ACCEPTANCE_COVERAGE_OK", checks.length);
}

main();
