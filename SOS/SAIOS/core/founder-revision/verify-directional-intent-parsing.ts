/**
 * Offline verify: Phase 4F narrow directional-intent parsing.
 * Descriptive location language must not bind UP/DOWN; imperative movement must.
 * No OpenAI. No production task mutation.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  buildCanvasInventory,
  type FabricCanvasDoc,
} from "./CanvasInventory.js";
import { validatePlanGeometrySafety } from "./PlanGeometrySafety.js";
import {
  parseExplicitMoveDirections,
  validatePlanVerticalDirections,
} from "./PositionOpCanonicalization.js";
import type { RevisionPlan } from "./revision-task-types.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/founder-revision/verify-directional-intent-parsing.json",
);
const TEACHER_FIXTURE = join(
  REPO,
  ".cursor/debug-fixtures/revtask-9875c4b2-407",
);

type Check = { name: string; pass: boolean; detail: string };

function assert(cond: boolean, name: string, detail: string): Check {
  return { name, pass: !!cond, detail };
}

function dirsOf(text: string): string {
  return [...parseExplicitMoveDirections(text)].sort().join(",") || "NONE";
}

function expectDirs(
  name: string,
  text: string,
  expected: "up" | "down" | "NONE" | "left" | "right",
): Check {
  const got = dirsOf(text);
  const ok =
    expected === "NONE" ? got === "NONE" : got.split(",").includes(expected);
  return assert(ok, name, `got=${got} expected=${expected} text=${text.slice(0, 120)}`);
}

function pageCanvas(extra: Record<string, unknown>[]): FabricCanvasDoc {
  return {
    version: "5.3.0",
    width: 794,
    height: 1123,
    objects: [
      {
        type: "rect",
        id: "page-root",
        left: 0,
        top: 0,
        width: 794,
        height: 1123,
        fill: "#ffffff",
        data: { role: "pageBackground", system: true, kind: "page-bg" },
      },
      ...extra,
    ],
  };
}

function main(): void {
  const checks: Check[] = [];

  // --- Descriptive vs imperative matrix (Phase 4F contract) ---
  checks.push(expectDirs("desc_lower_edge", "lower edge", "NONE"));
  checks.push(expectDirs("desc_bottom_padding", "bottom padding", "NONE"));
  checks.push(
    expectDirs("desc_space_below_header", "space below header", "NONE"),
  );
  checks.push(
    expectDirs(
      "desc_section_below_unchanged",
      "section below remains unchanged",
      "NONE",
    ),
  );
  checks.push(expectDirs("desc_upper_area", "upper area", "NONE"));
  checks.push(expectDirs("imp_move_upward", "move upward", "up"));
  checks.push(expectDirs("imp_move_down", "move down", "down"));
  checks.push(expectDirs("imp_shift_downward", "shift downward", "down"));
  checks.push(
    expectDirs("imp_raise_contact_row", "raise the contact row", "up"),
  );
  checks.push(
    expectDirs("imp_lower_contact_row", "lower the contact row", "down"),
  );
  checks.push(
    expectDirs(
      "imp_move_contact_higher",
      "move the contact row higher",
      "up",
    ),
  );
  checks.push(
    expectDirs(
      "imp_move_contact_lower",
      "move the contact row lower",
      "down",
    ),
  );

  // Extra contract cases from Phase 4F language matrix
  checks.push(
    expectDirs(
      "contract_maintain_space_below",
      "Maintain space below the header.",
      "NONE",
    ),
  );
  checks.push(
    expectDirs(
      "contract_keep_away_lower_edge",
      "Keep content away from the lower edge.",
      "NONE",
    ),
  );
  checks.push(
    expectDirs(
      "contract_summary_section_below",
      "The Summary section below should remain unchanged.",
      "NONE",
    ),
  );
  checks.push(
    expectDirs(
      "contract_lower_section_unchanged",
      "The lower section should remain unchanged.",
      "NONE",
    ),
  );
  checks.push(
    expectDirs(
      "contract_align_above",
      "Align the section above with Skills.",
      "NONE",
    ),
  );
  checks.push(
    expectDirs(
      "contract_keep_upper_area",
      "Keep the heading in the upper area.",
      "NONE",
    ),
  );

  // Teacher-shaped Founder RC that previously false-positived DOWN
  const teacherPaddingRc =
    "Increase the bottom padding between the contact-information row and the lower edge of the gray header background so the contact details do not appear cramped against the boundary.";
  checks.push(
    expectDirs("teacher_rc_lower_edge_none", teacherPaddingRc, "NONE"),
  );

  // --- Fail-closed contradiction proofs ---
  const langsInv = buildCanvasInventory(
    pageCanvas([
      {
        type: "textbox",
        id: "block-languages-6-t2",
        left: 48,
        top: 1107,
        width: 698,
        height: 16,
        text: "English, Spanish",
        data: { section: "languages", role: "body" },
      },
    ]),
  );
  const upContradict: RevisionPlan = {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "contradict upward",
    operations: [
      {
        op: "set_position",
        target_id: "block-languages-6-t2",
        values: { top: 1117 },
        before_summary: "Languages at top=1107",
        intended_change: "Move the Languages section upward.",
        founder_feedback_item: "Move the Languages section upward.",
        confidence: 0.9,
      },
    ],
  };
  const upGate = validatePlanVerticalDirections({
    plan: upContradict,
    inventory: langsInv,
    requested_changes: ["Move the Languages section upward."],
  });
  checks.push(
    assert(
      upGate.ok === false &&
        upGate.errors.some((e) => e.includes("upward") && e.includes("downward")),
      "fail_closed_upward_vs_positive_delta",
      upGate.errors.join("; "),
    ),
  );

  const summaryInv = buildCanvasInventory(
    pageCanvas([
      {
        type: "textbox",
        id: "block-summary-1-t2",
        left: 48,
        top: 200,
        width: 698,
        height: 40,
        text: "Summary body",
        data: { section: "summary", role: "body" },
      },
    ]),
  );
  const downContradict: RevisionPlan = {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "contradict downward",
    operations: [
      {
        op: "set_position",
        target_id: "block-summary-1-t2",
        values: { top: 192 },
        before_summary: "Summary at top=200",
        intended_change: "Move the Summary section down.",
        founder_feedback_item: "Move the Summary section down.",
        confidence: 0.9,
      },
    ],
  };
  const downGate = validatePlanVerticalDirections({
    plan: downContradict,
    inventory: summaryInv,
    requested_changes: ["Move the Summary section down."],
  });
  checks.push(
    assert(
      downGate.ok === false &&
        downGate.errors.some(
          (e) => e.includes("downward") && e.includes("upward"),
        ),
      "fail_closed_downward_vs_negative_delta",
      downGate.errors.join("; "),
    ),
  );

  // --- Generalized Teacher-shaped replay (copied evidence shape; no prod mutation) ---
  const teacherShapePlan: RevisionPlan = {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "Teacher-shaped header padding raise",
    operations: [
      {
        op: "set_position",
        target_id: "block-header-0-t3",
        values: { top: 114 },
        before_summary:
          "Textbox id=block-header-0-t3 in header section currently positioned left=48 top=121 width=698 height=14 with effective_bottom=135",
        intended_change:
          "Raise the contact-info row by 7 pixels to top=114, increasing bottom padding inside the gray header.",
        founder_feedback_item:
          "Keep the name, role title, and complete contact-information row visually contained inside the light-gray header rectangle as one unified header block.",
        confidence: 0.98,
      },
    ],
  };
  const teacherShapeInv = buildCanvasInventory(
    pageCanvas([
      {
        type: "rect",
        id: "block-header-0-r0",
        left: 36,
        top: 36,
        width: 722,
        height: 88,
        fill: "#e8e8e8",
        data: { section: "header", role: "header-band" },
      },
      {
        type: "textbox",
        id: "block-header-0-t3",
        left: 48,
        top: 121,
        width: 698,
        height: 14,
        text: "email@example.com · +1 555 0100 · City, ST",
        data: { section: "header", role: "contact" },
      },
    ]),
  );
  const teacherRequested = [
    "Keep the name, role title, and complete contact-information row visually contained inside the light-gray header rectangle as one unified header block.",
    teacherPaddingRc,
    "Adjust the vertical positions of the header text elements as needed so the name, role, and contact information have balanced top and bottom spacing within the gray header.",
    "Maintain a clear and consistent gap between the bottom of the gray header section and the Summary section below.",
  ];
  checks.push(
    assert(
      !parseExplicitMoveDirections(teacherPaddingRc).has("down"),
      "teacher_shape_parsed_down_false",
      dirsOf(teacherPaddingRc),
    ),
  );
  const teacherDir = validatePlanVerticalDirections({
    plan: teacherShapePlan,
    inventory: teacherShapeInv,
    requested_changes: teacherRequested,
  });
  checks.push(
    assert(
      teacherDir.ok === true && teacherDir.errors.length === 0,
      "teacher_shape_direction_violation_zero",
      teacherDir.errors.join("; ") || "ok",
    ),
  );
  const teacherShapeCanvas = pageCanvas([
    {
      type: "rect",
      id: "block-header-0-r0",
      left: 36,
      top: 36,
      width: 722,
      height: 88,
      fill: "#e8e8e8",
      data: { section: "header", role: "header-band" },
    },
    {
      type: "textbox",
      id: "block-header-0-t2",
      left: 48,
      top: 72,
      width: 698,
      height: 18,
      text: "Mid-Level Teacher",
      data: { section: "header", role: "role" },
    },
    {
      type: "textbox",
      id: "block-header-0-t3",
      left: 48,
      top: 121,
      width: 698,
      height: 14,
      text: "email@example.com · +1 555 0100 · City, ST",
      data: { section: "header", role: "contact" },
    },
  ]);
  const teacherShapeGeo = validatePlanGeometrySafety({
    plan: teacherShapePlan,
    canvas: teacherShapeCanvas,
  });
  checks.push(
    assert(
      teacherShapeGeo.ok === true &&
        teacherShapeGeo.text_overlaps === 0 &&
        teacherShapeGeo.page_oob === 0,
      "teacher_shape_geometry_allowed_and_clear",
      `ok=${teacherShapeGeo.ok} overlaps=${teacherShapeGeo.text_overlaps} oob=${teacherShapeGeo.page_oob}`,
    ),
  );

  // Static replay of Teacher failure shape (evidence-derived constants only;
  // no production task IDs in parser logic; optional local fixture for canvas).
  const copiedRequested = [
    "Keep the name, role title, and complete contact-information row visually contained inside the light-gray header rectangle as one unified header block.",
    teacherPaddingRc,
    "Adjust the vertical positions of the header text elements as needed so the name, role, and contact information have balanced top and bottom spacing within the gray header.",
    "Preserve the existing left alignment and horizontal margins of the header content.",
    "Maintain a clear and consistent gap between the bottom of the gray header section and the Summary section below.",
    "Preserve the current Summary, Experience, Education, Skills, Certifications, and Languages layout unless movement is required only to accommodate the corrected header spacing.",
    "Do not change the existing typography, section styling, colors, content, or overall single-column design while correcting the header spacing.",
  ];
  const copiedPlan: RevisionPlan = {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "Teacher failure-shape replay",
    operations: [
      {
        op: "set_position",
        target_id: "block-header-0-t3",
        before_summary:
          "Textbox id=block-header-0-t3 in header section currently positioned left=48 top=121 width=698 height=14 with effective_bottom=135",
        intended_change:
          "Raise the contact-info row by 7 pixels to top=114, increasing bottom padding inside the gray header, unifying the name, role, and contact info as a single contained header block, and balancing vertical spacing within the header.",
        values: { top: 114 },
        founder_feedback_item:
          "Keep the name, role title, and complete contact-information row visually contained inside the light-gray header rectangle as one unified header block.",
        confidence: 0.98,
      },
    ],
  };
  const copiedInv = buildCanvasInventory(
    pageCanvas([
      {
        type: "rect",
        id: "block-header-0-r0",
        left: 0,
        top: 0,
        width: 794,
        height: 124,
        fill: "#f1f5f9",
        data: { section: "header", role: "header-band" },
      },
      {
        type: "textbox",
        id: "block-header-0-t2",
        left: 48,
        top: 98,
        width: 698,
        height: 19,
        text: "Mid-Level Teacher",
        data: { section: "header", role: "role" },
      },
      {
        type: "textbox",
        id: "block-header-0-t3",
        left: 48,
        top: 121,
        width: 698,
        height: 14,
        text: "elena.thornton@fictmail.com · (555) 389-4721 · City",
        data: { section: "header", role: "contact" },
      },
    ]),
  );

  checks.push(
    assert(
      !parseExplicitMoveDirections(teacherPaddingRc).has("down") &&
        dirsOf(teacherPaddingRc) === "NONE",
      "copied_evidence_lower_edge_none",
      dirsOf(teacherPaddingRc),
    ),
  );
  const copiedDir = validatePlanVerticalDirections({
    plan: copiedPlan,
    inventory: copiedInv,
    requested_changes: copiedRequested,
  });
  checks.push(
    assert(
      copiedDir.ok === true && copiedDir.errors.length === 0,
      "copied_evidence_direction_gate_pass",
      copiedDir.errors.join("; ") || "ok",
    ),
  );
  checks.push(
    assert(
      copiedPlan.operations[0]?.values?.top === 114 &&
        114 - 121 === -7,
      "copied_evidence_delta_top_neg7",
      "top 121→114",
    ),
  );

  // Prefer optional local prior-canvas copy when present; else evidence-shaped
  // header-only canvas with the same t2/t3 geometry that produced the overlap.
  const fixtureCanvasPath = join(TEACHER_FIXTURE, "prior-canvas.json");
  const geoCanvas: FabricCanvasDoc = existsSync(fixtureCanvasPath)
    ? (JSON.parse(readFileSync(fixtureCanvasPath, "utf8")) as FabricCanvasDoc)
    : pageCanvas([
        {
          type: "rect",
          id: "block-header-0-r0",
          left: 0,
          top: 0,
          width: 794,
          height: 124,
          fill: "#f1f5f9",
          data: { section: "header", role: "header-band" },
        },
        {
          type: "textbox",
          id: "block-header-0-t2",
          left: 48,
          top: 98,
          width: 698,
          height: 19,
          fontSize: 14,
          text: "Mid-Level Teacher",
          data: { section: "header", role: "role" },
        },
        {
          type: "textbox",
          id: "block-header-0-t3",
          left: 48,
          top: 121,
          width: 698,
          height: 14,
          fontSize: 11,
          text: "elena.thornton@fictmail.com · (555) 389-4721 · City",
          data: { section: "header", role: "contact" },
        },
      ]);
  const geo = validatePlanGeometrySafety({
    plan: copiedPlan,
    canvas: geoCanvas,
  });
  checks.push(
    assert(
      geo.page_oob === 0,
      "copied_evidence_geometry_no_page_oob",
      `oob=${geo.page_oob}`,
    ),
  );
  checks.push(
    assert(
      geo.ok === false &&
        geo.text_overlaps >= 1 &&
        geo.findings.some(
          (f) =>
            f.code === "PLAN_TEXT_OVERLAP" &&
            f.object_ids.includes("block-header-0-t2") &&
            f.object_ids.includes("block-header-0-t3"),
        ),
      "copied_evidence_geometry_still_fail_closed_on_role_contact_overlap",
      `ok=${geo.ok} overlaps=${geo.text_overlaps} findings=${JSON.stringify(geo.findings)}`,
    ),
  );

  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.length - passed;
  const report = {
    schema_version: "verify-directional-intent-parsing-1.0.0",
    at: new Date().toISOString(),
    ok: failed === 0,
    passed,
    failed,
    total: checks.length,
    checks,
  };
  mkdirSync(join(REPO, "SOS/07_LOGS/saios/founder-revision"), {
    recursive: true,
  });
  writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify(
      {
        ok: report.ok,
        passed,
        failed,
        total: checks.length,
        out: OUT,
      },
      null,
      2,
    ),
  );
  if (!report.ok) {
    for (const c of checks.filter((x) => !x.pass)) {
      console.error(`FAIL ${c.name}: ${c.detail}`);
    }
    process.exit(1);
  }
}

main();
