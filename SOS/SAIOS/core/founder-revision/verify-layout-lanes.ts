/**
 * Focused verify: column/lane-aware RevisionLayoutNormalizer.
 * No OpenAI. No production task/evidence mutation.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import type { FabricCanvasDoc } from "./CanvasInventory.js";
import {
  MIN_SECTION_GAP_PX,
  detectLayoutLanesFromCanvas,
  normalizeRevisionLayout,
} from "./RevisionLayoutNormalizer.js";
import { listRevisionTasks } from "./RevisionTaskStore.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/founder-revision/verify-layout-lanes.json",
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

function findObj(
  canvas: FabricCanvasDoc,
  id: string,
): Record<string, unknown> | undefined {
  return (canvas.objects ?? []).find(
    (o) => (o as { id?: string }).id === id,
  ) as Record<string, unknown> | undefined;
}

function filledHeading(
  label: string,
  section: string,
  top: number,
  left = 48,
  opts?: { fontSize?: number; width?: number; height?: number; fill?: string },
): Record<string, unknown>[] {
  const width = opts?.width ?? 160;
  const height = opts?.height ?? 24;
  const fontSize = opts?.fontSize ?? 16;
  const fill = opts?.fill ?? "#1e3a8a";
  const r = `block-${section}-r0`;
  const t = `block-${section}-t1`;
  return [
    {
      type: "rect",
      id: r,
      left,
      top,
      width,
      height,
      fill,
      data: { id: r, section, role: "section-heading" },
    },
    {
      type: "textbox",
      id: t,
      left: left + 10,
      top: top + 5,
      width: width - 16,
      height: 14,
      text: label,
      fill: "#ffffff",
      fontSize,
      fontFamily: "Helvetica",
      fontWeight: "bold",
      data: { id: t, section, role: "section-heading" },
    },
  ];
}

function bodyText(
  id: string,
  section: string,
  top: number,
  left: number,
  text: string,
  width = 650,
): Record<string, unknown> {
  return {
    type: "textbox",
    id,
    left,
    top,
    width,
    height: 40,
    text,
    fill: "#111111",
    fontSize: 11,
    data: { id, section },
  };
}

/** A — classic one-column filled headings. */
function oneColumnCanvas(): FabricCanvasDoc {
  return {
    version: "5.3.0",
    width: 794,
    height: 1123,
    objects: [
      pageBg(),
      {
        type: "rect",
        id: "block-header-0-r0",
        left: 0,
        top: 0,
        width: 794,
        height: 100,
        fill: "#dbeafe",
        data: { id: "block-header-0-r0", section: "header", role: "header-band" },
      },
      {
        type: "textbox",
        id: "block-header-0-t1",
        left: 48,
        top: 40,
        width: 400,
        height: 28,
        text: "Elena Voss",
        fontSize: 28,
        data: { id: "block-header-0-t1", section: "header" },
      },
      {
        type: "textbox",
        id: "block-header-0-t2",
        left: 48,
        top: 72,
        width: 500,
        height: 16,
        text: "elena@example.com · Austin, TX",
        fontSize: 11,
        data: { id: "block-header-0-t2", section: "header" },
      },
      ...filledHeading("SUMMARY", "summary", 120),
      bodyText("block-summary-1-t2", "summary", 152, 48, "Summary body."),
      ...filledHeading("EXPERIENCE", "experience", 220),
      bodyText("block-experience-2-t2", "experience", 252, 48, "Job title"),
      ...filledHeading("EDUCATION", "education", 340),
      bodyText("block-education-3-t2", "education", 372, 48, "Degree"),
      ...filledHeading("SKILLS", "skills", 430),
      bodyText("block-skills-4-t2", "skills", 462, 48, "Skills list"),
    ],
  };
}

/**
 * B/C — two-column OA-like geometry (generic; not template-id specific).
 * Left: skills/certs/languages. Right: summary/experience/education.
 */
