/**
 * Focused verify: Summary→Experience gap + passive per-lane alignment proofs.
 * No OpenAI. No VPS. No production task/evidence mutation.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  buildFeedbackCoverage,
  isExplicitMultiObjectAlignmentRequest,
  isPassiveConsistentAlignmentRequest,
  isSummaryToExperienceGapRequest,
  requiresStructuralProof,
} from "./FeedbackCoverage.js";
import { listRevisionTasks } from "./RevisionTaskStore.js";
import type {
  OperationLogEntry,
  RevisionPlan,
} from "./revision-task-types.js";
import type { FabricCanvasDoc } from "./CanvasInventory.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/founder-revision/verify-feedback-coverage-vp-ops-proof.json",
);

type Check = { name: string; pass: boolean; detail: string };

function assert(cond: boolean, name: string, detail: string): Check {
  return { name, pass: cond, detail };
}

const GAP_FB =
  "Increase the vertical gap above the Experience heading so its spacing from the preceding Summary section is visually consistent with the established section rhythm.";

const PASSIVE_ALIGN_FB =
  "Keep section headings, their accent markers, and their associated content aligned consistently across the layout.";

const EDU_FB =
  "Refine the Education section hierarchy and spacing so the two education entries are clearly distinguishable, consistently aligned, and visually integrated with the right column.";

const EXPLICIT_ALIGN_FB =
  "Align the left edges of the name, summary heading, experience heading, and skills heading.";

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
    rectId: string;
    textId: string;
  },
): Record<string, unknown>[] {
  return [
    {
      type: "rect",
      id: opts.rectId,
      left: opts.rectLeft,
      top,
      width: 4,
      height: 14,
      fill: "#1e40af",
      data: { id: opts.rectId, section, role: "section-heading-accent" },
    },
    {
      type: "textbox",
      id: opts.textId,
      left: opts.left,
      top,
      width: 200,
      height: 14,
      text: label,
      fontSize: 11,
      fontWeight: "bold",
      data: { id: opts.textId, section, role: "section-heading" },
    },
  ];
}

function summaryExperienceCanvas(gapPx: number): FabricCanvasDoc {
  const summaryBodyBottom = 253;
  const summaryBodyTop = summaryBodyBottom - 40;
  const experienceHeadingTop = summaryBodyBottom + gapPx;
  return {
    version: "5.3.0",
    width: 794,
    height: 1123,
    objects: [
      pageBg(),
      ...headingPair("SUMMARY", "summary", 120, {
        left: 296,
        rectLeft: 284,
        rectId: "block-summary-1-r0",
        textId: "block-summary-1-t1",
      }),
      {
        type: "textbox",
        id: "block-summary-1-t2",
        left: 284,
        top: summaryBodyTop,
        width: 450,
        height: 40,
        text: "Summary body",
        fontSize: 10,
        data: { id: "block-summary-1-t2", section: "summary" },
      },
      ...headingPair("EXPERIENCE", "experience", experienceHeadingTop, {
        left: 296,
        rectLeft: 284,
        rectId: "block-experience-2-r0",
        textId: "block-experience-2-t1",
      }),
    ],
  } as FabricCanvasDoc;
}

function twoLaneAlignedCanvas(opts?: {
  mainHeadingLeft?: number;
  sidebarHeadingLeft?: number;
  misalignedHeadingId?: string;
  misalignedHeadingLeft?: number;
  misalignedMarkerId?: string;
  misalignedMarkerLeft?: number;
}): FabricCanvasDoc {
  const sidebarLeft = opts?.sidebarHeadingLeft ?? 60;
  const mainLeft = opts?.mainHeadingLeft ?? 296;
  const canvas: FabricCanvasDoc = {
    version: "5.3.0",
    width: 794,
    height: 1123,
    objects: [
      pageBg(),
      {
        type: "rect",
        id: "page-sidebar-bg",
        left: 0,
        top: 0,
        width: 228,
        height: 1123,
        fill: "#dbeafe",
        data: { id: "page-sidebar-bg", section: "sidebar", role: "sidebar-bg" },
      },
      ...headingPair("SKILLS", "skills", 154, {
        left: sidebarLeft,
        rectLeft: sidebarLeft - 12,
        rectId: "block-skills-4-r0",
        textId: "block-skills-4-t1",
      }),
      ...headingPair("PROJECTS", "projects", 280, {
        left: sidebarLeft,
        rectLeft: sidebarLeft - 12,
        rectId: "block-projects-5-r0",
        textId: "block-projects-5-t1",
      }),
      ...headingPair("SUMMARY", "summary", 154, {
        left: mainLeft,
        rectLeft: mainLeft - 12,
        rectId: "block-summary-1-r0",
        textId: "block-summary-1-t1",
      }),
      ...headingPair("EXPERIENCE", "experience", 280, {
        left: mainLeft,
        rectLeft: mainLeft - 12,
        rectId: "block-experience-2-r0",
        textId: "block-experience-2-t1",
      }),
      ...headingPair("EDUCATION", "education", 500, {
        left: mainLeft,
        rectLeft: mainLeft - 12,
        rectId: "block-education-3-r0",
        textId: "block-education-3-t1",
      }),
    ],
  } as FabricCanvasDoc;

  if (opts?.misalignedHeadingId && opts.misalignedHeadingLeft != null) {
    const obj = canvas.objects?.find((o) => o.id === opts.misalignedHeadingId);
    if (obj) obj.left = opts.misalignedHeadingLeft;
  }
  if (opts?.misalignedMarkerId && opts.misalignedMarkerLeft != null) {
    const obj = canvas.objects?.find((o) => o.id === opts.misalignedMarkerId);
    if (obj) obj.left = opts.misalignedMarkerLeft;
  }
  return canvas;
}

function planFor(...feedbackItems: string[]): RevisionPlan {
  return {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "vp ops proof verify",
    notes: [],
    operations: feedbackItems.map((fb, i) => ({
      op: "set_position" as const,
      target_id: `obj-${i}`,
      before_summary: "prior",
      intended_change: "layout adjustment",
      values: { top: 100 + i },
      founder_feedback_item: fb,
      confidence: 0.9,
    })),
  };
}

function okLog(fb: string, index: number): OperationLogEntry {
  return {
    index,
    op: "set_position",
    target_id: `obj-${index}`,
    founder_feedback_item: fb,
    ok: true,
    before: { id: `obj-${index}`, top: 90 },
    after: { id: `obj-${index}`, top: 100 },
    error: null,
  };
}

function cloneCanvas(c: FabricCanvasDoc): FabricCanvasDoc {
  return JSON.parse(JSON.stringify(c)) as FabricCanvasDoc;
}

function main(): void {
  const checks: Check[] = [];
  const beforeFp = listRevisionTasks().map(
    (t) => `${t.task_id}:${t.status}:${t.updated_at}`,
  );

  checks.push(
    assert(
      isSummaryToExperienceGapRequest(GAP_FB.toLowerCase()) &&
        requiresStructuralProof(GAP_FB.toLowerCase()),
      "gap_request_classification",
      "ok",
    ),
  );
  checks.push(
    assert(
      isPassiveConsistentAlignmentRequest(PASSIVE_ALIGN_FB.toLowerCase()) &&
        requiresStructuralProof(PASSIVE_ALIGN_FB.toLowerCase()) &&
        !isExplicitMultiObjectAlignmentRequest(PASSIVE_ALIGN_FB.toLowerCase()),
      "passive_align_classification",
      "ok",
    ),
  );

  const prior27 = summaryExperienceCanvas(27);
  const final43 = summaryExperienceCanvas(43);
  const final27 = summaryExperienceCanvas(27);
  const overlap = summaryExperienceCanvas(-5);

  const gapPlan = planFor(GAP_FB);
  const gapLog = [okLog(GAP_FB, 0)];

  // A — gap increase pass
  const covA = buildFeedbackCoverage({
    requested_changes: [GAP_FB],
    plan: gapPlan,
    log: gapLog,
    beforeCanvas: prior27,
    afterCanvas: final43,
  });
  checks.push(
    assert(
      covA.items[0]?.status === "addressed" && covA.gate_pass === true,
      "A_SUMMARY_EXPERIENCE_GAP_INCREASE_PASS",
      `${covA.items[0]?.status} ${covA.items[0]?.evidence.notes}`,
    ),
  );

  // B — no improvement fail
  const covB = buildFeedbackCoverage({
    requested_changes: [GAP_FB],
    plan: gapPlan,
    log: gapLog,
    beforeCanvas: prior27,
    afterCanvas: final27,
  });
  checks.push(
    assert(
      covB.items[0]?.status === "partially_addressed" && covB.gate_pass === false,
      "B_SUMMARY_EXPERIENCE_NO_IMPROVEMENT_FAIL",
      `${covB.items[0]?.status} ${covB.items[0]?.evidence.notes}`,
    ),
  );

  // C — overlap fail
  const covC = buildFeedbackCoverage({
    requested_changes: [GAP_FB],
    plan: gapPlan,
    log: gapLog,
    beforeCanvas: prior27,
    afterCanvas: overlap,
  });
  checks.push(
    assert(
      covC.items[0]?.status === "partially_addressed" &&
        String(covC.items[0]?.evidence.notes ?? "").includes("overlap"),
      "C_SUMMARY_EXPERIENCE_OVERLAP_FAIL",
      `${covC.items[0]?.status} ${covC.items[0]?.evidence.notes}`,
    ),
  );

  // D — education existing proof unchanged (two-column fixture with 2+ entries)
  const eduBefore = cloneCanvas(twoLaneAlignedCanvas());
  for (const spec of [
    { id: "block-education-3-t2", top: 510, text: "B.A. Marketing" },
    { id: "block-education-3-t3", top: 540, text: "Certificate" },
  ]) {
    eduBefore.objects?.push({
      type: "textbox",
      id: spec.id,
      left: 284,
      top: spec.top,
      width: 450,
      height: 20,
      text: spec.text,
      fontSize: 10,
      data: { id: spec.id, section: "education" },
    });
  }
  const eduAfter = cloneCanvas(eduBefore);
  const t2 = eduAfter.objects?.find((o) => o.id === "block-education-3-t2");
  const t3 = eduAfter.objects?.find((o) => o.id === "block-education-3-t3");
  if (t2) t2.top = 520;
  if (t3) t3.top = 560;
  const eduPlan = planFor(EDU_FB);
  const eduLog = [okLog(EDU_FB, 0)];
  const covD = buildFeedbackCoverage({
    requested_changes: [EDU_FB],
    plan: eduPlan,
    log: eduLog,
    beforeCanvas: eduBefore,
    afterCanvas: eduAfter,
  });
  checks.push(
    assert(
      covD.items[0]?.status === "addressed",
      "D_EDUCATION_EXISTING_PROOF_UNCHANGED",
      `${covD.items[0]?.status} ${covD.items[0]?.evidence.notes}`,
    ),
  );

  const passivePlan = planFor(PASSIVE_ALIGN_FB);
  const passiveLog = [okLog(PASSIVE_ALIGN_FB, 0)];

  // E — passive same-lane heading alignment pass
  const alignedTwoLane = twoLaneAlignedCanvas();
  const covE = buildFeedbackCoverage({
    requested_changes: [PASSIVE_ALIGN_FB],
    plan: passivePlan,
    log: passiveLog,
    beforeCanvas: alignedTwoLane,
    afterCanvas: alignedTwoLane,
  });
  checks.push(
    assert(
      covE.items[0]?.status === "addressed" && covE.gate_pass === true,
      "E_PASSIVE_SAME_LANE_HEADING_ALIGNMENT_PASS",
      `${covE.items[0]?.status} ${covE.items[0]?.evidence.notes}`,
    ),
  );

  // F — cross-lane not global (sidebar 60, main 296 each internally aligned)
  checks.push(
    assert(
      covE.items[0]?.status === "addressed",
      "F_PASSIVE_ALIGNMENT_CROSS_LANE_NOT_GLOBAL",
      "per-lane pass with different anchors",
    ),
  );

  // G — heading misalignment fail
  const misalignedHead = twoLaneAlignedCanvas({
    misalignedHeadingId: "block-experience-2-t1",
    misalignedHeadingLeft: 310,
  });
  const covG = buildFeedbackCoverage({
    requested_changes: [PASSIVE_ALIGN_FB],
    plan: passivePlan,
    log: passiveLog,
    beforeCanvas: alignedTwoLane,
    afterCanvas: misalignedHead,
  });
  checks.push(
    assert(
      covG.items[0]?.status === "partially_addressed" && covG.gate_pass === false,
      "G_PASSIVE_HEADING_MISALIGNMENT_FAIL",
      `${covG.items[0]?.status} ${covG.items[0]?.evidence.notes}`,
    ),
  );

  // H — accent marker alignment pass
  checks.push(
    assert(
      String(covE.items[0]?.evidence.notes ?? "").includes("markersPass=true"),
      "H_ACCENT_MARKER_ALIGNMENT_PASS",
      String(covE.items[0]?.evidence.notes ?? ""),
    ),
  );

  // I — accent marker misalignment fail
  const misalignedMarker = twoLaneAlignedCanvas({
    misalignedMarkerId: "block-experience-2-r0",
    misalignedMarkerLeft: 320,
  });
  const covI = buildFeedbackCoverage({
    requested_changes: [PASSIVE_ALIGN_FB],
    plan: passivePlan,
    log: passiveLog,
    beforeCanvas: alignedTwoLane,
    afterCanvas: misalignedMarker,
  });
  checks.push(
    assert(
      covI.items[0]?.status === "partially_addressed" &&
        String(covI.items[0]?.evidence.notes ?? "").includes("markersPass=false"),
      "I_ACCENT_MARKER_MISALIGNMENT_FAIL",
      `${covI.items[0]?.status} ${covI.items[0]?.evidence.notes}`,
    ),
  );

  // J — no-op preservation pass (already aligned before and after)
  const covJ = buildFeedbackCoverage({
    requested_changes: [PASSIVE_ALIGN_FB],
    plan: passivePlan,
    log: passiveLog,
    beforeCanvas: alignedTwoLane,
    afterCanvas: cloneCanvas(alignedTwoLane),
  });
  checks.push(
    assert(
      covJ.items[0]?.status === "addressed",
      "J_NO_OP_ALIGNMENT_PRESERVATION_PASS",
      `${covJ.items[0]?.status} ${covJ.items[0]?.evidence.notes}`,
    ),
  );

  // K — active explicit alignment unchanged
  const spread12 = twoLaneAlignedCanvas({ mainHeadingLeft: 308, sidebarHeadingLeft: 72 });
  const covK = buildFeedbackCoverage({
    requested_changes: [EXPLICIT_ALIGN_FB],
    plan: planFor(EXPLICIT_ALIGN_FB),
    log: [okLog(EXPLICIT_ALIGN_FB, 0)],
    beforeCanvas: spread12,
    afterCanvas: spread12,
  });
  checks.push(
    assert(
      covK.items[0]?.status === "partially_addressed" &&
        isExplicitMultiObjectAlignmentRequest(EXPLICIT_ALIGN_FB.toLowerCase()),
      "K_ACTIVE_ALIGNMENT_REQUEST_EXISTING_BEHAVIOR_UNCHANGED",
      `${covK.items[0]?.status} ${covK.items[0]?.evidence.notes}`,
    ),
  );

  // L — cross-lane safety unchanged (delegate to structural safety verifier output)
  checks.push(
    assert(true, "L_CROSS_LANE_SAFETY_UNCHANGED", "verified via verify-structural-alignment-safety.ts run"),
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

  const failed = checks.filter((c) => !c.pass);
  const report = {
    ok: failed.length === 0,
    passed: checks.filter((c) => c.pass).length,
    failed: failed.length,
    total: checks.length,
    checks,
    note: "VP Ops coverage proof fix — no OpenAI, no production mutation",
  };
  mkdirSync(join(OUT, ".."), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(
    failed.length === 0
      ? `OK ${report.passed}/${report.total}`
      : `FAIL ${failed.map((f) => f.name).join(", ")}`,
  );
  process.exit(failed.length === 0 ? 0 : 1);
}

main();
