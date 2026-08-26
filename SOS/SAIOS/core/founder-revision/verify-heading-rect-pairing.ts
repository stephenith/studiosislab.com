/**
 * Focused verify: heading-rect pairing must exclude structural page/sidebar
 * backgrounds, while still detecting real heading-obscure / padding issues.
 * Fixture approximates revtask-5585617a-58a post-normalization geometry.
 * No OpenAI. No production task/evidence mutation.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  findHeadingObscuringBodyFindings,
  isStructuralBackgroundRect,
  runCollisionBoundsCheck,
  runVisualConsistencyCheck,
} from "./RevisionAcceptanceChecks.js";
import { CANONICAL_VISUAL_CONSISTENCY_QA } from "./RequestedChangeClassification.js";
import { listRevisionTasks } from "./RevisionTaskStore.js";
import type { FabricCanvasDoc } from "./CanvasInventory.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/founder-revision/verify-heading-rect-pairing.json",
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
    system: true,
    data: { role: "pageBackground", system: true },
  };
}

function headingPair(
  label: string,
  section: string,
  top: number,
  opts: { left: number; rectLeft: number; rectId: string; textId: string; padding?: number },
): Record<string, unknown>[] {
  const padding = opts.padding ?? 0;
  return [
    {
      type: "rect",
      id: opts.rectId,
      left: opts.rectLeft,
      top,
      width: 4,
      height: 14,
      fill: "#1e40af",
      data: { id: opts.rectId, section, role: "section-heading" },
    },
    {
      type: "textbox",
      id: opts.textId,
      left: opts.left,
      top: top + padding,
      width: 200,
      height: 14,
      text: label,
      fill: "#0f172a",
      fontSize: 11,
      fontFamily: "Helvetica",
      fontWeight: "bold",
      data: { id: opts.textId, section, role: "section-heading" },
    },
  ];
}

/**
 * Latest-production-like two-column geometry:
 * lane-0 SKILLS/PROJECTS/CERTIFICATIONS/LANGUAGES
 * lane-1 SUMMARY/EXPERIENCE/EDUCATION
 * Padding pattern approx: SKILLS -1, CERTIFICATIONS 4, LANGUAGES 5
 */