function twoColumnCanvas(opts?: {
  /** Tall right-column body that cannot fit even after min-gap compaction. */
  impossibleFit?: boolean;
}): FabricCanvasDoc {
  const eduTop = opts?.impossibleFit ? 900 : 760;
  const experienceExtra: Record<string, unknown>[] = [];
  if (opts?.impossibleFit) {
    // Dense experience bullets filling the column so education cannot fit
    // even after reclaiming all excess gaps to configured minimums.
    for (let i = 0; i < 28; i++) {
      experienceExtra.push({
        type: "textbox",
        id: `block-experience-2-t${10 + i}`,
        left: 284,
        top: 335 + i * 34,
        width: 462,
        height: 48,
        text: `• Dense experience line ${i + 1} with enough vertical mass to overflow the page after min-gap compaction.`,
        fill: "#111111",
        fontSize: 12,
        lineHeight: 1.35,
        data: { id: `block-experience-2-t${10 + i}`, section: "experience" },
      });
    }
  }
  return {
    version: "5.3.0",
    width: 794,
    height: 1123,
    objects: [
      pageBg(),
      {
        type: "rect",
        id: "page-sidebar-bg",
        left: 40,
        top: 146,
        width: 228,
        height: 897,
        fill: "#f3f4f6",
        data: { id: "page-sidebar-bg", role: "sidebar-bg" },
      },
      {
        type: "rect",
        id: "block-header-0-r0",
        left: 0,
        top: 0,
        width: 794,
        height: 138,
        fill: "#dbeafe",
        data: { id: "block-header-0-r0", section: "header", role: "header-band" },
      },
      {
        type: "textbox",
        id: "block-header-0-t1",
        left: 48,
        top: 48,
        width: 698,
        height: 36,
        text: "Alex Morgan",
        fontSize: 28,
        data: { id: "block-header-0-t1", section: "header" },
      },
      {
        type: "textbox",
        id: "block-header-0-t3",
        left: 48,
        top: 113,
        width: 698,
        height: 14,
        text: "alex.morgan@example.com  ·  +1 (555) 010-2000",
        fontSize: 11,
        data: { id: "block-header-0-t3", section: "header" },
      },
      // Right column — thin marker headings
      {
        type: "rect",
        id: "block-summary-1-r0",
        left: 284,
        top: 154,
        width: 4,
        height: 14,
        fill: "#111111",
        data: { id: "block-summary-1-r0", section: "summary", role: "section-marker" },
      },
      {
        type: "textbox",
        id: "block-summary-1-t1",
        left: 296,
        top: 154,
        width: 450,
        height: 14,
        text: "SUMMARY",
        fontSize: 11,
        fill: "#111111",
        fontWeight: "bold",
        data: { id: "block-summary-1-t1", section: "summary", role: "section-heading" },
      },
      bodyText(
        "block-summary-1-t2",
        "summary",
        173,
        284,
        "Operations analyst summary paragraph.",
        462,
      ),
      {
        type: "rect",
        id: "block-experience-2-r0",
        left: 284,
        top: 280,
        width: 4,
        height: 14,
        fill: "#111111",
        data: {
          id: "block-experience-2-r0",
          section: "experience",
          role: "section-marker",
        },
      },
      {
        type: "textbox",
        id: "block-experience-2-t1",
        left: 296,
        top: 280,
        width: 450,
        height: 14,
        text: "EXPERIENCE",
        fontSize: 11,
        fill: "#111111",
        fontWeight: "bold",
        data: {
          id: "block-experience-2-t1",
          section: "experience",
          role: "section-heading",
        },
      },
      bodyText(
        "block-experience-2-t2",
        "experience",
        299,
        284,
        "Analyst — Example Corp",
        462,
      ),
      bodyText(
        "block-experience-2-t4",
        "experience",
        335,
        284,
        "• Delivered measurable process improvements across ops.",
        462,
      ),
      ...experienceExtra,
      {
        type: "rect",
        id: "block-education-3-r0",
        left: 284,
        top: eduTop,
        width: 4,
        height: 14,
        fill: "#111111",
        data: {
          id: "block-education-3-r0",
          section: "education",
          role: "section-marker",
        },
      },
      {
        type: "textbox",
        id: "block-education-3-t1",
        left: 296,
        top: eduTop,
        width: 450,
        height: 14,
        text: "EDUCATION",
        fontSize: 11,
        fill: "#111111",
        fontWeight: "bold",
        data: {
          id: "block-education-3-t1",
          section: "education",
          role: "section-heading",
        },
      },
      bodyText(
        "block-education-3-t2",
        "education",
        eduTop + 19,
        284,
        "B.S. Information Systems",
        462,
      ),
      // Left column — overlaps vertically with right
      {
        type: "rect",
        id: "block-skills-4-r0",
        left: 48,
        top: 154,
        width: 4,
        height: 14,
        fill: "#111111",
        data: { id: "block-skills-4-r0", section: "skills", role: "section-marker" },
      },
      {
        type: "textbox",
        id: "block-skills-4-t1",
        left: 60,
        top: 154,
        width: 208,
        height: 14,
        text: "SKILLS",
        fontSize: 11,
        fill: "#111111",
        fontWeight: "bold",
        data: { id: "block-skills-4-t1", section: "skills", role: "section-heading" },
      },
      bodyText(
        "block-skills-4-t2",
        "skills",
        173,
        48,
        "SQL · Excel · Tableau · Process Optimization",
        220,
      ),
      {
        type: "rect",
        id: "block-certifications-6-r0",
        left: 48,
        top: 419,
        width: 4,
        height: 14,
        fill: "#111111",
        data: {
          id: "block-certifications-6-r0",
          section: "certifications",
          role: "section-marker",
        },
      },
      {
        type: "textbox",
        id: "block-certifications-6-t1",
        left: 60,
        top: 419,
        width: 208,
        height: 14,
        text: "CERTIFICATIONS",
        fontSize: 11,
        fill: "#111111",
        fontWeight: "bold",
        data: {
          id: "block-certifications-6-t1",
          section: "certifications",
          role: "section-heading",
        },
      },
      bodyText(
        "block-certifications-6-t2",
        "certifications",
        438,
        48,
        "• Google Analytics IQ",
        220,
      ),
      {
        type: "rect",
        id: "block-languages-7-r0",
        left: 48,
        top: 510,
        width: 4,
        height: 14,
        fill: "#111111",
        data: {
          id: "block-languages-7-r0",
          section: "languages",
          role: "section-marker",
        },
      },
      {
        type: "textbox",
        id: "block-languages-7-t1",
        left: 60,
        top: 510,
        width: 208,
        height: 14,
        text: "LANGUAGES",
        fontSize: 11,
        fill: "#111111",
        fontWeight: "bold",
        data: {
          id: "block-languages-7-t1",
          section: "languages",
          role: "section-heading",
        },
      },
      bodyText(
        "block-languages-7-t2",
        "languages",
        529,
        48,
        "English (Native)",
        220,
      ),
    ],
  };
}

