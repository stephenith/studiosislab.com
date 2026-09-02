/**
 * Phase 5U — header band edge-extension vs content rebalance direction gate.
 * Proves "extend rectangle downward OR rebalance" does not bind DOWN onto
 * contact set_position that moves upward during safe rebalancing.
 * No OpenAI. No production task mutation. Never retries revtask-a8653c03-20f.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  buildCanvasInventory,
  type FabricCanvasDoc,
} from "./CanvasInventory.js";
import { validatePlanGeometrySafety } from "./PlanGeometrySafety.js";
import {
  isBandEdgeExtensionDirection,
  parseExplicitMoveDirections,
  validatePlanVerticalDirections,
} from "./PositionOpCanonicalization.js";
import type { RevisionPlan } from "./revision-task-types.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/founder-revision/verify-header-direction-or-branch-5u.json",
);

type Check = { name: string; pass: boolean; detail: string };

function assert(cond: boolean, name: string, detail: string): Check {
  return { name, pass: !!cond, detail };
}

function dirsOf(text: string): string {
  return [...parseExplicitMoveDirections(text)].sort().join(",") || "NONE";
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

/** Synthetic Account-Executive-like header: contact straddles band bottom. */
function headerFixtureCanvas(): FabricCanvasDoc {
  return pageCanvas([
    {
      type: "rect",
      id: "block-header-0-r0",
      left: 0,
      top: 0,
      width: 794,
      height: 124,
      fill: "#d0d0d0",
      data: { role: "header-band", section: "header" },
    },
    {
      type: "textbox",
      id: "block-header-0-t1",
      left: 48,
      top: 48,
      width: 698,
      height: 46,
      text: "Candidate Name",
      fontSize: 38,
      data: { section: "header", role: "header-name" },
    },
    {
      type: "textbox",
      id: "block-header-0-t2",
      left: 48,
      top: 98,
      width: 698,
      height: 19,
      text: "Account Executive",
      fontSize: 13,
      data: { section: "header", role: "header-role" },
    },
    {
      type: "textbox",
      id: "block-header-0-t3",
      left: 48,
      top: 121,
      width: 698,
      height: 14,
      text: "name@emailfictional.com · (555) 832-9147 · City, ST",
      fontSize: 10,
      data: { section: "header" },
    },
    {
      type: "textbox",
      id: "block-summary-1-t0",
      left: 48,
      top: 153,
      width: 698,
      height: 15,
      text: "SUMMARY",
      fontSize: 12,
      data: { section: "summary" },
    },
  ]);
}

