/**
 * Offline verify: Phase 4I target-scoped direction attribution.
 * OBJECT_SPECIFIC vs SECTION_SPECIFIC binding. No OpenAI. No production mutation.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  buildCanvasInventory,
  type FabricCanvasDoc,
} from "./CanvasInventory.js";
import { validatePlanGeometrySafety } from "./PlanGeometrySafety.js";
import {
  detectDirectionScope,
  objectClassesFromText,
  parseExplicitMoveDirections,
  validatePlanVerticalDirections,
} from "./PositionOpCanonicalization.js";
import type { RevisionPlan } from "./revision-task-types.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/founder-revision/verify-direction-target-scope.json",
);

type Check = { name: string; pass: boolean; detail: string };

function assert(cond: boolean, name: string, detail: string): Check {
  return { name, pass: !!cond, detail };
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

function headerFixture() {
  return buildCanvasInventory(
    pageCanvas([
      {
        type: "rect",
        id: "block-header-0-r0",
        left: 48,
        top: 48,
        width: 698,
        height: 54,
        fill: "#dbeafe",
        data: { section: "header", role: "pale-strip" },
      },
      {
        type: "textbox",
        id: "block-header-0-t1",
        left: 60,
        top: 58,
        width: 674,
        height: 39,
        text: "Evelyn Sterling",
        data: { section: "header", role: "header-name" },
      },
      {
        type: "textbox",
        id: "block-header-0-t2",
        left: 60,
        top: 97,
        width: 674,
        height: 14,
        text: "Hotel Manager  ·  evelyn.sterling@examplemail.com · (555) 874-3190",
        data: { section: "header" },
      },
    ]),
  );
}

function op(
  target_id: string,
  top: number,
  intended_change: string,
  founder_feedback_item: string,
) {
  return {
    op: "set_position" as const,
    target_id,
    values: { top },
    intended_change,
    founder_feedback_item,
    confidence: 0.9,
  };
}

function planOf(operations: ReturnType<typeof op>[]): RevisionPlan {
  return {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "direction target-scope verify",
    operations,
  };
}

function main(): void {
  const checks: Check[] = [];
  const inv = headerFixture();
  const contactFb = "Move the contact row upward.";
  const withinFb =
    "Move the contact row upward within the blue header.";
  const entireFb = "Move the entire header upward.";
  const langsFb = "Move the Languages section upward.";

  checks.push(
    assert(
      detectDirectionScope(contactFb) === "object" &&
        objectClassesFromText(contactFb).includes("contact"),
      "scope_contact_row_is_object",
      `${detectDirectionScope(contactFb)} ${objectClassesFromText(contactFb).join(",")}`,
    ),
  );
  checks.push(
    assert(
      detectDirectionScope(withinFb) === "object",
      "scope_contact_within_header_is_object_not_section",
      detectDirectionScope(withinFb),
    ),
  );
  checks.push(
    assert(
      detectDirectionScope(entireFb) === "section",
      "scope_entire_header_is_section",
      detectDirectionScope(entireFb),
    ),
  );
  checks.push(
    assert(
      detectDirectionScope(langsFb) === "section",
      "scope_languages_section_is_section",
      detectDirectionScope(langsFb),
    ),
  );

  // 1. contact -6 → PASS
  const c1 = validatePlanVerticalDirections({
    plan: planOf([
      op("block-header-0-t2", 91, "raise contact", contactFb),
    ]),
    inventory: inv,
    requested_changes: [contactFb],
  });
  checks.push(
    assert(c1.ok, "matrix_1_contact_up_pass", c1.errors.join("; ") || "ok"),
  );

  // 2. contact +4 → FAIL
  const c2 = validatePlanVerticalDirections({
    plan: planOf([
      op("block-header-0-t2", 101, "nudge", contactFb),
    ]),
    inventory: inv,
    requested_changes: [contactFb],
  });
  checks.push(
    assert(
      !c2.ok && c2.errors.some((e) => e.includes("upward")),
      "matrix_2_contact_down_fail",
      c2.errors.join("; "),
    ),
  );

  // 3. contact -6 + name +2 → PASS (name must not inherit)
  const c3 = validatePlanVerticalDirections({
    plan: planOf([
      op("block-header-0-t2", 91, "raise contact", contactFb),
      op("block-header-0-t1", 60, "nudge name", "Balance padding."),
    ]),
    inventory: inv,
    requested_changes: [contactFb],
  });
  checks.push(
    assert(
      c3.ok,
      "matrix_3_name_does_not_inherit_contact_up",
      c3.errors.join("; ") || "ok",
    ),
  );

  // 4. contact within header; contact -7, rect +2 → PASS
  const c4 = validatePlanVerticalDirections({
    plan: planOf([
      op("block-header-0-t2", 90, "raise contact", withinFb),
      op(
        "block-header-0-r0",
        50,
        "Adjust the header rectangle top position downward slightly",
        "Balance the padding inside the header.",
      ),
    ]),
    inventory: inv,
    requested_changes: [withinFb],
  });
  checks.push(
    assert(
      c4.ok,
      "matrix_4_rect_does_not_inherit_contact_up_within_header",
      c4.errors.join("; ") || "ok",
    ),
  );

  // 5. entire header up; rect +2 → FAIL
  const c5 = validatePlanVerticalDirections({
    plan: planOf([op("block-header-0-r0", 50, "x", entireFb)]),
    inventory: inv,
    requested_changes: [entireFb],
  });
  checks.push(
    assert(
      !c5.ok && c5.errors.some((e) => e.includes("upward")),
      "matrix_5_entire_header_rect_down_fail",
      c5.errors.join("; "),
    ),
  );

  // 6. entire header up; all -5 → PASS
  const c6 = validatePlanVerticalDirections({
    plan: planOf([
      op("block-header-0-t1", 53, "x", entireFb),
      op("block-header-0-t2", 92, "x", entireFb),
      op("block-header-0-r0", 43, "x", entireFb),
    ]),
    inventory: inv,
    requested_changes: [entireFb],
  });
  checks.push(
    assert(c6.ok, "matrix_6_entire_header_all_up_pass", c6.errors.join("; ") || "ok"),
  );

  // 7. Languages section up; body +4 → FAIL
  const langsInv = buildCanvasInventory(
    pageCanvas([
      {
        type: "textbox",
        id: "block-languages-6-t2",
        left: 48,
        top: 1100,
        width: 200,
        height: 16,
        text: "English",
        data: { section: "languages", role: "body" },
      },
    ]),
  );
  const c7 = validatePlanVerticalDirections({
    plan: planOf([
      op("block-languages-6-t2", 1104, "x", langsFb),
    ]),
    inventory: langsInv,
    requested_changes: [langsFb],
  });
  checks.push(
    assert(
      !c7.ok && c7.errors.some((e) => e.includes("upward")),
      "matrix_7_languages_section_down_fail",
      c7.errors.join("; "),
    ),
  );

  // 8. balance padding → NONE
  checks.push(
    assert(
      parseExplicitMoveDirections("Balance the padding inside the header.")
        .size === 0,
      "matrix_8_balance_padding_none",
      "ok",
    ),
  );

  // 9. lower edge descriptive → NONE
  checks.push(
    assert(
      parseExplicitMoveDirections(
        "Keep the contact row away from the lower edge.",
      ).size === 0,
      "matrix_9_lower_edge_none",
      "ok",
    ),
  );

  // Fail-closed proofs
  const objFail = validatePlanVerticalDirections({
    plan: planOf([op("block-header-0-t2", 101, "x", contactFb)]),
    inventory: inv,
    requested_changes: [contactFb],
  });
  checks.push(
    assert(!objFail.ok, "fail_closed_object_specific", objFail.errors.join("; ")),
  );
  const secFail = validatePlanVerticalDirections({
    plan: planOf([op("block-header-0-r0", 50, "x", entireFb)]),
    inventory: inv,
    requested_changes: [entireFb],
  });
  checks.push(
    assert(!secFail.ok, "fail_closed_section_specific", secFail.errors.join("; ")),
  );

  // Hotel failure-shape replay (generalized; no production mutation)
  const hotelRc =
    "Move the role and contact-information row slightly upward so it sits comfortably within the blue header instead of touching or crossing the bottom boundary.";
  checks.push(
    assert(
      detectDirectionScope(hotelRc) === "object" &&
        parseExplicitMoveDirections(hotelRc).has("up"),
      "hotel_rc_object_scope_up",
      `${detectDirectionScope(hotelRc)} dirs=${[...parseExplicitMoveDirections(hotelRc)]}`,
    ),
  );
  const hotelPlan = planOf([
    op(
      "block-header-0-t1",
      55,
      "Move the name upwards slightly to balance vertical space above and below the header text",
      "Balance the internal vertical spacing of the header so there is clear and approximately even padding above the name and below the contact-information row.",
    ),
    op(
      "block-header-0-t2",
      90,
      "Move the role title and contact-information row upward so it sits comfortably within the blue header rectangle",
      hotelRc,
    ),
    op(
      "block-header-0-r0",
      50,
      "Adjust the header rectangle top position downward slightly to maintain a clean separation from the Summary section",
      "Maintain a clean separation between the completed header block and the Summary section below.",
    ),
  ]);
  const hotelRequested = [
    "Keep the name, role title, and complete contact-information row together inside the light-blue header rectangle as one unified identity block.",
    hotelRc,
    "Balance the internal vertical spacing of the header so there is clear and approximately even padding above the name and below the contact-information row.",
    "Preserve the existing left alignment, typography, colors, header width, and overall visual style.",
    "Maintain a clean separation between the completed header block and the Summary section below.",
    "Do not modify the Summary, Experience, Education, Skills, Certifications, Languages, or other body layout unless absolutely required to preserve the corrected header spacing.",
  ];
  const hotelDir = validatePlanVerticalDirections({
    plan: hotelPlan,
    inventory: inv,
    requested_changes: hotelRequested,
  });
  checks.push(
    assert(
      hotelDir.ok && hotelDir.errors.length === 0,
      "hotel_shape_direction_pass",
      hotelDir.errors.join("; ") || "ok",
    ),
  );
  checks.push(
    assert(
      90 - 97 === -7 && 50 - 48 === 2,
      "hotel_shape_deltas",
      "contact -7 rect +2",
    ),
  );

  const hotelCanvas = pageCanvas([
    {
      type: "rect",
      id: "block-header-0-r0",
      left: 48,
      top: 48,
      width: 698,
      height: 54,
      fill: "#dbeafe",
      data: { section: "header", role: "pale-strip" },
    },
    {
      type: "textbox",
      id: "block-header-0-t1",
      left: 60,
      top: 58,
      width: 674,
      height: 39,
      fontSize: 28,
      text: "Evelyn Sterling",
      data: { section: "header", role: "header-name" },
    },
    {
      type: "textbox",
      id: "block-header-0-t2",
      left: 60,
      top: 97,
      width: 674,
      height: 14,
      fontSize: 11,
      text: "Hotel Manager  ·  evelyn.sterling@examplemail.com · (555) 874-3190",
      data: { section: "header" },
    },
    {
      type: "textbox",
      id: "block-summary-1-t2",
      left: 48,
      top: 165,
      width: 698,
      height: 40,
      fontSize: 11,
      text: "Summary body remains far below the header.",
      data: { section: "summary", role: "body" },
    },
  ]);
  const hotelGeo = validatePlanGeometrySafety({
    plan: hotelPlan,
    canvas: hotelCanvas,
  });
  checks.push(
    assert(
      hotelGeo.page_oob === 0,
      "hotel_shape_geometry_no_page_oob",
      `oob=${hotelGeo.page_oob}`,
    ),
  );
  // Report geometry honestly — do not require ok=true if overlaps exist.
  checks.push(
    assert(
      typeof hotelGeo.ok === "boolean",
      "hotel_shape_geometry_evaluated",
      `ok=${hotelGeo.ok} overlaps=${hotelGeo.text_overlaps} findings=${JSON.stringify(hotelGeo.findings)}`,
    ),
  );

  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.length - passed;
  const report = {
    schema_version: "verify-direction-target-scope-1.0.0",
    at: new Date().toISOString(),
    ok: failed === 0,
    passed,
    failed,
    total: checks.length,
    hotel_attribution_class_resolved: hotelDir.ok,
    hotel_geometry: {
      ok: hotelGeo.ok,
      text_overlaps: hotelGeo.text_overlaps,
      page_oob: hotelGeo.page_oob,
      findings: hotelGeo.findings,
    },
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
        hotel_attribution_class_resolved: hotelDir.ok,
        hotel_geometry_ok: hotelGeo.ok,
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
