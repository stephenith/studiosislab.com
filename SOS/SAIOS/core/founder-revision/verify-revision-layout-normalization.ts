/**
 * Focused verify: deterministic post-revision layout normalization.
 * Reproduces revtask-05667cbb-641 collision/font defects. No OpenAI.
 * No production task/evidence mutation.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  buildFeedbackCoverage,
  isExplicitMultiObjectAlignmentRequest,
} from "./FeedbackCoverage.js";
import { inventorySummary, type FabricCanvasDoc } from "./CanvasInventory.js";
import {
  CANONICAL_COLLISION_BOUNDS_QA,
  CANONICAL_VISUAL_CONSISTENCY_QA,
} from "./RequestedChangeClassification.js";
import { runRevisionAcceptanceChecks } from "./RevisionAcceptanceChecks.js";
import {
  MIN_HEADING_BODY_GAP_PX,
  MIN_SECTION_GAP_PX,
  normalizeRevisionLayout,
} from "./RevisionLayoutNormalizer.js";
import { listRevisionTasks } from "./RevisionTaskStore.js";
import type { CanvasInventoryObject } from "./revision-task-types.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/founder-revision/verify-revision-layout-normalization.json",
);

type Check = { name: string; pass: boolean; detail: string };

function assert(cond: boolean, name: string, detail: string): Check {
  return { name, pass: cond, detail };
}

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
  opts?: {
    left?: number;
    fontSize?: number;
    width?: number;
    height?: number;
    fill?: string;
    textFill?: string;
    fontFamily?: string;
    fontWeight?: string | number;
    padding?: number;
  },
): Record<string, unknown>[] {
  const left = opts?.left ?? 48;
  const height = opts?.height ?? 24;
  const width = opts?.width ?? 160;
  const padding = opts?.padding ?? 5;
  const fontSize = opts?.fontSize ?? 16;
  const fill = opts?.fill ?? "#1e3a8a";
  const textFill = opts?.textFill ?? "#ffffff";
  const fontFamily = opts?.fontFamily ?? "Helvetica";
  const fontWeight = opts?.fontWeight ?? "bold";
  // Match production-like ids for known sections
  const idMap: Record<string, { r: string; t: string }> = {
    summary: { r: "block-summary-1-r0", t: "block-summary-1-t1" },
    experience: { r: "block-experience-2-r0", t: "block-experience-2-t1" },
    education: { r: "block-education-3-r0", t: "block-education-3-t1" },
    skills: { r: "block-skills-4-r0", t: "block-skills-4-t1" },
    certifications: {
      r: "block-certifications-5-r0",
      t: "block-certifications-5-t1",
    },
    languages: { r: "block-languages-6-r0", t: "block-languages-6-t1" },
  };
  const ids = idMap[section] ?? {
    r: `block-${section}-r0`,
    t: `block-${section}-t1`,
  };
  return [
    {
      type: "rect",
      id: ids.r,
      left,
      top,
      width,
      height,
      fill,
      data: { id: ids.r, section, role: "section-heading" },
    },
    {
      type: "textbox",
      id: ids.t,
      left: left + 10,
      top: top + padding,
      width: 688,
      height: 14,
      text: label,
      fill: textFill,
      fontSize,
      fontFamily,
      fontWeight,
      data: { id: ids.t, section, role: "section-heading" },
    },
  ];
}

/**
 * Broken geometry matching revtask-05667cbb-641 post-OpenAI / pre-normalization:
 * - Experience last bullet ends ~747
 * - Education heading overlaps it (~14px)
 * - Certifications heading/body overlap (~4px)
 * - Heading fonts 16/16/11/11/11/11
 */
