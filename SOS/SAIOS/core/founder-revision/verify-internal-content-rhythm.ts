/**
 * Deterministic verify: Founder-gated internal content whitespace rhythm.
 *
 * Metric is next.top − current.bottom, never top-to-top pitch.
 * No OpenAI. No VPS. No production task mutation.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { FabricCanvasDoc } from "./CanvasInventory.js";
import { buildFeedbackCoverage } from "./FeedbackCoverage.js";
import {
  isFounderInternalContentRhythmRequest,
  isFounderSectionToSectionGapEqualityRequest,
  MIN_HEADING_BODY_GAP_PX,
  MIN_SECTION_GAP_PX,
  normalizeRevisionLayout,
} from "./RevisionLayoutNormalizer.js";
import { effectiveTextHeightScaled } from "./TextEffectiveHeight.js";
import { applySectionUnitVerticalSafety } from "./SectionUnitVerticalSafety.js";
import { listRevisionTasks } from "./RevisionTaskStore.js";
import type { RevisionPlan } from "./revision-task-types.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/founder-revision/verify-internal-content-rhythm.json",
);

type Check = { name: string; pass: boolean; detail: string };

function assert(cond: boolean, name: string, detail: string): Check {
  return { name, pass: cond, detail };
}

const ITEM2 =
  "Treat Skills, Projects, Certifications, and Languages as a consistent sidebar section system and apply the same vertical layout rules, spacing logic, heading-to-content relationship, and section-to-section rhythm to all four sections.";
const ITEM5 =
  "Reflow the Certifications section so every certification line is individually readable with consistent line spacing and no collision with the Certifications heading, other certification lines, or the Languages section.";
const ITEM6 =
  "Maintain a clear and consistent vertical gap between Skills → Projects, Projects → Certifications, and Certifications → Languages using the same spacing system rather than positioning each section independently.";
const ITEM7 =
  "Align the sidebar section headings Skills, Projects, Certifications, and Languages to one consistent left anchor within the sidebar, and align their blue accent markers consistently relative to those headings.";
const ITEM9 =
  "Use the Summary heading and its blue accent marker as a visual reference for a clean and consistent heading-marker relationship, while preserving the separate horizontal anchors of the sidebar and main column.";
const ITEM10 =
  "Keep each section’s heading, blue accent marker, and associated content visually grouped as one unit with consistent internal spacing.";
const GENERIC_SPACING =
  "Keep consistent section spacing and a clear visual rhythm across the page.";
const GENERIC_READABLE = "Make the Certifications section readable.";

const GAP_NOISE = 2;

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

function objById(
  canvas: FabricCanvasDoc,
  id: string,
): Record<string, unknown> | undefined {
  return (canvas.objects ?? []).find((o) => o.id === id);
}

function emptyPlan(): RevisionPlan {
  return {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "fixture",
    operations: [],
    notes: [],
  };
}

function cover(item: string, before: FabricCanvasDoc, after: FabricCanvasDoc) {
  const rep = buildFeedbackCoverage({
    requested_changes: [item],
    beforeCanvas: before,
    afterCanvas: after,
    plan: emptyPlan(),
    log: [],
  });
  return {
    status: rep.items[0]?.status,
    notes: String(rep.items[0]?.evidence.notes ?? ""),
  };
}

function marker(
  id: string,
  section: string,
  top: number,
  left: number,
): Record<string, unknown> {
  return {
    type: "rect",
    id,
    left,
    top,
    width: 4,
    height: 14,
    fill: "#1e40af",
    data: { id, section, role: "section-marker" },
  };
}

function heading(
  id: string,
  section: string,
  label: string,
  top: number,
  left: number,
): Record<string, unknown> {
  return {
    type: "textbox",
    id,
    left,
    top,
    width: 208,
    height: 14,
    text: label,
    fill: "#0f172a",
    fontSize: 11,
    data: { id, section, role: "section-heading" },
  };
}

function line(
  id: string,
  section: string,
  top: number,
  text: string,
  height = 16,
  left = 48,
  width = 220,
): Record<string, unknown> {
  return {
    type: "textbox",
    id,
    left,
    top,
    width,
    height,
    text,
    fill: "#0a0a0a",
    fontSize: 10.5,
    data: { id, section },
  };
}

function clone(c: FabricCanvasDoc): FabricCanvasDoc {
  return JSON.parse(JSON.stringify(c)) as FabricCanvasDoc;
}

function num(v: unknown): number {
  return Number(v ?? 0);
}

function whitespace(
  canvas: FabricCanvasDoc,
  a: string,
  b: string,
  c: string,
): [number, number] {
  const oa = objById(canvas, a)!;
  const ob = objById(canvas, b)!;
  const oc = objById(canvas, c)!;
  const g1 = num(ob.top) - (num(oa.top) + num(oa.height));
  const g2 = num(oc.top) - (num(ob.top) + num(ob.height));
  return [Number(g1.toFixed(2)), Number(g2.toFixed(2))];
}

function headingContentGap(
  canvas: FabricCanvasDoc,
  headingId: string,
  firstId: string,
): number {
  const h = objById(canvas, headingId)!;
  const f = objById(canvas, firstId)!;
  return Number((num(f.top) - (num(h.top) + num(h.height))).toFixed(2));
}

function sectionGap(
  canvas: FabricCanvasDoc,
  lastId: string,
  nextHeadingId: string,
): number {
  const last = objById(canvas, lastId)!;
  const next = objById(canvas, nextHeadingId)!;
  return Number((num(next.top) - (num(last.top) + num(last.height))).toFixed(2));
}

function spread(gaps: number[]): number {
  return Number((Math.max(...gaps) - Math.min(...gaps)).toFixed(2));
}

/** Compact isolated certs+languages canvas. Heading→first already legal. */
function isolatedCanvas(opts: {
  t2: number;
  t3: number;
  t4: number;
  t2h?: number;
  t3h?: number;
  t4h?: number;
  langsTop?: number;
}): FabricCanvasDoc {
  const t2h = opts.t2h ?? 16;
  const t3h = opts.t3h ?? 16;
  const t4h = opts.t4h ?? 16;
  const langsTop = opts.langsTop ?? 360;
  return {
    version: "5.3.0",
    width: 794,
    height: 1123,
    objects: [
      pageBg(),
      { type: "rect", id: "block-header-0-r0", left: 0, top: 0, width: 794, height: 100, fill: "#0f172a", data: { section: "header" } },
      marker("block-skills-4-r0", "skills", 120, 48),
      heading("block-skills-4-t1", "skills", "SKILLS", 120, 60),
      line("block-skills-4-t2", "skills", 142, "Strategic Operational Leadership", 16),
      marker("block-projects-5-r0", "projects", 170, 48),
      heading("block-projects-5-t1", "projects", "PROJECTS", 170, 60),
      line("block-projects-5-t2", "projects", 192, "Global ERP Rollout", 16),
      marker("block-certifications-6-r0", "certifications", 220, 48),
      heading("block-certifications-6-t1", "certifications", "CERTIFICATIONS", 220, 60),
      line("block-certifications-6-t2", "certifications", opts.t2, "• Lean Six Sigma Black Belt", t2h),
      line("block-certifications-6-t3", "certifications", opts.t3, "• Certified Supply Chain Professional", t3h),
      line("block-certifications-6-t4", "certifications", opts.t4, "• Project Management Professional", t4h),
      marker("block-languages-7-r0", "languages", langsTop, 48),
      heading("block-languages-7-t1", "languages", "LANGUAGES", langsTop, 60),
      line("block-languages-7-t2", "languages", langsTop + 22, "English (native); Spanish (professional)"),
      marker("block-summary-1-r0", "summary", 120, 284),
      heading("block-summary-1-t1", "summary", "SUMMARY", 120, 296),
      line("block-summary-1-t2", "summary", 142, "Strategic VP of Operations", 40, 284, 462),
    ],
  } as FabricCanvasDoc;
}