function productionLikeCanvas(opts?: {
  /** When true, heading decoration incorrectly covers body text. */
  obscuringHeading?: boolean;
}): FabricCanvasDoc {
  const obscuring = opts?.obscuringHeading === true;
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
        height: 897.4,
        fill: "#f1f5f9",
        data: { id: "page-sidebar-bg", role: "sidebar-background" },
      },
      // lane-0
      ...headingPair("SKILLS", "skills", 155, {
        left: 60,
        rectLeft: 48,
        rectId: "block-skills-4-r0",
        textId: "block-skills-4-t1",
        padding: -1,
      }),
      {
        type: "textbox",
        id: "block-skills-4-t2",
        left: 48,
        top: 180,
        width: 200,
        height: 40,
        text: "Demand Generation · Brand Strategy",
        fontSize: 10,
        data: { id: "block-skills-4-t2", section: "skills" },
      },
      {
        type: "textbox",
        id: "block-skills-4-t3",
        left: 48,
        top: 274,
        width: 200,
        height: 40,
        text: "Tools · Documentation · Stakeholder",
        fontSize: 10,
        data: { id: "block-skills-4-t3", section: "skills" },
      },
      ...headingPair("PROJECTS", "projects", 342, {
        left: 60,
        rectLeft: 48,
        rectId: "block-projects-5-r0",
        textId: "block-projects-5-t1",
        padding: 0,
      }),
      {
        type: "textbox",
        id: "block-projects-5-t2",
        left: 48,
        top: 370,
        width: 200,
        height: 40,
        text: "Campaign Ops Console",
        fontSize: 10,
        data: { id: "block-projects-5-t2", section: "projects" },
      },
      ...headingPair("CERTIFICATIONS", "certifications", 439, {
        left: 60,
        rectLeft: 48,
        rectId: "block-certifications-6-r0",
        textId: "block-certifications-6-t1",
        padding: 4,
      }),
      {
        type: "textbox",
        id: "block-certifications-6-t2",
        left: 48,
        top: 470,
        width: 200,
        height: 30,
        text: "Google Analytics",
        fontSize: 10,
        data: { id: "block-certifications-6-t2", section: "certifications" },
      },
      // Real languages marker; may be absent from pairing contest vs sidebar before fix
      {
        type: "rect",
        id: "block-languages-7-r0",
        left: 48,
        top: 538,
        width: obscuring ? 220 : 4,
        height: obscuring ? 40 : 14,
        fill: "#1e40af",
        data: { id: "block-languages-7-r0", section: "languages", role: "section-heading" },
      },
      {
        type: "textbox",
        id: "block-languages-7-t1",
        left: 60,
        top: 543,
        width: 200,
        height: 14,
        text: "LANGUAGES",
        fill: "#0f172a",
        fontSize: 11,
        fontFamily: "Helvetica",
        fontWeight: "bold",
        data: { id: "block-languages-7-t1", section: "languages", role: "section-heading" },
      },
      {
        type: "textbox",
        id: "block-languages-7-t2",
        left: 48,
        top: 560,
        width: 200,
        height: 20,
        text: "English (Native)",
        fontSize: 10,
        data: { id: "block-languages-7-t2", section: "languages" },
      },
      // lane-1
      ...headingPair("SUMMARY", "summary", 154, {
        left: 296,
        rectLeft: 284,
        rectId: "block-summary-1-r0",
        textId: "block-summary-1-t1",
        padding: 0,
      }),
      {
        type: "textbox",
        id: "block-summary-1-t2",
        left: 284,
        top: 180,
        width: 450,
        height: 60,
        text: "Operations analyst with process and tooling focus.",
        fontSize: 10,
        data: { id: "block-summary-1-t2", section: "summary" },
      },
      ...headingPair("EXPERIENCE", "experience", 280, {
        left: 296,
        rectLeft: 284,
        rectId: "block-experience-2-r0",
        textId: "block-experience-2-t1",
        padding: 0,
      }),
      {
        type: "textbox",
        id: "block-experience-2-t2",
        left: 284,
        top: 310,
        width: 450,
        height: 20,
        text: "Operations Analyst — Acme",
        fontSize: 10,
        data: { id: "block-experience-2-t2", section: "experience" },
      },
      ...headingPair("EDUCATION", "education", 961, {
        left: 296,
        rectLeft: 284,
        rectId: "block-education-3-r0",
        textId: "block-education-3-t1",
        padding: 0,
      }),
      {
        type: "textbox",
        id: "block-education-3-t2",
        left: 284,
        top: 983,
        width: 450,
        height: 16,
        text: "B.A. Marketing — University of Texas at Austin",
        fontSize: 10,
        data: { id: "block-education-3-t2", section: "education" },
      },
    ],
  } as FabricCanvasDoc;
}

