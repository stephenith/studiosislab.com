/**
 * Phase 5O — CONTACT_IN_HEADER_BAND coverage proof (pale-strip / margin tops).
 * Offline / no OpenAI. Does not mutate production tasks.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { FabricCanvasDoc } from "./CanvasInventory.js";
import { buildFeedbackCoverage } from "./FeedbackCoverage.js";
import {
  applyHeaderIdentityBlockLayout,
  HEADER_IDENTITY_PAD_PX,
  HEADER_TO_SUMMARY_CLEARANCE_PX,
  isHeaderIdentityLayoutFeedback,
  resolveHeaderIdentityMembersFromCanvas,
} from "./HeaderIdentityLayout.js";
import {
  classifyRequestedChange,
  isVerificationAcceptance,
} from "./RequestedChangeClassification.js";
import type { OperationLogEntry, RevisionPlan } from "./revision-task-types.js";
import { findTextOverlapFindings } from "./RevisionAcceptanceChecks.js";
import { runLayoutPreservationCheck } from "./RevisionAcceptanceChecks.js";
import { runCollisionBoundsCheck } from "./RevisionAcceptanceChecks.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/founder-revision/verify-header-containment-coverage-5o.json",
);

type Check = { name: string; pass: boolean; detail: string };

function assert(cond: boolean, name: string, detail: string): Check {
  return { name, pass: Boolean(cond), detail };
}

function pageBg(): Record<string, unknown> {
  return {
    id: "page-bg",
    type: "Rect",
    left: 0,
    top: 0,
    width: 794,
    height: 1123,
    fill: "#ffffff",
    data: { system: true, kind: "page-bg", role: "pageBackground" },
  };
}

/** Geometry matching Phase 5N Customer Success Associate failure class. */
function makePaleStripHeaderCanvas(opts: {
  bandHeight: number;
  contactTop: number;
  summaryTop?: number;
  nameTop?: number;
  nameHeight?: number;
  contactHeight?: number;
}): FabricCanvasDoc {
  const nameTop = opts.nameTop ?? 58;
  const nameHeight = opts.nameHeight ?? 39;
  const contactHeight = opts.contactHeight ?? 14;
  const summaryTop = opts.summaryTop ?? 135;
  return {
    version: "5.3.0",
    width: 794,
    height: 1123,
    objects: [
      pageBg(),
      {
        id: "block-header-0-r0",
        type: "Rect",
        left: 48,
        top: 48,
        width: 698,
        height: opts.bandHeight,
        fill: "#dbeafe",
        data: { section: "header", role: "pale-strip" },
      },
      {
        id: "block-header-0-t1",
        type: "Textbox",
        left: 60,
        top: nameTop,
        width: 674,
        height: nameHeight,
        text: "Alex Rivera",
        fontSize: 28,
        data: { section: "header", role: "header-name" },
      },
      {
        id: "block-header-0-t2",
        type: "Textbox",
        left: 60,
        top: opts.contactTop,
        width: 674,
        height: contactHeight,
        text: "Customer Success Associate · alex.rivera@example.com · (555) 100-2000 · LinkedIn.com/in/alexrivera · Seattle, WA",
        fontSize: 9.5,
        lineHeight: 1.45,
        data: { section: "header" },
      },
      {
        id: "block-summary-1-r0",
        type: "Rect",
        left: 48,
        top: summaryTop,
        width: 160,
        height: 24,
        fill: "#1e3a5f",
        data: { section: "summary", role: "filled-label" },
      },
      {
        id: "block-summary-1-t1",
        type: "Textbox",
        left: 58,
        top: summaryTop + 5,
        width: 140,
        height: 14,
        text: "SUMMARY",
        fontSize: 11,
        fill: "#ffffff",
        data: { section: "summary", role: "section-heading" },
      },
      {
        id: "block-summary-1-t2",
        type: "Textbox",
        left: 48,
        top: summaryTop + 30,
        width: 698,
        height: 40,
        text: "Entry-level associate with SaaS support experience.",
        fontSize: 10.5,
        data: { section: "summary" },
      },
      {
        id: "block-experience-2-t1",
        type: "Textbox",
        left: 58,
        top: summaryTop + 90,
        width: 688,
        height: 14,
        text: "EXPERIENCE",
        fontSize: 11,
        data: { section: "experience", role: "section-heading" },
      },
    ],
  };
}