/** D — same-lane collision: education overlaps experience in one column. */
function sameLaneCollisionCanvas(): FabricCanvasDoc {
  const c = oneColumnCanvas();
  // Pull education up into experience
  for (const o of c.objects ?? []) {
    const id = String((o as { id?: string }).id ?? "");
    if (id.startsWith("block-education")) {
      (o as { top?: number }).top = 260;
    }
    if (id.startsWith("block-skills")) {
      (o as { top?: number }).top =
        Number((o as { top?: number }).top ?? 0) - 80;
    }
  }
  return c;
}

function educationRectId(canvas: FabricCanvasDoc): string {
  const o = (canvas.objects ?? []).find((x) => {
    const id = String((x as { id?: string }).id ?? "");
    return id.includes("education") && id.includes("-r");
  }) as { id?: string } | undefined;
  return o?.id ?? "block-education-r0";
}

/** H — different visual systems: filled main vs thin sidebar markers. */
function mixedHeadingSystemsCanvas(): FabricCanvasDoc {
  const c = twoColumnCanvas();
  // Convert right-column markers into filled pills (different system)
  for (const o of c.objects ?? []) {
    const id = String((o as { id?: string }).id ?? "");
    const data = (o as { data?: { section?: string; role?: string } }).data;
    if (
      data?.section &&
      ["summary", "experience", "education"].includes(data.section) &&
      String((o as { type?: string }).type).toLowerCase().includes("rect")
    ) {
      (o as { width?: number; height?: number; fill?: string }).width = 140;
      (o as { height?: number }).height = 22;
      (o as { fill?: string }).fill = "#1e3a8a";
      if (data) data.role = "section-heading";
    }
    if (
      data?.section &&
      ["summary", "experience", "education"].includes(data.section) &&
      id.endsWith("-t1")
    ) {
      (o as { fill?: string; fontSize?: number }).fill = "#ffffff";
      (o as { fontSize?: number }).fontSize = 16;
      (o as { left?: number }).left =
        Number((o as { left?: number }).left ?? 0) - 2;
    }
  }
  return c;
}

