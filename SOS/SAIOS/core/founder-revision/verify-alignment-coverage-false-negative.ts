/**
 * Focused verify: generic alignment wording must not false-fail coverage.
 * Reproduces revtask-503c2d4d-1e5 FAILED_COVERAGE semantics (no OpenAI,
 * no production task / evidence mutation).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  buildFeedbackCoverage,
  isExplicitMultiObjectAlignmentRequest,
  requiresStructuralProof,
} from "./FeedbackCoverage.js";
import { listRevisionTasks } from "./RevisionTaskStore.js";
import type {
  OperationLogEntry,
  RevisionPlan,
} from "./revision-task-types.js";
import type { FabricCanvasDoc } from "./CanvasInventory.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/founder-revision/verify-alignment-coverage-false-negative.json",
);

type Check = { name: string; pass: boolean; detail: string };

function assert(cond: boolean, name: string, detail: string): Check {
  return { name, pass: cond, detail };
}

/** Exact Founder items from revtask-503c2d4d-1e5 false-partials. */
const HIERARCHY_FB =
  "Improve the visual hierarchy below the header by creating clearer separation between the job title and the contact information through spacing and alignment.";
const QA_FB =
  "Perform a final visual QA pass to ensure every section appears intentionally aligned, evenly spaced, and production-ready.";
const EXPLICIT_ALIGN_FB =
  "Align the left edges of the name, summary heading, experience heading, and skills heading.";

function textObj(
  id: string,
  left: number,
  top: number,
  text: string,
  section: string | null,
): Record<string, unknown> {
  return {
    type: "textbox",
    id,
    left,
    top,
    width: 200,
    height: 24,
    text,
    fill: "#111",
    fontSize: 12,
    selectable: true,
    evented: true,
    data: { id, ...(section ? { section } : {}) },
  };
}

/** Canvas with headerLeft=48 and body left=60 → maxSpread=12 (production shape). */
function spread12Canvas(): FabricCanvasDoc {
  return {
    version: "5.3.0",
    width: 794,
    height: 1123,
    objects: [
      textObj("hdr-name", 48, 40, "Ada Lovelace", "header"),
      textObj("body-summary", 60, 200, "Summary heading", "summary"),
      textObj("body-exp", 60, 320, "Experience heading", "experience"),
      textObj("body-skills", 60, 520, "Skills heading", "skills"),
    ],
  } as FabricCanvasDoc;
}

function alignedCanvas(): FabricCanvasDoc {
  return {
    version: "5.3.0",
    width: 794,
    height: 1123,
    objects: [
      textObj("hdr-name", 48, 40, "Ada Lovelace", "header"),
      textObj("body-summary", 48, 200, "Summary heading", "summary"),
      textObj("body-exp", 49, 320, "Experience heading", "experience"),
      textObj("body-skills", 48, 520, "Skills heading", "skills"),
    ],
  } as FabricCanvasDoc;
}

function emptyCanvas(): FabricCanvasDoc {
  return { version: "5.3.0", width: 794, height: 1123, objects: [] };
}

function okLog(
  fb: string,
  targetId: string,
  index: number,
): OperationLogEntry {
  return {
    index,
    op: "move_object",
    target_id: targetId,
    founder_feedback_item: fb,
    ok: true,
    before: { id: targetId, top: 100 },
    after: { id: targetId, top: 112 },
    error: null,
  };
}

function failLog(fb: string, targetId: string): OperationLogEntry {
  return {
    index: 0,
    op: "move_object",
    target_id: targetId,
    founder_feedback_item: fb,
    ok: false,
    before: { id: targetId, top: 100 },
    after: null,
    error: "move failed",
  };
}

function planFor(...feedbackItems: string[]): RevisionPlan {
  return {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "alignment coverage verify",
    notes: [],
    operations: feedbackItems.map((fb, i) => ({
      op: "move_object" as const,
      target_id: `obj-${i}`,
      before_summary: "prior position",
      intended_change: "nudge object for layout",
      values: { delta_top: 12 },
      founder_feedback_item: fb,
      confidence: 0.9,
    })),
  };
}

