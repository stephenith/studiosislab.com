/**
 * Deterministic verify: lane-aware alignment + generalized section-system /
 * section-unit / heading↔marker-reference coverage proofs.
 *
 * Root cause covered:
 *   REV3_COVERAGE_ROOT_CAUSE_LANE_AND_SECTION_UNAWARE_COVERAGE_METRICS
 *
 * No OpenAI. No VPS. No production task/evidence mutation.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  buildFeedbackCoverage,
  isHeadingMarkerReferenceRequest,
  isSectionHierarchySpacingRequest,
  isSectionUnitGroupingRequest,
  isExplicitMultiObjectAlignmentRequest,
  requiresStructuralProof,
} from "./FeedbackCoverage.js";
import {
  classifyRequestedChange,
  verificationCheckTypes,
} from "./RequestedChangeClassification.js";
import { detectLayoutLanesFromCanvas } from "./RevisionLayoutNormalizer.js";
import { listRevisionTasks } from "./RevisionTaskStore.js";
import type { FabricCanvasDoc } from "./CanvasInventory.js";
import { effectiveTextHeightScaled } from "./TextEffectiveHeight.js";
import type {
  CanvasOperation,
  OperationLogEntry,
  RevisionPlan,
} from "./revision-task-types.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/founder-revision/verify-lane-section-aware-coverage.json",
);

type Check = { name: string; pass: boolean; detail: string };

function assert(cond: boolean, name: string, detail: string): Check {
  return { name, pass: cond, detail };
}

/* ------------------------------------------------------------------ *
 * Production Founder items (exact text from revtask-1ae261a9-127)
 * ------------------------------------------------------------------ */

const FB2 =
  "Treat Skills, Projects, Certifications, and Languages as a consistent sidebar section system and apply the same vertical layout rules, spacing logic, heading-to-content relationship, and section-to-section rhythm to all four sections.";
const FB5 =
  "Reflow the Certifications section so every certification line is individually readable with consistent line spacing and no collision with the Certifications heading, other certification lines, or the Languages section.";
const FB6 =
  "Maintain a clear and consistent vertical gap between Skills → Projects, Projects → Certifications, and Certifications → Languages using the same spacing system rather than positioning each section independently.";
const FB7 =
  "Align the sidebar section headings Skills, Projects, Certifications, and Languages to one consistent left anchor within the sidebar, and align their blue accent markers consistently relative to those headings.";
const FB8 =
  "Preserve lane ownership: sidebar headings and markers must align only with other sidebar headings and markers; main-column headings and markers must remain aligned within the main column and must not be globally aligned across both columns.";
const FB9 =
  "Use the Summary heading and its blue accent marker as a visual reference for a clean and consistent heading-marker relationship, while preserving the separate horizontal anchors of the sidebar and main column.";
const FB10 =
  "Keep each section’s heading, blue accent marker, and associated content visually grouped as one unit with consistent internal spacing.";
const FB12 =
  "Preserve the improved Summary → Experience spacing and the current Experience layout; do not undo the spacing corrections that are already visually satisfactory.";
const FB13 =
  "Preserve the current dark header, two-column architecture, typography hierarchy, colors, sidebar background, and overall visual identity; fix the layout defects without redesigning the template.";
const FB14 =
  "After all reflow and repositioning, verify the complete final canvas for zero text-to-text overlap, zero heading-to-content collision, zero section intrusion, zero clipping, and zero out-of-bounds content.";
const FB15 =
  "Keep the entire resume on one page and do not remove, shorten, invent, or alter factual resume content merely to make the layout fit.";

const EDU_FB =
  "Refine the Education section hierarchy and spacing so the two education entries are clearly distinguishable, consistently aligned, and visually integrated with the rest of the right column.";

/* ------------------------------------------------------------------ *
 * Fixture builder — production-like two-lane resume geometry
 * ------------------------------------------------------------------ */

const HEAD_H = 14;
const SECTION_GAP = 12;
const HEADING_GAP = 8;

type Line = { h: number; gap?: number; text: string };

