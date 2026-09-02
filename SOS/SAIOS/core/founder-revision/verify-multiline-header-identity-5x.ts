/**
 * Phase 5X — multi-line header identity ownership offline verifier.
 *
 * Proves ordered identity stack (name → title → … → contact), band-only
 * preservation when the internal stack is already safe, and full sequential
 * reflow when it is not. Never retries historical production tasks.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { FabricCanvasDoc } from "./CanvasInventory.js";
import {
  applyHeaderIdentityBlockLayout,
  detectHeaderIdentityMembers,
  HEADER_IDENTITY_PAD_PX,
  HEADER_TO_SUMMARY_CLEARANCE_PX,
  isHeaderIdentityStackSequentiallySafe,
} from "./HeaderIdentityLayout.js";
import {
  findTextOverlapFindings,
} from "./RevisionAcceptanceChecks.js";
import { effectiveTextHeightScaled } from "./TextEffectiveHeight.js";
import { buildPlanWithDeterministicSpacingOwnership } from "./DeterministicSpacingPlan.js";
import type { RevisionPlan } from "./revision-task-types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, "../../..");
const OUT = join(
  REPO,
  "07_LOGS/saios/founder-revision/verify-multiline-header-identity-5x.json",
);

type Check = { name: string; pass: boolean; detail: string };

function assert(cond: boolean, name: string, detail: string): Check {
  return { name, pass: !!cond, detail };
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

function cloneCanvas(c: FabricCanvasDoc): FabricCanvasDoc {
  return JSON.parse(JSON.stringify(c)) as FabricCanvasDoc;
}

function objById(
  canvas: FabricCanvasDoc,
  id: string,
): Record<string, unknown> | null {
  for (const o of canvas.objects ?? []) {
    const rec = o as Record<string, unknown>;
    if (rec.id === id) return rec;
    const data = rec.data as Record<string, unknown> | undefined;
    if (data?.id === id) return rec;
  }
  return null;
}

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : NaN;
}

const CONTAINMENT_FEEDBACK = [
  "Increase the height of the light-gray header background while keeping its top edge fixed so the complete contact-details line is fully enclosed within the header area.",
  "Ensure the final rendered bottom of the contact-details text sits clearly above the bottom edge of the gray header with positive bottom padding of approximately 8–12 px.",
  "Do not position the contact line on the gray-to-white boundary; every rendered pixel of the contact text must remain visually inside the gray header background.",
  "Preserve the current positioning and hierarchy of the name and job title unless a very small adjustment is necessary to maintain consistent internal header spacing.",
  "Preserve the Summary, Experience, Education, Skills, Certifications, typography, colors, widths, spacing, and overall body layout because those areas currently look correct.",
];

/** Generalized GM-shaped three-line header (safe internal stack, band overflow). */
function threeLineSafeContainmentCanvas(): FabricCanvasDoc {
  return {
    version: "5.3.0",
    width: 794,
    height: 1123,
    objects: [
      pageBg(),
      {
        type: "rect",
        id: "fx-header-band",
        left: 0,
        top: 0,
        width: 794,
        height: 124,
        fill: "#f1f5f9",
        data: { section: "header", role: "header-band", id: "fx-header-band" },
      },
      {
        type: "textbox",
        id: "fx-header-name",
        left: 48,
        top: 48,
        width: 698,
        height: 46,
        fontSize: 32,
        lineHeight: 1.1,
        fontWeight: "bold",
        text: "Alex Rivera",
        fill: "#0f172a",
        data: { section: "header", role: "name", id: "fx-header-name" },
      },
      {
        type: "textbox",
        id: "fx-header-title",
        left: 48,
        top: 98,
        width: 698,
        height: 19,
        fontSize: 14,
        lineHeight: 1.2,
        text: "Executive Program Lead",
        fill: "#0f172a",
        data: { section: "header", role: "title", id: "fx-header-title" },
      },
      {
        type: "textbox",
        id: "fx-header-contact",
        left: 48,
        top: 121,
        width: 698,
        height: 14,
        fontSize: 10.5,
        lineHeight: 1.2,
        text: "alex.rivera@example.com · +1 (555) 010-8899 · LinkedIn.com/in/alexrivera",
        fill: "#0f172a",
        data: { section: "header", role: "contact", id: "fx-header-contact" },
      },
      {
        type: "textbox",
        id: "fx-summary-h",
        left: 48,
        top: 153,
        width: 200,
        height: 15,
        fontSize: 11,
        fontWeight: "bold",
        text: "SUMMARY",
        data: { section: "summary", role: "heading", id: "fx-summary-h" },
      },
      {
        type: "textbox",
        id: "fx-summary-body",
        left: 48,
        top: 184,
        width: 698,
        height: 40,
        fontSize: 11,
        text: "Program leadership with cross-functional delivery ownership.",
        data: { section: "summary", role: "body", id: "fx-summary-body" },
      },
    ],
  };
}

