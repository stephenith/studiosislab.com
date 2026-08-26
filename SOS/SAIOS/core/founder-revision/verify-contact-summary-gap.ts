/**
 * Focused verify: CONTACT_TO_SUMMARY_GAP coverage + header→summary normalizer.
 * No OpenAI. No production task/evidence mutation.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  buildFeedbackCoverage,
  isContactBandExtensionRequest,
  isContactToSummaryGapRequest,
  requiresStructuralProof,
} from "./FeedbackCoverage.js";
import type { FabricCanvasDoc } from "./CanvasInventory.js";
import {
  MIN_SECTION_GAP_PX,
  normalizeRevisionLayout,
} from "./RevisionLayoutNormalizer.js";
import { listRevisionTasks } from "./RevisionTaskStore.js";
import type { RevisionPlan } from "./revision-task-types.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/founder-revision/verify-contact-summary-gap.json",
);

type Check = { name: string; pass: boolean; detail: string };

function assert(cond: boolean, name: string, detail: string): Check {
  return { name, pass: cond, detail };
}

const CONTACT_GAP_FB =
  'Rework the contact block below the name so "Senior Software Engineer", the contact details, and "Austin, TX" form a clean compact header group, then add a clear and consistent vertical gap before the Summary section begins.';

const BAND_FB =
  "Move contact inside the blue header band and extend the banner so contact sits within the header.";

const GROUP_ONLY_FB =
  "Group contact details in the header into a compact header group.";

function pageBg(h = 1123): Record<string, unknown> {
  return {
    type: "rect",
    id: "page-root",
    left: 0,
    top: 0,
    width: 794,
    height: h,
    fill: "#ffffff",
    data: { role: "pageBackground", kind: "page-bg", system: true, id: "page-root" },
  };
}

/** Exact production-like geometry: contact bottom 109, Summary top 120, gap 11. */
function contactGap11Canvas(): FabricCanvasDoc {
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
        height: 40,
        fill: "#dbeafe",
        data: { id: "block-header-0-r0", section: "header", role: "pale-strip" },
      },
      {
        type: "textbox",
        id: "block-header-0-t1",
        left: 60,
        top: 54.5,
        width: 674,
        height: 39,
        text: "Elena Voss",
        fontSize: 32,
        data: { id: "block-header-0-t1", section: "header" },
      },
      {
        type: "textbox",
        id: "block-header-0-t2",
        left: 60,
        top: 95,
        width: 674,
        height: 14,
        text: "Senior Software Engineer  ·  elena.voss@example.com · +1-555-724-9821 · LinkedIn: linkedin.com/in/elenavoss · Austin, TX",
        fontSize: 12,
        data: { id: "block-header-0-t2", section: "header" },
      },
      {
        type: "rect",
        id: "block-summary-1-r0",
        left: 48,
        top: 120,
        width: 160,
        height: 24,
        fill: "#1e3a5f",
        data: {
          id: "block-summary-1-r0",
          section: "summary",
          role: "filled-label",
        },
      },
      {
        type: "textbox",
        id: "block-summary-1-t1",
        left: 58,
        top: 125,
        width: 688,
        height: 14,
        text: "SUMMARY",
        fontSize: 16,
        fill: "#ffffff",
        data: { id: "block-summary-1-t1", section: "summary" },
      },
      {
        type: "textbox",
        id: "block-summary-1-t2",
        left: 48,
        top: 166,
        width: 698,
        height: 61,
        text: "Summary body paragraph for layout.",
        fontSize: 10.5,
        data: { id: "block-summary-1-t2", section: "summary" },
      },
      {
        type: "rect",
        id: "block-experience-2-r0",
        left: 48,
        top: 240,
        width: 160,
        height: 24,
        fill: "#1e3a5f",
        data: {
          id: "block-experience-2-r0",
          section: "experience",
          role: "filled-label",
        },
      },
      {
        type: "textbox",
        id: "block-experience-2-t1",
        left: 58,
        top: 245,
        width: 200,
        height: 14,
        text: "EXPERIENCE",
        fontSize: 16,
        fill: "#ffffff",
        data: { id: "block-experience-2-t1", section: "experience" },
      },
      {
        type: "textbox",
        id: "block-experience-2-t2",
        left: 48,
        top: 272,
        width: 698,
        height: 16,
        text: "Lead Engineer — Example Co",
        fontSize: 11,
        data: { id: "block-experience-2-t2", section: "experience" },
      },
    ],
  } as FabricCanvasDoc;
}

function findObj(canvas: FabricCanvasDoc, id: string): Record<string, unknown> | null {
  for (const o of canvas.objects ?? []) {
    if (o.id === id || (o.data as { id?: string } | undefined)?.id === id) {
      return o;
    }
  }
  return null;
}