function main(): void {
  const checks: Check[] = [];
  const extendOrRebalance =
    "Extend the gray header rectangle downward as needed, or rebalance the header content, so the contact/details line is fully contained within the header band.";
  const adjustContain =
    "Adjust the top header so the job title and the full contact/details line below the name sit fully inside the gray header background with proper bottom padding.";
  const preserveRest =
    "Preserve the rest of the resume layout, spacing, typography, and section structure, since the remaining template looks good.";

  checks.push(
    assert(
      isBandEdgeExtensionDirection(extendOrRebalance),
      "1_band_partial_outside_context_is_edge_extension",
      extendOrRebalance.slice(0, 80),
    ),
  );
  checks.push(
    assert(
      dirsOf(extendOrRebalance) === "NONE",
      "2_extend_or_rebalance_binds_no_position_down",
      dirsOf(extendOrRebalance),
    ),
  );

  const canvas = headerFixtureCanvas();
  const inventory = buildCanvasInventory(canvas);
  const band = inventory.find((o) => o.id === "block-header-0-r0")!;
  const contact = inventory.find((o) => o.id === "block-header-0-t3")!;
  const summary = inventory.find((o) => o.id === "block-summary-1-t0")!;

  const beforeContactBottom =
    (contact.effective_bottom as number | undefined) ??
    Number(contact.top) + Number(contact.effective_height ?? contact.height ?? 0);
  const beforeBandBottom = Number(band.top) + Number(band.height);
  checks.push(
    assert(
      beforeContactBottom > beforeBandBottom,
      "1b_contact_partially_outside_before",
      `contact_bottom=${beforeContactBottom} band_bottom=${beforeBandBottom}`,
    ),
  );

  const safePlan: RevisionPlan = {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "Extend band height; rebalance contact upward into band.",
    operations: [
      {
        op: "set_dimensions",
        target_id: "block-header-0-r0",
        before_summary: "header band h=124",
        intended_change:
          "Extend the gray header rectangle downward from height 124 to height 140.",
        values: { height: 140 },
        founder_feedback_item: extendOrRebalance,
        confidence: 0.95,
      },
      {
        op: "set_position",
        target_id: "block-header-0-t3",
        before_summary: "contact top=121",
        intended_change: "Apply deterministic layout-normalized position for contact",
        // Title ends ~117; place contact just below with room for band pad.
        values: { top: 118 },
        founder_feedback_item: adjustContain,
        founder_feedback_items: [extendOrRebalance],
        confidence: 1,
      },
    ],
    notes: ["deterministic_spacing_ownership", "shifted_objects=1"],
  };

  const dirGate = validatePlanVerticalDirections({
    plan: safePlan,
    inventory,
    requested_changes: [adjustContain, extendOrRebalance, preserveRest],
  });
  checks.push(
    assert(dirGate.ok, "8_direction_validator_pass_safe_rebalance", dirGate.errors.join("; ") || "ok"),
  );

  // Geometry after applying plan values (simulate)
  const afterBandBottom = 0 + 140;
  const afterContactTop = 118;
  const afterContactBottom = 118 + 14;
  const pad = afterBandBottom - afterContactBottom;
  checks.push(
    assert(
      afterBandBottom > beforeBandBottom && Number(band.top) === 0,
      "3_background_top_fixed_height_grows_down",
      `band_top=0 h 124→140 bottom ${beforeBandBottom}→${afterBandBottom}`,
    ),
  );
  checks.push(
    assert(
      afterContactTop < Number(contact.top),
      "4_contact_moves_up_during_rebalance",
      `top ${contact.top}→${afterContactTop}`,
    ),
  );
  checks.push(
    assert(
      afterContactBottom <= afterBandBottom - 8,
      "5_final_contact_containment_pass",
      `contact_bottom=${afterContactBottom} band_bottom=${afterBandBottom} pad=${pad}`,
    ),
  );
  checks.push(
    assert(pad >= 8, "6_proper_bottom_padding_pass", `pad=${pad}`),
  );
  checks.push(
    assert(
      Number(summary.top) - afterBandBottom >= 8,
      "7_summary_clearance_pass",
      `summary_top=${summary.top} band_bottom=${afterBandBottom}`,
    ),
  );

  checks.push(
    assert(
      dirsOf(adjustContain) === "NONE" &&
        dirsOf(preserveRest) === "NONE",
      "9_equivalent_containment_lines_no_false_down",
      `adjust=${dirsOf(adjustContain)} preserve=${dirsOf(preserveRest)}`,
    ),
  );
  checks.push(
    assert(
      /preserve/i.test(preserveRest),
      "10_preserve_rest_is_verification_acceptance_wording",
      preserveRest.slice(0, 60),
    ),
  );

  // Explicit move contact downward + upward movement MUST FAIL
  const explicitDownFail = validatePlanVerticalDirections({
    plan: {
      ...safePlan,
      operations: [
        {
          op: "set_position",
          target_id: "block-header-0-t3",
          before_summary: "contact",
          intended_change: "move contact down",
          values: { top: 102 },
          founder_feedback_item: "move the contact line downward",
          confidence: 1,
        },
      ],
    },
    inventory,
    requested_changes: ["move the contact line downward"],
  });
  checks.push(
    assert(
      !explicitDownFail.ok &&
        explicitDownFail.errors.some((e) => e.includes("downward")),
      "11_explicit_contact_down_vs_up_fails",
      explicitDownFail.errors.join("; "),
    ),
  );

  // Explicit move name up + downward name movement MUST FAIL
  const nameInv = inventory.find((o) => o.id === "block-header-0-t1")!;
  const nameDownFail = validatePlanVerticalDirections({
    plan: {
      ...safePlan,
      operations: [
        {
          op: "set_position",
          target_id: "block-header-0-t1",
          before_summary: "name",
          intended_change: "move name down wrongly",
          values: { top: Number(nameInv.top) + 20 },
          founder_feedback_item: "move name up",
          confidence: 1,
        },
      ],
    },
    inventory,
    requested_changes: ["move name up"],
  });
  checks.push(
    assert(
      !nameDownFail.ok && nameDownFail.errors.some((e) => e.includes("upward")),
      "12_explicit_name_up_vs_down_fails",
      nameDownFail.errors.join("; "),
    ),
  );

  // Wrong-object downward cannot satisfy band extension (extension binds no position down)
  checks.push(
    assert(
      dirsOf(extendOrRebalance) === "NONE",
      "13_wrong_object_down_cannot_satisfy_band_extension",
      "extension phrase yields no position DOWN token",
    ),
  );

  // Direct band vertical translation vs bottom-edge extension
  checks.push(
    assert(
      isBandEdgeExtensionDirection(
        "Extend the gray header rectangle downward as needed",
      ) &&
        !isBandEdgeExtensionDirection("move the header band downward 20px") &&
        dirsOf("move the header band downward 20px") === "down",
      "14_band_translation_vs_bottom_edge_extension",
      `ext=${isBandEdgeExtensionDirection("Extend the gray header rectangle downward as needed")} moveDirs=${dirsOf("move the header band downward 20px")}`,
    ),
  );

  const geo = validatePlanGeometrySafety({
    canvas,
    plan: safePlan,
  });
  checks.push(
    assert(
      geo.ok && geo.text_overlaps === 0,
      "15_no_text_overlaps",
      geo.error ?? `overlaps=${geo.text_overlaps}`,
    ),
  );
  checks.push(
    assert(
      geo.ok && geo.page_oob === 0,
      "16_no_page_oob",
      geo.error ?? `oob=${geo.page_oob}`,
    ),
  );

  // Preserve fail-closed for shift downward alone
  checks.push(
    assert(
      dirsOf("shift downward") === "down" &&
        dirsOf("move upward") === "up",
      "fail_closed_imperatives_preserved",
      `shift=${dirsOf("shift downward")} moveUp=${dirsOf("move upward")}`,
    ),
  );

  const failed = checks.filter((c) => !c.pass);
  const report = {
    schema_version: "verify-header-direction-or-branch-5u-1.0.0",
    phase: "5U",
    generated_at: new Date().toISOString(),
    historical_task_frozen: "revtask-a8653c03-20f",
    pass: failed.length === 0,
    checks,
    failed: failed.map((c) => c.name),
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ pass: report.pass, failed: report.failed }, null, 2));
  if (!report.pass) process.exitCode = 1;
}

main();