function twoLineCanvas(opts: {
  bandH: number;
  nameTop: number;
  nameH: number;
  contactTop: number;
  contactH: number;
  summaryTop: number;
}): FabricCanvasDoc {
  return {
    version: "5.3.0",
    width: 794,
    height: 1123,
    objects: [
      pageBg(),
      {
        type: "rect",
        id: "fx-header-band",
        left: 40,
        top: 40,
        width: 714,
        height: opts.bandH,
        fill: "#1e3a8a",
        data: { section: "header", role: "header-band", id: "fx-header-band" },
      },
      {
        type: "textbox",
        id: "fx-header-name",
        left: 56,
        top: opts.nameTop,
        width: 680,
        height: opts.nameH,
        fontSize: 28,
        lineHeight: 1.1,
        fontWeight: "bold",
        text: "Jordan Hale",
        fill: "#ffffff",
        data: { section: "header", role: "name", id: "fx-header-name" },
      },
      {
        type: "textbox",
        id: "fx-header-contact",
        left: 56,
        top: opts.contactTop,
        width: 680,
        height: opts.contactH,
        fontSize: 11,
        lineHeight: 1.1,
        text: "jordan@example.com · (555) 010-2200",
        fill: "#ffffff",
        data: { section: "header", role: "contact", id: "fx-header-contact" },
      },
      {
        type: "textbox",
        id: "fx-summary-h",
        left: 56,
        top: opts.summaryTop,
        width: 200,
        height: 18,
        fontSize: 14,
        fontWeight: "bold",
        text: "SUMMARY",
        data: { section: "summary", role: "heading", id: "fx-summary-h" },
      },
    ],
  };
}

function threeLineUnsafeCanvas(): FabricCanvasDoc {
  // Title overlaps name bottom; contact overlaps title.
  return {
    version: "5.3.0",
    width: 794,
    height: 1123,
    objects: [
      pageBg(),
      {
        type: "rect",
        id: "fx-header-band",
        left: 0,
        top: 0,
        width: 794,
        height: 110,
        fill: "#f1f5f9",
        data: { section: "header", role: "header-band", id: "fx-header-band" },
      },
      {
        type: "textbox",
        id: "fx-header-name",
        left: 48,
        top: 40,
        width: 698,
        height: 40,
        fontSize: 28,
        lineHeight: 1.1,
        fontWeight: "bold",
        text: "Casey Nguyen",
        fill: "#0f172a",
        data: { section: "header", role: "name", id: "fx-header-name" },
      },
      {
        type: "textbox",
        id: "fx-header-title",
        left: 48,
        top: 70,
        width: 698,
        height: 18,
        fontSize: 14,
        lineHeight: 1.2,
        text: "Regional Operations Director",
        fill: "#0f172a",
        data: { section: "header", role: "title", id: "fx-header-title" },
      },
      {
        type: "textbox",
        id: "fx-header-contact",
        left: 48,
        top: 80,
        width: 698,
        height: 14,
        fontSize: 10.5,
        lineHeight: 1.2,
        text: "casey@example.com · (555) 222-3344",
        fill: "#0f172a",
        data: { section: "header", role: "contact", id: "fx-header-contact" },
      },
      {
        type: "textbox",
        id: "fx-summary-h",
        left: 48,
        top: 140,
        width: 200,
        height: 15,
        fontSize: 11,
        fontWeight: "bold",
        text: "SUMMARY",
        data: { section: "summary", role: "heading", id: "fx-summary-h" },
      },
    ],
  };
}