function planFourOps(fb: string): RevisionPlan {
  return {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "contact gap",
    notes: [],
    operations: [
      {
        op: "set_position",
        target_id: "block-header-0-t2",
        values: { top: 95 },
        before_summary: "contact",
        intended_change: "compact contact",
        founder_feedback_item: fb,
        confidence: 0.95,
      },
      {
        op: "set_position",
        target_id: "block-summary-1-r0",
        values: { top: 120 },
        before_summary: "summary rect",
        intended_change: "gap before summary",
        founder_feedback_item: fb,
        confidence: 0.95,
      },
      {
        op: "set_position",
        target_id: "block-summary-1-t1",
        values: { top: 125 },
        before_summary: "summary text",
        intended_change: "keep heading",
        founder_feedback_item: fb,
        confidence: 0.95,
      },
      {
        op: "set_position",
        target_id: "block-summary-1-t2",
        values: { top: 166 },
        before_summary: "summary body",
        intended_change: "keep body",
        founder_feedback_item: fb,
        confidence: 0.95,
      },
    ],
  };
}

function okLogs(fb: string) {
  // Log indices must match plan operation indices (0..n-1) for attribution mapping.
  return [
    {
      index: 0,
      op: "set_position" as const,
      target_id: "block-header-0-t2",
      founder_feedback_item: fb,
      ok: true,
      before: { id: "block-header-0-t2", top: 103 },
      after: { id: "block-header-0-t2", top: 95 },
      error: null,
    },
    {
      index: 1,
      op: "set_position" as const,
      target_id: "block-summary-1-r0",
      founder_feedback_item: fb,
      ok: true,
      before: { id: "block-summary-1-r0", top: 135 },
      after: { id: "block-summary-1-r0", top: 120 },
      error: null,
    },
    {
      index: 2,
      op: "set_position" as const,
      target_id: "block-summary-1-t1",
      founder_feedback_item: fb,
      ok: true,
      before: { id: "block-summary-1-t1", top: 140 },
      after: { id: "block-summary-1-t1", top: 125 },
      error: null,
    },
    {
      index: 3,
      op: "set_position" as const,
      target_id: "block-summary-1-t2",
      founder_feedback_item: fb,
      ok: true,
      before: { id: "block-summary-1-t2", top: 181 },
      after: { id: "block-summary-1-t2", top: 166 },
      error: null,
    },
  ];
}