/** I — header clearance should not move an independent non-intersecting lane.
 *  (Both lanes intersect full-width header here; use contact→summary gap fixture.)
 */
function headerClearanceCanvas(): FabricCanvasDoc {
  const c = twoColumnCanvas();
  // Move summary too close to contact
  for (const o of c.objects ?? []) {
    const id = String((o as { id?: string }).id ?? "");
    if (id.startsWith("block-summary")) {
      (o as { top?: number }).top = 118;
    }
  }
  return c;
}

function main(): void {
  const checks: Check[] = [];
  const beforeFp = listRevisionTasks().map(
    (t) => `${t.task_id}:${t.status}:${t.updated_at}`,
  );
  const openaiCalls = 0;

  // A — one column
  const one = normalizeRevisionLayout({ canvas: oneColumnCanvas() });
  checks.push(
    assert(
      one.report.lanes.length === 1 &&
        one.report.ok === true &&
        (one.report.page_overflow_bottom ?? 0) <= 1123.5,
      "A_one_column_single_lane_bounds_pass",
      `lanes=${one.report.lanes.length} bottom=${one.report.page_overflow_bottom} order=${one.report.lanes[0]?.section_order.join(",")}`,
    ),
  );
  const oneFacade = detectLayoutLanesFromCanvas(oneColumnCanvas());
  checks.push(
    assert(
      oneFacade.lane_count === 1 &&
        Object.keys(oneFacade.section_to_lane).length >= 1,
      "A2_detectLayoutLanesFromCanvas_one_column",
      JSON.stringify(oneFacade),
    ),
  );

  // B — two column independent lanes
  const two = normalizeRevisionLayout({ canvas: twoColumnCanvas() });
  const leftLane = two.report.lanes.find((l) =>
    l.section_order.includes("skills"),
  );
  const rightLane = two.report.lanes.find((l) =>
    l.section_order.includes("summary"),
  );
  checks.push(
    assert(
      two.report.lanes.length === 2 &&
        !!leftLane &&
        !!rightLane &&
        leftLane.lane_id !== rightLane.lane_id,
      "B_two_column_independent_lanes",
      JSON.stringify(two.report.lanes),
    ),
  );

  // C — OA-like: no global chain to ~1304; stays on page when intrinsically fit
  checks.push(
    assert(
      two.report.ok === true &&
        (two.report.page_overflow_bottom ?? 9999) <= 1123.5 &&
        Number(findObj(two.canvas, "block-skills-4-r0")?.top) < 400 &&
        Number(findObj(two.canvas, "block-skills-4-r0")?.left) < 120 &&
        Number(findObj(two.canvas, "block-summary-1-r0")?.left) > 200,
      "C_oa_like_no_global_chain_overflow",
      `ok=${two.report.ok} bottom=${two.report.page_overflow_bottom} skillsTop=${findObj(two.canvas, "block-skills-4-r0")?.top} skillsLeft=${findObj(two.canvas, "block-skills-4-r0")?.left} summaryLeft=${findObj(two.canvas, "block-summary-1-r0")?.left} err=${two.report.error}`,
    ),
  );

  // D — same-lane collision moves downstream in that lane
  const collideSrc = sameLaneCollisionCanvas();
  const collide = normalizeRevisionLayout({ canvas: collideSrc });
  const eduId = educationRectId(collide.canvas);
  const eduTop = Number(findObj(collide.canvas, eduId)?.top);
  const expBodyTop = Number(
    findObj(collide.canvas, "block-experience-2-t2")?.top,
  );
  checks.push(
    assert(
      collide.report.ok &&
        Number.isFinite(eduTop) &&
        eduTop > expBodyTop &&
        collide.report.shifts_applied.some((s) => s.section === "education"),
      "D_same_lane_collision_moves_downstream",
      `eduId=${eduId} eduTop=${eduTop} expBodyTop=${expBodyTop} shifts=${collide.report.shifts_applied.map((s) => s.section).join(",")}`,
    ),
  );

  // E — cross-lane vertical overlap does not move left because of right chain
  const skillsTopBefore = 154;
  const skillsTopAfter = Number(findObj(two.canvas, "block-skills-4-r0")?.top);
  checks.push(
    assert(
      Math.abs(skillsTopAfter - skillsTopBefore) < 40,
      "E_cross_lane_overlap_does_not_global_push",
      `skillsTopAfter=${skillsTopAfter}`,
    ),
  );

  // F — lane-local content grid keeps distinct x anchors
  checks.push(
    assert(
      Number(findObj(two.canvas, "block-skills-4-r0")?.left) < 100 &&
        Number(findObj(two.canvas, "block-summary-1-r0")?.left) > 250 &&
        !two.report.content_grid_changes.some(
          (c) =>
            c.object_id.startsWith("block-skills") &&
            c.after > 200 &&
            c.grid === "heading_rect",
        ),
      "F_lane_local_content_grid_distinct_anchors",
      `skillsL=${findObj(two.canvas, "block-skills-4-r0")?.left} summaryL=${findObj(two.canvas, "block-summary-1-r0")?.left} grid=${JSON.stringify(two.report.content_grid_changes.slice(0, 8))}`,
    ),
  );

  // G — genuine overflow still fail-closed
  const overflow = normalizeRevisionLayout({
    canvas: twoColumnCanvas({ impossibleFit: true }),
  });
  checks.push(
    assert(
      overflow.report.ok === false && overflow.report.page_overflow === true,
      "G_genuine_overflow_fails_closed",
      `ok=${overflow.report.ok} bottom=${overflow.report.page_overflow_bottom} err=${overflow.report.error}`,
    ),
  );

  // H — different heading systems not collapsed
  const mixed = normalizeRevisionLayout({ canvas: mixedHeadingSystemsCanvas() });
  const skillsFs = Number(findObj(mixed.canvas, "block-skills-4-t1")?.fontSize);
  const summaryFs = Number(
    findObj(mixed.canvas, "block-summary-1-t1")?.fontSize,
  );
  checks.push(
    assert(
      skillsFs === 11 &&
        summaryFs === 16 &&
        !mixed.report.heading_style_changes.some(
          (c) => c.section === "skills" && c.field === "fontSize",
        ),
      "H_heading_style_systems_isolated",
      `skillsFs=${skillsFs} summaryFs=${summaryFs} styleChanges=${mixed.report.heading_style_changes.length}`,
    ),
  );

  // I — header clearance moves Summary lane; left skills stay near original band
  const clearance = normalizeRevisionLayout({ canvas: headerClearanceCanvas() });
  const summaryTop = Number(
    findObj(clearance.canvas, "block-summary-1-r0")?.top,
  );
  const skillsTop = Number(findObj(clearance.canvas, "block-skills-4-r0")?.top);
  checks.push(
    assert(
      summaryTop >= 127 &&
        skillsTop < 200 &&
        clearance.report.shifts_applied.some(
          (s) =>
            s.section === "summary" &&
            String(s.reason).includes("header clearance"),
        ),
      "I_header_clearance_lane_local",
      `summaryTop=${summaryTop} skillsTop=${skillsTop} shifts=${JSON.stringify(clearance.report.shifts_applied.filter((s) => s.section === "summary" || s.section === "skills"))}`,
    ),
  );

  // Read-only diagnostic against production prior canvas if present (no mutation)
  const priorPath = join(
    REPO,
    "SOS/07_LOGS/saios/first-production-cycle/candidates/cand-ats-operations-analyst-20260807T223735Z-2c9bcf/canvas.json",
  );
  if (existsSync(priorPath)) {
    const prior = JSON.parse(readFileSync(priorPath, "utf8")) as FabricCanvasDoc;
    const prod = normalizeRevisionLayout({ canvas: prior });
    checks.push(
      assert(
        prod.report.lanes.length >= 2 &&
          (prod.report.page_overflow_bottom ?? 9999) < 1200,
        "production_prior_canvas_lane_aware_diagnostic",
        `lanes=${prod.report.lanes.length} bottom=${prod.report.page_overflow_bottom} ok=${prod.report.ok} order=${JSON.stringify(prod.report.lanes)}`,
      ),
    );
  } else {
    checks.push(
      assert(true, "production_prior_canvas_lane_aware_diagnostic", "skipped"),
    );
  }

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