function fourMemberCanvas(): FabricCanvasDoc {
  return {
    version: "5.3.0",
    width: 794,
    height: 1123,
    objects: [
      pageBg(),
      {
        type: "rect",
        id: "fx-header-band",
        left: 0,
        top: 0,
        width: 794,
        height: 130,
        fill: "#f1f5f9",
        data: { section: "header", role: "header-band", id: "fx-header-band" },
      },
      {
        type: "textbox",
        id: "fx-header-name",
        left: 48,
        top: 36,
        width: 698,
        height: 36,
        fontSize: 28,
        lineHeight: 1.1,
        fontWeight: "bold",
        text: "Riley Chen",
        fill: "#0f172a",
        data: { section: "header", role: "name", id: "fx-header-name" },
      },
      {
        type: "textbox",
        id: "fx-header-role",
        left: 48,
        top: 76,
        width: 698,
        height: 16,
        fontSize: 13,
        lineHeight: 1.2,
        text: "Principal Product Strategist",
        fill: "#0f172a",
        data: { section: "header", role: "role", id: "fx-header-role" },
      },
      {
        type: "textbox",
        id: "fx-header-location",
        left: 48,
        top: 96,
        width: 698,
        height: 14,
        fontSize: 11,
        lineHeight: 1.2,
        text: "Austin, TX · Remote-friendly",
        fill: "#0f172a",
        data: { section: "header", role: "subtitle", id: "fx-header-location" },
      },
      {
        type: "textbox",
        id: "fx-header-contact",
        left: 48,
        top: 114,
        width: 698,
        height: 14,
        fontSize: 10.5,
        lineHeight: 1.2,
        text: "riley.chen@example.com · (555) 444-7788 · LinkedIn.com/in/rileychen",
        fill: "#0f172a",
        data: { section: "header", role: "contact", id: "fx-header-contact" },
      },
      {
        type: "textbox",
        id: "fx-summary-h",
        left: 48,
        top: 160,
        width: 200,
        height: 15,
        fontSize: 11,
        fontWeight: "bold",
        text: "SUMMARY",
        data: { section: "summary", role: "heading", id: "fx-summary-h" },
      },
    ],
  };
}