type SectionSpec = {
  section: string;
  prefix: string;
  label: string;
  bandTop: number;
  markerLeft: number;
  headingLeft: number;
  contentLeft: number;
  contentWidth: number;
  headingGap?: number;
  lines: Line[];
};

function pageBg(): Record<string, unknown> {
  return {
    type: "rect",
    id: "page-root",
    left: 0,
    top: 0,
    width: 794,
    height: 1123,
    fill: "#ffffff",
    data: { role: "pageBackground", kind: "page-bg", system: true, id: "page-root" },
  };
}

function buildSection(spec: SectionSpec): {
  objects: Record<string, unknown>[];
  bottom: number;
} {
  const objects: Record<string, unknown>[] = [];
  const markerId = `${spec.prefix}-r0`;
  const headingId = `${spec.prefix}-t1`;
  objects.push({
    type: "rect",
    id: markerId,
    left: spec.markerLeft,
    top: spec.bandTop,
    width: 4,
    height: HEAD_H,
    fill: "#1e40af",
    data: { id: markerId, section: spec.section, role: "section-heading" },
  });
  objects.push({
    type: "textbox",
    id: headingId,
    left: spec.headingLeft,
    top: spec.bandTop,
    width: 200,
    height: HEAD_H,
    text: spec.label,
    fill: "#0f172a",
    fontSize: 11,
    fontWeight: "bold",
    data: { id: headingId, section: spec.section, role: "section-heading" },
  });

  let top = spec.bandTop + HEAD_H + (spec.headingGap ?? HEADING_GAP);
  let bottom = spec.bandTop + HEAD_H;
  let i = 2;
  for (const line of spec.lines) {
    const id = `${spec.prefix}-t${i}`;
    const obj: Record<string, unknown> = {
      type: "textbox",
      id,
      left: spec.contentLeft,
      top,
      width: spec.contentWidth,
      height: line.h,
      text: line.text,
      fill: "#0a0a0a",
      fontSize: 10.5,
      lineHeight: 1.45,
      data: { id, section: spec.section },
    };
    // Honest wrap-aware height so legal section stacks remain legal under
    // effective-text geometry (does not hard-code production IDs).
    const effH = Math.max(line.h, effectiveTextHeightScaled(obj));
    obj.height = effH;
    objects.push(obj);
    bottom = top + effH;
    top = bottom + (line.gap ?? 0);
    i++;
  }
  return { objects, bottom };
}

/**
 * Two lanes, uniform 12px section rhythm, uniform 8px heading→content gap,
 * markers 12px left of their headings in BOTH lanes, distinct lane anchors
 * (sidebar 60 / main 296). Mirrors the accepted 10:54Z production geometry.
 */