/** Production-like prior sidebar + main (14:27Z inventory). */
function priorCanvas(): FabricCanvasDoc {
  return {
    version: "5.3.0",
    width: 794,
    height: 1123,
    objects: [
      pageBg(),
      { type: "rect", id: "block-header-0-r0", left: 0, top: 0, width: 794, height: 138, fill: "#0f172a", data: { section: "header" } },
      marker("block-skills-4-r0", "skills", 148, 48),
      heading("block-skills-4-t1", "skills", "SKILLS", 154, 60),
      line("block-skills-4-t2", "skills", 176, "Strategic Operational Leadership", 84),
      line("block-skills-4-t3", "skills", 264, "Tools · Documentation", 46),
      marker("block-projects-5-r0", "projects", 322, 48),
      heading("block-projects-5-t1", "projects", "PROJECTS", 322, 60),
      line("block-projects-5-t2", "projects", 387, "Global ERP Rollout and IoT Integration"),
      line("block-projects-5-t3", "projects", 403, "Led a $35M global ERP deployment", 31),
      line("block-projects-5-t4", "projects", 433, "Warehouse Consolidation"),
      line("block-projects-5-t5", "projects", 449, "Directed consolidation of three regional", 31),
      marker("block-certifications-6-r0", "certifications", 507, 48),
      heading("block-certifications-6-t1", "certifications", "CERTIFICATIONS", 507, 60),
      line("block-certifications-6-t2", "certifications", 529, "• Lean Six Sigma Black Belt"),
      line("block-certifications-6-t3", "certifications", 547.67, "• Certified Supply Chain Professional"),
      line("block-certifications-6-t4", "certifications", 566.33, "• Project Management Professional"),
      marker("block-languages-7-r0", "languages", 594.33, 48),
      heading("block-languages-7-t1", "languages", "LANGUAGES", 594.33, 60),
      line("block-languages-7-t2", "languages", 616.33, "English (native); Spanish (professional)"),
      marker("block-summary-1-r0", "summary", 154, 284),
      heading("block-summary-1-t1", "summary", "SUMMARY", 154, 296),
      line("block-summary-1-t2", "summary", 176, "Strategic VP of Operations", 77, 284, 462),
      marker("block-experience-2-r0", "experience", 290, 284),
      heading("block-experience-2-t1", "experience", "EXPERIENCE", 290, 296),
      line("block-experience-2-t2", "experience", 308, "VP of Operations — Northwind", 80, 284, 462),
      marker("block-education-3-r0", "education", 949.6, 284),
      heading("block-education-3-t1", "education", "EDUCATION", 949.6, 296),
      line("block-education-3-t2", "education", 993, "MBA, Operations Management", 16, 284, 462),
    ],
  } as FabricCanvasDoc;
}

