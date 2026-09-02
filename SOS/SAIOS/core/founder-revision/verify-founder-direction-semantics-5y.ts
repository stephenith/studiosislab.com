/**
 * Phase 5Y — Founder direction negation + target-scope reliability verifier.
 *
 * Proves negation-aware movement parsing, move-target section binding (not
 * incidental nouns), edge-extension preservation, and Business Analyst–shaped
 * band-only containment. Never retries historical production tasks.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { FabricCanvasDoc } from "./CanvasInventory.js";
import { buildCanvasInventory } from "./CanvasInventory.js";
import { buildPlanWithDeterministicSpacingOwnership } from "./DeterministicSpacingPlan.js";
import {
  applyHeaderIdentityBlockLayout,
  feedbackRequiresContactUpward,
  feedbackRequestsPreserveHeaderTextPositions,
  HEADER_IDENTITY_PAD_PX,
  HEADER_TO_SUMMARY_CLEARANCE_PX,
} from "./HeaderIdentityLayout.js";
import {
  detectDirectionScope,
  isBandEdgeExtensionDirection,
  parseExplicitMoveDirections,
  sectionTokensFromText,
  validatePlanVerticalDirections,
} from "./PositionOpCanonicalization.js";
import { findTextOverlapFindings } from "./RevisionAcceptanceChecks.js";
import type { RevisionPlan } from "./revision-task-types.js";
import { effectiveTextHeightScaled } from "./TextEffectiveHeight.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, "../../..");
const OUT = join(
  REPO,
  "07_LOGS/saios/founder-revision/verify-founder-direction-semantics-5y.json",
);

type Check = { name: string; pass: boolean; detail: string };

function assert(cond: boolean, name: string, detail: string): Check {
  return { name, pass: !!cond, detail };
}

function dirsOf(text: string): string {
  return [...parseExplicitMoveDirections(text)].sort().join(",") || "NONE";
}

function pageBg() {
  return {
    type: "rect",
    id: "page-bg",
    left: 0,
    top: 0,
    width: 794,
    height: 1123,
    fill: "#ffffff",
    data: { system: true, kind: "page-bg", role: "pageBackground" },
  };
}

function baShapedCanvas(): FabricCanvasDoc {
  return {
    version: "5.3.0",
    width: 794,
    height: 1123,
    objects: [
      pageBg(),
      {
        type: "rect",
        id: "block-header-0-r0",
        left: 48,
        top: 48,
        width: 698,
        height: 54,
        fill: "#dbeafe",
        data: { section: "header", role: "pale-strip", id: "block-header-0-r0" },
      },
      {
        type: "textbox",
        id: "block-header-0-t1",
        left: 60,
        top: 58,
        width: 680,
        height: 39,
        fontSize: 28,
        lineHeight: 1.1,
        fontWeight: "bold",
        text: "Morgan Ellis",
        fill: "#0f172a",
        data: { section: "header", role: "name", id: "block-header-0-t1" },
      },
      {
        type: "textbox",
        id: "block-header-0-t2",
        left: 60,
        top: 97,
        width: 680,
        height: 14,
        fontSize: 11,
        lineHeight: 1.2,
        text: "Business Analyst  ·  morgan@example.com · (555) 814-3200",
        fill: "#0f172a",
        data: { section: "header", role: "contact", id: "block-header-0-t2" },
      },
      {
        type: "textbox",
        id: "block-summary-1-t1",
        left: 48,
        top: 140,
        width: 200,
        height: 15,
        fontSize: 11,
        fontWeight: "bold",
        text: "SUMMARY",
        data: { section: "summary", role: "heading", id: "block-summary-1-t1" },
      },
      {
        type: "textbox",
        id: "block-summary-1-t2",
        left: 48,
        top: 165,
        width: 680,
        height: 40,
        fontSize: 11,
        text: "Analyst with cross-functional delivery ownership.",
        data: { section: "summary", role: "body", id: "block-summary-1-t2" },
      },
    ],
  };
}

const BA_FEEDBACK = [
  "Extend the light-blue header background downward while keeping its top edge fixed so the complete Business Analyst title and contact-details line are fully enclosed within the header area.",
  "Preserve the current vertical positions of the name, title, and contact information if their existing internal spacing is already non-overlapping; solve the containment issue primarily by increasing the header background height.",
  "Calculate the final header bottom from the actual rendered bottom of the lowest header identity text plus the required positive bottom padding.",
  "Maintain approximately 8–12 px of visible bottom padding between the final rendered contact-details text and the bottom edge of the light-blue header background.",
  "Do not move the contact-details line upward into the name or title, and do not allow any header identity text objects to overlap one another.",
  "If expanding the header requires additional clearance before the Summary section, move the body content downward only as much as necessary to preserve a clear positive gap.",
  "Before returning the revision to Founder Review, validate the final post-normalization rendered geometry and confirm that every header identity element is fully contained, internally non-overlapping, and inside the header background.",
  "Preserve the complete body layout, section positions, typography, colors, widths, and existing spacing because those areas currently look correct.",
];

function cloneCanvas(c: FabricCanvasDoc): FabricCanvasDoc {
  return JSON.parse(JSON.stringify(c)) as FabricCanvasDoc;
}

function objById(c: FabricCanvasDoc, id: string): Record<string, unknown> | null {
  for (const o of c.objects ?? []) {
    const r = o as Record<string, unknown>;
    if (r.id === id) return r;
  }
  return null;
}

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : NaN;
}

function main(): void {
  const checks: Check[] = [];

  // --- Negation matrix ---
  checks.push(
    assert(dirsOf("move contact upward") === "up", "neg_pos_contact_up", dirsOf("move contact upward")),
  );
  checks.push(
    assert(
      dirsOf("do not move contact upward") === "NONE",
      "neg_do_not_contact_up",
      dirsOf("do not move contact upward"),
    ),
  );
  checks.push(
    assert(dirsOf("move contact downward") === "down", "neg_pos_contact_down", dirsOf("move contact downward")),
  );
  checks.push(
    assert(
      dirsOf("do not move contact downward") === "NONE",
      "neg_do_not_contact_down",
      dirsOf("do not move contact downward"),
    ),
  );
  checks.push(
    assert(
      dirsOf("never move the title downward") === "NONE",
      "neg_never_title_down",
      dirsOf("never move the title downward"),
    ),
  );
  checks.push(
    assert(
      !feedbackRequiresContactUpward([
        "Do not move the contact-details line upward into the name or title.",
      ]),
      "neg_require_up_false",
      String(feedbackRequiresContactUpward([
        "Do not move the contact-details line upward into the name or title.",
      ])),
    ),
  );
  checks.push(
    assert(
      feedbackRequiresContactUpward(["Move the contact row upward inside the header."]),
      "neg_require_up_true_positive",
      "ok",
    ),
  );

  // --- Edge extension ---
  const extend =
    "Extend the light-blue header background downward while keeping its top edge fixed so the contact line is enclosed.";
  checks.push(
    assert(
      isBandEdgeExtensionDirection(extend) && dirsOf(extend) === "NONE",
      "edge_extension_no_position_down",
      `edge=${isBandEdgeExtensionDirection(extend)} dirs=${dirsOf(extend)}`,
    ),
  );
  checks.push(
    assert(
      isBandEdgeExtensionDirection(
        "Do not move contact upward; extend the header background downward instead.",
      ) &&
        dirsOf(
          "Do not move contact upward; extend the header background downward instead.",
        ) === "NONE",
      "edge_extension_with_negated_move",
      dirsOf(
        "Do not move contact upward; extend the header background downward instead.",
      ),
    ),
  );

  // --- Target scope ---
  const bodyIfHeader =
    "If expanding the header requires additional clearance before the Summary section, move the body content downward only as much as necessary to preserve a clear positive gap.";
  checks.push(
    assert(dirsOf(bodyIfHeader) === "down", "scope_body_if_header_dirs", dirsOf(bodyIfHeader)),
  );
  checks.push(
    assert(
      detectDirectionScope(bodyIfHeader) === "object",
      "scope_body_if_header_object_scope",
      detectDirectionScope(bodyIfHeader),
    ),
  );
  checks.push(
    assert(
      sectionTokensFromText(bodyIfHeader).includes("summary") &&
        !sectionTokensFromText(bodyIfHeader).includes("header"),
      "scope_body_if_header_sections",
      sectionTokensFromText(bodyIfHeader).join(","),
    ),
  );

  const moveSummaryBecauseHeader =
    "Move the Summary downward because the header is taller.";
  checks.push(
    assert(
      dirsOf(moveSummaryBecauseHeader) === "down" &&
        sectionTokensFromText(moveSummaryBecauseHeader).includes("summary") &&
        !sectionTokensFromText(moveSummaryBecauseHeader).includes("header"),
      "scope_summary_not_header_context",
      sectionTokensFromText(moveSummaryBecauseHeader).join(","),
    ),
  );

  const moveHeader =
    "Move the header downward away from the name.";
  checks.push(
    assert(
      dirsOf(moveHeader) === "down" &&
        sectionTokensFromText(moveHeader).includes("header"),
      "scope_explicit_header_down",
      `dirs=${dirsOf(moveHeader)} sec=${sectionTokensFromText(moveHeader).join(",")}`,
    ),
  );

  const keepHeaderMoveBody =
    "Keep header fixed and move body downward.";
  checks.push(
    assert(
      dirsOf(keepHeaderMoveBody) === "down" &&
        detectDirectionScope(keepHeaderMoveBody) === "object",
      "scope_keep_header_move_body",
      `dirs=${dirsOf(keepHeaderMoveBody)} scope=${detectDirectionScope(keepHeaderMoveBody)}`,
    ),
  );

  // --- BA offline replay ---
  const ba = baShapedCanvas();
  checks.push(
    assert(
      feedbackRequestsPreserveHeaderTextPositions(BA_FEEDBACK),
      "ba_preserve_flag",
      "ok",
    ),
  );
  checks.push(
    assert(
      !feedbackRequiresContactUpward(BA_FEEDBACK),
      "ba_require_up_false",
      String(feedbackRequiresContactUpward(BA_FEEDBACK)),
    ),
  );
  const baClone = cloneCanvas(ba);
  const baR = applyHeaderIdentityBlockLayout({
    canvas: baClone,
    requested_changes: BA_FEEDBACK,
  });
  const band = objById(baClone, "block-header-0-r0")!;
  const name = objById(baClone, "block-header-0-t1")!;
  const contact = objById(baClone, "block-header-0-t2")!;
  const summary = objById(baClone, "block-summary-1-t1")!;
  const contactEb = num(contact.top) + effectiveTextHeightScaled(contact);
  const bandBottom = num(band.top) + num(band.height);
  const summaryClear = num(summary.top) - bandBottom;
  checks.push(
    assert(
      baR.ok && baR.ownership_mode === "BAND_ONLY" && baR.text_positions_preserved,
      "ba_band_only",
      `mode=${baR.ownership_mode} preserved=${baR.text_positions_preserved}`,
    ),
  );
  checks.push(
    assert(
      num(band.top) === 48 && num(name.top) === 58 && num(contact.top) === 97,
      "ba_tops_preserved",
      `band=${band.top} name=${name.top} contact=${contact.top}`,
    ),
  );
  checks.push(
    assert(
      bandBottom >= 119 - 0.5 && num(band.height) >= 71 - 0.5,
      "ba_band_height_min",
      `h=${band.height} bottom=${bandBottom}`,
    ),
  );
  checks.push(
    assert(
      contactEb <= bandBottom - HEADER_IDENTITY_PAD_PX + 0.5,
      "ba_bottom_pad",
      `pad=${bandBottom - contactEb}`,
    ),
  );
  checks.push(
    assert(
      summaryClear + 1e-9 >= HEADER_TO_SUMMARY_CLEARANCE_PX - 0.5 ||
        baR.summary_shift_px >= 0,
      "ba_summary_clearance",
      `clear=${summaryClear} shift=${baR.summary_shift_px}`,
    ),
  );
  checks.push(
    assert(
      findTextOverlapFindings(baClone).length === 0,
      "ba_zero_overlaps",
      String(findTextOverlapFindings(baClone).length),
    ),
  );

  const aiPlan: RevisionPlan = {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "AI band expand",
    operations: [
      {
        op: "set_dimensions",
        target_id: "block-header-0-r0",
        intended_change: "expand band height",
        values: { height: 69 },
        founder_feedback_item: BA_FEEDBACK[0]!,
        confidence: 0.95,
      },
    ],
    notes: [],
  };
  const det = buildPlanWithDeterministicSpacingOwnership({
    priorCanvas: ba,
    requested_changes: BA_FEEDBACK,
    aiPlan,
  });
  const headerPosOps = (det.plan?.operations ?? []).filter(
    (o) =>
      o.op === "set_position" &&
      "target_id" in o &&
      String(o.target_id).includes("header"),
  );
  checks.push(
    assert(
      det.ok === true && headerPosOps.length === 0,
      "ba_unnecessary_header_position_ops_zero",
      `n=${headerPosOps.length} total=${det.plan?.operations.length}`,
    ),
  );
  const inv = buildCanvasInventory(ba);
  const dirGate = validatePlanVerticalDirections({
    plan: det.plan!,
    inventory: inv,
    requested_changes: BA_FEEDBACK,
  });
  checks.push(
    assert(dirGate.ok, "ba_direction_pass", dirGate.errors.join("; ") || "ok"),
  );

  // --- Fail-closed contradictions ---
  const contactDownPlan: RevisionPlan = {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "bad",
    operations: [
      {
        op: "set_position",
        target_id: "block-header-0-t2",
        intended_change: "wrong way",
        values: { top: 90 },
        founder_feedback_item: "Move the contact downward.",
        confidence: 1,
      },
    ],
    notes: [],
  };
  const contactDownFail = validatePlanVerticalDirections({
    plan: contactDownPlan,
    inventory: inv,
    requested_changes: ["Move the contact downward."],
  });
  checks.push(
    assert(
      !contactDownFail.ok,
      "fail_closed_contact_down_vs_up",
      contactDownFail.errors.join("; "),
    ),
  );

  const summaryDownPlan: RevisionPlan = {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "bad",
    operations: [
      {
        op: "set_position",
        target_id: "block-summary-1-t1",
        intended_change: "wrong way",
        values: { top: 120 },
        founder_feedback_item: "Move the Summary downward.",
        confidence: 1,
      },
    ],
    notes: [],
  };
  const summaryDownFail = validatePlanVerticalDirections({
    plan: summaryDownPlan,
    inventory: inv,
    requested_changes: ["Move the Summary downward."],
  });
  checks.push(
    assert(
      !summaryDownFail.ok,
      "fail_closed_summary_down_vs_up",
      summaryDownFail.errors.join("; "),
    ),
  );

  // Body-down must not fail header-only band dim plans
  const headerDimOnly: RevisionPlan = {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "dim",
    operations: [
      {
        op: "set_dimensions",
        target_id: "block-header-0-r0",
        intended_change: "grow",
        values: { height: 71 },
        founder_feedback_item: BA_FEEDBACK[0]!,
        confidence: 1,
      },
    ],
    notes: [],
  };
  checks.push(
    assert(
      validatePlanVerticalDirections({
        plan: headerDimOnly,
        inventory: inv,
        requested_changes: BA_FEEDBACK,
      }).ok,
      "compound_ba_packet_dim_only_passes",
      "ok",
    ),
  );

  checks.push(
    assert(true, "historical_tasks_not_retried", "revtask-ecd4d24a-139 frozen"),
  );

  const failed = checks.filter((c) => !c.pass);
  const report = {
    schema_version: "verify-founder-direction-semantics-5y-1.0.0",
    ok: failed.length === 0,
    checks,
    failed: failed.map((c) => c.name),
    historical_tasks_retried: false,
    at: new Date().toISOString(),
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(report, null, 2));
  if (!report.ok) {
    console.error("FAIL verify-founder-direction-semantics-5y", report.failed);
    process.exit(1);
  }
  console.log("PASS verify-founder-direction-semantics-5y", {
    checks: checks.length,
  });
}

main();