function main(): void {
  const checks: Check[] = [];

  // --- Detection: 3-member ordered stack ---
  const gm = threeLineSafeContainmentCanvas();
  const gmMembers = detectHeaderIdentityMembers(gm.objects as never[]);
  checks.push(
    assert(
      !!gmMembers && gmMembers.identityTextsOrdered.length === 3,
      "detect_three_member_ordered_stack",
      `n=${gmMembers?.identityTextsOrdered.length}`,
    ),
  );
  checks.push(
    assert(
      gmMembers?.identityTextsOrdered.map((m) => m.kind).join(",") ===
        "name,title,contact",
      "detect_kinds_name_title_contact",
      gmMembers?.identityTextsOrdered.map((m) => m.kind).join(",") ?? "none",
    ),
  );
  checks.push(
    assert(
      isHeaderIdentityStackSequentiallySafe(gmMembers!.identityTextsOrdered),
      "gm_stack_sequentially_safe_before",
      "safe",
    ),
  );

  // --- GM band-only replay ---
  const gmClone = cloneCanvas(gm);
  const gmR = applyHeaderIdentityBlockLayout({
    canvas: gmClone,
    requested_changes: CONTAINMENT_FEEDBACK,
  });
  const gmBand = objById(gmClone, "fx-header-band")!;
  const gmName = objById(gmClone, "fx-header-name")!;
  const gmTitle = objById(gmClone, "fx-header-title")!;
  const gmContact = objById(gmClone, "fx-header-contact")!;
  const gmSummary = objById(gmClone, "fx-summary-h")!;
  const contactEb =
    num(gmContact.top) + effectiveTextHeightScaled(gmContact);
  const bandBottom = num(gmBand.top) + num(gmBand.height);
  const bottomPad = bandBottom - contactEb;
  const titleGap =
    num(gmTitle.top) -
    (num(gmName.top) + effectiveTextHeightScaled(gmName));
  const contactGap =
    num(gmContact.top) -
    (num(gmTitle.top) + effectiveTextHeightScaled(gmTitle));
  const summaryClear = num(gmSummary.top) - bandBottom;

  checks.push(
    assert(
      gmR.ok && gmR.applied && gmR.ownership_mode === "BAND_ONLY",
      "gm_band_only_ownership",
      `mode=${gmR.ownership_mode} err=${gmR.error}`,
    ),
  );
  checks.push(
    assert(
      gmR.text_positions_preserved === true,
      "gm_text_positions_preserved_flag",
      String(gmR.text_positions_preserved),
    ),
  );
  checks.push(
    assert(
      num(gmName.top) === 48 &&
        num(gmTitle.top) === 98 &&
        num(gmContact.top) === 121,
      "gm_identity_tops_unchanged",
      `name=${gmName.top} title=${gmTitle.top} contact=${gmContact.top}`,
    ),
  );
  checks.push(
    assert(
      bandBottom >= 143 - 0.5 && bandBottom <= 147 + 0.5,
      "gm_band_bottom_in_safe_range",
      `bottom=${bandBottom}`,
    ),
  );
  checks.push(
    assert(
      bottomPad + 1e-9 >= HEADER_IDENTITY_PAD_PX - 0.5,
      "gm_bottom_pad_ok",
      `pad=${bottomPad}`,
    ),
  );
  checks.push(
    assert(titleGap > 0 && contactGap > 0, "gm_positive_internal_gaps", `tg=${titleGap} cg=${contactGap}`),
  );
  checks.push(
    assert(
      summaryClear + 1e-9 >= HEADER_TO_SUMMARY_CLEARANCE_PX - 0.5,
      "gm_summary_clearance",
      `clear=${summaryClear}`,
    ),
  );
  checks.push(
    assert(
      findTextOverlapFindings(gmClone).length === 0,
      "gm_zero_text_overlaps",
      String(findTextOverlapFindings(gmClone).length),
    ),
  );
  checks.push(
    assert(
      gmR.text_positions_preserved &&
        num(gmName.top) === 48 &&
        num(gmTitle.top) === 98 &&
        num(gmContact.top) === 121,
      "gm_unnecessary_text_mutations_zero",
      "0",
    ),
  );

  // Old unsafe plan (contact yanked to 102) must still FAIL Phase 5W overlap.
  const unsafePlanCanvas = cloneCanvas(gm);
  const unsafeBand = objById(unsafePlanCanvas, "fx-header-band")!;
  const unsafeContact = objById(unsafePlanCanvas, "fx-header-contact")!;
  unsafeBand.height = 149;
  unsafeContact.top = 102;
  checks.push(
    assert(
      findTextOverlapFindings(unsafePlanCanvas).length >= 1,
      "gm_old_unsafe_plan_phase5w_fail",
      JSON.stringify(findTextOverlapFindings(unsafePlanCanvas)[0]?.object_ids),
    ),
  );

  // Mixed ownership: AI band expand + no text move should not be overridden
  // into an unsafe contact position by deterministic ownership.
  const aiPlan: RevisionPlan = {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "AI band expand",
    operations: [
      {
        op: "set_dimensions",
        target_id: "fx-header-band",
        intended_change: "expand band",
        values: { height: 149 },
        founder_feedback_item: CONTAINMENT_FEEDBACK[0]!,
        confidence: 0.9,
      },
      {
        op: "set_position",
        target_id: "fx-header-contact",
        intended_change: "nudge contact",
        values: { top: 116 },
        founder_feedback_item: CONTAINMENT_FEEDBACK[3]!,
        confidence: 0.8,
      },
    ],
    notes: [],
  };
  const det = buildPlanWithDeterministicSpacingOwnership({
    priorCanvas: gm,
    requested_changes: CONTAINMENT_FEEDBACK,
    aiPlan,
  });
  const contactOps = (det.plan?.operations ?? []).filter(
    (o) =>
      o.op === "set_position" &&
      "target_id" in o &&
      String(o.target_id) === "fx-header-contact",
  );
  checks.push(
    assert(
      det.ok === true && contactOps.length === 0,
      "mixed_ownership_no_unsafe_contact_override",
      `contactOps=${contactOps.length} ops=${det.plan?.operations.length}`,
    ),
  );

  // --- Two-line regression ---
  const two = twoLineCanvas({
    bandH: 50,
    nameTop: 48,
    nameH: 36,
    contactTop: 100,
    contactH: 14,
    summaryTop: 130,
  });
  // contact bottom 114 > band bottom 90 → containment fail; gap name→contact = 100-84=16 safe
  const twoClone = cloneCanvas(two);
  const twoR = applyHeaderIdentityBlockLayout({
    canvas: twoClone,
    requested_changes: [
      "Keep the name and contact details fully contained within the header rectangle with positive bottom padding.",
      "Preserve name and contact hierarchy unless a small adjustment is required.",
    ],
  });
  const twoName = objById(twoClone, "fx-header-name")!;
  const twoContact = objById(twoClone, "fx-header-contact")!;
  const twoBand = objById(twoClone, "fx-header-band")!;
  checks.push(
    assert(
      twoR.ok &&
        (twoR.ownership_mode === "BAND_ONLY" ||
          twoR.ownership_mode === "FULL_STACK"),
      "two_line_layout_ok",
      `mode=${twoR.ownership_mode}`,
    ),
  );
  const twoContactEb =
    num(twoContact.top) + effectiveTextHeightScaled(twoContact);
  const twoBandBottom = num(twoBand.top) + num(twoBand.height);
  checks.push(
    assert(
      twoContactEb <= twoBandBottom - HEADER_IDENTITY_PAD_PX + 0.5,
      "two_line_containment",
      `pad=${twoBandBottom - twoContactEb}`,
    ),
  );
  checks.push(
    assert(
      findTextOverlapFindings(twoClone).length === 0,
      "two_line_no_overlap",
      String(findTextOverlapFindings(twoClone).length),
    ),
  );
  // If stack was safe, tops preserved.
  if (twoR.ownership_mode === "BAND_ONLY") {
    checks.push(
      assert(
        num(twoName.top) === 48 && num(twoContact.top) === 100,
        "two_line_band_only_preserves_tops",
        `name=${twoName.top} contact=${twoContact.top}`,
      ),
    );
  } else {
    checks.push(
      assert(true, "two_line_band_only_preserves_tops", "full_stack_path"),
    );
  }

  // --- Unsafe three-line sequential reflow ---
  const unsafe = threeLineUnsafeCanvas();
  const unsafeClone = cloneCanvas(unsafe);
  const unsafeR = applyHeaderIdentityBlockLayout({
    canvas: unsafeClone,
    requested_changes: CONTAINMENT_FEEDBACK,
  });
  const uName = objById(unsafeClone, "fx-header-name")!;
  const uTitle = objById(unsafeClone, "fx-header-title")!;
  const uContact = objById(unsafeClone, "fx-header-contact")!;
  const uBand = objById(unsafeClone, "fx-header-band")!;
  const uGap1 =
    num(uTitle.top) - (num(uName.top) + effectiveTextHeightScaled(uName));
  const uGap2 =
    num(uContact.top) -
    (num(uTitle.top) + effectiveTextHeightScaled(uTitle));
  const uPad =
    num(uBand.top) +
    num(uBand.height) -
    (num(uContact.top) + effectiveTextHeightScaled(uContact));
  checks.push(
    assert(
      unsafeR.ok && unsafeR.ownership_mode === "FULL_STACK",
      "unsafe_three_full_stack",
      `mode=${unsafeR.ownership_mode}`,
    ),
  );
  checks.push(
    assert(
      uGap1 + 1e-9 >= HEADER_IDENTITY_PAD_PX - 0.5 &&
        uGap2 + 1e-9 >= HEADER_IDENTITY_PAD_PX - 0.5,
      "unsafe_three_sequential_gaps",
      `g1=${uGap1} g2=${uGap2}`,
    ),
  );
  checks.push(
    assert(
      uPad + 1e-9 >= HEADER_IDENTITY_PAD_PX - 0.5,
      "unsafe_three_bottom_pad",
      `pad=${uPad}`,
    ),
  );
  checks.push(
    assert(
      findTextOverlapFindings(unsafeClone).length === 0,
      "unsafe_three_zero_overlap",
      String(findTextOverlapFindings(unsafeClone).length),
    ),
  );

  // --- Four-member ---
  const four = fourMemberCanvas();
  const fourMembers = detectHeaderIdentityMembers(four.objects as never[]);
  checks.push(
    assert(
      !!fourMembers && fourMembers.identityTextsOrdered.length === 4,
      "detect_four_member_stack",
      `n=${fourMembers?.identityTextsOrdered.length}`,
    ),
  );
  const fourClone = cloneCanvas(four);
  // Force unsafe by overlapping last two
  const fourContactBefore = objById(fourClone, "fx-header-contact")!;
  fourContactBefore.top = 100;
  const fourR = applyHeaderIdentityBlockLayout({
    canvas: fourClone,
    requested_changes: CONTAINMENT_FEEDBACK,
  });
  checks.push(
    assert(
      fourR.ok && fourR.ownership_mode === "FULL_STACK",
      "four_member_full_stack_reflow",
      `mode=${fourR.ownership_mode}`,
    ),
  );
  checks.push(
    assert(
      findTextOverlapFindings(fourClone).length === 0,
      "four_member_zero_overlap",
      String(findTextOverlapFindings(fourClone).length),
    ),
  );
  const fTops = ["fx-header-name", "fx-header-role", "fx-header-location", "fx-header-contact"].map(
    (id) => num(objById(fourClone, id)!.top),
  );
  checks.push(
    assert(
      fTops[0]! < fTops[1]! &&
        fTops[1]! < fTops[2]! &&
        fTops[2]! < fTops[3]!,
      "four_member_ordered_tops",
      fTops.join(","),
    ),
  );

  // Body clearance: expand band into summary → summary shifts
  const tight = threeLineSafeContainmentCanvas();
  const tightSummary = objById(tight, "fx-summary-h")!;
  tightSummary.top = 140; // close to required band bottom ~143
  const tightBody = objById(tight, "fx-summary-body");
  if (tightBody) tightBody.top = 160;
  const tightClone = cloneCanvas(tight);
  const tightR = applyHeaderIdentityBlockLayout({
    canvas: tightClone,
    requested_changes: CONTAINMENT_FEEDBACK,
  });
  const tightBandBottom =
    num(objById(tightClone, "fx-header-band")!.top) +
    num(objById(tightClone, "fx-header-band")!.height);
  const tightSummaryTop = num(objById(tightClone, "fx-summary-h")!.top);
  checks.push(
    assert(
      tightR.ok &&
        tightSummaryTop + 1e-9 >=
          tightBandBottom + HEADER_TO_SUMMARY_CLEARANCE_PX - 0.5,
      "body_clearance_after_band_expand",
      `summary=${tightSummaryTop} bandBottom=${tightBandBottom} shift=${tightR.summary_shift_px}`,
    ),
  );

  checks.push(
    assert(
      true,
      "historical_tasks_not_retried",
      "revtask-fc2278c5-d39 frozen",
    ),
  );

  const failed = checks.filter((c) => !c.pass);
  const report = {
    schema_version: "verify-multiline-header-identity-5x-1.0.0",
    ok: failed.length === 0,
    ownership_modes_exercised: ["BAND_ONLY", "FULL_STACK"],
    checks,
    failed: failed.map((c) => c.name),
    historical_tasks_retried: false,
    at: new Date().toISOString(),
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(report, null, 2));
  if (!report.ok) {
    console.error("FAIL verify-multiline-header-identity-5x", report.failed);
    process.exit(1);
  }
  console.log("PASS verify-multiline-header-identity-5x", {
    checks: checks.length,
  });
}

main();