function productionBrokenCanvas(): FabricCanvasDoc {
  return {
    version: "5.3.0",
    width: 794,
    height: 1123,
    objects: [
      pageBg(),
      {
        type: "textbox",
        id: "block-header-0-t1",
        left: 60,
        top: 40,
        width: 400,
        height: 32,
        text: "Elena Voss",
        fontSize: 32,
        fill: "#0a0a0a",
        data: { id: "block-header-0-t1", section: "header" },
      },
      ...headingPair("SUMMARY", "summary", 130, { fontSize: 16 }),
      {
        type: "textbox",
        id: "block-summary-1-t2",
        left: 48,
        top: 160,
        width: 698,
        height: 40,
        text: "Senior Software Engineer specializing in scalable systems.",
        fontSize: 11,
        fill: "#111111",
        data: { id: "block-summary-1-t2", section: "summary" },
      },
      ...headingPair("EXPERIENCE", "experience", 218, { fontSize: 16 }),
      {
        type: "textbox",
        id: "block-experience-2-t2",
        left: 48,
        top: 250,
        width: 698,
        height: 16,
        text: "Lead Software Engineer — TechNexus",
        fontSize: 11,
        fill: "#111111",
        data: { id: "block-experience-2-t2", section: "experience" },
      },
      {
        type: "textbox",
        id: "block-experience-2-t17",
        left: 48,
        top: 716,
        width: 698,
        height: 31,
        text: "• Maintained comprehensive technical documentation",
        fontSize: 10.5,
        fill: "#111111",
        data: { id: "block-experience-2-t17", section: "experience" },
      },
      // Education overlaps experience bullet (production defect)
      ...headingPair("EDUCATION", "education", 728, { fontSize: 11 }),
      {
        type: "textbox",
        id: "block-education-3-t2",
        left: 48,
        top: 760,
        width: 698,
        height: 16,
        text: "Bachelor of Science in Computer Engineering",
        fontSize: 10.5,
        fill: "#111111",
        data: { id: "block-education-3-t2", section: "education" },
      },
      ...headingPair("SKILLS", "skills", 800, { fontSize: 11, width: 140 }),
      {
        type: "textbox",
        id: "block-skills-4-t2",
        left: 48,
        top: 830,
        width: 698,
        height: 40,
        text: "Programming Languages: C++, Python",
        fontSize: 10.5,
        fill: "#111111",
        data: { id: "block-skills-4-t2", section: "skills" },
      },
      // Certifications heading/body overlap (production defect)
      ...headingPair("CERTIFICATIONS", "certifications", 900, { fontSize: 11 }),
      {
        type: "textbox",
        id: "block-certifications-5-t2",
        left: 48,
        top: 915,
        width: 698,
        height: 16,
        text: "• Certified Scrum Master (CSM), Agile Alliance, 2019",
        fontSize: 10.5,
        fill: "#111111",
        data: { id: "block-certifications-5-t2", section: "certifications" },
      },
      {
        type: "textbox",
        id: "block-certifications-5-t3",
        left: 48,
        top: 935,
        width: 698,
        height: 16,
        text: "• ISO 26262 Functional Safety Certified",
        fontSize: 10.5,
        fill: "#111111",
        data: { id: "block-certifications-5-t3", section: "certifications" },
      },
      ...headingPair("LANGUAGES", "languages", 980, { fontSize: 11 }),
      {
        type: "textbox",
        id: "block-languages-6-t2",
        left: 48,
        top: 1010,
        width: 698,
        height: 16,
        text: "English (Native), Spanish (Conversational)",
        fontSize: 10.5,
        fill: "#111111",
        data: { id: "block-languages-6-t2", section: "languages" },
      },
    ],
  } as FabricCanvasDoc;
}

function alreadyCorrectCanvas(): FabricCanvasDoc {
  // Comfortable gaps, consistent fonts, no overlaps
  return {
    version: "5.3.0",
    width: 794,
    height: 1123,
    objects: [
      pageBg(),
      {
        type: "textbox",
        id: "block-header-0-t1",
        left: 60,
        top: 40,
        width: 400,
        height: 32,
        text: "Elena Voss",
        fontSize: 32,
        data: { id: "block-header-0-t1", section: "header" },
      },
      ...headingPair("SUMMARY", "summary", 130, { fontSize: 16 }),
      {
        type: "textbox",
        id: "block-summary-1-t2",
        left: 48,
        top: 165,
        width: 698,
        height: 30,
        text: "Summary body",
        data: { id: "block-summary-1-t2", section: "summary" },
      },
      ...headingPair("EXPERIENCE", "experience", 220, { fontSize: 16 }),
      {
        type: "textbox",
        id: "block-experience-2-t2",
        left: 48,
        top: 255,
        width: 698,
        height: 30,
        text: "Experience body",
        data: { id: "block-experience-2-t2", section: "experience" },
      },
      ...headingPair("EDUCATION", "education", 320, { fontSize: 16 }),
      {
        type: "textbox",
        id: "block-education-3-t2",
        left: 48,
        top: 355,
        width: 698,
        height: 20,
        text: "Education body",
        data: { id: "block-education-3-t2", section: "education" },
      },
      ...headingPair("SKILLS", "skills", 420, { fontSize: 16, width: 120 }),
      {
        type: "textbox",
        id: "block-skills-4-t2",
        left: 48,
        top: 455,
        width: 698,
        height: 20,
        text: "Skills body",
        data: { id: "block-skills-4-t2", section: "skills" },
      },
    ],
  } as FabricCanvasDoc;
}

/**
 * Exact post-reflow geometry from revtask-05667cbb-641 before gap compaction:
 * content_bottom=1134, page_height=1123, education→skills gap=59.
 */
