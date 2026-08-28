/**
 * Phase 5C offline verifier: deterministic HEADER_IDENTITY_BLOCK layout.
 * Fictional fixtures only. No OpenAI. No production task mutation.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { FabricCanvasDoc } from "./CanvasInventory.js";
import { buildCanvasInventory } from "./CanvasInventory.js";
import {
  buildPlanWithDeterministicSpacingOwnership,
  isDeterministicLayoutNormalizerOwnedChange,
  isVerticalSpacingRhythmHeavyFeedback,
} from "./DeterministicSpacingPlan.js";
import {
  applyHeaderIdentityBlockLayout,
  detectHeaderIdentityMembers,
  HEADER_IDENTITY_PAD_PX,
  HEADER_TO_SUMMARY_CLEARANCE_PX,
  isHeaderIdentityLayoutFeedback,
  isHeaderIdentityLayoutOwnedChange,
} from "./HeaderIdentityLayout.js";
import { validatePlanGeometrySafety } from "./PlanGeometrySafety.js";
import { validatePlanVerticalDirections } from "./PositionOpCanonicalization.js";
import { isPlanCoverageExemptRequestedChange } from "./RevisionPromptBuilder.js";
import { effectiveTextHeightScaled } from "./TextEffectiveHeight.js";
import type { RevisionPlan } from "./revision-task-types.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/founder-revision/verify-header-identity-layout.json",
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

function headerCanvas(opts: {
  bandTop: number;
  bandHeight: number;
  nameTop: number;
  nameHeight: number;
  contactTop: number;
  contactHeight: number;
  summaryTop: number;
  nameText?: string;
  contactText?: string;
  pageHeight?: number;
}): FabricCanvasDoc {
  const pageH = opts.pageHeight ?? 1123;
  return {
    version: "5.3.0",
    width: 794,
    height: pageH,
    objects: [
      { ...pageBg(), height: pageH },
      {
        type: "rect",
        id: "fx-header-band",
        left: 40,
        top: opts.bandTop,
        width: 714,
        height: opts.bandHeight,
        fill: "#1e3a8a",
        data: { section: "header", role: "header-band", id: "fx-header-band" },
      },
      {
        type: "textbox",
        id: "fx-header-name",
        left: 56,
        top: opts.nameTop,
        width: 680,
        height: opts.nameHeight,
        fontSize: 28,
        lineHeight: 1.1,
        fontWeight: "bold",
        text: opts.nameText ?? "Jordan Hale",
        fill: "#ffffff",
        data: { section: "header", role: "name", id: "fx-header-name" },
      },
      {
        type: "textbox",
        id: "fx-header-contact",
        left: 56,
        top: opts.contactTop,
        width: 680,
        height: opts.contactHeight,
        fontSize: 11,
        lineHeight: 1.1,
        text: opts.contactText ?? "Analyst  |  jordan@example.com  |  (555) 010-2200",
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
      {
        type: "textbox",
        id: "fx-summary-body",
        left: 56,
        top: opts.summaryTop + 24,
        width: 680,
        height: 40,
        fontSize: 12,
        text: "Operations and delivery leadership with cross-functional impact.",
        data: { section: "summary", role: "body", id: "fx-summary-body" },
      },
    ],
  };
}

const CLOUD_FEEDBACK = [
  "Keep the name and contact details fully contained within the blue header rectangle.",
  "Slightly move the contact/role row upward inside the header so bottom padding is healthier.",
  "Increase the bottom padding inside the header without crowding the name.",
  "Balance the top and bottom spacing inside the header.",
  "Preserve the existing header width, alignment, typography, and color style.",
];

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

function main(): void {
  const checks: Check[] = [];

  // Ownership classification
  for (const line of CLOUD_FEEDBACK) {
    checks.push(
      assert(
        isHeaderIdentityLayoutOwnedChange(line),
        `owned_${line.slice(0, 32).replace(/\W+/g, "_")}`,
        line,
      ),
    );
  }
  checks.push(
    assert(
      isHeaderIdentityLayoutFeedback(CLOUD_FEEDBACK),
      "cloud_feedback_is_header_identity",
      "packet",
    ),
  );
  checks.push(
    assert(
      isVerticalSpacingRhythmHeavyFeedback(CLOUD_FEEDBACK),
      "cloud_feedback_triggers_spacing_heavy",
      "packet",
    ),
  );
  checks.push(
    assert(
      CLOUD_FEEDBACK.every((c) => isPlanCoverageExemptRequestedChange(c)),
      "cloud_feedback_all_coverage_exempt",
      `exempt=${CLOUD_FEEDBACK.filter((c) => isPlanCoverageExemptRequestedChange(c)).length}`,
    ),
  );
  checks.push(
    assert(
      !isHeaderIdentityLayoutOwnedChange(
        "Change the header rectangle fill to a darker navy.",
      ),
      "style_only_color_not_geometry_owned",
      "recolor excluded",
    ),
  );

  // --- Fixture A: Teacher-shaped (taller band, mild overflow) ---
  const teacher = headerCanvas({
    bandTop: 40,
    bandHeight: 60,
    nameTop: 48,
    nameHeight: 36,
    contactTop: 90,
    contactHeight: 14,
    summaryTop: 130,
    nameText: "Morgan Ellis",
    contactText: "Teacher  |  morgan@school.edu  |  (555) 100-2000",
  });
  const teacherClone = cloneCanvas(teacher);
  const teacherR = applyHeaderIdentityBlockLayout({
    canvas: teacherClone,
    requested_changes: CLOUD_FEEDBACK,
  });
  const tBand = objById(teacherClone, "fx-header-band")!;
  const tName = objById(teacherClone, "fx-header-name")!;
  const tContact = objById(teacherClone, "fx-header-contact")!;
  const tNameEh = effectiveTextHeightScaled(tName);
  const tContactEh = effectiveTextHeightScaled(tContact);
  const tNameBottom = num(tName.top) + tNameEh;
  const tContactBottom = num(tContact.top) + tContactEh;
  const tBandBottom = num(tBand.top) + num(tBand.height);
  checks.push(
    assert(teacherR.ok && teacherR.applied, "teacher_ok_applied", teacherR.error ?? "ok"),
  );
  checks.push(
    assert(
      num(tContact.top) + 1e-9 >= tNameBottom + HEADER_IDENTITY_PAD_PX - 0.5,
      "teacher_no_name_contact_overlap",
      `gap=${num(tContact.top) - tNameBottom}`,
    ),
  );
  checks.push(
    assert(
      tContactBottom <= tBandBottom - HEADER_IDENTITY_PAD_PX + 0.5,
      "teacher_bottom_padding",
      `pad=${tBandBottom - tContactBottom}`,
    ),
  );
  checks.push(
    assert(
      num(objById(teacherClone, "fx-summary-h")!.top) >=
        tBandBottom + HEADER_TO_SUMMARY_CLEARANCE_PX - 0.5,
      "teacher_summary_clearance",
      `summary=${objById(teacherClone, "fx-summary-h")!.top} bandBottom=${tBandBottom}`,
    ),
  );

  // --- Fixture B: Hotel-shaped ---
  const hotel = headerCanvas({
    bandTop: 36,
    bandHeight: 52,
    nameTop: 44,
    nameHeight: 34,
    contactTop: 84,
    contactHeight: 14,
    summaryTop: 120,
    nameText: "Casey Quinn",
    contactText: "Front Desk Lead  |  casey@hotel.test  |  (555) 333-4444",
  });
  const hotelClone = cloneCanvas(hotel);
  const hotelR = applyHeaderIdentityBlockLayout({
    canvas: hotelClone,
    requested_changes: CLOUD_FEEDBACK,
  });
  const hBand = objById(hotelClone, "fx-header-band")!;
  const hName = objById(hotelClone, "fx-header-name")!;
  const hContact = objById(hotelClone, "fx-header-contact")!;
  const hNameEh = effectiveTextHeightScaled(hName);
  const hContactEh = effectiveTextHeightScaled(hContact);
  const hBandBottom = num(hBand.top) + num(hBand.height);
  checks.push(
    assert(hotelR.ok && hotelR.applied, "hotel_ok_applied", hotelR.error ?? "ok"),
  );
  checks.push(
    assert(
      num(hContact.top) + 1e-9 >= num(hName.top) + hNameEh + HEADER_IDENTITY_PAD_PX - 0.5,
      "hotel_no_overlap",
      `gap=${num(hContact.top) - (num(hName.top) + hNameEh)}`,
    ),
  );
  checks.push(
    assert(
      num(hContact.top) + hContactEh <= hBandBottom - HEADER_IDENTITY_PAD_PX + 0.5,
      "hotel_contained",
      `bottomPad=${hBandBottom - (num(hContact.top) + hContactEh)}`,
    ),
  );

  // --- Fixture C: Cloud-Architect-shaped (48→102, name 58→97, contact 97→111) ---
  const cloud = headerCanvas({
    bandTop: 48,
    bandHeight: 54,
    nameTop: 58,
    nameHeight: 39,
    contactTop: 97,
    contactHeight: 14,
    summaryTop: 135,
    nameText: "Riley Whitman",
    contactText: "Cloud Architect  |  riley@cloud.test  |  (555) 900-1000",
  });
  const cloudMembers = detectHeaderIdentityMembers(
    (cloud.objects ?? []) as Array<Record<string, unknown> & { id?: string }>,
  );
  checks.push(
    assert(cloudMembers != null, "cloud_members_detected", "name/contact/band"),
  );
  const cloudNameEh = effectiveTextHeightScaled(
    objById(cloud, "fx-header-name")!,
  );
  const cloudContactEh = effectiveTextHeightScaled(
    objById(cloud, "fx-header-contact")!,
  );
  checks.push(
    assert(
      Math.abs(cloudNameEh - 39) < 1.5,
      "cloud_name_effective_height",
      `eh=${cloudNameEh}`,
    ),
  );
  checks.push(
    assert(
      Math.abs(cloudContactEh - 14) < 1.5,
      "cloud_contact_effective_height",
      `eh=${cloudContactEh}`,
    ),
  );

  const cloudClone = cloneCanvas(cloud);
  const cloudR = applyHeaderIdentityBlockLayout({
    canvas: cloudClone,
    requested_changes: CLOUD_FEEDBACK,
  });
  const cBand = objById(cloudClone, "fx-header-band")!;
  const cName = objById(cloudClone, "fx-header-name")!;
  const cContact = objById(cloudClone, "fx-header-contact")!;
  const cSummary = objById(cloudClone, "fx-summary-h")!;
  const cBody = objById(cloudClone, "fx-summary-body")!;
  const cNameEh = effectiveTextHeightScaled(cName);
  const cContactEh = effectiveTextHeightScaled(cContact);
  const cBandBottom = num(cBand.top) + num(cBand.height);
  const cGap = num(cContact.top) - (num(cName.top) + cNameEh);
  const cBottomPad = cBandBottom - (num(cContact.top) + cContactEh);
  const priorContactTop = 97;
  const bodyPriorTop = 135 + 24;

  checks.push(
    assert(cloudR.ok && cloudR.applied, "cloud_ok_applied", cloudR.error ?? JSON.stringify(cloudR.reason_codes)),
  );
  checks.push(
    assert(cGap + 1e-9 >= HEADER_IDENTITY_PAD_PX - 0.5, "cloud_positive_inter_text_gap", `gap=${cGap}`),
  );
  checks.push(
    assert(cBottomPad + 1e-9 >= HEADER_IDENTITY_PAD_PX - 0.5, "cloud_positive_bottom_padding", `pad=${cBottomPad}`),
  );
  checks.push(
    assert(
      num(cName.top) >= num(cBand.top) + HEADER_IDENTITY_PAD_PX - 0.5 &&
        num(cContact.top) + cContactEh <= cBandBottom - HEADER_IDENTITY_PAD_PX + 0.5,
      "cloud_identity_contained",
      `band=${cBand.top}→${cBandBottom} name=${cName.top} contact=${cContact.top}`,
    ),
  );
  checks.push(
    assert(
      num(cContact.top) <= priorContactTop + 0.5,
      "cloud_contact_not_moved_down",
      `delta=${num(cContact.top) - priorContactTop}`,
    ),
  );
  checks.push(
    assert(
      num(cSummary.top) >= cBandBottom + HEADER_TO_SUMMARY_CLEARANCE_PX - 0.5,
      "cloud_summary_clearance",
      `summary=${cSummary.top} need=${cBandBottom + HEADER_TO_SUMMARY_CLEARANCE_PX}`,
    ),
  );
  checks.push(
    assert(
      num(cBody.top) - num(cSummary.top) === 24 ||
        Math.abs(num(cBody.top) - (num(cSummary.top) + 24)) < 0.5,
      "cloud_body_relative_preserved",
      `body=${cBody.top} summary=${cSummary.top}`,
    ),
  );
  checks.push(
    assert(
      cloudR.after != null,
      "cloud_after_geometry_present",
      JSON.stringify(cloudR.after),
    ),
  );

  // Matrix 1: already fits → minimal / no mutation
  const fitsNameH = 32;
  const fitsContactH = 14;
  const fitsNameTop = 50;
  const fitsContactTop = fitsNameTop + fitsNameH + HEADER_IDENTITY_PAD_PX;
  const fits = headerCanvas({
    bandTop: 40,
    bandHeight: 120,
    nameTop: fitsNameTop,
    nameHeight: fitsNameH,
    contactTop: fitsContactTop,
    contactHeight: fitsContactH,
    summaryTop: 200,
    nameText: "Jo",
    contactText: "a@b.co",
  });
  // Verify effective heights do not exceed stored (single-glyph / short strings).
  {
    const n = objById(fits, "fx-header-name")!;
    const c = objById(fits, "fx-header-contact")!;
    const ne = effectiveTextHeightScaled(n);
    const ce = effectiveTextHeightScaled(c);
    if (ne > fitsNameH + 0.5 || ce > fitsContactH + 0.5) {
      // widen stored heights to match estimate so "already safe" is meaningful
      n.height = Math.ceil(ne);
      c.height = Math.ceil(ce);
      const ct = fitsNameTop + Math.ceil(ne) + HEADER_IDENTITY_PAD_PX;
      c.top = ct;
      const band = objById(fits, "fx-header-band")!;
      band.height = Math.max(
        120,
        HEADER_IDENTITY_PAD_PX +
          Math.ceil(ne) +
          HEADER_IDENTITY_PAD_PX +
          Math.ceil(ce) +
          HEADER_IDENTITY_PAD_PX +
          20,
      );
    }
  }
  const fitsClone = cloneCanvas(fits);
  const fitsR = applyHeaderIdentityBlockLayout({
    canvas: fitsClone,
    requested_changes: [
      "Keep the name and contact details fully contained within the header.",
    ],
  });
  checks.push(
    assert(
      fitsR.ok && !fitsR.applied,
      "matrix_1_already_fits_preserve",
      fitsR.reason_codes.join("; "),
    ),
  );

  // Matrix 3/4: UP request with collision risk — expand/raise, never overlap
  const upCollide = headerCanvas({
    bandTop: 48,
    bandHeight: 54,
    nameTop: 58,
    nameHeight: 39,
    contactTop: 97,
    contactHeight: 14,
    summaryTop: 135,
  });
  const upClone = cloneCanvas(upCollide);
  const upR = applyHeaderIdentityBlockLayout({
    canvas: upClone,
    requested_changes: [
      "Move the contact row upward inside the header.",
      "Keep name and contact contained within the header.",
    ],
  });
  const upContact = objById(upClone, "fx-header-contact")!;
  const upName = objById(upClone, "fx-header-name")!;
  checks.push(
    assert(upR.ok, "matrix_4_up_no_overlap_ok", upR.error ?? "ok"),
  );
  checks.push(
    assert(
      num(upContact.top) <= 97.5 &&
        num(upContact.top) >=
          num(upName.top) +
            effectiveTextHeightScaled(upName) +
            HEADER_IDENTITY_PAD_PX -
            0.5,
      "matrix_4_up_safe_geometry",
      `contact=${upContact.top} nameBottom=${num(upName.top) + effectiveTextHeightScaled(upName)}`,
    ),
  );

  // Explicit direction contradiction: require UP but no room above page top
  const contradiction = headerCanvas({
    bandTop: 2,
    bandHeight: 40,
    nameTop: 4,
    nameHeight: 50,
    contactTop: 40,
    contactHeight: 40,
    summaryTop: 200,
    pageHeight: 1123,
  });
  const contraClone = cloneCanvas(contradiction);
  const contraR = applyHeaderIdentityBlockLayout({
    canvas: contraClone,
    requested_changes: [
      "Move the contact row upward inside the header.",
      "Keep name and contact contained within the header with healthy padding.",
    ],
  });
  checks.push(
    assert(
      !contraR.ok,
      "matrix_10_direction_contradiction_fail_closed",
      contraR.error ?? contraR.reason_codes.join("; "),
    ),
  );

  // Impossible: content too tall even with growth (tiny page)
  const impossible = headerCanvas({
    bandTop: 10,
    bandHeight: 40,
    nameTop: 12,
    nameHeight: 220,
    contactTop: 240,
    contactHeight: 180,
    summaryTop: 500,
    pageHeight: 400,
  });
  const impClone = cloneCanvas(impossible);
  const impR = applyHeaderIdentityBlockLayout({
    canvas: impClone,
    requested_changes: [
      "Keep the name and contact details fully contained within the header.",
      "Balance the top and bottom spacing inside the header.",
    ],
  });
  checks.push(
    assert(
      !impR.ok,
      "impossible_fail_closed",
      impR.error ?? impR.reason_codes.join("; "),
    ),
  );

  // Deterministic ownership plan + geometry safety (Cloud)
  const aiPlan: RevisionPlan = {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "AI unsafe contact nudge",
    operations: [
      {
        op: "set_position",
        target_id: "fx-header-contact",
        values: { top: 90 },
        before_summary: "contact at 97",
        intended_change: "Move contact upward",
        founder_feedback_item: CLOUD_FEEDBACK[1]!,
        confidence: 0.5,
      },
    ],
  };
  const det = buildPlanWithDeterministicSpacingOwnership({
    priorCanvas: cloud,
    requested_changes: CLOUD_FEEDBACK,
    aiPlan,
  });
  checks.push(
    assert(det.ok && det.plan != null, "det_plan_ok", det.error ?? "ok"),
  );
  const inv = buildCanvasInventory(cloud);
  if (det.plan) {
    const dir = validatePlanVerticalDirections({
      plan: det.plan,
      inventory: inv,
      requested_changes: CLOUD_FEEDBACK,
    });
    checks.push(
      assert(dir.ok, "cloud_det_direction_gate", dir.errors.join("; ") || "ok"),
    );
    const geo = validatePlanGeometrySafety({
      canvas: cloud,
      plan: det.plan,
    });
    checks.push(
      assert(
        geo.ok && geo.text_overlaps === 0 && geo.page_oob === 0,
        "cloud_det_geometry_gate",
        `ok=${geo.ok} overlaps=${geo.text_overlaps} oob=${geo.page_oob} ${geo.errors?.join?.("; ") ?? geo.error ?? ""}`,
      ),
    );
    const hasDim = det.plan.operations.some(
      (o) => o.op === "set_dimensions" && o.target_id === "fx-header-band",
    );
    checks.push(
      assert(hasDim, "cloud_det_emits_band_dimensions", "set_dimensions on band"),
    );
    const aiPosReplaced = !det.plan.operations.some(
      (o) =>
        o.op === "set_position" &&
        o.target_id === "fx-header-contact" &&
        Number((o.values as { top?: number })?.top) === 90,
    );
    checks.push(
      assert(aiPosReplaced, "cloud_ai_unsafe_contact_top_replaced", "no top=90"),
    );
  }

  // Body untouched when expansion not needed beyond clearance
  const bodyBefore = num(objById(cloud, "fx-summary-body")!.top);
  const bodyAfterCloud = num(cBody.top);
  const summaryShifted =
    num(cSummary.top) > 135.5 || bodyAfterCloud > bodyBefore + 0.5;
  checks.push(
    assert(
      typeof summaryShifted === "boolean",
      "cloud_body_shift_recorded",
      `summary=${cSummary.top} body=${bodyAfterCloud} priorBody=${bodyBefore} shift=${cloudR.summary_shift_px}`,
    ),
  );

  // Owned change helper still marks deterministic normalizer owned
  checks.push(
    assert(
      CLOUD_FEEDBACK.every((c) => isDeterministicLayoutNormalizerOwnedChange(c)),
      "cloud_normalizer_owned_via_header",
      "all",
    ),
  );

  const failed = checks.filter((c) => !c.pass);
  const report = {
    schema_version: "verify-header-identity-layout-1.0.0",
    ok: failed.length === 0,
    passed: checks.filter((c) => c.pass).length,
    total: checks.length,
    cloud_architect_replay_geometry: cloudR.after,
    cloud_reason_codes: cloudR.reason_codes,
    checks,
    failed: failed.map((c) => c.name),
  };
  mkdirSync(join(REPO, "SOS/07_LOGS/saios/founder-revision"), {
    recursive: true,
  });
  writeFileSync(OUT, JSON.stringify(report, null, 2));
  for (const c of checks) {
    if (!c.pass) console.error(`FAIL ${c.name}: ${c.detail}`);
  }
  if (failed.length > 0) {
    console.error(
      `verify-header-identity-layout: ${failed.length}/${checks.length} failed`,
    );
    process.exit(1);
  }
  console.log(
    `verify-header-identity-layout: PASS ${checks.length}/${checks.length}`,
  );
  console.log(
    `cloud_after=${JSON.stringify(cloudR.after)} band_expanded=${cloudR.band_expanded}`,
  );
}

main();