function plannedPostOpCanvas(): FabricCanvasDoc {
  const c = clone(priorCanvas());
  const setTop = (id: string, top: number) => {
    const o = objById(c, id);
    if (o) o.top = top;
  };
  setTop("block-skills-4-t2", 182);
  setTop("block-skills-4-t3", 272);
  setTop("block-projects-5-r0", 290);
  setTop("block-projects-5-t1", 308);
  setTop("block-projects-5-t2", 326);
  setTop("block-projects-5-t3", 342);
  setTop("block-projects-5-t4", 383);
  setTop("block-projects-5-t5", 402);
  setTop("block-certifications-6-r0", 481);
  setTop("block-certifications-6-t2", 510);
  setTop("block-certifications-6-t3", 544);
  setTop("block-certifications-6-t4", 563);
  setTop("block-languages-7-r0", 593);
  setTop("block-languages-7-t2", 610);
  return c;
}

function main(): void {
  const checks: Check[] = [];
  const beforeFp = listRevisionTasks().map(
    (t) => `${t.task_id}:${t.status}:${t.updated_at}`,
  );
  const openaiCalls = 0;

  checks.push(
    assert(
      isFounderInternalContentRhythmRequest(ITEM5),
      "trigger_item5_must_match",
      ITEM5,
    ),
  );
  checks.push(
    assert(
      !isFounderInternalContentRhythmRequest(GENERIC_READABLE) &&
        !isFounderInternalContentRhythmRequest(GENERIC_SPACING) &&
        !isFounderInternalContentRhythmRequest(ITEM2) &&
        !isFounderInternalContentRhythmRequest(ITEM6) &&
        !isFounderInternalContentRhythmRequest(ITEM10),
      "trigger_generic_readable_and_page_spacing_do_not_match",
      "generic/item2/item6/item10",
    ),
  );

  const priorIso = isolatedCanvas({ t2: 242, t3: 260.67, t4: 279.33 });
  const bad18_3 = isolatedCanvas({ t2: 242, t3: 276, t4: 295 });
  const [b1, b2] = whitespace(
    bad18_3,
    "block-certifications-6-t2",
    "block-certifications-6-t3",
    "block-certifications-6-t4",
  );
  checks.push(
    assert(b1 === 18 && b2 === 3, "fixture_18_3_whitespace", `${b1}/${b2}`),
  );

  /* A — 18/3 + ITEM5 → consistent */
  const a = normalizeRevisionLayout({
    canvas: clone(bad18_3),
    requested_changes: [ITEM5],
    prior_canvas: priorIso,
  });
  const aWs = whitespace(
    a.canvas,
    "block-certifications-6-t2",
    "block-certifications-6-t3",
    "block-certifications-6-t4",
  );
  const aAction = a.report.internal_content_rhythm_actions.find(
    (x) => x.section === "certifications",
  );
  checks.push(
    assert(
      a.report.ok &&
        spread(aWs) <= GAP_NOISE &&
        aWs[0] >= 0 &&
        aWs[1] >= 0 &&
        aAction?.canonical_source === "prior_consistent",
      "A_18_3_with_item5_normalizes_to_consistent_whitespace",
      JSON.stringify({ aWs, action: aAction }),
    ),
  );

  /* B — 18/3 without ITEM5 → internal gaps unchanged (heading-body already legal) */
  const b = normalizeRevisionLayout({
    canvas: clone(bad18_3),
    requested_changes: [GENERIC_READABLE],
  });
  const bWs = whitespace(
    b.canvas,
    "block-certifications-6-t2",
    "block-certifications-6-t3",
    "block-certifications-6-t4",
  );
  checks.push(
    assert(
      bWs[0] === 18 &&
        bWs[1] === 3 &&
        b.report.internal_content_rhythm_actions.length === 0,
      "B_18_3_without_spacing_equality_feedback_unchanged",
      JSON.stringify({ bWs, actions: b.report.internal_content_rhythm_actions }),
    ),
  );

  /* C — prior 2.67/2.66 already consistent → not rewritten */
  const cIn = isolatedCanvas({ t2: 242, t3: 260.67, t4: 279.33 });
  const cBefore = whitespace(
    cIn,
    "block-certifications-6-t2",
    "block-certifications-6-t3",
    "block-certifications-6-t4",
  );
  const c = normalizeRevisionLayout({
    canvas: clone(cIn),
    requested_changes: [ITEM5],
    prior_canvas: cIn,
  });
  const cAfterTops = [
    num(objById(c.canvas, "block-certifications-6-t2")?.top),
    num(objById(c.canvas, "block-certifications-6-t3")?.top),
    num(objById(c.canvas, "block-certifications-6-t4")?.top),
  ];
  const cWs = whitespace(
    c.canvas,
    "block-certifications-6-t2",
    "block-certifications-6-t3",
    "block-certifications-6-t4",
  );
  checks.push(
    assert(
      spread(cBefore) <= GAP_NOISE &&
        cAfterTops[0] === 242 &&
        cAfterTops[1] === 260.67 &&
        cAfterTops[2] === 279.33 &&
        c.report.internal_content_rhythm_actions.length === 0,
      "C_prior_2_67_2_66_not_rewritten",
      JSON.stringify({ cBefore, cWs, cAfterTops }),
    ),
  );

  /* D — different heights, equal whitespace → unchanged */
  const dIn = isolatedCanvas({
    t2: 242,
    t3: 266,
    t4: 305,
    t2h: 16,
    t3h: 31,
    t4h: 16,
    langsTop: 400,
  });
  const dWsBefore = whitespace(
    dIn,
    "block-certifications-6-t2",
    "block-certifications-6-t3",
    "block-certifications-6-t4",
  );
  const d = normalizeRevisionLayout({
    canvas: clone(dIn),
    requested_changes: [ITEM5],
  });
  const dTops = [
    num(objById(d.canvas, "block-certifications-6-t2")?.top),
    num(objById(d.canvas, "block-certifications-6-t3")?.top),
    num(objById(d.canvas, "block-certifications-6-t4")?.top),
  ];
  checks.push(
    assert(
      dWsBefore[0] === 8 &&
        dWsBefore[1] === 8 &&
        dTops[0] === 242 &&
        dTops[1] === 266 &&
        dTops[2] === 305,
      "D_different_heights_equal_whitespace_unchanged",
      JSON.stringify({ dWsBefore, dTops }),
    ),
  );

  /* E — different top pitches, equal visual whitespace → consistent */
  const ePitch = [dTops[1]! - dTops[0]!, dTops[2]! - dTops[1]!];
  const eWs = whitespace(
    d.canvas,
    "block-certifications-6-t2",
    "block-certifications-6-t3",
    "block-certifications-6-t4",
  );
  checks.push(
    assert(
      ePitch[0] !== ePitch[1] && spread(eWs) <= GAP_NOISE,
      "E_different_top_pitch_equal_whitespace_treated_consistent",
      JSON.stringify({ ePitch, eWs }),
    ),
  );

  /* F — overlap repaired */
  const fIn = isolatedCanvas({ t2: 242, t3: 250, t4: 270, langsTop: 400 });
  const fBefore = whitespace(
    fIn,
    "block-certifications-6-t2",
    "block-certifications-6-t3",
    "block-certifications-6-t4",
  );
  const f = normalizeRevisionLayout({
    canvas: clone(fIn),
    requested_changes: [ITEM5],
    prior_canvas: priorIso,
  });
  const fWs = whitespace(
    f.canvas,
    "block-certifications-6-t2",
    "block-certifications-6-t3",
    "block-certifications-6-t4",
  );
  checks.push(
    assert(
      fBefore[0] < 0 &&
        f.report.ok &&
        fWs[0] >= 0 &&
        fWs[1] >= 0 &&
        spread(fWs) <= GAP_NOISE,
      "F_negative_whitespace_repaired",
      JSON.stringify({ fBefore, fWs, err: f.report.error }),
    ),
  );

  /* G — first body remains tied to heading */
  const gGap = headingContentGap(
    a.canvas,
    "block-certifications-6-t1",
    "block-certifications-6-t2",
  );
  const gFirst = num(objById(a.canvas, "block-certifications-6-t2")?.top);
  checks.push(
    assert(
      gFirst === 242 && gGap >= MIN_HEADING_BODY_GAP_PX,
      "G_first_body_tied_to_heading_anchor_unchanged",
      `first=${gFirst} gap=${gGap}`,
    ),
  );

  /* H / I — marker and heading unchanged by this pass */
  const hMarkerIn = num(objById(bad18_3, "block-certifications-6-r0")?.top);
  const hHeadIn = num(objById(bad18_3, "block-certifications-6-t1")?.top);
  const hMarkerOut = num(objById(a.canvas, "block-certifications-6-r0")?.top);
  const hHeadOut = num(objById(a.canvas, "block-certifications-6-t1")?.top);
  checks.push(
    assert(
      hMarkerIn === hMarkerOut,
      "H_marker_never_moves_during_content_rhythm",
      `in=${hMarkerIn} out=${hMarkerOut}`,
    ),
  );
  checks.push(
    assert(
      hHeadIn === hHeadOut,
      "I_heading_never_moves_during_content_rhythm",
      `in=${hHeadIn} out=${hHeadOut}`,
    ),
  );

  /* J — lefts unchanged */
  const jIds = [
    "block-certifications-6-t2",
    "block-certifications-6-t3",
    "block-certifications-6-t4",
  ];
  const jOk = jIds.every(
    (id) => num(objById(a.canvas, id)?.left) === num(objById(bad18_3, id)?.left),
  );
  checks.push(assert(jOk, "J_left_coordinates_unchanged", "certs lefts"));

  /* K — text/style unchanged */
  const kOk = jIds.every((id) => {
    const before = objById(bad18_3, id)!;
    const after = objById(a.canvas, id)!;
    return (
      before.text === after.text &&
      before.fill === after.fill &&
      before.fontSize === after.fontSize &&
      before.width === after.width &&
      before.height === after.height
    );
  });
  checks.push(assert(kOk, "K_text_style_unchanged", "certs text/style"));

  /* L — section→next gap remains valid after reflow */
  const lGap = sectionGap(
    a.canvas,
    "block-certifications-6-t4",
    "block-languages-7-t1",
  );
  checks.push(
    assert(
      lGap + 1e-9 >= MIN_SECTION_GAP_PX,
      "L_section_to_next_gap_remains_valid",
      `certs→langs=${lGap}`,
    ),
  );

  /* Production-like replay */
  const prior = priorCanvas();
  const planned = plannedPostOpCanvas();
  const vs = applySectionUnitVerticalSafety({
    priorCanvas: prior,
    afterCanvas: planned,
    requested_changes: [ITEM7, ITEM9, ITEM10],
  });
  const intermediate = normalizeRevisionLayout({
    canvas: vs.canvas,
    requested_changes: [],
  });
  const interWs = whitespace(
    intermediate.canvas,
    "block-certifications-6-t2",
    "block-certifications-6-t3",
    "block-certifications-6-t4",
  );
  const interHeadGap = headingContentGap(
    intermediate.canvas,
    "block-certifications-6-t1",
    "block-certifications-6-t2",
  );
  const production = normalizeRevisionLayout({
    canvas: vs.canvas,
    requested_changes: [ITEM5],
    prior_canvas: prior,
  });
  const pWs = whitespace(
    production.canvas,
    "block-certifications-6-t2",
    "block-certifications-6-t3",
    "block-certifications-6-t4",
  );
  const pHeadGap = headingContentGap(
    production.canvas,
    "block-certifications-6-t1",
    "block-certifications-6-t2",
  );
  const pMarker = num(objById(production.canvas, "block-certifications-6-r0")?.top);
  const pHeading = num(objById(production.canvas, "block-certifications-6-t1")?.top);
  const pLangs = num(objById(production.canvas, "block-languages-7-t1")?.top);
  const pLastBottom =
    num(objById(production.canvas, "block-certifications-6-t4")?.top) +
    num(objById(production.canvas, "block-certifications-6-t4")?.height);
  const pAction = production.report.internal_content_rhythm_actions.find(
    (x) => x.section === "certifications",
  );

  checks.push(
    assert(
      vs.report.ok &&
        interHeadGap + 1e-9 >= MIN_HEADING_BODY_GAP_PX &&
        interWs[0] === 18 &&
        interWs[1] === 3,
      "P_intermediate_after_marker_and_heading_body_still_18_3",
      JSON.stringify({
        interWs,
        interHeadGap,
        t2: num(objById(intermediate.canvas, "block-certifications-6-t2")?.top),
        t3: num(objById(intermediate.canvas, "block-certifications-6-t3")?.top),
        t4: num(objById(intermediate.canvas, "block-certifications-6-t4")?.top),
      }),
    ),
  );
  checks.push(
    assert(
      production.report.ok &&
        pHeadGap + 1e-9 >= MIN_HEADING_BODY_GAP_PX &&
        spread(pWs) <= GAP_NOISE &&
        pWs[0] >= 0 &&
        pWs[1] >= 0 &&
        pLangs >= pLastBottom + MIN_SECTION_GAP_PX - 1e-9 &&
        pMarker === pHeading &&
        pAction?.canonical_source === "prior_consistent" &&
        objById(production.canvas, "block-certifications-6-t2")?.text ===
          objById(prior, "block-certifications-6-t2")?.text,
      "P_production_certs_consistent_whitespace_no_langs_intrusion",
      JSON.stringify({
        pWs,
        pHeadGap,
        pMarker,
        pHeading,
        pLangs,
        pLastBottom,
        action: pAction,
      }),
    ),
  );

  const priorStable = normalizeRevisionLayout({
    canvas: clone(prior),
    requested_changes: [ITEM5],
    prior_canvas: prior,
  });
  const priorWs = whitespace(
    priorStable.canvas,
    "block-certifications-6-t2",
    "block-certifications-6-t3",
    "block-certifications-6-t4",
  );
  checks.push(
    assert(
      spread(priorWs) <= GAP_NOISE &&
        priorWs[0] === 2.67 &&
        priorWs[1] === 2.66 &&
        priorStable.report.internal_content_rhythm_actions.length === 0,
      "C2_production_prior_clean_rhythm_remains_stable",
      JSON.stringify({
        priorWs,
        t2: num(objById(priorStable.canvas, "block-certifications-6-t2")?.top),
        t3: num(objById(priorStable.canvas, "block-certifications-6-t3")?.top),
        t4: num(objById(priorStable.canvas, "block-certifications-6-t4")?.top),
      }),
    ),
  );

  /* M — Founder-gated section-gap equality still works after content reflow */
  const m = normalizeRevisionLayout({
    canvas: vs.canvas,
    requested_changes: [ITEM2, ITEM5, ITEM6],
    prior_canvas: prior,
  });
  const mSp = sectionGap(m.canvas, "block-skills-4-t3", "block-projects-5-t1");
  const mPc = sectionGap(m.canvas, "block-projects-5-t5", "block-certifications-6-t1");
  const mCl = sectionGap(m.canvas, "block-certifications-6-t4", "block-languages-7-t1");
  const mWs = whitespace(
    m.canvas,
    "block-certifications-6-t2",
    "block-certifications-6-t3",
    "block-certifications-6-t4",
  );
  checks.push(
    assert(
      isFounderSectionToSectionGapEqualityRequest(ITEM6) &&
        m.report.ok &&
        spread([mSp, mPc, mCl]) <= GAP_NOISE &&
        spread(mWs) <= GAP_NOISE,
      "M_section_gap_equality_still_works_after_content_rhythm",
      JSON.stringify({ mSp, mPc, mCl, mWs, actions: m.report.section_gap_rhythm_actions }),
    ),
  );

  const noGlobal = normalizeRevisionLayout({
    canvas: clone(bad18_3),
    requested_changes: [GENERIC_SPACING],
  });
  checks.push(
    assert(
      noGlobal.report.section_gap_rhythm_actions.length === 0 &&
        noGlobal.report.internal_content_rhythm_actions.length === 0,
      "M2_no_global_exact_gap_without_founder_request",
      "generic spacing",
    ),
  );

  /* N — page fit */
  checks.push(
    assert(
      production.report.ok &&
        production.report.page_overflow === false &&
        (production.report.page_fit?.fit_pass ?? false) === true,
      "N_page_fit_remains_protected",
      JSON.stringify(production.report.page_fit),
    ),
  );

  /* O — no cross-lane movement */
  checks.push(
    assert(
      num(objById(production.canvas, "block-summary-1-t2")?.left) === 284 &&
        num(objById(production.canvas, "block-certifications-6-t2")?.left) === 48 &&
        num(objById(a.canvas, "block-summary-1-t2")?.left) === 284,
      "O_no_cross_lane_movement",
      "sidebar 48 / main 284",
    ),
  );

  /* Q — item [5] coverage follows geometry */
  const qPartial = cover(ITEM5, prior, intermediate.canvas);
  const qAddressed = cover(ITEM5, prior, production.canvas);
  checks.push(
    assert(
      qPartial.status !== "addressed" &&
        String(qPartial.notes).includes("whitespace"),
      "Q_item5_partial_on_18_3",
      `${qPartial.status} :: ${qPartial.notes}`,
    ),
  );
  checks.push(
    assert(
      qAddressed.status === "addressed" &&
        !String(qAddressed.notes).includes("inconsistent line spacing whitespace"),
      "Q_item5_addressed_only_when_whitespace_consistent",
      `${qAddressed.status} :: ${qAddressed.notes}`,
    ),
  );

  /* n=2 body stack — Skills-shaped reflow must not be skipped */
  const SKILLS_REFLOW =
    "Reflow the Skills content so every line is fully readable and vertically separated within the existing sidebar width.";
  checks.push(
    assert(
      isFounderInternalContentRhythmRequest(SKILLS_REFLOW),
      "n2_skills_reflow_gates_internal_rhythm",
      SKILLS_REFLOW,
    ),
  );
  const longBody =
    "Strategic Operational Leadership  ·  P&L Management  ·  Digital Transformation  ·  Lean Six Sigma & Continuous Improvement  ·  Supply Chain Optimization  ·  Cross-Functional Team Leadership  ·  Budgeting & Forecasting  ·  Predictive Analytics Implementation";
  const n2Canvas: FabricCanvasDoc = {
    version: "5.3.0",
    width: 794,
    height: 1123,
    objects: [
      pageBg(),
      marker("sk-r0", "skills", 150, 48),
      heading("sk-t1", "skills", "SKILLS", 154, 60),
      {
        type: "textbox",
        id: "sk-t2",
        left: 48,
        top: 176,
        width: 220,
        height: 84,
        text: longBody,
        fontSize: 10.5,
        lineHeight: 1.45,
        fill: "#0a0a0a",
        data: { id: "sk-t2", section: "skills", role: "body" },
      },
      {
        type: "textbox",
        id: "sk-t3",
        left: 48,
        top: 264,
        width: 220,
        height: 46,
        text: "Tools  ·  Documentation  ·  Stakeholder Comms  ·  Process Design",
        fontSize: 10.5,
        lineHeight: 1.45,
        fill: "#0a0a0a",
        data: { id: "sk-t3", section: "skills", role: "body" },
      },
    ],
  };
  const n2Norm = normalizeRevisionLayout({
    canvas: n2Canvas,
    requested_changes: [SKILLS_REFLOW],
  });
  const n2T2 = objById(n2Norm.canvas, "sk-t2")!;
  const n2T3 = objById(n2Norm.canvas, "sk-t3")!;
  const n2EffBottom =
    Number(n2T2.top ?? 0) + effectiveTextHeightScaled(n2T2);
  const n2Gap = Number(n2T3.top ?? 0) - n2EffBottom;
  checks.push(
    assert(
      n2Norm.report.ok === true && n2Gap + 1e-9 >= -1,
      "n2_body_stack_clears_effective_overlap",
      `ok=${n2Norm.report.ok} t3.top=${n2T3.top} effBottom=${n2EffBottom} gap=${n2Gap}`,
    ),
  );

  /* Heading→content compact must not leave effective child overlap */
  const compactCanvas: FabricCanvasDoc = {
    version: "5.3.0",
    width: 794,
    height: 1123,
    objects: [
      pageBg(),
      marker("sk-r0b", "skills", 150, 48),
      heading("sk-t1b", "skills", "SKILLS", 154, 60),
      {
        type: "textbox",
        id: "sk-t2b",
        left: 48,
        top: 182,
        width: 220,
        height: 84,
        text: longBody,
        fontSize: 10.5,
        lineHeight: 1.45,
        data: { id: "sk-t2b", section: "skills", role: "body" },
      },
      {
        type: "textbox",
        id: "sk-t3b",
        left: 48,
        top: 270,
        width: 220,
        height: 46,
        text: "Tools  ·  Documentation  ·  Stakeholder Comms",
        fontSize: 10.5,
        lineHeight: 1.45,
        data: { id: "sk-t3b", section: "skills", role: "body" },
      },
      marker("pr-r0b", "projects", 330, 48),
      heading("pr-t1b", "projects", "PROJECTS", 334, 60),
      line("pr-t2b", "projects", 356, "Project One", 16),
      marker("ce-r0b", "certifications", 400, 48),
      heading("ce-t1b", "certifications", "CERTIFICATIONS", 404, 60),
      line("ce-t2b", "certifications", 426, "Cert A", 16),
      line("ce-t3b", "certifications", 450, "Cert B", 16),
      line("ce-t4b", "certifications", 474, "Cert C", 16),
      marker("la-r0b", "languages", 520, 48),
      heading("la-t1b", "languages", "LANGUAGES", 524, 60),
      line("la-t2b", "languages", 546, "English", 16),
    ],
  };
  const compactNorm = normalizeRevisionLayout({
    canvas: compactCanvas,
    requested_changes: [ITEM2, SKILLS_REFLOW],
  });
  const cT2 = objById(compactNorm.canvas, "sk-t2b")!;
  const cT3 = objById(compactNorm.canvas, "sk-t3b")!;
  const cEff =
    Number(cT2.top ?? 0) + effectiveTextHeightScaled(cT2);
  const cGap = Number(cT3.top ?? 0) - cEff;
  checks.push(
    assert(
      compactNorm.report.ok === true && cGap + 1e-9 >= -1,
      "heading_content_compact_no_effective_child_overlap",
      `ok=${compactNorm.report.ok} t3=${cT3.top} effBottom=${cEff} gap=${cGap}`,
    ),
  );

  const afterFp = listRevisionTasks().map(
    (t) => `${t.task_id}:${t.status}:${t.updated_at}`,
  );
  checks.push(
    assert(
      JSON.stringify(beforeFp) === JSON.stringify(afterFp),
      "production_tasks_untouched",
      `${beforeFp.length} fingerprints`,
    ),
  );
  checks.push(assert(openaiCalls === 0, "openai_calls_zero", String(openaiCalls)));
  checks.push(
    assert(
      MIN_HEADING_BODY_GAP_PX === 8 && MIN_SECTION_GAP_PX === 12,
      "gap_constants_unchanged",
      `h=${MIN_HEADING_BODY_GAP_PX} s=${MIN_SECTION_GAP_PX}`,
    ),
  );

  const failed = checks.filter((c) => !c.pass);
  const payload = {
    ok: failed.length === 0,
    passed: checks.filter((c) => c.pass).length,
    failed: failed.length,
    openai_calls: openaiCalls,
    insertion_point:
      "after heading→content equality + stack; before section-gap equality",
    canonical_decision:
      "restore prior consistent collision-free whitespace when current is inconsistent; else mode; else median; never force heading-body 8px onto line gaps",
    intermediate_geometry: {
      heading_content_gap: interHeadGap,
      whitespace: interWs,
    },
    production_final: {
      heading_content_gap: pHeadGap,
      whitespace: pWs,
      canonical_source: pAction?.canonical_source ?? null,
      canonical_gap: pAction?.canonical_gap ?? null,
    },
    checks,
  };
  mkdirSync(join(OUT, ".."), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`);
  if (failed.length) {
    console.error(JSON.stringify(payload, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify(payload, null, 2));
}

main();
