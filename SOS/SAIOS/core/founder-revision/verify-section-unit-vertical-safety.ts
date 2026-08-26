/**
 * Deterministic verify: section-marker is not body; first content is text;
 * marker↔heading Y restored from prior delta or fail closed; coverage refuses
 * detached markers; certification whitespace (not top pitch); Founder-gated
 * section-gap equality.
 *
 * Root cause: PLANNER_MARKER_VERTICAL_DETACHMENT +
 * SECTION_MARKER_MISCLASSIFIED_AS_BODY
 * No OpenAI. No VPS. No production task mutation.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { FabricCanvasDoc } from "./CanvasInventory.js";
import {
  buildFeedbackCoverage,
  isHeadingMarkerReferenceRequest,
  isMarkerHeadingRelativeAlignmentRequest,
  isSectionUnitGroupingRequest,
} from "./FeedbackCoverage.js";
import {
  inspectRevisionSectionGroups,
  isFounderSectionToSectionGapEqualityRequest,
  MIN_HEADING_BODY_GAP_PX,
  MIN_SECTION_GAP_PX,
  normalizeRevisionLayout,
} from "./RevisionLayoutNormalizer.js";
import {
  applySectionUnitVerticalSafety,
  founderRequiresSectionUnitVerticalCoherence,
} from "./SectionUnitVerticalSafety.js";
import { listRevisionTasks } from "./RevisionTaskStore.js";
import type { RevisionPlan } from "./revision-task-types.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/founder-revision/verify-section-unit-vertical-safety.json",
);

type Check = { name: string; pass: boolean; detail: string };

function assert(cond: boolean, name: string, detail: string): Check {
  return { name, pass: cond, detail };
}

const ITEM2 =
  "Treat Skills, Projects, Certifications, and Languages as a consistent sidebar section system and apply the same vertical layout rules, spacing logic, heading-to-content relationship, and section-to-section rhythm to all four sections.";
const ITEM6 =
  "Maintain a clear and consistent vertical gap between Skills → Projects, Projects → Certifications, and Certifications → Languages using the same spacing system rather than positioning each section independently.";
const ITEM7 =
  "Align the sidebar section headings Skills, Projects, Certifications, and Languages to one consistent left anchor within the sidebar, and align their blue accent markers consistently relative to those headings.";
const ITEM9 =
  "Use the Summary heading and its blue accent marker as a visual reference for a clean and consistent heading-marker relationship, while preserving the separate horizontal anchors of the sidebar and main column.";
const ITEM10 =
  "Keep each section’s heading, blue accent marker, and associated content visually grouped as one unit with consistent internal spacing.";
const ITEM5 =
  "Reflow the Certifications section so every certification line is individually readable with consistent line spacing and no collision with the Certifications heading, other certification lines, or the Languages section.";
const GENERIC_SPACING =
  "Keep consistent section spacing and a clear visual rhythm across the page.";

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

function objById(canvas: FabricCanvasDoc, id: string): Record<string, unknown> | undefined {
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

/** 14:27Z planner post-op geometry (detached Projects/Certs markers). */
function plannedPostOpCanvas(): FabricCanvasDoc {
  const c = JSON.parse(JSON.stringify(priorCanvas())) as FabricCanvasDoc;
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

function clone(c: FabricCanvasDoc): FabricCanvasDoc {
  return JSON.parse(JSON.stringify(c)) as FabricCanvasDoc;
}

function main(): void {
  const checks: Check[] = [];
  const beforeFp = listRevisionTasks().map(
    (t) => `${t.task_id}:${t.status}:${t.updated_at}`,
  );
  const openaiCalls = 0;

  const prior = priorCanvas();
  const planned = plannedPostOpCanvas();

  const groups = inspectRevisionSectionGroups(planned);
  const projects = groups.find((g) => g.section === "projects")!;
  const certs = groups.find((g) => g.section === "certifications")!;
  const skills = groups.find((g) => g.section === "skills")!;

  checks.push(
    assert(
      projects.heading_rect_id === "block-projects-5-r0" &&
        !projects.body_ids.includes("block-projects-5-r0") &&
        projects.marker_recognized_by_role,
      "A_projects_section_marker_is_not_body",
      JSON.stringify(projects),
    ),
  );
  checks.push(
    assert(
      projects.first_content_top === 326 &&
        projects.body_ids.includes("block-projects-5-t2"),
      "B_projects_first_content_is_t2_326_not_marker_290",
      JSON.stringify(projects),
    ),
  );
  checks.push(
    assert(
      certs.heading_rect_id === "block-certifications-6-r0" &&
        !certs.body_ids.includes("block-certifications-6-r0") &&
        certs.first_content_top === 510,
      "C_certs_first_content_is_t2_510_not_marker_481",
      JSON.stringify(certs),
    ),
  );

  const normOnly = normalizeRevisionLayout({ canvas: planned });
  const repairs = normOnly.report.heading_body_gap_repairs;
  const pRepair = repairs.find((r) => r.section === "projects");
  const cRepair = repairs.find((r) => r.section === "certifications");
  checks.push(
    assert(
      pRepair != null &&
        Math.abs(pRepair.before_gap - 4) < 0.05 &&
        !pRepair.object_ids.includes("block-projects-5-r0") &&
        pRepair.object_ids.includes("block-projects-5-t2"),
      "D_E_heading_body_floor_uses_true_text_and_does_not_shift_marker",
      JSON.stringify(pRepair),
    ),
  );
  checks.push(
    assert(
      cRepair != null &&
        Math.abs(cRepair.before_gap - -11) < 0.05 &&
        !cRepair.object_ids.includes("block-certifications-6-r0"),
      "D2_certs_true_gap_negative_11_not_fake_minus_40",
      JSON.stringify(cRepair),
    ),
  );

  const markerAfterNorm = Number(objById(normOnly.canvas, "block-projects-5-r0")?.top);
  const headingAfterNorm = Number(objById(normOnly.canvas, "block-projects-5-t1")?.top);
  checks.push(
    assert(
      markerAfterNorm !== headingAfterNorm + 22 &&
        Math.abs(markerAfterNorm - 346) > 1,
      "G_normalization_cannot_produce_22px_below_heading_inversion",
      `marker=${markerAfterNorm} heading=${headingAfterNorm}`,
    ),
  );

  checks.push(
    assert(
      founderRequiresSectionUnitVerticalCoherence([ITEM10, ITEM9, ITEM7]) &&
        !founderRequiresSectionUnitVerticalCoherence([GENERIC_SPACING]),
      "F0_founder_gate_predicates",
      "grouping/reference/relative vs generic",
    ),
  );

  const restored = applySectionUnitVerticalSafety({
    priorCanvas: prior,
    afterCanvas: planned,
    requested_changes: [ITEM10, ITEM9, ITEM7],
  });
  const pMarker = Number(objById(restored.canvas, "block-projects-5-r0")?.top);
  const pHead = Number(objById(restored.canvas, "block-projects-5-t1")?.top);
  const cMarker = Number(objById(restored.canvas, "block-certifications-6-r0")?.top);
  const cHead = Number(objById(restored.canvas, "block-certifications-6-t1")?.top);
  const sMarker = Number(objById(restored.canvas, "block-skills-4-r0")?.top);
  const sHead = Number(objById(restored.canvas, "block-skills-4-t1")?.top);
  checks.push(
    assert(
      restored.report.ok &&
        Math.abs(pMarker - pHead) < 0.05 &&
        Math.abs(cMarker - cHead) < 0.05 &&
        restored.report.restorations.some((r) => r.section === "projects" && r.prior_delta === 0) &&
        restored.report.restorations.some((r) => r.section === "certifications" && r.prior_delta === 0),
      "F_detached_marker_restored_from_prior_delta_0",
      JSON.stringify({
        pMarker,
        pHead,
        cMarker,
        cHead,
        restorations: restored.report.restorations,
      }),
    ),
  );
  checks.push(
    assert(
      Math.abs(sMarker - 148) < 0.05 && Math.abs(sHead - 154) < 0.05,
      "J_skills_historical_minus_6_not_rewritten",
      `skills marker=${sMarker} heading=${sHead}`,
    ),
  );

  const skipped = applySectionUnitVerticalSafety({
    priorCanvas: prior,
    afterCanvas: planned,
    requested_changes: [GENERIC_SPACING],
  });
  checks.push(
    assert(
      skipped.report.skipped &&
        Number(objById(skipped.canvas, "block-projects-5-r0")?.top) === 290,
      "F2_without_founder_request_no_restore",
      JSON.stringify(skipped.report),
    ),
  );

  const unknownPrior = clone(planned);
  for (const o of unknownPrior.objects ?? []) {
    if (o.id === "block-projects-5-r0") (o as { id: string }).id = "block-projects-5-r0-new";
  }
  const failClosed = applySectionUnitVerticalSafety({
    priorCanvas: prior,
    afterCanvas: unknownPrior,
    requested_changes: [ITEM10],
  });
  checks.push(
    assert(
      failClosed.report.ok === false &&
        String(failClosed.report.error ?? "").includes("SECTION_UNIT_VERTICAL_DETACHMENT"),
      "F3_unknown_prior_detached_marker_fails_closed",
      String(failClosed.report.error),
    ),
  );

  const detachedFinal = clone(prior);
  const set = (id: string, top: number) => {
    const o = objById(detachedFinal, id);
    if (o) o.top = top;
  };
  set("block-projects-5-r0", 346);
  set("block-projects-5-t1", 324);
  set("block-projects-5-t2", 382);
  const h10 = cover(ITEM10, prior, detachedFinal);
  checks.push(
    assert(
      h10.status !== "addressed" &&
        String(h10.notes).includes("marker detached"),
      "H_item10_fails_marker_346_heading_324",
      `${h10.status} :: ${h10.notes}`,
    ),
  );

  const i9 = cover(ITEM9, prior, detachedFinal);
  checks.push(
    assert(
      isHeadingMarkerReferenceRequest(ITEM9.toLowerCase()) &&
        i9.status !== "addressed" &&
        String(i9.notes).includes("marker Y relationship"),
      "I_item9_detects_materially_wrong_Y",
      `${i9.status} :: ${i9.notes}`,
    ),
  );

  const item7onDetached = cover(ITEM7, prior, detachedFinal);
  checks.push(
    assert(
      isMarkerHeadingRelativeAlignmentRequest(ITEM7.toLowerCase()) &&
        isSectionUnitGroupingRequest(ITEM10.toLowerCase()) &&
        item7onDetached.status !== "addressed",
      "H2_item7_relative_markers_fail_when_Y_detached",
      `${item7onDetached.status} :: ${item7onDetached.notes}`,
    ),
  );

  const lefts = ["block-skills-4-t1", "block-projects-5-t1", "block-summary-1-t1"].map(
    (id) => Number(objById(restored.canvas, id)?.left),
  );
  checks.push(
    assert(
      lefts[0] === 60 && lefts[1] === 60 && lefts[2] === 296,
      "K_lane_anchors_unchanged",
      JSON.stringify(lefts),
    ),
  );
  checks.push(
    assert(
      Number(objById(restored.canvas, "block-summary-1-t2")?.left) === 284 &&
        Number(objById(restored.canvas, "block-projects-5-t2")?.left) === 48,
      "L_no_cross_lane_mutation",
      "sidebar content 48 / main 284",
    ),
  );
  checks.push(
    assert(
      objById(restored.canvas, "block-projects-5-t2")?.text ===
        objById(prior, "block-projects-5-t2")?.text &&
        objById(restored.canvas, "block-certifications-6-t2")?.text ===
          objById(prior, "block-certifications-6-t2")?.text,
      "M_factual_text_unchanged",
      "projects/certs text",
    ),
  );

  const afterRestoreNorm = normalizeRevisionLayout({
    canvas: restored.canvas,
    requested_changes: [ITEM2, ITEM6],
  });
  checks.push(
    assert(
      afterRestoreNorm.report.ok &&
        afterRestoreNorm.report.page_overflow === false &&
        (afterRestoreNorm.report.page_fit?.fit_pass ?? false) === true,
      "N_page_fit_remains_protected",
      JSON.stringify(afterRestoreNorm.report.page_fit),
    ),
  );

  const restoredMarker = Number(
    objById(afterRestoreNorm.canvas, "block-projects-5-r0")?.top,
  );
  const restoredHeading = Number(
    objById(afterRestoreNorm.canvas, "block-projects-5-t1")?.top,
  );
  checks.push(
    assert(
      Math.abs(restoredMarker - restoredHeading) <= 2,
      "G2_after_restore_and_normalize_marker_stays_attached",
      `marker=${restoredMarker} heading=${restoredHeading}`,
    ),
  );

  /* Certification whitespace */
  const certBad = clone(prior);
  objById(certBad, "block-certifications-6-t2")!.top = 510;
  objById(certBad, "block-certifications-6-t3")!.top = 544;
  objById(certBad, "block-certifications-6-t4")!.top = 563;
  const certBadCover = cover(ITEM5, prior, certBad);
  checks.push(
    assert(
      certBadCover.status !== "addressed" &&
        String(certBadCover.notes).includes("whitespace"),
      "cert_whitespace_18_then_3_is_inconsistent",
      `${certBadCover.status} :: ${certBadCover.notes}`,
    ),
  );

  const certGood = clone(prior);
  objById(certGood, "block-certifications-6-t2")!.top = 529;
  objById(certGood, "block-certifications-6-t3")!.top = 553;
  objById(certGood, "block-certifications-6-t4")!.top = 577;
  const certGoodCover = cover(ITEM5, prior, certGood);
  checks.push(
    assert(
      !String(certGoodCover.notes).includes("inconsistent line spacing whitespace"),
      "cert_whitespace_8_8_is_consistent",
      `${certGoodCover.status} :: ${certGoodCover.notes}`,
    ),
  );

  const certDiffH = clone(prior);
  objById(certDiffH, "block-certifications-6-t2")!.top = 529;
  objById(certDiffH, "block-certifications-6-t2")!.height = 16;
  objById(certDiffH, "block-certifications-6-t3")!.top = 553;
  objById(certDiffH, "block-certifications-6-t3")!.height = 31;
  objById(certDiffH, "block-certifications-6-t4")!.top = 592;
  objById(certDiffH, "block-certifications-6-t4")!.height = 16;
  const certDiffCover = cover(ITEM5, prior, certDiffH);
  checks.push(
    assert(
      !String(certDiffCover.notes).includes("inconsistent line spacing whitespace"),
      "cert_different_heights_equal_whitespace_8_not_judged_by_top_pitch",
      `${certDiffCover.status} :: ${certDiffCover.notes}`,
    ),
  );

  checks.push(
    assert(
      isFounderSectionToSectionGapEqualityRequest(ITEM6) &&
        isFounderSectionToSectionGapEqualityRequest(ITEM2) &&
        !isFounderSectionToSectionGapEqualityRequest(GENERIC_SPACING),
      "section_gap_predicate_item6_not_generic",
      "item6/item2 vs generic",
    ),
  );

  const gapCanvas = clone(prior);
  objById(gapCanvas, "block-certifications-6-r0")!.top = 529;
  objById(gapCanvas, "block-certifications-6-t1")!.top = 529;
  objById(gapCanvas, "block-certifications-6-t2")!.top = 551;
  objById(gapCanvas, "block-certifications-6-t3")!.top = 569.67;
  objById(gapCanvas, "block-certifications-6-t4")!.top = 588.33;
  const noEq = normalizeRevisionLayout({ canvas: clone(gapCanvas) });
  const yesEq = normalizeRevisionLayout({
    canvas: clone(gapCanvas),
    requested_changes: [ITEM6],
  });
  const gapOf = (c: FabricCanvasDoc, lastId: string, nextHeading: string) => {
    const last = objById(c, lastId)!;
    const next = objById(c, nextHeading)!;
    return Number(next.top) - (Number(last.top) + Number(last.height));
  };
  const noPc = gapOf(noEq.canvas, "block-projects-5-t5", "block-certifications-6-t1");
  const yesPc = gapOf(yesEq.canvas, "block-projects-5-t5", "block-certifications-6-t1");
  const yesSp = gapOf(yesEq.canvas, "block-skills-4-t3", "block-projects-5-t1");
  const yesCl = gapOf(yesEq.canvas, "block-certifications-6-t4", "block-languages-7-t1");
  checks.push(
    assert(
      noPc > 20 &&
        Math.abs(yesSp - MIN_SECTION_GAP_PX) < 1 &&
        Math.abs(yesPc - MIN_SECTION_GAP_PX) < 1 &&
        Math.abs(yesCl - MIN_SECTION_GAP_PX) < 1 &&
        yesEq.report.section_gap_rhythm_actions.length > 0,
      "section_gaps_12_34_12_equalize_only_when_founder_asks",
      JSON.stringify({
        noPc,
        yesSp,
        yesPc,
        yesCl,
        actions: yesEq.report.section_gap_rhythm_actions,
      }),
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
  checks.push(
    assert(openaiCalls === 0, "openai_calls_zero", String(openaiCalls)),
  );
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