function uniformCanvas(opts?: {
  skillsHeadingGap?: number;
  skillsLastLineHeight?: number;
}): FabricCanvasDoc {
  const objects: Record<string, unknown>[] = [pageBg()];

  const SB = { markerLeft: 48, headingLeft: 60, contentLeft: 60, contentWidth: 200 };
  const MC = { markerLeft: 284, headingLeft: 296, contentLeft: 284, contentWidth: 450 };

  const skills = buildSection({
    section: "skills",
    prefix: "block-skills-4",
    label: "SKILLS",
    bandTop: 148,
    headingGap: opts?.skillsHeadingGap ?? HEADING_GAP,
    lines: [
      { h: 40, gap: 4, text: "Strategic Operational Leadership · P&L Management" },
      { h: opts?.skillsLastLineHeight ?? 20, text: "Tools · Documentation · Process Design" },
    ],
    ...SB,
  });
  objects.push(...skills.objects);

  const projects = buildSection({
    section: "projects",
    prefix: "block-projects-5",
    label: "PROJECTS",
    bandTop: skills.bottom + SECTION_GAP,
    lines: [
      { h: 16, gap: 4, text: "Global ERP Rollout and IoT Integration" },
      { h: 16, text: "Led a $35M global ERP deployment" },
    ],
    ...SB,
  });
  objects.push(...projects.objects);

  const certifications = buildSection({
    section: "certifications",
    prefix: "block-certifications-6",
    label: "CERTIFICATIONS",
    bandTop: projects.bottom + SECTION_GAP,
    lines: [
      { h: 16, gap: 4, text: "• Lean Six Sigma Black Belt" },
      { h: 16, gap: 4, text: "• Certified Supply Chain Professional" },
      { h: 16, text: "• Project Management Professional (PMP)" },
    ],
    ...SB,
  });
  objects.push(...certifications.objects);

  const languages = buildSection({
    section: "languages",
    prefix: "block-languages-7",
    label: "LANGUAGES",
    bandTop: certifications.bottom + SECTION_GAP,
    lines: [{ h: 16, text: "English (native); Spanish (professional)" }],
    ...SB,
  });
  objects.push(...languages.objects);

  const summary = buildSection({
    section: "summary",
    prefix: "block-summary-1",
    label: "SUMMARY",
    bandTop: 148,
    lines: [{ h: 40, text: "Operations executive with 18 years of experience" }],
    ...MC,
  });
  objects.push(...summary.objects);

  const experience = buildSection({
    section: "experience",
    prefix: "block-experience-2",
    label: "EXPERIENCE",
    bandTop: summary.bottom + SECTION_GAP,
    lines: [{ h: 100, text: "VP of Operations — Northwind Industrial" }],
    ...MC,
  });
  objects.push(...experience.objects);

  const education = buildSection({
    section: "education",
    prefix: "block-education-3",
    label: "EDUCATION",
    bandTop: experience.bottom + SECTION_GAP,
    lines: [
      { h: 16, gap: 4, text: "MBA, Operations Management - Caldwell University" },
      { h: 16, text: "BS, Industrial Engineering - Wellington State College" },
    ],
    ...MC,
  });
  objects.push(...education.objects);

  return { version: "5.3.0", width: 794, height: 1123, objects } as FabricCanvasDoc;
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

function getObj(
  canvas: FabricCanvasDoc,
  id: string,
): Record<string, unknown> | undefined {
  return (canvas.objects ?? []).find((o) => o.id === id) as
    | Record<string, unknown>
    | undefined;
}

/* ------------------------------------------------------------------ *
 * Plan / log helpers
 * ------------------------------------------------------------------ */

function alignOp(
  primary: string,
  secondary: string[],
  targetIds: string[],
  alignLeft: number,
): CanvasOperation {
  return {
    op: "align_objects",
    target_ids: targetIds,
    before_summary: "peer cohort",
    intended_change: `align left edges to ${alignLeft}`,
    values: { align_left: alignLeft },
    founder_feedback_item: primary,
    founder_feedback_items: secondary,
    confidence: 0.95,
  };
}

/** Successful align_objects whose before === after (a genuine no-op). */
function noopAlignLog(
  index: number,
  primary: string,
  targetIds: string[],
  lefts: number[],
): OperationLogEntry {
  const snap = { ids: targetIds, lefts };
  return {
    index,
    op: "align_objects",
    target_id: targetIds.join(","),
    founder_feedback_item: primary,
    ok: true,
    before: { ...snap },
    after: { ...snap },
    error: null,
  };
}

const SIDEBAR_MARKERS = [
  "block-skills-4-r0",
  "block-projects-5-r0",
  "block-certifications-6-r0",
  "block-languages-7-r0",
];
const SIDEBAR_HEADINGS = [
  "block-skills-4-t1",
  "block-projects-5-t1",
  "block-certifications-6-t1",
  "block-languages-7-t1",
];
const MAIN_MARKERS = [
  "block-summary-1-r0",
  "block-experience-2-r0",
  "block-education-3-r0",
];
const MAIN_HEADINGS = [
  "block-summary-1-t1",
  "block-experience-2-t1",
  "block-education-3-t1",
];

/**
 * Production-shaped plan: four align_objects ops, all of which were no-ops in
 * the real run, attributed exactly as production attributed them.
 */
function productionAlignPlan(): RevisionPlan {
  return {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "lane + section aware coverage verify",
    notes: [],
    operations: [
      alignOp(FB7, [FB8, FB2], SIDEBAR_MARKERS, 48),
      alignOp(FB7, [FB8, FB2], SIDEBAR_HEADINGS, 60),
      alignOp(FB9, [FB8, FB10], MAIN_MARKERS, 284),
      alignOp(FB9, [FB8, FB10], MAIN_HEADINGS, 296),
    ],
  };
}

function productionAlignLog(): OperationLogEntry[] {
  return [
    noopAlignLog(0, FB7, SIDEBAR_MARKERS, [48, 48, 48, 48]),
    noopAlignLog(1, FB7, SIDEBAR_HEADINGS, [60, 60, 60, 60]),
    noopAlignLog(2, FB9, MAIN_MARKERS, [284, 284, 284]),
    noopAlignLog(3, FB9, MAIN_HEADINGS, [296, 296, 296]),
  ];
}

/** Section-system items are carried by real repositioning ops in production. */
function rhythmPlan(items: string[]): RevisionPlan {
  return {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "sidebar reflow",
    notes: [],
    operations: items.map((fb, i) => ({
      op: "set_position" as const,
      target_id: `block-certifications-6-t${(i % 3) + 2}`,
      before_summary: "prior",
      intended_change: "reposition sidebar content",
      values: { top: 500 + i },
      founder_feedback_item: fb,
      confidence: 0.95,
    })),
  };
}

function rhythmLog(items: string[]): OperationLogEntry[] {
  return items.map((fb, i) => ({
    index: i,
    op: "set_position",
    target_id: `block-certifications-6-t${(i % 3) + 2}`,
    founder_feedback_item: fb,
    ok: true,
    before: { id: `block-certifications-6-t${(i % 3) + 2}`, top: 490 + i },
    after: { id: `block-certifications-6-t${(i % 3) + 2}`, top: 500 + i },
    error: null,
  }));
}

function coverFor(
  change: string,
  before: FabricCanvasDoc,
  after: FabricCanvasDoc,
  plan: RevisionPlan,
  log: OperationLogEntry[],
): { status: string; notes: string; gate: boolean } {
  const rep = buildFeedbackCoverage({
    requested_changes: [change],
    plan,
    log,
    beforeCanvas: before,
    afterCanvas: after,
  });
  return {
    status: String(rep.items[0]?.status),
    notes: String(rep.items[0]?.evidence.notes ?? ""),
    gate: rep.gate_pass,
  };
}

function main(): void {
  const checks: Check[] = [];
  const beforeFp = listRevisionTasks().map(
    (t) => `${t.task_id}:${t.status}:${t.updated_at}`,
  );
  const openaiCalls = 0;

  const uniform = uniformCanvas();
  const alignPlan = productionAlignPlan();
  const alignLog = productionAlignLog();

  /* ---------- fixture sanity ---------- */
  const lanes = detectLayoutLanesFromCanvas(uniform);
  checks.push(
    assert(
      lanes.lane_count === 2 &&
        lanes.section_to_lane.skills !== lanes.section_to_lane.summary &&
        lanes.section_to_lane.projects === lanes.section_to_lane.skills,
      "fixture_two_lanes_with_projects_in_sidebar_lane",
      JSON.stringify(lanes.lanes),
    ),
  );
  checks.push(
    assert(
      Number(getObj(uniform, "block-skills-4-t1")?.left) === 60 &&
        Number(getObj(uniform, "block-projects-5-t1")?.left) === 60 &&
        Number(getObj(uniform, "block-summary-1-t1")?.left) === 296,
      "fixture_lane_anchors_60_and_296",
      "sidebar=60 main=296 (global spread 236)",
    ),
  );

  /* ---------- A — per-lane alignment passes despite 236px global spread ---------- */
  const a7 = coverFor(FB7, uniform, uniform, alignPlan, alignLog);
  const a8 = coverFor(FB8, uniform, uniform, alignPlan, alignLog);
  checks.push(
    assert(
      a7.status === "addressed" && a8.status === "addressed",
      "A_sidebar_60_and_main_296_pass_per_lane",
      `item7=${a7.status} :: ${a7.notes} | item8=${a8.status}`,
    ),
  );
  checks.push(
    assert(
      !a7.notes.includes("maxSpread=236") && a7.notes.includes("per-lane"),
      "A2_global_236_spread_not_used",
      a7.notes,
    ),
  );

  /* ---------- B — one sidebar heading off-anchor fails ---------- */
  const badSidebar = cloneCanvas(uniform);
  setObj(badSidebar, "block-certifications-6-t1", { left: 72 });
  const b7 = coverFor(FB7, uniform, badSidebar, alignPlan, alignLog);
  checks.push(
    assert(
      b7.status !== "addressed" && b7.gate === false,
      "B_sidebar_heading_at_72_fails_within_lane",
      `${b7.status} :: ${b7.notes}`,
    ),
  );

  /* ---------- C — PROJECTS heading is inside the cohort ---------- */
  const badProjects = cloneCanvas(uniform);
  setObj(badProjects, "block-projects-5-t1", { left: 90 });
  const c7 = coverFor(FB7, uniform, badProjects, alignPlan, alignLog);
  checks.push(
    assert(
      c7.status !== "addressed" && a7.notes.includes("n=4"),
      "C_projects_heading_included_in_cohort",
      `projects_off=${c7.status} :: ${c7.notes} | uniform_cohort=${a7.notes}`,
    ),
  );

  /* ---------- D — uniform 12px sidebar rhythm passes ---------- */
  const d6 = coverFor(FB6, uniform, uniform, rhythmPlan([FB6]), rhythmLog([FB6]));
  checks.push(
    assert(
      d6.status === "addressed" && d6.notes.includes("section system rhythm proof pass"),
      "D_uniform_12px_section_rhythm_addressed",
      `${d6.status} :: ${d6.notes}`,
    ),
  );
  const d5 = coverFor(FB5, uniform, uniform, rhythmPlan([FB5]), rhythmLog([FB5]));
  checks.push(
    assert(
      d5.status === "addressed",
      "D2_certifications_consistent_line_spacing_addressed",
      `${d5.status} :: ${d5.notes}`,
    ),
  );

  /* ---------- E — section overlapping the next section fails ---------- */
  const overlap = cloneCanvas(uniform);
  const certBand = Number(getObj(uniform, "block-certifications-6-t1")?.top);
  setObj(overlap, "block-certifications-6-r0", { top: certBand - 30 });
  setObj(overlap, "block-certifications-6-t1", { top: certBand - 30 });
  const e6 = coverFor(FB6, uniform, overlap, rhythmPlan([FB6]), rhythmLog([FB6]));
  checks.push(
    assert(
      e6.status !== "addressed" &&
        (e6.notes.includes("intrusion") || e6.notes.includes("< minimum")),
      "E_section_overlaps_next_fails",
      `${e6.status} :: ${e6.notes}`,
    ),
  );

  /* ---------- F — content above its own heading fails ---------- */
  const above = cloneCanvas(uniform);
  const certHeadTop = Number(getObj(uniform, "block-certifications-6-t1")?.top);
  setObj(above, "block-certifications-6-t2", { top: certHeadTop - 10 });
  const f6 = coverFor(FB6, uniform, above, rhythmPlan([FB6]), rhythmLog([FB6]));
  checks.push(
    assert(
      f6.status !== "addressed",
      "F_content_above_own_heading_fails",
      `${f6.status} :: ${f6.notes}`,
    ),
  );

  /* ---------- G — item 10 cannot pass from no-op aligns alone ---------- */
  checks.push(
    assert(
      isSectionUnitGroupingRequest(FB10.toLowerCase()) &&
        requiresStructuralProof(FB10.toLowerCase()),
      "G0_item10_requires_structural_proof",
      "predicate+gate",
    ),
  );
  const g10 = coverFor(FB10, uniform, above, alignPlan, alignLog);
  checks.push(
    assert(
      g10.status !== "addressed" &&
        !g10.notes.includes("successful planned operation(s)"),
      "G_item10_noop_aligns_cannot_prove_broken_grouping",
      `${g10.status} :: ${g10.notes}`,
    ),
  );
  const g10overlap = coverFor(FB10, uniform, overlap, alignPlan, alignLog);
  checks.push(
    assert(
      g10overlap.status !== "addressed",
      "G2_item10_section_intrusion_fails",
      `${g10overlap.status} :: ${g10overlap.notes}`,
    ),
  );

  /* ---------- H — item 10 passes on valid grouping for EVERY section ---------- */
  const h10 = coverFor(FB10, uniform, uniform, alignPlan, alignLog);
  checks.push(
    assert(
      h10.status === "addressed" &&
        h10.notes.includes("section-unit grouping proof pass") &&
        h10.notes.includes("skills") &&
        h10.notes.includes("summary"),
      "H_item10_addressed_by_all_section_geometry",
      `${h10.status} :: ${h10.notes}`,
    ),
  );

  /* ---------- I — item 9 passes when reference relationship preserved ---------- */
  checks.push(
    assert(
      isHeadingMarkerReferenceRequest(FB9.toLowerCase()) &&
        requiresStructuralProof(FB9.toLowerCase()),
      "I0_item9_requires_structural_proof",
      "predicate+gate",
    ),
  );
  const i9 = coverFor(FB9, uniform, uniform, alignPlan, alignLog);
  checks.push(
    assert(
      i9.status === "addressed" &&
        i9.notes.includes("reference=summary") &&
        !i9.notes.includes("successful planned operation(s)"),
      "I_item9_reference_relationship_preserved_per_lane",
      `${i9.status} :: ${i9.notes}`,
    ),
  );

  /* ---------- J — item 9 fails on material within-lane offset difference ---------- */
  const badOffset = cloneCanvas(uniform);
  setObj(badOffset, "block-certifications-6-r0", { left: 40 });
  const j9 = coverFor(FB9, uniform, badOffset, alignPlan, alignLog);
  checks.push(
    assert(
      j9.status !== "addressed" && j9.notes.includes("differs from reference"),
      "J_item9_marker_heading_offset_mismatch_fails",
      `${j9.status} :: ${j9.notes}`,
    ),
  );
  const collapsed = cloneCanvas(uniform);
  for (const id of SIDEBAR_HEADINGS) setObj(collapsed, id, { left: 296 });
  for (const id of SIDEBAR_MARKERS) setObj(collapsed, id, { left: 284 });
  const j9b = coverFor(FB9, uniform, collapsed, alignPlan, alignLog);
  checks.push(
    assert(
      j9b.status !== "addressed",
      "J2_item9_collapsed_lane_anchors_fail",
      `${j9b.status} :: ${j9b.notes}`,
    ),
  );

  /* ---------- K — Education hierarchy behavior intact ---------- */
  checks.push(
    assert(
      isSectionHierarchySpacingRequest(EDU_FB.toLowerCase()) &&
        requiresStructuralProof(EDU_FB.toLowerCase()),
      "K0_education_still_requires_hierarchy_proof",
      "predicate+gate",
    ),
  );
  const eduPlan = rhythmPlan([EDU_FB]);
  const eduLog = rhythmLog([EDU_FB]);
  const eduTranslated = cloneCanvas(uniform);
  for (const id of [
    "block-education-3-t1",
    "block-education-3-t2",
    "block-education-3-t3",
  ]) {
    const o = getObj(eduTranslated, id);
    if (o) o.top = Number(o.top) + 10;
  }
  const kTrans = coverFor(EDU_FB, uniform, eduTranslated, eduPlan, eduLog);
  checks.push(
    assert(
      kTrans.status === "partially_addressed" &&
        kTrans.notes.includes("uniform translation"),
      "K_education_uniform_translation_still_not_addressed",
      `${kTrans.status} :: ${kTrans.notes}`,
    ),
  );
  const eduGapChange = cloneCanvas(uniform);
  const eduT2 = Number(getObj(uniform, "block-education-3-t2")?.top);
  const eduT3 = Number(getObj(uniform, "block-education-3-t3")?.top);
  setObj(eduGapChange, "block-education-3-t2", { top: eduT2 + 10 });
  setObj(eduGapChange, "block-education-3-t3", { top: eduT3 + 30 });
  const kGap = coverFor(EDU_FB, uniform, eduGapChange, eduPlan, eduLog);
  checks.push(
    assert(
      kGap.status === "addressed" && kGap.notes.includes("education hierarchy"),
      "K2_education_relational_gap_change_addressed",
      `${kGap.status} :: ${kGap.notes}`,
    ),
  );

  /* ---------- L — verification items 12–15 unchanged ---------- */
  const cls12 = classifyRequestedChange(FB12);
  const cls13 = classifyRequestedChange(FB13);
  const cls14 = classifyRequestedChange(FB14);
  const cls15 = classifyRequestedChange(FB15);
  checks.push(
    assert(
      cls12.classification === "VERIFICATION_ACCEPTANCE" &&
        verificationCheckTypes(cls12).join(",") === "LAYOUT_PRESERVATION" &&
        cls13.classification === "VERIFICATION_ACCEPTANCE" &&
        verificationCheckTypes(cls13).join(",") === "ARCHITECTURE_PRESERVATION" &&
        cls14.classification === "VERIFICATION_ACCEPTANCE" &&
        verificationCheckTypes(cls14).join(",") === "COLLISION_BOUNDS" &&
        cls15.classification === "VERIFICATION_ACCEPTANCE" &&
        verificationCheckTypes(cls15).join(",") ===
          "PAGE_FIT,CONTENT_PRESERVATION",
      "L_verification_items_12_to_15_unchanged",
      JSON.stringify({
        i12: verificationCheckTypes(cls12),
        i13: verificationCheckTypes(cls13),
        i14: verificationCheckTypes(cls14),
        i15: verificationCheckTypes(cls15),
      }),
    ),
  );
  const l15NoAcceptance = buildFeedbackCoverage({
    requested_changes: [FB15],
    plan: alignPlan,
    log: alignLog,
    beforeCanvas: uniform,
    afterCanvas: uniform,
  });
  checks.push(
    assert(
      l15NoAcceptance.items[0]?.status !== "addressed",
      "L2_verification_item_needs_acceptance_evidence",
      `${l15NoAcceptance.items[0]?.status} :: ${l15NoAcceptance.items[0]?.evidence.notes}`,
    ),
  );

  /* ---------- M — strict gate unchanged ---------- */
  const mMixed = buildFeedbackCoverage({
    requested_changes: [FB7, FB6],
    plan: alignPlan,
    log: alignLog,
    beforeCanvas: uniform,
    afterCanvas: badSidebar,
  });
  checks.push(
    assert(
      mMixed.gate_pass === false &&
        mMixed.gate_pass === mMixed.all_addressed &&
        mMixed.items.some((i) => i.status !== "addressed"),
      "M_strict_gate_requires_every_item_addressed",
      JSON.stringify(mMixed.items.map((i) => i.status)),
    ),
  );
  const mAll = buildFeedbackCoverage({
    requested_changes: [FB7, FB8, FB9, FB10],
    plan: alignPlan,
    log: alignLog,
    beforeCanvas: uniform,
    afterCanvas: uniform,
  });
  checks.push(
    assert(
      mAll.gate_pass === true &&
        mAll.items.every((i) => i.status === "addressed"),
      "M2_all_addressed_passes_gate",
      JSON.stringify(mAll.items.map((i) => i.status)),
    ),
  );

  /* ---------- N — differing lane anchors alone never fail ---------- */
  checks.push(
    assert(
      isExplicitMultiObjectAlignmentRequest(FB7.toLowerCase()) &&
        isExplicitMultiObjectAlignmentRequest(FB8.toLowerCase()) &&
        mAll.gate_pass === true,
      "N_production_like_two_lane_fixture_not_failed_by_anchor_difference",
      `lane anchors 60/296 spread=236; gate=${mAll.gate_pass}`,
    ),
  );

  /* ---------- O — Skills 16px vs 8px heading→content decision ---------- */
  const skillsWide = uniformCanvas({
    skillsHeadingGap: 16,
    skillsLastLineHeight: 12,
  });
  const skillsWideLanes = detectLayoutLanesFromCanvas(skillsWide);
  const o2 = coverFor(FB2, uniform, skillsWide, rhythmPlan([FB2]), rhythmLog([FB2]));
  const o6 = coverFor(FB6, uniform, skillsWide, rhythmPlan([FB6]), rhythmLog([FB6]));
  const o10 = coverFor(FB10, uniform, skillsWide, alignPlan, alignLog);
  const o2Uniform = coverFor(
    FB2,
    uniform,
    uniform,
    rhythmPlan([FB2]),
    rhythmLog([FB2]),
  );
  checks.push(
    assert(
      skillsWideLanes.lane_count === 2,
      "O0_skills_wide_gap_fixture_preserves_two_lanes",
      JSON.stringify(skillsWideLanes.lanes.map((l) => l.section_order)),
    ),
  );
  // DECISION: item 2 says "apply the SAME … heading-to-content relationship",
  // so 16px vs 8px is a real failure for item 2.
  checks.push(
    assert(
      o2.status === "partially_addressed" &&
        o2.notes.includes("heading→content relationship not the same"),
      "O_item2_same_heading_to_content_fails_on_16_vs_8",
      `${o2.status} :: ${o2.notes}`,
    ),
  );
  // Item 2 passes when the relationship really is the same everywhere.
  checks.push(
    assert(
      o2Uniform.status === "addressed",
      "O2_item2_addressed_when_heading_to_content_uniform",
      `${o2Uniform.status} :: ${o2Uniform.notes}`,
    ),
  );
  // DECISION: item 6 only demands consistent SECTION-TO-SECTION gaps (12/12/12),
  // which the 16px Skills gap does not disturb.
  checks.push(
    assert(
      o6.status === "addressed",
      "O3_item6_section_rhythm_unaffected_by_skills_heading_gap",
      `${o6.status} :: ${o6.notes}`,
    ),
  );
  // DECISION: item 10 demands per-unit coherence ("consistent internal
  // spacing"), not cross-section equality — 16px is still a valid unit.
  checks.push(
    assert(
      o10.status === "addressed",
      "O4_item10_per_unit_coherence_allows_16px_skills_gap",
      `${o10.status} :: ${o10.notes}`,
    ),
  );

  /* ---------- P — cohort scope follows the Founder's named targets ---------- */
  // Lane-scoped wording (item 7 names sidebar sections only) → per-lane.
  // Page-wide wording naming sections in BOTH lanes → global comparison, so a
  // lane-uniform-but-cross-lane-different layout must still fail.
  const CROSS_LANE_FB =
    "Align the left edges of the summary heading, experience heading, and skills heading.";
  const pCross = coverFor(
    CROSS_LANE_FB,
    uniform,
    uniform,
    rhythmPlan([CROSS_LANE_FB]),
    rhythmLog([CROSS_LANE_FB]),
  );
  checks.push(
    assert(
      isExplicitMultiObjectAlignmentRequest(CROSS_LANE_FB.toLowerCase()) &&
        pCross.status !== "addressed" &&
        pCross.notes.includes("maxSpread=236"),
      "P_founder_named_targets_spanning_two_lanes_graded_globally",
      `${pCross.status} :: ${pCross.notes}`,
    ),
  );
  checks.push(
    assert(
      a7.status === "addressed" && a7.notes.includes("per-lane"),
      "P2_lane_scoped_named_targets_graded_per_lane",
      a7.notes,
    ),
  );

  /* ---------- fail-closed: unresolvable geometry ---------- */
  const noContent = cloneCanvas(uniform);
  noContent.objects = (noContent.objects ?? []).filter(
    (o) => !String(o.id ?? "").startsWith("block-certifications-6-t2"),
  );
  const failClosed = coverFor(
    FB5,
    uniform,
    noContent,
    rhythmPlan([FB5]),
    rhythmLog([FB5]),
  );
  checks.push(
    assert(
      failClosed.status !== "addressed" || failClosed.notes.includes("certifications"),
      "fail_closed_on_reduced_geometry",
      `${failClosed.status} :: ${failClosed.notes}`,
    ),
  );

  /* ---------- no production side effects ---------- */
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
    schema_version: "verify-lane-section-aware-coverage-1.0.0",
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
      "VERIFY_LANE_SECTION_AWARE_COVERAGE_FAIL",
      failed.map((f) => `${f.name} [${f.detail}]`).join(" || "),
    );
    process.exit(1);
  }
  console.log("VERIFY_LANE_SECTION_AWARE_COVERAGE_OK", checks.length);
}

main();