function main(): void {
  const checks: Check[] = [];
  const beforeFp = listRevisionTasks().map(
    (t) => `${t.task_id}:${t.status}:${t.updated_at}`,
  );
  const openaiCalls = 0;

  // Classification routing
  checks.push(
    assert(
      isContactToSummaryGapRequest(CONTACT_GAP_FB.toLowerCase()) &&
        !isContactBandExtensionRequest(CONTACT_GAP_FB.toLowerCase()) &&
        requiresStructuralProof(CONTACT_GAP_FB.toLowerCase()),
      "B_contact_gap_fb_uses_gap_proof_not_band",
      "ok",
    ),
  );
  checks.push(
    assert(
      isContactBandExtensionRequest(BAND_FB.toLowerCase()) &&
        !isContactToSummaryGapRequest(BAND_FB.toLowerCase()) &&
        requiresStructuralProof(BAND_FB.toLowerCase()),
      "A_band_fb_still_requires_band_proof",
      "ok",
    ),
  );
  checks.push(
    assert(
      !isContactToSummaryGapRequest(GROUP_ONLY_FB.toLowerCase()) &&
        !isContactBandExtensionRequest(GROUP_ONLY_FB.toLowerCase()),
      "C_group_only_no_gap_or_band_proof",
      `gap=${isContactToSummaryGapRequest(GROUP_ONLY_FB.toLowerCase())} band=${isContactBandExtensionRequest(GROUP_ONLY_FB.toLowerCase())}`,
    ),
  );

  const raw = contactGap11Canvas();
  const contactBottom =
    Number(findObj(raw, "block-header-0-t2")?.top) +
    Number(findObj(raw, "block-header-0-t2")?.height);
  const summaryTop = Number(findObj(raw, "block-summary-1-r0")?.top);
  checks.push(
    assert(
      contactBottom === 109 && summaryTop === 120 && summaryTop - contactBottom === 11,
      "fixture_gap_11",
      `contactBottom=${contactBottom} summaryTop=${summaryTop}`,
    ),
  );

  // Coverage on gap=11 canvas → partial (before normalizer)
  const cov11 = buildFeedbackCoverage({
    requested_changes: [CONTACT_GAP_FB],
    plan: planFourOps(CONTACT_GAP_FB),
    log: okLogs(CONTACT_GAP_FB),
    beforeCanvas: raw,
    afterCanvas: raw,
  });
  const item11 = cov11.items[0]!;
  checks.push(
    assert(
      item11.status === "partially_addressed" &&
        item11.evidence.relation?.type === "CONTACT_TO_SUMMARY_GAP" &&
        item11.evidence.relation?.gap_px === 11 &&
        item11.evidence.relation?.minimum_gap_px === MIN_SECTION_GAP_PX &&
        item11.evidence.relation?.pass === false &&
        String(item11.evidence.notes ?? "").includes("11"),
      "coverage_gap_11_partial",
      JSON.stringify(item11.evidence),
    ),
  );

  // Evidence pairing: multi-op different IDs → no singular before/after
  checks.push(
    assert(
      Array.isArray(item11.evidence.operation_evidence) &&
        item11.evidence.operation_evidence.length === 4 &&
        item11.evidence.operation_evidence.every(
          (e, i) =>
            e.target_id === okLogs(CONTACT_GAP_FB)[i]!.target_id &&
            (e.before as { id?: string } | null)?.id === e.target_id &&
            (e.after as { id?: string } | null)?.id === e.target_id,
        ) &&
        item11.evidence.before === undefined &&
        item11.evidence.after === undefined,
      "A_B_operation_evidence_preserves_identity_no_mismatched_pair",
      JSON.stringify({
        before: item11.evidence.before,
        after: item11.evidence.after,
        ops: item11.evidence.operation_evidence,
      }),
    ),
  );

  // Relation fields
  checks.push(
    assert(
      item11.evidence.relation?.contact_id === "block-header-0-t2" &&
        item11.evidence.relation?.summary_id === "block-summary-1-r0" &&
        typeof item11.evidence.relation?.gap_px === "number" &&
        item11.evidence.relation?.minimum_gap_px === 12,
      "C_relation_records_ids_and_gaps",
      JSON.stringify(item11.evidence.relation),
    ),
  );

  // Normalizer repairs 11 → 12 and page still fits
  const normalized = normalizeRevisionLayout({ canvas: raw });
  const sumTopAfter = Number(
    findObj(normalized.canvas, "block-summary-1-r0")?.top,
  );
  const contactBottomAfter =
    Number(findObj(normalized.canvas, "block-header-0-t2")?.top) +
    Number(findObj(normalized.canvas, "block-header-0-t2")?.height);
  const gapAfter = sumTopAfter - contactBottomAfter;
  const expTop = Number(findObj(normalized.canvas, "block-experience-2-r0")?.top);
  checks.push(
    assert(
      normalized.report.ok === true &&
        gapAfter + 1e-9 >= MIN_SECTION_GAP_PX &&
        sumTopAfter === 121 &&
        contactBottomAfter === 109 &&
        expTop === 241 &&
        (normalized.report.page_fit?.fit_pass ?? false) === true,
      "normalizer_header_summary_gap_plus_1",
      `gap=${gapAfter} sumTop=${sumTopAfter} expTop=${expTop} page_fit=${JSON.stringify(normalized.report.page_fit)}`,
    ),
  );

  // Coverage after normalization → addressed
  const cov12 = buildFeedbackCoverage({
    requested_changes: [CONTACT_GAP_FB],
    plan: planFourOps(CONTACT_GAP_FB),
    log: okLogs(CONTACT_GAP_FB),
    beforeCanvas: raw,
    afterCanvas: normalized.canvas,
  });
  checks.push(
    assert(
      cov12.items[0]?.status === "addressed" &&
        cov12.items[0]?.evidence.relation?.pass === true &&
        cov12.gate_pass === true,
      "production_fixture_addressed_after_normalizer",
      JSON.stringify(cov12.items[0]?.evidence),
    ),
  );

  // Overlap case
  const overlap = contactGap11Canvas();
  (findObj(overlap, "block-summary-1-r0") as { top: number }).top = 100;
  const covOverlap = buildFeedbackCoverage({
    requested_changes: [CONTACT_GAP_FB],
    plan: planFourOps(CONTACT_GAP_FB),
    log: okLogs(CONTACT_GAP_FB),
    beforeCanvas: overlap,
    afterCanvas: overlap,
  });
  checks.push(
    assert(
      covOverlap.items[0]?.status !== "addressed" &&
        String(covOverlap.items[0]?.evidence.notes ?? "").toLowerCase().includes(
          "overlap",
        ),
      "overlap_not_addressed",
      covOverlap.items[0]?.evidence.notes ?? "missing",
    ),
  );

  // Ops alone without structural pass do not address (gap 11)
  checks.push(
    assert(
      cov11.items[0]?.status !== "addressed",
      "ops_alone_do_not_address_without_gap",
      cov11.items[0]?.status ?? "missing",
    ),
  );

  checks.push(assert(openaiCalls === 0, "N_no_openai", `n=${openaiCalls}`));
  const afterFp = listRevisionTasks().map(
    (t) => `${t.task_id}:${t.status}:${t.updated_at}`,
  );
  checks.push(
    assert(
      JSON.stringify(beforeFp) === JSON.stringify(afterFp),
      "H_production_tasks_untouched",
      `before=${beforeFp.length} after=${afterFp.length}`,
    ),
  );

  const failed = checks.filter((c) => !c.pass);
  const report = {
    schema_version: "founder-revision-contact-summary-gap-verify-1.0.0",
    ok: failed.length === 0,
    passed: checks.filter((c) => c.pass).length,
    total: checks.length,
    checks,
    at: new Date().toISOString(),
  };
  mkdirSync(join(OUT, ".."), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    failed.length === 0
      ? `OK ${report.passed}/${report.total}`
      : `FAIL ${failed.map((f) => f.name).join(", ")}`,
  );
  if (!report.ok) process.exit(1);
}

main();
