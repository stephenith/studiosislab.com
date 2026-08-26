/**
 * Deterministic verify: Founder-gated heading→content equality across a
 * named same-lane section system.
 *
 * Root cause covered: SIDEBAR_RHYTHM_PLANNER_AND_NORMALIZER_GAP
 * No OpenAI. No VPS. No production task mutation.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { FabricCanvasDoc } from "./CanvasInventory.js";
import {
  isFounderHeadingToContentEqualityRequest,
  MIN_HEADING_BODY_GAP_PX,
  MIN_SECTION_GAP_PX,
  normalizeRevisionLayout,
} from "./RevisionLayoutNormalizer.js";
import { listRevisionTasks } from "./RevisionTaskStore.js";
import { effectiveTextHeightScaled } from "./TextEffectiveHeight.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/founder-revision/verify-founder-section-system-rhythm.json",
);

type Check = { name: string; pass: boolean; detail: string };

function assert(cond: boolean, name: string, detail: string): Check {
  return { name, pass: cond, detail };
}

const ITEM2 =
  "Treat Skills, Projects, Certifications, and Languages as a consistent sidebar section system and apply the same vertical layout rules, spacing logic, heading-to-content relationship, and section-to-section rhythm to all four sections.";
const ITEM6 =
  "Maintain a clear and consistent vertical gap between Skills → Projects, Projects → Certifications, and Certifications → Languages using the same spacing system rather than positioning each section independently.";
const GENERIC_SPACING =
  "Keep consistent section spacing and a clear visual rhythm across the page.";

const HEAD_H = 14;
const SECTION_GAP = 12;

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

type Line = { h: number; text: string };

function buildSection(spec: {
  section: string;
  prefix: string;
  label: string;
  headingTop: number;
  markerTop: number;
  headingGap: number;
  markerLeft: number;
  headingLeft: number;
  contentLeft: number;
  contentWidth: number;
  lines: Line[];
}): { objects: Record<string, unknown>[]; bottom: number } {
  const objects: Record<string, unknown>[] = [
    {
      type: "rect",
      id: `${spec.prefix}-r0`,
      left: spec.markerLeft,
      top: spec.markerTop,
      width: 4,
      height: HEAD_H,
      fill: "#1e40af",
      data: {
        id: `${spec.prefix}-r0`,
        section: spec.section,
        role: "section-marker",
      },
    },
    {
      type: "textbox",
      id: `${spec.prefix}-t1`,
      left: spec.headingLeft,
      top: spec.headingTop,
      width: 200,
      height: HEAD_H,
      text: spec.label,
      fill: "#0f172a",
      fontSize: 11,
      fontWeight: 600,
      lineHeight: 1.2,
      data: { id: `${spec.prefix}-t1`, section: spec.section, role: "section-heading" },
    },
  ];
  let top = spec.headingTop + HEAD_H + spec.headingGap;
  let bottom = spec.headingTop + HEAD_H;
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
      data: { id, section: spec.section },
    };
    const effH = Math.max(line.h, effectiveTextHeightScaled(obj));
    obj.height = effH;
    objects.push(obj);
    bottom = top + effH;
    top = bottom;
    i++;
  }
  return { objects, bottom };
}

function sidebarCanvas(opts: {
  skillsGap: number;
  projectsGap: number;
  certsGap: number;
  langsGap: number;
  skillsMarkerOffset?: number;
  includeMain?: boolean;
  mainHeadingGaps?: [number, number, number];
}): FabricCanvasDoc {
  const SB = {
    markerLeft: 48,
    headingLeft: 60,
    contentLeft: 60,
    contentWidth: 200,
  };
  const objects: Record<string, unknown>[] = [
    pageBg(),
    {
      type: "rect",
      id: "page-sidebar-bg",
      left: 0,
      top: 146,
      width: 268,
      height: 900,
      fill: "#f1f5f9",
      data: { id: "page-sidebar-bg", role: "sidebar-bg" },
    },
  ];

  const skillsMarkerOffset = opts.skillsMarkerOffset ?? 6;
  const skillsHeadingTop = 154;
  const skills = buildSection({
    section: "skills",
    prefix: "block-skills-4",
    label: "SKILLS",
    headingTop: skillsHeadingTop,
    markerTop: skillsHeadingTop - skillsMarkerOffset,
    headingGap: opts.skillsGap,
    lines: [
      { h: 40, text: "Strategic Operational Leadership · P&L Management" },
      { h: 20, text: "Tools · Documentation · Process Design" },
    ],
    ...SB,
  });
  objects.push(...skills.objects);

  const projects = buildSection({
    section: "projects",
    prefix: "block-projects-5",
    label: "PROJECTS",
    headingTop: skills.bottom + SECTION_GAP,
    markerTop: skills.bottom + SECTION_GAP,
    headingGap: opts.projectsGap,
    lines: [
      { h: 16, text: "Global ERP Rollout and IoT Integration" },
      { h: 16, text: "Led a $35M global ERP deployment" },
    ],
    ...SB,
  });
  objects.push(...projects.objects);

  const certs = buildSection({
    section: "certifications",
    prefix: "block-certifications-6",
    label: "CERTIFICATIONS",
    headingTop: projects.bottom + SECTION_GAP,
    markerTop: projects.bottom + SECTION_GAP,
    headingGap: opts.certsGap,
    lines: [
      { h: 16, text: "• Lean Six Sigma Black Belt" },
      { h: 16, text: "• Certified Supply Chain Professional" },
    ],
    ...SB,
  });
  objects.push(...certs.objects);

  const langs = buildSection({
    section: "languages",
    prefix: "block-languages-7",
    label: "LANGUAGES",
    headingTop: certs.bottom + SECTION_GAP,
    markerTop: certs.bottom + SECTION_GAP,
    headingGap: opts.langsGap,
    lines: [{ h: 16, text: "English (native); Spanish (professional)" }],
    ...SB,
  });
  objects.push(...langs.objects);

  if (opts.includeMain !== false) {
    const MC = {
      markerLeft: 284,
      headingLeft: 296,
      contentLeft: 284,
      contentWidth: 450,
    };
    const [sumGap, expGap, eduGap] = opts.mainHeadingGaps ?? [8, 8, 8];
    const summary = buildSection({
      section: "summary",
      prefix: "block-summary-1",
      label: "SUMMARY",
      headingTop: 154,
      markerTop: 154,
      headingGap: sumGap,
      lines: [{ h: 40, text: "Operations executive with 18 years of experience" }],
      ...MC,
    });
    objects.push(...summary.objects);
    const experience = buildSection({
      section: "experience",
      prefix: "block-experience-2",
      label: "EXPERIENCE",
      headingTop: summary.bottom + SECTION_GAP,
      markerTop: summary.bottom + SECTION_GAP,
      headingGap: expGap,
      lines: [{ h: 80, text: "VP of Operations — Northwind Industrial" }],
      ...MC,
    });
    objects.push(...experience.objects);
    const education = buildSection({
      section: "education",
      prefix: "block-education-3",
      label: "EDUCATION",
      headingTop: experience.bottom + SECTION_GAP,
      markerTop: experience.bottom + SECTION_GAP,
      headingGap: eduGap,
      lines: [{ h: 16, text: "MBA, Operations Management" }],
      ...MC,
    });
    objects.push(...education.objects);
  }

  return { version: "5.3.0", width: 794, height: 1123, objects } as FabricCanvasDoc;
}

function oneColumnMixedCanvas(): FabricCanvasDoc {
  const objects: Record<string, unknown>[] = [pageBg()];
  const COL = {
    markerLeft: 40,
    headingLeft: 52,
    contentLeft: 40,
    contentWidth: 700,
  };
  const summary = buildSection({
    section: "summary",
    prefix: "block-summary-1",
    label: "SUMMARY",
    headingTop: 80,
    markerTop: 80,
    headingGap: 12,
    lines: [{ h: 30, text: "Summary body" }],
    ...COL,
  });
  objects.push(...summary.objects);
  const experience = buildSection({
    section: "experience",
    prefix: "block-experience-2",
    label: "EXPERIENCE",
    headingTop: summary.bottom + 24,
    markerTop: summary.bottom + 24,
    headingGap: 20,
    lines: [{ h: 30, text: "Experience body" }],
    ...COL,
  });
  objects.push(...experience.objects);
  return { version: "5.3.0", width: 794, height: 1123, objects } as FabricCanvasDoc;
}

function findObj(
  canvas: FabricCanvasDoc,
  id: string,
): Record<string, unknown> | undefined {
  return (canvas.objects ?? []).find((o) => o.id === id) as
    | Record<string, unknown>
    | undefined;
}

function headingContentGap(canvas: FabricCanvasDoc, headingId: string, bodyId: string): number {
  const h = findObj(canvas, headingId);
  const b = findObj(canvas, bodyId);
  return Number(b?.top) - (Number(h?.top) + Number(h?.height));
}

function sectionGap(
  canvas: FabricCanvasDoc,
  prevLastId: string,
  nextBandId: string,
): number {
  const prev = findObj(canvas, prevLastId);
  const next = findObj(canvas, nextBandId);
  return Number(next?.top) - (Number(prev?.top) + Number(prev?.height));
}

function snapshotLefts(canvas: FabricCanvasDoc, ids: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of ids) out[id] = Number(findObj(canvas, id)?.left);
  return out;
}

function snapshotTops(canvas: FabricCanvasDoc, ids: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of ids) out[id] = Number(findObj(canvas, id)?.top);
  return out;
}

function snapshotText(canvas: FabricCanvasDoc, ids: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const id of ids) out[id] = String(findObj(canvas, id)?.text ?? "");
  return out;
}

const TRACKED_IDS = [
  "block-skills-4-r0",
  "block-skills-4-t1",
  "block-skills-4-t2",
  "block-projects-5-r0",
  "block-projects-5-t1",
  "block-projects-5-t2",
  "block-certifications-6-r0",
  "block-certifications-6-t1",
  "block-certifications-6-t2",
  "block-languages-7-r0",
  "block-languages-7-t1",
  "block-languages-7-t2",
];

function main(): void {
  const checks: Check[] = [];
  const beforeFp = listRevisionTasks().map(
    (t) => `${t.task_id}:${t.status}:${t.updated_at}`,
  );
  const openaiCalls = 0;

  checks.push(
    assert(
      isFounderHeadingToContentEqualityRequest(ITEM2) === true,
      "trigger_item2_heading_to_content_equality",
      ITEM2,
    ),
  );
  checks.push(
    assert(
      isFounderHeadingToContentEqualityRequest(ITEM6) === false &&
        isFounderHeadingToContentEqualityRequest(GENERIC_SPACING) === false,
      "E0_generic_spacing_and_item6_do_not_trigger_predicate",
      "item6 + generic",
    ),
  );

  const fixture16888 = sidebarCanvas({
    skillsGap: 16,
    projectsGap: 8,
    certsGap: 8,
    langsGap: 8,
  });
  const markerBefore = snapshotTops(fixture16888, ["block-skills-4-r0"]);
  const leftsBefore = snapshotLefts(fixture16888, TRACKED_IDS);
  const textBefore = snapshotText(fixture16888, TRACKED_IDS);

  const a = normalizeRevisionLayout({
    canvas: fixture16888,
    requested_changes: [ITEM2],
  });
  const aGaps = [
    headingContentGap(a.canvas, "block-skills-4-t1", "block-skills-4-t2"),
    headingContentGap(a.canvas, "block-projects-5-t1", "block-projects-5-t2"),
    headingContentGap(a.canvas, "block-certifications-6-t1", "block-certifications-6-t2"),
    headingContentGap(a.canvas, "block-languages-7-t1", "block-languages-7-t2"),
  ];
  checks.push(
    assert(
      a.report.ok && aGaps.every((g) => Math.abs(g - 8) < 0.05),
      "A_16_8_8_8_converges_to_8_8_8_8",
      JSON.stringify({ aGaps, actions: a.report.section_system_rhythm_actions }),
    ),
  );

  const bSrc = sidebarCanvas({
    skillsGap: 8,
    projectsGap: 8,
    certsGap: 8,
    langsGap: 8,
    skillsMarkerOffset: 6,
  });
  const b = normalizeRevisionLayout({
    canvas: bSrc,
    requested_changes: [ITEM2],
  });
  checks.push(
    assert(
      b.report.section_system_rhythm_actions.length === 0,
      "B_already_equal_8_zero_body_shifts",
      JSON.stringify(b.report.section_system_rhythm_actions),
    ),
  );

  const cSrc = sidebarCanvas({
    skillsGap: 16,
    projectsGap: 16,
    certsGap: 16,
    langsGap: 16,
  });
  const c = normalizeRevisionLayout({
    canvas: cSrc,
    requested_changes: [ITEM2],
  });
  const cGaps = [
    headingContentGap(c.canvas, "block-skills-4-t1", "block-skills-4-t2"),
    headingContentGap(c.canvas, "block-projects-5-t1", "block-projects-5-t2"),
    headingContentGap(c.canvas, "block-certifications-6-t1", "block-certifications-6-t2"),
    headingContentGap(c.canvas, "block-languages-7-t1", "block-languages-7-t2"),
  ];
  checks.push(
    assert(
      c.report.ok &&
        cGaps.every((g) => Math.abs(g - 16) < 0.05) &&
        c.report.section_system_rhythm_actions.length === 0,
      "C_16_16_16_16_stays_16",
      JSON.stringify({ cGaps, actions: c.report.section_system_rhythm_actions }),
    ),
  );

  const dSrc = sidebarCanvas({
    skillsGap: 16,
    projectsGap: 8,
    certsGap: 8,
    langsGap: 8,
  });
  const d = normalizeRevisionLayout({ canvas: dSrc });
  const dSkills = headingContentGap(d.canvas, "block-skills-4-t1", "block-skills-4-t2");
  checks.push(
    assert(
      Math.abs(dSkills - 16) < 0.05 &&
        d.report.section_system_rhythm_actions.length === 0,
      "D_without_founder_request_16_preserved",
      `skillsGap=${dSkills} actions=${d.report.section_system_rhythm_actions.length}`,
    ),
  );

  const e = normalizeRevisionLayout({
    canvas: sidebarCanvas({
      skillsGap: 16,
      projectsGap: 8,
      certsGap: 8,
      langsGap: 8,
    }),
    requested_changes: [GENERIC_SPACING, ITEM6],
  });
  const eSkills = headingContentGap(e.canvas, "block-skills-4-t1", "block-skills-4-t2");
  checks.push(
    assert(
      Math.abs(eSkills - 16) < 0.05 &&
        e.report.section_system_rhythm_actions.length === 0,
      "E_generic_consistent_spacing_does_not_equalize",
      `skillsGap=${eSkills}`,
    ),
  );

  const fSrc = sidebarCanvas({
    skillsGap: 4,
    projectsGap: 4,
    certsGap: 4,
    langsGap: 2,
  });
  const fNo = normalizeRevisionLayout({ canvas: fSrc });
  const fYes = normalizeRevisionLayout({
    canvas: sidebarCanvas({
      skillsGap: 4,
      projectsGap: 4,
      certsGap: 4,
      langsGap: 2,
    }),
    requested_changes: [ITEM2],
  });
  const fNoGaps = [
    headingContentGap(fNo.canvas, "block-skills-4-t1", "block-skills-4-t2"),
    headingContentGap(fNo.canvas, "block-projects-5-t1", "block-projects-5-t2"),
    headingContentGap(fNo.canvas, "block-certifications-6-t1", "block-certifications-6-t2"),
    headingContentGap(fNo.canvas, "block-languages-7-t1", "block-languages-7-t2"),
  ];
  const fYesGaps = [
    headingContentGap(fYes.canvas, "block-skills-4-t1", "block-skills-4-t2"),
    headingContentGap(fYes.canvas, "block-projects-5-t1", "block-projects-5-t2"),
    headingContentGap(fYes.canvas, "block-certifications-6-t1", "block-certifications-6-t2"),
    headingContentGap(fYes.canvas, "block-languages-7-t1", "block-languages-7-t2"),
  ];
  checks.push(
    assert(
      fNoGaps.every((g) => Math.abs(g - MIN_HEADING_BODY_GAP_PX) < 0.05) &&
        fYesGaps.every((g) => Math.abs(g - MIN_HEADING_BODY_GAP_PX) < 0.05) &&
        fYes.report.section_system_rhythm_actions.length === 0,
      "F_min_floor_4_4_2_to_8_then_equality_is_noop",
      JSON.stringify({ fNoGaps, fYesGaps, actions: fYes.report.section_system_rhythm_actions }),
    ),
  );

  const gSp = sectionGap(a.canvas, "block-skills-4-t3", "block-projects-5-t1");
  const gPc = sectionGap(a.canvas, "block-projects-5-t3", "block-certifications-6-t1");
  const gCl = sectionGap(a.canvas, "block-certifications-6-t3", "block-languages-7-t1");
  checks.push(
    assert(
      gSp + 1e-9 >= MIN_SECTION_GAP_PX &&
        gPc + 1e-9 >= MIN_SECTION_GAP_PX &&
        gCl + 1e-9 >= MIN_SECTION_GAP_PX,
      "G_section_gaps_remain_at_least_12_after_skills_body_up",
      JSON.stringify({ gSp, gPc, gCl }),
    ),
  );
  checks.push(
    assert(
      Math.abs(gSp - 12) < 0.05 && Math.abs(gPc - 12) < 0.05 && Math.abs(gCl - 12) < 0.05,
      "O_production_like_section_rhythm_stays_12",
      JSON.stringify({ gSp, gPc, gCl, aGaps }),
    ),
  );

  const overlaps =
    gSp < 0 ||
    gPc < 0 ||
    gCl < 0 ||
    headingContentGap(a.canvas, "block-skills-4-t1", "block-skills-4-t2") < 0;
  checks.push(assert(!overlaps, "H_no_section_overlap", JSON.stringify({ gSp, gPc, gCl })));

  checks.push(
    assert(
      a.report.ok === true &&
        a.report.page_overflow === false &&
        (a.report.page_fit?.fit_pass ?? false) === true,
      "I_no_page_overflow",
      JSON.stringify({ ok: a.report.ok, overflow: a.report.page_overflow, fit: a.report.page_fit }),
    ),
  );

  const leftsAfter = snapshotLefts(a.canvas, TRACKED_IDS);
  checks.push(
    assert(
      JSON.stringify(leftsBefore) === JSON.stringify(leftsAfter),
      "J_left_coordinates_unchanged",
      JSON.stringify({ leftsBefore, leftsAfter }),
    ),
  );

  const textAfter = snapshotText(a.canvas, TRACKED_IDS);
  checks.push(
    assert(
      JSON.stringify(textBefore) === JSON.stringify(textAfter),
      "K_factual_text_unchanged",
      "ok",
    ),
  );

  const markerAfter = Number(findObj(a.canvas, "block-skills-4-r0")?.top);
  const headingAfter = Number(findObj(a.canvas, "block-skills-4-t1")?.top);
  checks.push(
    assert(
      markerAfter === markerBefore["block-skills-4-r0"] &&
        headingAfter === 154 &&
        markerAfter === 148,
      "L_skills_marker_and_heading_tops_unchanged",
      `marker ${markerBefore["block-skills-4-r0"]}→${markerAfter} heading=${headingAfter}`,
    ),
  );

  const mSrc = oneColumnMixedCanvas();
  const mGapBefore = [
    headingContentGap(mSrc, "block-summary-1-t1", "block-summary-1-t2"),
    headingContentGap(mSrc, "block-experience-2-t1", "block-experience-2-t2"),
  ];
  const m = normalizeRevisionLayout({ canvas: mSrc });
  const mGapAfter = [
    headingContentGap(m.canvas, "block-summary-1-t1", "block-summary-1-t2"),
    headingContentGap(m.canvas, "block-experience-2-t1", "block-experience-2-t2"),
  ];
  checks.push(
    assert(
      m.report.section_system_rhythm_actions.length === 0 &&
        Math.abs(mGapAfter[0]! - mGapBefore[0]!) < 0.05 &&
        Math.abs(mGapAfter[1]! - mGapBefore[1]!) < 0.05,
      "M_one_column_12_20_unchanged_without_trigger",
      JSON.stringify({ mGapBefore, mGapAfter }),
    ),
  );

  const nSrc = sidebarCanvas({
    skillsGap: 8,
    projectsGap: 8,
    certsGap: 8,
    langsGap: 8,
    mainHeadingGaps: [20, 20, 20],
  });
  const n = normalizeRevisionLayout({
    canvas: nSrc,
    requested_changes: [ITEM2],
  });
  const nMain = headingContentGap(n.canvas, "block-summary-1-t1", "block-summary-1-t2");
  checks.push(
    assert(
      Math.abs(nMain - 20) < 0.05,
      "N_unnamed_main_column_intentional_gaps_unchanged",
      `summary heading→content=${nMain}`,
    ),
  );

  checks.push(
    assert(
      a.report.lanes.length === 2 &&
        aGaps.every((g) => Math.abs(g - 8) < 0.05) &&
        Number(findObj(a.canvas, "block-skills-4-t1")?.left) === 60 &&
        Number(findObj(a.canvas, "block-summary-1-t1")?.left) === 296,
      "O2_production_like_lane_ownership_preserved",
      JSON.stringify({
        lanes: a.report.lanes,
        aGaps,
        sb: findObj(a.canvas, "block-skills-4-t1")?.left,
        mc: findObj(a.canvas, "block-summary-1-t1")?.left,
      }),
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
  checks.push(assert(openaiCalls === 0, "no_openai_calls", `n=${openaiCalls}`));

  const failed = checks.filter((c) => !c.pass);
  const report = {
    ok: failed.length === 0,
    schema_version: "verify-founder-section-system-rhythm-1.0.0",
    at: new Date().toISOString(),
    checks,
    failed: failed.map((f) => f.name),
    openai_calls: openaiCalls,
  };
  mkdirSync(join(REPO, "SOS/07_LOGS/saios/founder-revision"), { recursive: true });
  writeFileSync(OUT, JSON.stringify(report, null, 2));
  if (!report.ok) {
    console.error(
      "VERIFY_FOUNDER_SECTION_SYSTEM_RHYTHM_FAIL",
      failed.map((f) => `${f.name} [${f.detail}]`).join(" || "),
    );
    process.exit(1);
  }
  console.log("VERIFY_FOUNDER_SECTION_SYSTEM_RHYTHM_OK", checks.length);
}

main();