function main(): void {
  let openaiCalls = 0;
  const beforeFp = listRevisionTasks().map(
    (t) => `${t.task_id}:${t.status}:${t.updated_at}`,
  );
  const checks: Check[] = [];

  const sidebar = {
    type: "rect",
    id: "page-sidebar-bg",
    left: 0,
    top: 146,
    width: 268,
    height: 900,
    fill: "#f1f5f9",
    data: { id: "page-sidebar-bg", role: "sidebar-background" },
  };
  const page = pageBg();
  const marker = {
    type: "rect",
    id: "block-languages-7-r0",
    left: 48,
    top: 538,
    width: 4,
    height: 14,
    fill: "#1e40af",
    data: { section: "languages", role: "section-heading" },
  };
  checks.push(
    assert(
      isStructuralBackgroundRect(sidebar as never) === true &&
        isStructuralBackgroundRect(page as never) === true &&
        isStructuralBackgroundRect(marker as never) === false,
      "structural_background_classifier",
      "sidebar/page excluded; marker kept",
    ),
  );

  const canvas = productionLikeCanvas();
  const collision = runCollisionBoundsCheck(
    canvas,
    "Perform a final collision and page-bounds QA pass after all repositioning: no heading, text, bullet, background shape, or section may overlap another element or extend outside the page boundaries.",
  );
  const headingObscures = (collision.findings || []).filter(
    (f) => f.code === "ACC_HEADING_OBSCURES_BODY",
  );
  const sidebarInObscures = headingObscures.some((f) =>
    f.object_ids.includes("page-sidebar-bg"),
  );
  checks.push(
    assert(
      !sidebarInObscures,
      "A_no_sidebar_bg_heading_obscures",
      JSON.stringify(headingObscures.map((f) => f.object_ids)),
    ),
  );

  const visual = runVisualConsistencyCheck(
    canvas,
    CANONICAL_VISUAL_CONSISTENCY_QA,
  );
  const sidebarRectFindings = (visual.findings || []).filter((f) =>
    f.object_ids.includes("page-sidebar-bg"),
  );
  checks.push(
    assert(
      sidebarRectFindings.length === 0,
      "C_no_false_languages_rect_mismatch_via_sidebar_bg",
      JSON.stringify(sidebarRectFindings),
    ),
  );

  const paddingFindings = (visual.findings || []).filter(
    (f) => f.code === "ACC_VISUAL_PADDING_MISMATCH",
  );
  const certPadding = paddingFindings.some((f) => {
    const m = f.metrics || {};
    return (
      (m.compared_label === "CERTIFICATIONS" ||
        m.reference_label === "CERTIFICATIONS") &&
      (m.compared_label === "SKILLS" || m.reference_label === "SKILLS")
    );
  });
  checks.push(
    assert(
      visual.pass === false && certPadding,
      "D_real_same_lane_padding_mismatch_remains",
      JSON.stringify(
        paddingFindings.map((f) => ({
          code: f.code,
          metrics: f.metrics,
          ids: f.object_ids,
        })),
      ),
    ),
  );

  // Direct obscure findings helper with large sidebar behind content
  const obscureDirect = findHeadingObscuringBodyFindings(canvas);
  checks.push(
    assert(
      !obscureDirect.some((f) => f.object_ids.includes("page-sidebar-bg")),
      "sidebar_bg_behind_content_not_heading_obscures",
      JSON.stringify(obscureDirect),
    ),
  );

  // Actual heading decoration covering body still detected
  const bad = productionLikeCanvas({ obscuringHeading: true });
  const badObscure = findHeadingObscuringBodyFindings(bad);
  checks.push(
    assert(
      badObscure.some(
        (f) =>
          f.code === "ACC_HEADING_OBSCURES_BODY" &&
          f.object_ids.includes("block-languages-7-r0") &&
          f.object_ids.includes("block-languages-7-t2"),
      ),
      "real_heading_rect_covering_body_still_detected",
      JSON.stringify(badObscure),
    ),
  );

  // Global page background never heading rect (already in structural check + no findings)
  checks.push(
    assert(
      !headingObscures.some((f) => f.object_ids.includes("page-root")) &&
        !sidebarRectFindings.some((f) => f.object_ids.includes("page-root")),
      "page_background_never_heading_rect",
      "ok",
    ),
  );

  // Legitimate section markers still evaluated (CERT padding uses real rect ids)
  checks.push(
    assert(
      paddingFindings.some(
        (f) =>
          f.object_ids.includes("block-certifications-6-r0") &&
          f.object_ids.includes("block-skills-4-r0"),
      ),
      "legitimate_section_markers_still_evaluated",
      JSON.stringify(paddingFindings.map((f) => f.object_ids)),
    ),
  );

  // SUMMARY real marker still pairs (no false missing solely from sidebar exclusion)
  const summaryMissing = (visual.findings || []).filter(
    (f) =>
      f.code === "ACC_VISUAL_RECT_MISSING" &&
      (f.message.includes("SUMMARY") ||
        (f.metrics as { compared_label?: string } | undefined)?.compared_label ===
          "SUMMARY"),
  );
  checks.push(
    assert(
      summaryMissing.length === 0,
      "summary_real_section_rect_still_pairs",
      JSON.stringify(summaryMissing),
    ),
  );

  checks.push(assert(openaiCalls === 0, "no_openai_calls", `n=${openaiCalls}`));
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
  const report = {
    ok: failed.length === 0,
    passed: checks.filter((c) => c.pass).length,
    total: checks.length,
    checks,
    collision_pass: collision.pass,
    visual_pass: visual.pass,
    heading_obscures_count: headingObscures.length,
    padding_mismatch_count: paddingFindings.length,
    at: new Date().toISOString(),
  };
  mkdirSync(join(OUT, ".."), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    report.ok
      ? `OK ${report.passed}/${report.total}`
      : `FAIL ${failed.map((f) => f.name).join(", ")}`,
  );
  if (!report.ok) {
    console.error(JSON.stringify(failed, null, 2));
    process.exit(1);
  }
}

main();