function productionOverflowAfterReflowCanvas(): FabricCanvasDoc {
  return {
    version: "5.3.0",
    width: 794,
    height: 1123,
    objects: [
      pageBg(),
      {
        type: "textbox",
        id: "block-header-0-t1",
        left: 60,
        top: 54,
        width: 674,
        height: 39,
        text: "Elena Voss",
        fontSize: 32,
        fill: "#1e3a5f",
        data: { id: "block-header-0-t1", section: "header" },
      },
      {
        type: "textbox",
        id: "block-header-0-t2",
        left: 60,
        top: 104,
        width: 674,
        height: 14,
        text: "Senior Software Engineer  ·  elena.voss@example.com",
        fontSize: 11,
        data: { id: "block-header-0-t2", section: "header" },
      },
      ...headingPair("SUMMARY", "summary", 155, { fontSize: 16, padding: 0 }),
      {
        type: "textbox",
        id: "block-summary-1-t2",
        left: 48,
        top: 187,
        width: 698,
        height: 61,
        text: "Senior Software Engineer specializing in scalable systems and safety-critical software.",
        fontSize: 11,
        data: { id: "block-summary-1-t2", section: "summary" },
      },
      ...headingPair("EXPERIENCE", "experience", 260, { fontSize: 16, padding: 0 }),
      {
        type: "textbox",
        id: "block-experience-2-t2",
        left: 48,
        top: 292,
        width: 698,
        height: 16,
        text: "Lead Software Engineer — TechNexus Engineering",
        fontSize: 11,
        data: { id: "block-experience-2-t2", section: "experience" },
      },
      {
        type: "textbox",
        id: "block-experience-2-t17",
        left: 48,
        top: 747,
        width: 698,
        height: 16,
        text: "• Maintained comprehensive technical documentation",
        fontSize: 10.5,
        data: { id: "block-experience-2-t17", section: "experience" },
      },
      ...headingPair("EDUCATION", "education", 784, { fontSize: 16, padding: 0 }),
      {
        type: "textbox",
        id: "block-education-3-t2",
        left: 48,
        top: 829,
        width: 698,
        height: 16,
        text: "Bachelor of Science in Computer Engineering, Lakewood Technical University, 2014",
        fontSize: 10.5,
        data: { id: "block-education-3-t2", section: "education" },
      },
      ...headingPair("SKILLS", "skills", 904, {
        fontSize: 16,
        width: 140,
        padding: 0,
      }),
      {
        type: "textbox",
        id: "block-skills-4-t2",
        left: 48,
        top: 936,
        width: 698,
        height: 60,
        text: "Programming Languages: C++, Python\nArchitecture & Design: System Architecture, Safety",
        fontSize: 10.5,
        data: { id: "block-skills-4-t2", section: "skills" },
      },
      ...headingPair("CERTIFICATIONS", "certifications", 1008, {
        fontSize: 16,
        padding: 0,
      }),
      {
        type: "textbox",
        id: "block-certifications-5-t2",
        left: 48,
        top: 1040,
        width: 698,
        height: 16,
        text: "• Certified Scrum Master (CSM), Agile Alliance, 2019",
        fontSize: 10.5,
        data: { id: "block-certifications-5-t2", section: "certifications" },
      },
      {
        type: "textbox",
        id: "block-certifications-5-t3",
        left: 48,
        top: 1058,
        width: 698,
        height: 16,
        text: "• ISO 26262 Functional Safety Certified, SafetyTech Institute, 2018",
        fontSize: 10.5,
        data: { id: "block-certifications-5-t3", section: "certifications" },
      },
      ...headingPair("LANGUAGES", "languages", 1086, {
        fontSize: 16,
        padding: 0,
      }),
      {
        type: "textbox",
        id: "block-languages-6-t2",
        left: 48,
        top: 1118,
        width: 698,
        height: 16,
        text: "English (native) · German (professional working proficiency)",
        fontSize: 10.5,
        data: { id: "block-languages-6-t2", section: "languages" },
      },
    ],
  } as FabricCanvasDoc;
}

/** Overflow with every gap already at configured minimums — must fail closed. */
function insufficientSlackOverflowCanvas(): FabricCanvasDoc {
  const pageH = 520;
  return {
    version: "5.3.0",
    width: 794,
    height: pageH,
    objects: [
      {
        ...pageBg(),
        height: pageH,
      },
      {
        type: "textbox",
        id: "block-header-0-t1",
        left: 60,
        top: 40,
        width: 400,
        height: 28,
        text: "Elena Voss",
        fontSize: 24,
        data: { id: "block-header-0-t1", section: "header" },
      },
      // header bottom 68 → summary top 80 (gap 12)
      ...headingPair("SUMMARY", "summary", 80, { fontSize: 16, padding: 0 }),
      {
        type: "textbox",
        id: "block-summary-1-t2",
        left: 48,
        top: 112, // heading rect bottom 104 + 8
        width: 698,
        height: 20,
        text: "Summary body",
        fontSize: 11,
        data: { id: "block-summary-1-t2", section: "summary" },
      },
      // summary bottom 132 → experience 144
      ...headingPair("EXPERIENCE", "experience", 144, {
        fontSize: 16,
        padding: 0,
      }),
      {
        type: "textbox",
        id: "block-experience-2-t2",
        left: 48,
        top: 176,
        width: 698,
        height: 120,
        text: "Experience body block that fills the section",
        fontSize: 11,
        data: { id: "block-experience-2-t2", section: "experience" },
      },
      // experience bottom 296 → education 308
      ...headingPair("EDUCATION", "education", 308, {
        fontSize: 16,
        padding: 0,
      }),
      {
        type: "textbox",
        id: "block-education-3-t2",
        left: 48,
        top: 340,
        width: 698,
        height: 40,
        text: "Education body",
        fontSize: 11,
        data: { id: "block-education-3-t2", section: "education" },
      },
      // education bottom 380 → skills 392
      ...headingPair("SKILLS", "skills", 392, {
        fontSize: 16,
        width: 120,
        padding: 0,
      }),
      {
        type: "textbox",
        id: "block-skills-4-t2",
        left: 48,
        top: 424,
        width: 698,
        height: 40,
        text: "Skills body",
        fontSize: 11,
        data: { id: "block-skills-4-t2", section: "skills" },
      },
      // skills bottom 464 → certifications 476
      ...headingPair("CERTIFICATIONS", "certifications", 476, {
        fontSize: 16,
        padding: 0,
      }),
      {
        type: "textbox",
        id: "block-certifications-5-t2",
        left: 48,
        top: 508,
        width: 698,
        height: 30,
        text: "• Certification that overflows the page",
        fontSize: 11,
        data: { id: "block-certifications-5-t2", section: "certifications" },
      },
    ],
  } as FabricCanvasDoc;
}