const FOUNDER_LINES = [
  "Adjust the top header so the subtitle and contact details line below the name sit fully inside the light blue header background with proper padding.",
  "Extend the light blue header rectangle downward as needed, or rebalance the header content, so the entire contact/details line is fully contained within the header band.",
  "Preserve the rest of the resume design, section layout, spacing, and typography, since the remaining template looks good.",
];

function planFromOps(
  ops: Array<{
    op: string;
    target_id: string;
    values: Record<string, number>;
    founder_feedback_item: string;
    founder_feedback_items?: string[];
  }>,
): RevisionPlan {
  return {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "Phase 5O header containment fixture plan",
    operations: ops.map((o) => ({
      op: o.op as "set_dimensions" | "set_position",
      target_id: o.target_id,
      before_summary: `before ${o.target_id}`,
      intended_change: `Apply ${o.op} for ${o.target_id}`,
      values: o.values,
      founder_feedback_item: o.founder_feedback_item,
      founder_feedback_items: o.founder_feedback_items,
      confidence: 1,
    })),
    notes: [],
  };
}

function logFromPlan(plan: RevisionPlan): OperationLogEntry[] {
  return plan.operations.map((op, i) => ({
    index: i,
    op: op.op,
    target_id: op.target_id ?? null,
    ok: true,
    before: null,
    after: null,
    error: null,
    founder_feedback_item: op.founder_feedback_item ?? null,
  }));
}