function main(): void {
  const checks: Check[] = [];
  const beforeFp = listRevisionTasks().map(
    (t) => `${t.task_id}:${t.status}:${t.updated_at}`,
  );
  const openaiCalls = 0;
  const spread12 = spread12Canvas();

  // Classification helpers
  checks.push(
    assert(
      !isExplicitMultiObjectAlignmentRequest(HIERARCHY_FB.toLowerCase()),
      "hierarchy_fb_not_explicit_multi_object_alignment",
      HIERARCHY_FB.slice(0, 80),
    ),
  );
  checks.push(
    assert(
      !isExplicitMultiObjectAlignmentRequest(QA_FB.toLowerCase()),
      "qa_fb_not_explicit_multi_object_alignment",
      QA_FB.slice(0, 80),
    ),
  );
  checks.push(
    assert(
      !requiresStructuralProof(HIERARCHY_FB.toLowerCase()),
      "hierarchy_fb_does_not_require_structural_proof",
      "ok",
    ),
  );
  checks.push(
    assert(
      !requiresStructuralProof(QA_FB.toLowerCase()),
      "qa_fb_does_not_require_structural_proof",
      "ok",
    ),
  );
  checks.push(
    assert(
      isExplicitMultiObjectAlignmentRequest(EXPLICIT_ALIGN_FB.toLowerCase()) &&
        requiresStructuralProof(EXPLICIT_ALIGN_FB.toLowerCase()),
      "explicit_left_edges_requires_structural_proof",
      EXPLICIT_ALIGN_FB,
    ),
  );

  // A — hierarchy + successful ops + spread12 canvas → addressed
  const covA = buildFeedbackCoverage({
    requested_changes: [HIERARCHY_FB],
    plan: planFor(HIERARCHY_FB),
    log: [okLog(HIERARCHY_FB, "obj-0", 0)],
    beforeCanvas: spread12,
    afterCanvas: spread12,
  });
  checks.push(
    assert(
      covA.items[0]?.status === "addressed" && covA.gate_pass === true,
      "A_hierarchy_generic_alignment_wording_addressed",
      `${covA.items[0]?.status} notes=${covA.items[0]?.evidence.notes}`,
    ),
  );
  checks.push(
    assert(
      !String(covA.items[0]?.evidence.notes ?? "").includes("maxSpread"),
      "A_does_not_apply_alignment_spread_heuristic",
      String(covA.items[0]?.evidence.notes ?? ""),
    ),
  );

  // B — final QA wording + successful ops → addressed
  const covB = buildFeedbackCoverage({
    requested_changes: [QA_FB],
    plan: planFor(QA_FB),
    log: [
      okLog(QA_FB, "obj-0", 0),
      okLog(QA_FB, "obj-1", 1),
      okLog(QA_FB, "obj-2", 2),
    ],
    beforeCanvas: spread12,
    afterCanvas: spread12,
  });
  checks.push(
    assert(
      covB.items[0]?.status === "addressed" && covB.gate_pass === true,
      "B_final_qa_aligned_wording_addressed",
      `${covB.items[0]?.status} notes=${covB.items[0]?.evidence.notes}`,
    ),
  );

  // C — explicit multi-object align with maxSpread=12 → partial
  const covC = buildFeedbackCoverage({
    requested_changes: [EXPLICIT_ALIGN_FB],
    plan: planFor(EXPLICIT_ALIGN_FB),
    log: [okLog(EXPLICIT_ALIGN_FB, "obj-0", 0)],
    beforeCanvas: spread12,
    afterCanvas: spread12,
  });
  checks.push(
    assert(
      covC.items[0]?.status === "partially_addressed" &&
        covC.gate_pass === false,
      "C_explicit_align_maxSpread_12_partial",
      `${covC.items[0]?.status} notes=${covC.items[0]?.evidence.notes}`,
    ),
  );
  checks.push(
    assert(
      String(covC.items[0]?.evidence.notes ?? "").includes("maxSpread=12"),
      "C_preserves_strict_spread_tolerance",
      String(covC.items[0]?.evidence.notes ?? ""),
    ),
  );

  // D — explicit align within tolerance → addressed
  const aligned = alignedCanvas();
  const covD = buildFeedbackCoverage({
    requested_changes: [EXPLICIT_ALIGN_FB],
    plan: planFor(EXPLICIT_ALIGN_FB),
    log: [okLog(EXPLICIT_ALIGN_FB, "obj-0", 0)],
    beforeCanvas: aligned,
    afterCanvas: aligned,
  });
  checks.push(
    assert(
      covD.items[0]?.status === "addressed" && covD.gate_pass === true,
      "D_explicit_align_within_tolerance_addressed",
      `${covD.items[0]?.status} notes=${covD.items[0]?.evidence.notes}`,
    ),
  );

  // E — no matching ops → not_addressed
  const covE = buildFeedbackCoverage({
    requested_changes: [HIERARCHY_FB],
    plan: planFor("Unrelated other feedback."),
    log: [okLog("Unrelated other feedback.", "obj-0", 0)],
    beforeCanvas: emptyCanvas(),
    afterCanvas: emptyCanvas(),
  });
  checks.push(
    assert(
      covE.items[0]?.status === "not_addressed" && covE.gate_pass === false,
      "E_zero_matching_ops_not_addressed",
      covE.items[0]?.status ?? "missing",
    ),
  );

  // F — failed matching op → not addressed
  const covF = buildFeedbackCoverage({
    requested_changes: [HIERARCHY_FB],
    plan: planFor(HIERARCHY_FB),
    log: [failLog(HIERARCHY_FB, "obj-0")],
    beforeCanvas: spread12,
    afterCanvas: spread12,
  });
  checks.push(
    assert(
      covF.items[0]?.status !== "addressed" && covF.gate_pass === false,
      "F_failed_matching_op_not_addressed",
      covF.items[0]?.status ?? "missing",
    ),
  );

  // Production failure fixture: both false-partials + successful ops must pass gate
  // for those two items (spread12 canvas would previously false-fail).
  const prodFixture = buildFeedbackCoverage({
    requested_changes: [HIERARCHY_FB, QA_FB],
    plan: planFor(HIERARCHY_FB, QA_FB),
    log: [
      okLog(HIERARCHY_FB, "title-contact", 0),
      okLog(QA_FB, "qa-1", 1),
      okLog(QA_FB, "qa-2", 2),
      okLog(QA_FB, "qa-3", 3),
    ],
    beforeCanvas: spread12,
    afterCanvas: spread12,
  });
  checks.push(
    assert(
      prodFixture.items.every((i) => i.status === "addressed") &&
        prodFixture.gate_pass === true,
      "prod_revtask_503c2d4d_1e5_false_partials_pass_after_fix",
      JSON.stringify(
        prodFixture.items.map((i) => ({
          status: i.status,
          notes: i.evidence.notes,
        })),
      ),
    ),
  );

  const afterFp = listRevisionTasks().map(
    (t) => `${t.task_id}:${t.status}:${t.updated_at}`,
  );
  checks.push(
    assert(
      JSON.stringify(beforeFp) === JSON.stringify(afterFp),
      "no_production_task_mutation",
      `before=${beforeFp.length} after=${afterFp.length}`,
    ),
  );
  checks.push(
    assert(openaiCalls === 0, "no_openai_calls", `openaiCalls=${openaiCalls}`),
  );

  const failed = checks.filter((c) => !c.pass);
  const report = {
    ok: failed.length === 0,
    passed: checks.filter((c) => c.pass).length,
    failed: failed.length,
    total: checks.length,
    checks,
    note: "Alignment coverage false-negative fix — no OpenAI, no production mutation",
  };
  mkdirSync(join(OUT, ".."), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(
    failed.length === 0
      ? `OK ${report.passed}/${report.total}`
      : `FAIL ${failed.map((f) => f.name).join(", ")}`,
  );
  process.exit(failed.length === 0 ? 0 : 1);
}

main();