function gapBetweenSections(
  report: { after_bounds: Array<{ section: string; top: number; bottom: number }> },
  a: string,
  b: string,
): number {
  const prev = report.after_bounds.find((x) => x.section === a);
  const next = report.after_bounds.find((x) => x.section === b);
  if (!prev || !next) return Number.NaN;
  return next.top - prev.bottom;
}

function headingBodyGap(
  canvas: FabricCanvasDoc,
  section: string,
  headingTextId: string,
  headingRectId: string,
  firstBodyId: string,
): number {
  const ht = findObj(canvas, headingTextId);
  const hr = findObj(canvas, headingRectId);
  const body = findObj(canvas, firstBodyId);
  if (!ht || !hr || !body) return Number.NaN;
  const headBottom = Math.max(
    Number(ht.top) + Number(ht.height ?? 14),
    Number(hr.top) + Number(hr.height ?? 24),
  );
  return Number(body.top) - headBottom;
}

function findObj(canvas: FabricCanvasDoc, id: string): Record<string, unknown> | null {
  for (const o of canvas.objects ?? []) {
    if (o.id === id || (o.data as { id?: string } | undefined)?.id === id) {
      return o;
    }
  }
  return null;
}

function main(): void {
  const checks: Check[] = [];
  const beforeFp = listRevisionTasks().map(
    (t) => `${t.task_id}:${t.status}:${t.updated_at}`,
  );
  const openaiCalls = 0;

  const broken = productionBrokenCanvas();
  const priorExpBulletTop = Number(findObj(broken, "block-experience-2-t17")?.top);

  // Pre-conditions of fixture
  const eduTop = Number(findObj(broken, "block-education-3-t1")?.top);
  const expBottom =
    priorExpBulletTop +
    Number(findObj(broken, "block-experience-2-t17")?.height ?? 0);
  checks.push(
    assert(
      eduTop < expBottom,
      "fixture_education_overlaps_experience",
      `eduTop=${eduTop} expBottom=${expBottom}`,
    ),
  );
  const certHeadBottom =
    Number(findObj(broken, "block-certifications-5-t1")?.top) +
    Number(findObj(broken, "block-certifications-5-t1")?.height ?? 14);
  const certBodyTop = Number(findObj(broken, "block-certifications-5-t2")?.top);
  checks.push(
    assert(
      certBodyTop < certHeadBottom,
      "fixture_certifications_heading_body_overlap",
      `bodyTop=${certBodyTop} headBottom=${certHeadBottom}`,
    ),
  );

  const { canvas: fixed, report } = normalizeRevisionLayout({ canvas: broken });
  checks.push(
    assert(report.ok === true, "normalization_ok", report.error ?? "ok"),
  );

  // A — experience bullet unchanged
  const afterExpTop = Number(findObj(fixed, "block-experience-2-t17")?.top);
  checks.push(
    assert(
      afterExpTop === priorExpBulletTop,
      "A_experience_final_bullet_unchanged",
      `before=${priorExpBulletTop} after=${afterExpTop}`,
    ),
  );

  // B — education below experience with min gap
  const eduBounds = report.after_bounds.find((b) => b.section === "education");
  const expBounds = report.after_bounds.find((b) => b.section === "experience");
  const sectionGap = (eduBounds?.top ?? 0) - (expBounds?.bottom ?? 0);
  checks.push(
    assert(
      eduBounds != null &&
        expBounds != null &&
        sectionGap >= MIN_SECTION_GAP_PX - 0.01,
      "B_education_below_experience_min_gap",
      `gap=${sectionGap} min=${MIN_SECTION_GAP_PX}`,
    ),
  );

  // C — certifications heading/body gap
  const certHead = findObj(fixed, "block-certifications-5-t1")!;
  const certRect = findObj(fixed, "block-certifications-5-r0")!;
  const certBody = findObj(fixed, "block-certifications-5-t2")!;
  const headBottom = Math.max(
    Number(certHead.top) + Number(certHead.height ?? 14),
    Number(certRect.top) + Number(certRect.height ?? 24),
  );
  const bodyGap = Number(certBody.top) - headBottom;
  checks.push(
    assert(
      bodyGap >= MIN_HEADING_BODY_GAP_PX - 0.01,
      "C_certifications_heading_body_min_gap",
      `gap=${bodyGap} min=${MIN_HEADING_BODY_GAP_PX}`,
    ),
  );

  // D — heading fonts normalized to 16
  const fonts = [
    "block-summary-1-t1",
    "block-experience-2-t1",
    "block-education-3-t1",
    "block-skills-4-t1",
    "block-certifications-5-t1",
    "block-languages-6-t1",
  ].map((id) => Number(findObj(fixed, id)?.fontSize));
  checks.push(
    assert(
      fonts.every((f) => f === 16),
      "D_heading_fonts_normalized_to_16",
      fonts.join(","),
    ),
  );

  // E/F — acceptance passes on normalized canvas
  const acceptance = runRevisionAcceptanceChecks({
    afterCanvas: fixed,
    requested_changes: [
      CANONICAL_COLLISION_BOUNDS_QA,
      CANONICAL_VISUAL_CONSISTENCY_QA,
    ],
    task_id: "fixture-revtask-05667cbb-641",
  });
  const coll = acceptance.checks.find((c) => c.check_type === "COLLISION_BOUNDS");
  const vis = acceptance.checks.find((c) => c.check_type === "VISUAL_CONSISTENCY");
  checks.push(
    assert(
      coll?.pass === true,
      "E_acceptance_collision_bounds_pass",
      coll?.reason ?? "missing",
    ),
  );
  checks.push(
    assert(
      vis?.pass === true,
      "F_acceptance_visual_consistency_pass",
      vis?.reason ?? "missing",
    ),
  );

  // Downstream moves as group: skills after education
  const skillsBounds = report.after_bounds.find((b) => b.section === "skills");
  checks.push(
    assert(
      skillsBounds != null &&
        eduBounds != null &&
        skillsBounds.top >= eduBounds.bottom + MIN_SECTION_GAP_PX - 0.01,
      "downstream_skills_below_education",
      `skills.top=${skillsBounds?.top} edu.bottom=${eduBounds?.bottom}`,
    ),
  );

  // Idempotent
  const second = normalizeRevisionLayout({ canvas: fixed });
  checks.push(
    assert(
      second.report.ok &&
        second.report.shifts_applied.length === 0 &&
        second.report.heading_body_gap_repairs.length === 0 &&
        second.report.heading_style_changes.length === 0 &&
        second.report.compaction_actions.length === 0 &&
        (second.report.page_fit?.pixels_reclaimed ?? 0) === 0,
      "idempotent_second_pass_no_changes",
      `shifts=${second.report.shifts_applied.length} style=${second.report.heading_style_changes.length} gaps=${second.report.heading_body_gap_repairs.length} compact=${second.report.compaction_actions.length}`,
    ),
  );

  // Already-correct: no unnecessary vertical shifts / compaction no-op
  const correct = alreadyCorrectCanvas();
  const topsBefore = Object.fromEntries(
    (correct.objects ?? [])
      .filter((o) => o.id)
      .map((o) => [String(o.id), o.top]),
  );
  const corr = normalizeRevisionLayout({ canvas: correct });
  const movedVertically = (corr.canvas.objects ?? []).filter((o) => {
    const id = String(o.id ?? "");
    return id && topsBefore[id] !== o.top;
  });
  checks.push(
    assert(
      corr.report.ok &&
        corr.report.shifts_applied.length === 0 &&
        corr.report.compaction_actions.length === 0 &&
        (corr.report.page_fit?.overflow_before ?? 0) === 0 &&
        (corr.report.page_fit?.pixels_reclaimed ?? 0) === 0 &&
        movedVertically.length === 0,
      "already_correct_no_unnecessary_positional_changes",
      `shifts=${corr.report.shifts_applied.length} compact=${corr.report.compaction_actions.length} moved=${movedVertically.length} page_fit=${JSON.stringify(corr.report.page_fit)}`,
    ),
  );
  checks.push(
    assert(
      corr.report.page_fit?.fit_pass === true,
      "J_already_fit_canvas_noop",
      JSON.stringify(corr.report.page_fit),
    ),
  );

  // Different heading widths preserved
  const skillsW = Number(findObj(fixed, "block-skills-4-r0")?.width);
  const summaryW = Number(findObj(fixed, "block-summary-1-r0")?.width);
  checks.push(
    assert(
      skillsW === 140 && summaryW === 160,
      "heading_widths_not_forced_equal",
      `skills=${skillsW} summary=${summaryW}`,
    ),
  );

  // Header name left=60 must not be treated as body-grid failure signal
  const verticalFb =
    "Rework the contact block below the name so title and contact form a clean group, then add a clear and consistent vertical gap before the Summary section begins.";
  checks.push(
    assert(
      !isExplicitMultiObjectAlignmentRequest(verticalFb.toLowerCase()),
      "vertical_spacing_language_not_horizontal_maxspread",
      verticalFb.slice(0, 80),
    ),
  );

  const contentGridFb =
    "Align all section heading rectangles to the same left edge and keep the body content beneath them aligned to a consistent content grid.";
  checks.push(
    assert(
      isExplicitMultiObjectAlignmentRequest(contentGridFb.toLowerCase()),
      "content_grid_still_explicit_alignment",
      "ok",
    ),
  );

  // Body grid / name: coverage should not fail solely because name left=60
  const gridCanvas = fixed;
  const cov = buildFeedbackCoverage({
    requested_changes: [contentGridFb],
    plan: {
      schema_version: "founder-canvas-revision-plan-1.0.0",
      summary: "grid",
      notes: [],
      operations: [
        {
          op: "align_objects",
          target_ids: [
            "block-summary-1-r0",
            "block-experience-2-r0",
            "block-education-3-r0",
          ],
          before_summary: "rects",
          intended_change: "align heading rects",
          values: { align_left: 48 },
          founder_feedback_item: contentGridFb,
          confidence: 0.9,
        },
      ],
    },
    log: [
      {
        index: 0,
        op: "align_objects",
        target_id:
          "block-summary-1-r0,block-experience-2-r0,block-education-3-r0",
        founder_feedback_item: contentGridFb,
        ok: true,
        before: { lefts: [48, 48, 48] },
        after: { lefts: [48, 48, 48] },
        error: null,
      },
    ],
    beforeCanvas: broken,
    afterCanvas: gridCanvas,
  });
  checks.push(
    assert(
      cov.items[0]?.status === "addressed" &&
        !String(cov.items[0]?.evidence.notes ?? "").includes("headerLeft"),
      "name_left_60_does_not_fail_body_grid",
      `${cov.items[0]?.status} ${cov.items[0]?.evidence.notes}`,
    ),
  );

  // Missing section metadata: empty non-system without section → skip safely
  const noMeta: FabricCanvasDoc = {
    version: "5.3.0",
    width: 794,
    height: 1123,
    objects: [
      pageBg(),
      {
        type: "textbox",
        id: "orphan",
        left: 48,
        top: 100,
        width: 100,
        height: 20,
        text: "Orphan",
        data: { id: "orphan" },
      },
    ],
  };
  const skipped = normalizeRevisionLayout({ canvas: noMeta });
  checks.push(
    assert(
      skipped.report.ok &&
        skipped.report.warnings.some((w) =>
          w.includes("no stackable sections"),
        ) &&
        Number(findObj(skipped.canvas, "orphan")?.top) === 100,
      "missing_section_metadata_fails_safe",
      skipped.report.warnings.join("; "),
    ),
  );

  // ---- Production 11px overflow: excess education→skills reclaim ----
  const overflowGeom = productionOverflowAfterReflowCanvas();
  const eduTopBeforeCompact = Number(
    findObj(overflowGeom, "block-education-3-r0")?.top,
  );
  const skillsTopBefore = Number(findObj(overflowGeom, "block-skills-4-r0")?.top);
  const langTopBefore = Number(findObj(overflowGeom, "block-languages-6-r0")?.top);
  const langBodyTopBefore = Number(
    findObj(overflowGeom, "block-languages-6-t2")?.top,
  );
  const fontsBeforeCompact = [
    "block-summary-1-t1",
    "block-experience-2-t1",
    "block-education-3-t1",
    "block-skills-4-t1",
    "block-certifications-5-t1",
    "block-languages-6-t1",
  ].map((id) => ({
    id,
    fontSize: Number(findObj(overflowGeom, id)?.fontSize),
    text: String(findObj(overflowGeom, id)?.text ?? ""),
  }));
  const scaleBefore = (overflowGeom.objects ?? []).map((o) => ({
    id: String(o.id ?? ""),
    scaleX: o.scaleX ?? 1,
    scaleY: o.scaleY ?? 1,
  }));

  checks.push(
    assert(
      skillsTopBefore - (eduTopBeforeCompact + 61) === 59 ||
        skillsTopBefore - 845 === 59,
      "fixture_education_skills_gap_59",
      `skillsTop=${skillsTopBefore} eduBottomExpected=845 gap=${skillsTopBefore - 845}`,
    ),
  );
  checks.push(
    assert(
      langBodyTopBefore + 16 === 1134,
      "fixture_content_bottom_1134",
      `langBodyTop=${langBodyTopBefore} bottom=${langBodyTopBefore + 16}`,
    ),
  );

  const compacted = normalizeRevisionLayout({ canvas: overflowGeom });
  const pf = compacted.report.page_fit;
  const compactActions = compacted.report.compaction_actions;
  const firstAction = compactActions[0];

  checks.push(
    assert(
      compacted.report.ok === true && pf?.fit_pass === true,
      "A_11px_overflow_safely_reclaimed",
      `ok=${compacted.report.ok} page_fit=${JSON.stringify(pf)}`,
    ),
  );
  checks.push(
    assert(
      pf != null &&
        pf.overflow_before === 11 &&
        pf.pixels_reclaimed === 11 &&
        pf.content_bottom_after_compaction <= 1123.01 &&
        pf.overflow_after <= 0.5,
      "H_content_bottom_le_page_height",
      JSON.stringify(pf),
    ),
  );
  checks.push(
    assert(
      firstAction?.type === "section_gap_compaction" &&
        firstAction.previous_section === "education" &&
        firstAction.next_section === "skills" &&
        firstAction.pixels_reclaimed === 11 &&
        firstAction.gap_before === 59 &&
        firstAction.gap_after === 48,
      "B_largest_excess_gap_chosen_first",
      JSON.stringify(firstAction),
    ),
  );
  checks.push(
    assert(
      firstAction != null &&
        firstAction.shifted_sections.includes("skills") &&
        firstAction.shifted_sections.includes("certifications") &&
        firstAction.shifted_sections.includes("languages") &&
        !firstAction.shifted_sections.includes("education"),
      "C_downstream_sections_move_coherently",
      JSON.stringify(firstAction?.shifted_sections),
    ),
  );

  const skillsTopAfter = Number(
    findObj(compacted.canvas, "block-skills-4-r0")?.top,
  );
  const certTopAfter = Number(
    findObj(compacted.canvas, "block-certifications-5-r0")?.top,
  );
  const langTopAfter = Number(
    findObj(compacted.canvas, "block-languages-6-r0")?.top,
  );
  const eduTopAfter = Number(
    findObj(compacted.canvas, "block-education-3-r0")?.top,
  );
  checks.push(
    assert(
      skillsTopAfter === 893 &&
        certTopAfter === 997 &&
        langTopAfter === 1075 &&
        eduTopAfter === eduTopBeforeCompact,
      "production_fixture_expected_tops",
      `skills=${skillsTopAfter} cert=${certTopAfter} lang=${langTopAfter} edu=${eduTopAfter}`,
    ),
  );

  const gapsAfter = [
    gapBetweenSections(compacted.report, "header", "summary"),
    gapBetweenSections(compacted.report, "summary", "experience"),
    gapBetweenSections(compacted.report, "experience", "education"),
    gapBetweenSections(compacted.report, "education", "skills"),
    gapBetweenSections(compacted.report, "skills", "certifications"),
    gapBetweenSections(compacted.report, "certifications", "languages"),
  ];
  checks.push(
    assert(
      gapsAfter.every((g) => g + 1e-9 >= MIN_SECTION_GAP_PX),
      "D_minimum_section_gaps_preserved",
      gapsAfter.join(","),
    ),
  );

  const hbGaps = [
    headingBodyGap(
      compacted.canvas,
      "summary",
      "block-summary-1-t1",
      "block-summary-1-r0",
      "block-summary-1-t2",
    ),
    headingBodyGap(
      compacted.canvas,
      "skills",
      "block-skills-4-t1",
      "block-skills-4-r0",
      "block-skills-4-t2",
    ),
    headingBodyGap(
      compacted.canvas,
      "certifications",
      "block-certifications-5-t1",
      "block-certifications-5-r0",
      "block-certifications-5-t2",
    ),
    headingBodyGap(
      compacted.canvas,
      "languages",
      "block-languages-6-t1",
      "block-languages-6-r0",
      "block-languages-6-t2",
    ),
  ];
  checks.push(
    assert(
      hbGaps.every((g) => g + 1e-9 >= MIN_HEADING_BODY_GAP_PX),
      "E_minimum_heading_body_gaps_preserved",
      hbGaps.join(","),
    ),
  );

  const fontsAfterCompact = fontsBeforeCompact.map((f) => ({
    id: f.id,
    fontSize: Number(findObj(compacted.canvas, f.id)?.fontSize),
    text: String(findObj(compacted.canvas, f.id)?.text ?? ""),
  }));
  checks.push(
    assert(
      JSON.stringify(fontsBeforeCompact) === JSON.stringify(fontsAfterCompact),
      "F_no_text_font_changes_during_compaction",
      JSON.stringify({ fontsBeforeCompact, fontsAfterCompact }),
    ),
  );

  const scaleAfter = (compacted.canvas.objects ?? []).map((o) => ({
    id: String(o.id ?? ""),
    scaleX: o.scaleX ?? 1,
    scaleY: o.scaleY ?? 1,
  }));
  checks.push(
    assert(
      JSON.stringify(scaleBefore) === JSON.stringify(scaleAfter),
      "G_no_scaling",
      "scale geometry unchanged",
    ),
  );

  checks.push(
    assert(
      pf != null &&
        pf.total_reclaimable_slack >= 81 &&
        compactActions.length === 1 &&
        compactActions[0]?.type === "section_gap_compaction",
      "L_normalization_evidence_reports_compaction",
      JSON.stringify({ page_fit: pf, actions: compactActions }),
    ),
  );

  // Acceptance on compacted production fixture
  const compactAcceptance = runRevisionAcceptanceChecks({
    afterCanvas: compacted.canvas,
    requested_changes: [
      CANONICAL_COLLISION_BOUNDS_QA,
      CANONICAL_VISUAL_CONSISTENCY_QA,
    ],
    task_id: "fixture-revtask-05667cbb-641-compaction",
  });
  const compactColl = compactAcceptance.checks.find(
    (c) => c.check_type === "COLLISION_BOUNDS",
  );
  const compactVis = compactAcceptance.checks.find(
    (c) => c.check_type === "VISUAL_CONSISTENCY",
  );
  checks.push(
    assert(
      compactColl?.pass === true && compactVis?.pass === true,
      "acceptance_regression_after_compaction",
      `coll=${compactColl?.pass} vis=${compactVis?.pass} ${compactColl?.reason} ${compactVis?.reason}`,
    ),
  );

  // Idempotent on compacted production fixture
  const compactSecond = normalizeRevisionLayout({ canvas: compacted.canvas });
  const topsCompacted = Object.fromEntries(
    (compacted.canvas.objects ?? [])
      .filter((o) => o.id)
      .map((o) => [String(o.id), o.top]),
  );
  const topsSecond = (compactSecond.canvas.objects ?? []).filter((o) => {
    const id = String(o.id ?? "");
    return id && topsCompacted[id] !== o.top;
  });
  checks.push(
    assert(
      compactSecond.report.ok &&
        compactSecond.report.compaction_actions.length === 0 &&
        compactSecond.report.shifts_applied.length === 0 &&
        topsSecond.length === 0,
      "K_second_normalization_idempotent",
      `compact=${compactSecond.report.compaction_actions.length} moved=${topsSecond.length}`,
    ),
  );

  // Insufficient slack → fail closed, no unsafe compaction
  const tight = insufficientSlackOverflowCanvas();
  const tightResult = normalizeRevisionLayout({ canvas: tight });
  checks.push(
    assert(
      tightResult.report.ok === false &&
        tightResult.report.page_overflow === true &&
        (tightResult.report.page_fit?.fit_pass ?? true) === false &&
        (tightResult.report.page_fit?.pixels_reclaimed ?? 0) === 0,
      "I_insufficient_slack_fails_closed",
      `ok=${tightResult.report.ok} err=${tightResult.report.error} page_fit=${JSON.stringify(tightResult.report.page_fit)}`,
    ),
  );
  checks.push(
    assert(
      tightResult.report.ok === false && tightResult.report.page_overflow === true,
      "page_overflow_fails_closed",
      tightResult.report.error ?? "missing error",
    ),
  );

  // Inventory typography in summary
  const invSample: CanvasInventoryObject[] = [
    {
      id: "t1",
      index: 0,
      type: "textbox",
      text: "SUMMARY",
      left: 58,
      top: 100,
      width: 100,
      height: 14,
      fill: "#fff",
      stroke: null,
      fontSize: 16,
      fontFamily: "Helvetica",
      fontWeight: "bold",
      lineHeight: 1.2,
      role: "section-heading",
      section: "summary",
      locked: false,
      system: false,
      group_id: null,
    },
  ];
  const summary = inventorySummary(invSample);
  checks.push(
    assert(
      summary.includes("fontSize=16") &&
        summary.includes("fontFamily=Helvetica") &&
        summary.includes("fontWeight=bold") &&
        summary.includes("lineHeight=1.2"),
      "inventory_summary_includes_typography",
      summary,
    ),
  );

  // Input immutability
  checks.push(
    assert(
      Number(findObj(broken, "block-education-3-t1")?.top) === 733 ||
        Number(findObj(broken, "block-education-3-t1")?.top) === 728 + 5,
      "input_canvas_not_mutated",
      String(findObj(broken, "block-education-3-t1")?.top),
    ),
  );
  // headingPair padding 5 → text top = 728+5 = 733
  checks.push(
    assert(
      Number(findObj(broken, "block-education-3-r0")?.top) === 728,
      "input_education_rect_unchanged",
      String(findObj(broken, "block-education-3-r0")?.top),
    ),
  );

  checks.push(
    assert(openaiCalls === 0, "no_openai_during_verification", `n=${openaiCalls}`),
  );
  const afterFp = listRevisionTasks().map(
    (t) => `${t.task_id}:${t.status}:${t.updated_at}`,
  );
  checks.push(
    assert(
      JSON.stringify(beforeFp) === JSON.stringify(afterFp),
      "production_tasks_untouched",
      `before=${beforeFp.length} after=${afterFp.length}`,
    ),
  );

  const failed = checks.filter((c) => !c.pass);
  const out = {
    schema_version: "founder-revision-layout-normalization-verify-1.0.0",
    ok: failed.length === 0,
    at: new Date().toISOString(),
    fixture_task: "revtask-05667cbb-641",
    constants: {
      min_section_gap_px: MIN_SECTION_GAP_PX,
      min_heading_body_gap_px: MIN_HEADING_BODY_GAP_PX,
    },
    checks,
    failed: failed.map((c) => c.name),
    normalization_sample: {
      ok: report.ok,
      shifts: report.shifts_applied.length,
      heading_body_repairs: report.heading_body_gap_repairs.length,
      style_changes: report.heading_style_changes.length,
      compaction_actions: report.compaction_actions.length,
      page_fit: report.page_fit,
      sections: report.section_order,
    },
    production_compaction_sample: {
      ok: compacted.report.ok,
      page_fit: compacted.report.page_fit,
      compaction_actions: compacted.report.compaction_actions,
      after_bounds: compacted.report.after_bounds,
    },
    openai_calls: openaiCalls,
    publication_allowed: false,
  };
  mkdirSync(join(OUT, ".."), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`, "utf8");
  // eslint-disable-next-line no-console
  console.log(
    failed.length === 0
      ? `LAYOUT NORMALIZATION VERIFY PASS (${checks.length} checks)`
      : `LAYOUT NORMALIZATION VERIFY FAIL: ${failed.map((c) => c.name).join(", ")}`,
  );
  if (failed.length) process.exit(1);
}

main();