function main(): void {
  const checks: Check[] = [];

  // Preserve-rest classification
  const preserve = FOUNDER_LINES[2]!;
  checks.push(
    assert(
      isVerificationAcceptance(preserve) &&
        classifyRequestedChange(preserve).classification ===
          "VERIFICATION_ACCEPTANCE",
      "preserve_rest_is_verification_acceptance",
      JSON.stringify(classifyRequestedChange(preserve)),
    ),
  );
  checks.push(
    assert(
      isHeaderIdentityLayoutFeedback(FOUNDER_LINES) === true,
      "founder_packet_is_header_identity",
      "ok",
    ),
  );

  // Before geometry fails containment
  const before = makePaleStripHeaderCanvas({
    bandHeight: 54,
    contactTop: 97,
    summaryTop: 135,
  });
  const beforeMembers = resolveHeaderIdentityMembersFromCanvas(before);
  checks.push(
    assert(Boolean(beforeMembers), "before_members_detected", "pale-strip"),
  );
  const beforeBandBottom = 48 + 54;
  const beforeContactBottom = 97 + 14;
  checks.push(
    assert(
      beforeContactBottom > beforeBandBottom - HEADER_IDENTITY_PAD_PX,
      "before_containment_fail",
      `contactBottom=${beforeContactBottom} bandBottom=${beforeBandBottom}`,
    ),
  );

  // Deterministic header identity apply (mutates canvas in place)
  const working = structuredClone(before);
  const applied = applyHeaderIdentityBlockLayout({
    canvas: working,
    requested_changes: FOUNDER_LINES,
  });
  checks.push(
    assert(
      applied.ok && applied.applied && applied.after != null,
      "header_identity_ownership_applies",
      applied.error ?? applied.reason_codes.join(";"),
    ),
  );
  const after = working;
  const afterGeom = applied.after!;
  const bottomPad = afterGeom.band_bottom - afterGeom.contact_effective_bottom;
  const nameContactGap =
    afterGeom.contact_top - afterGeom.name_effective_bottom;
  checks.push(
    assert(
      bottomPad + 1e-9 >= HEADER_IDENTITY_PAD_PX - 0.5,
      "after_bottom_padding",
      `pad=${bottomPad} band=${afterGeom.band_top}→${afterGeom.band_bottom} contact_eb=${afterGeom.contact_effective_bottom}`,
    ),
  );
  checks.push(
    assert(
      nameContactGap + 1e-9 >= HEADER_IDENTITY_PAD_PX - 0.5,
      "after_name_contact_gap",
      `gap=${nameContactGap}`,
    ),
  );

  // Coverage replay on the applied canvas (ACTIVE_PLAN = DETERMINISTIC_HEADER)
  const appliedMembers = resolveHeaderIdentityMembersFromCanvas(after);
  checks.push(
    assert(
      Boolean(appliedMembers) &&
        String(
          (appliedMembers!.background.data as { role?: string })?.role ?? "",
        ) === "pale-strip",
      "applied_pale_strip_members",
      String((appliedMembers?.background.data as { role?: string })?.role),
    ),
  );

  const appliedPlan = planFromOps([
    {
      op: "set_dimensions",
      target_id: "block-header-0-r0",
      values: { height: afterGeom.band_bottom - afterGeom.band_top },
      founder_feedback_item: FOUNDER_LINES[0]!,
      founder_feedback_items: [FOUNDER_LINES[1]!],
    },
    {
      op: "set_position",
      target_id: "block-header-0-t2",
      values: { top: afterGeom.contact_top },
      founder_feedback_item: FOUNDER_LINES[0]!,
      founder_feedback_items: [FOUNDER_LINES[1]!],
    },
  ]);
  const appliedCollision = runCollisionBoundsCheck(after, preserve);
  const appliedLayout = runLayoutPreservationCheck({
    beforeCanvas: before,
    afterCanvas: after,
    requestedChange: preserve,
  });
  const appliedAcceptance = {
    schema_version: "founder-revision-acceptance-1.0.0" as const,
    task_id: "fixture-phase5o-applied",
    revision_id: null,
    decision_id: null,
    at: new Date().toISOString(),
    canvas_source: "post_mutation" as const,
    checks: [appliedCollision, appliedLayout],
    all_verification_pass:
      appliedCollision.evaluable &&
      appliedCollision.pass &&
      appliedLayout.evaluable &&
      appliedLayout.pass,
  };
  const appliedCov = buildFeedbackCoverage({
    requested_changes: FOUNDER_LINES,
    plan: appliedPlan,
    log: logFromPlan(appliedPlan),
    beforeCanvas: before,
    afterCanvas: after,
    acceptanceReport: appliedAcceptance,
  });
  checks.push(
    assert(
      appliedCov.gate_pass === true,
      "customer_success_offline_replay_coverage_pass",
      JSON.stringify(
        appliedCov.items.map((i) => ({
          s: i.status,
          n: i.evidence.notes?.slice(0, 100),
        })),
      ),
    ),
  );

  // Anti-false-negative: pale-strip top=48 height≈79
  const paleAfter = makePaleStripHeaderCanvas({
    bandHeight: 79,
    contactTop: 105,
    summaryTop: 139,
  });
  const paleMembers = resolveHeaderIdentityMembersFromCanvas(paleAfter);
  checks.push(
    assert(
      Boolean(paleMembers) &&
        String(
          (paleMembers!.background.data as { role?: string })?.role ?? "",
        ) === "pale-strip",
      "pale_strip_anti_false_negative_detect",
      String((paleMembers?.background.data as { role?: string })?.role),
    ),
  );

  const detPlan = planFromOps([
    {
      op: "set_dimensions",
      target_id: "block-header-0-r0",
      values: { height: 79 },
      founder_feedback_item: FOUNDER_LINES[0]!,
      founder_feedback_items: [FOUNDER_LINES[1]!],
    },
    {
      op: "set_position",
      target_id: "block-header-0-t2",
      values: { top: 105 },
      founder_feedback_item: FOUNDER_LINES[0]!,
      founder_feedback_items: [FOUNDER_LINES[1]!],
    },
    {
      op: "set_position",
      target_id: "block-summary-1-r0",
      values: { top: 139 },
      founder_feedback_item: FOUNDER_LINES[0]!,
      founder_feedback_items: [FOUNDER_LINES[1]!],
    },
    {
      op: "set_position",
      target_id: "block-summary-1-t1",
      values: { top: 144 },
      founder_feedback_item: FOUNDER_LINES[0]!,
      founder_feedback_items: [FOUNDER_LINES[1]!],
    },
    {
      op: "set_position",
      target_id: "block-summary-1-t2",
      values: { top: 169 },
      founder_feedback_item: FOUNDER_LINES[0]!,
      founder_feedback_items: [FOUNDER_LINES[1]!],
    },
    {
      op: "set_position",
      target_id: "block-experience-2-t1",
      values: { top: 229 },
      founder_feedback_item: FOUNDER_LINES[0]!,
      founder_feedback_items: [FOUNDER_LINES[1]!],
    },
  ]);

  const collisionCheck = runCollisionBoundsCheck(paleAfter, preserve);
  const layoutCheck = runLayoutPreservationCheck({
    beforeCanvas: before,
    afterCanvas: paleAfter,
    requestedChange: preserve,
  });
  const acceptance = {
    schema_version: "founder-revision-acceptance-1.0.0" as const,
    task_id: "fixture-phase5o",
    revision_id: null,
    decision_id: null,
    at: new Date().toISOString(),
    canvas_source: "post_mutation" as const,
    checks: [collisionCheck, layoutCheck],
    all_verification_pass:
      collisionCheck.evaluable &&
      collisionCheck.pass &&
      layoutCheck.evaluable &&
      layoutCheck.pass,
  };

  const cov = buildFeedbackCoverage({
    requested_changes: FOUNDER_LINES,
    plan: detPlan,
    log: logFromPlan(detPlan),
    beforeCanvas: before,
    afterCanvas: paleAfter,
    acceptanceReport: acceptance,
  });

  checks.push(
    assert(cov.gate_pass === true, "customer_success_coverage_gate_pass", JSON.stringify(cov.items.map((i) => ({ s: i.status, n: i.evidence.notes?.slice(0, 80) })))),
  );
  checks.push(
    assert(
      cov.items[0]?.status === "addressed" &&
        cov.items[1]?.status === "addressed",
      "equivalent_founder_lines_both_addressed",
      `${cov.items[0]?.status}/${cov.items[1]?.status}`,
    ),
  );
  checks.push(
    assert(
      cov.items[0]?.evidence.relation?.type === "CONTACT_IN_HEADER_BAND" &&
        cov.items[0]?.evidence.relation?.pass === true,
      "contact_in_header_band_pass",
      JSON.stringify(cov.items[0]?.evidence.relation),
    ),
  );
  checks.push(
    assert(
      cov.items[2]?.status === "addressed",
      "preserve_rest_addressed_as_va",
      cov.items[2]?.evidence.notes ?? "",
    ),
  );

  const summaryTop = 139;
  const clearance = summaryTop - (48 + 79);
  checks.push(
    assert(
      clearance + 1e-9 >= HEADER_TO_SUMMARY_CLEARANCE_PX - 0.5,
      "summary_clearance_preserved",
      `clearance=${clearance}`,
    ),
  );
  checks.push(
    assert(
      findTextOverlapFindings(paleAfter).length === 0,
      "text_overlaps_zero",
      String(findTextOverlapFindings(paleAfter).length),
    ),
  );

  // Negative fixtures
  const stillOutside = makePaleStripHeaderCanvas({
    bandHeight: 54,
    contactTop: 97,
  });
  const failOutside = buildFeedbackCoverage({
    requested_changes: [FOUNDER_LINES[0]!],
    plan: detPlan,
    log: logFromPlan(detPlan),
    beforeCanvas: before,
    afterCanvas: stillOutside,
  });
  checks.push(
    assert(
      failOutside.items[0]?.status !== "addressed" &&
        failOutside.items[0]?.evidence.relation?.pass === false,
      "negative_contact_still_outside_fails",
      failOutside.items[0]?.status ?? "missing",
    ),
  );

  const thinPad = makePaleStripHeaderCanvas({
    bandHeight: 70,
    contactTop: 105,
  });
  // contact bottom 119, band bottom 118 → pad -1
  const failPad = buildFeedbackCoverage({
    requested_changes: [FOUNDER_LINES[0]!],
    plan: detPlan,
    log: logFromPlan(detPlan),
    beforeCanvas: before,
    afterCanvas: thinPad,
  });
  checks.push(
    assert(
      failPad.items[0]?.status !== "addressed",
      "negative_insufficient_bottom_pad_fails",
      failPad.items[0]?.evidence.notes?.slice(0, 120) ?? "",
    ),
  );

  // contact still outside short band
  const wrong = makePaleStripHeaderCanvas({
    bandHeight: 54,
    contactTop: 105,
    summaryTop: 139,
  });
  // enlarge a non-header rect only
  (wrong.objects as Record<string, unknown>[]).push({
    id: "decoy-rect",
    type: "Rect",
    left: 48,
    top: 400,
    width: 698,
    height: 200,
    fill: "#eee",
    data: { section: "experience", role: "decoy" },
  });
  const failWrong = buildFeedbackCoverage({
    requested_changes: [FOUNDER_LINES[1]!],
    plan: planFromOps([
      {
        op: "set_dimensions",
        target_id: "decoy-rect",
        values: { height: 200 },
        founder_feedback_item: FOUNDER_LINES[1]!,
      },
    ]),
    log: logFromPlan(
      planFromOps([
        {
          op: "set_dimensions",
          target_id: "decoy-rect",
          values: { height: 200 },
          founder_feedback_item: FOUNDER_LINES[1]!,
        },
      ]),
    ),
    beforeCanvas: before,
    afterCanvas: wrong,
  });
  checks.push(
    assert(
      failWrong.items[0]?.status !== "addressed",
      "negative_wrong_rect_enlarged_fails",
      failWrong.items[0]?.status ?? "",
    ),
  );

  const overlapName = makePaleStripHeaderCanvas({
    bandHeight: 79,
    contactTop: 70, // overlaps name (name bottom 97)
    nameTop: 58,
    nameHeight: 39,
  });
  const failOverlap = buildFeedbackCoverage({
    requested_changes: [FOUNDER_LINES[0]!],
    plan: detPlan,
    log: logFromPlan(detPlan),
    beforeCanvas: before,
    afterCanvas: overlapName,
  });
  checks.push(
    assert(
      failOverlap.items[0]?.status !== "addressed" &&
        failOverlap.items[0]?.evidence.relation?.pass === false,
      "negative_contact_name_overlap_fails",
      failOverlap.items[0]?.evidence.notes?.slice(0, 160) ?? "",
    ),
  );

  const brokenSummary = makePaleStripHeaderCanvas({
    bandHeight: 79,
    contactTop: 105,
    summaryTop: 120, // clearance 120-127 = -7 broken
  });
  const failSummary = buildFeedbackCoverage({
    requested_changes: [FOUNDER_LINES[0]!],
    plan: detPlan,
    log: logFromPlan(detPlan),
    beforeCanvas: before,
    afterCanvas: brokenSummary,
  });
  checks.push(
    assert(
      failSummary.items[0]?.status !== "addressed" &&
        failSummary.items[0]?.evidence.relation?.pass === false,
      "negative_summary_clearance_broken_fails",
      failSummary.items[0]?.evidence.notes?.slice(0, 160) ?? "",
    ),
  );

  const claimOnly = buildFeedbackCoverage({
    requested_changes: [FOUNDER_LINES[0]!],
    plan: detPlan,
    log: logFromPlan(detPlan),
    beforeCanvas: before,
    afterCanvas: stillOutside, // plan claims fix but geometry unchanged
  });
  checks.push(
    assert(
      claimOnly.gate_pass === false,
      "negative_plan_claims_but_geometry_fails",
      claimOnly.items[0]?.status ?? "",
    ),
  );

  const allPass = checks.every((c) => c.pass);
  const result = {
    generated_at: new Date().toISOString(),
    phase: "5O",
    overall: allPass ? "PASS" : "FAIL",
    openai: false,
    HEADER_IDENTITY_PAD_PX,
    checks,
    failed: checks.filter((c) => !c.pass).map((c) => c.name),
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(result, null, 2));
  if (!allPass) process.exit(1);
}

main();
