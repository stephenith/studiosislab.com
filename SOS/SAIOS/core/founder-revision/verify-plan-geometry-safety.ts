/**
 * Deterministic verify: pre-execution plan geometry safety + planner
 * wrap-aware inventory contract.
 * No OpenAI. No production mutation.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  buildCanvasInventory,
  inventorySummary,
  type FabricCanvasDoc,
} from "./CanvasInventory.js";
import { validatePlanGeometrySafety } from "./PlanGeometrySafety.js";
import { buildRevisionPlannerPrompt } from "./RevisionPromptBuilder.js";
import {
  isFounderInternalContentRhythmRequest,
  normalizeRevisionLayout,
} from "./RevisionLayoutNormalizer.js";
import {
  findTextOverlapFindings,
  runCollisionBoundsCheck,
} from "./RevisionAcceptanceChecks.js";
import { effectiveTextHeightScaled } from "./TextEffectiveHeight.js";
import type { RevisionPlan, RevisionTask } from "./revision-task-types.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/founder-revision/verify-plan-geometry-safety.json",
);

type Check = { name: string; pass: boolean; detail: string };

function assert(cond: boolean, name: string, detail: string): Check {
  return { name, pass: cond, detail };
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

const LONG_TEXT =
  "Strategic Operational Leadership  ·  P&L Management  ·  Digital Transformation  ·  Lean Six Sigma & Continuous Improvement  ·  Supply Chain Optimization  ·  Cross-Functional Team Leadership  ·  Budgeting & Forecasting  ·  Predictive Analytics Implementation  ·  Vendor Management  ·  Change Management";

/** Generic under-height A + lower B (stored bbox looks safe; wrap overlaps). */
function underHeightPairFixture(opts?: {
  aTop?: number;
  bTop?: number;
  aStoredH?: number;
  columnLeft?: number;
}): FabricCanvasDoc {
  const aTop = opts?.aTop ?? 176;
  const bTop = opts?.bTop ?? 264;
  const aStoredH = opts?.aStoredH ?? 84;
  const left = opts?.columnLeft ?? 48;
  return pageCanvas([
    {
      type: "textbox",
      id: "body-a",
      left,
      top: aTop,
      width: 220,
      height: aStoredH,
      text: LONG_TEXT,
      fontSize: 10.5,
      lineHeight: 1.45,
      fill: "#0a0a0a",
      data: { section: "skills", role: "body", id: "body-a" },
    },
    {
      type: "textbox",
      id: "body-b",
      left,
      top: bTop,
      width: 220,
      height: 46,
      text: "Tools  ·  Documentation  ·  Stakeholder Comms  ·  Process Design",
      fontSize: 10.5,
      lineHeight: 1.45,
      fill: "#0a0a0a",
      data: { section: "skills", role: "body", id: "body-b" },
    },
  ]);
}

function planOps(
  ops: RevisionPlan["operations"],
): RevisionPlan {
  return {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "fixture plan",
    operations: ops,
    notes: [],
  };
}

function stubTask(): RevisionTask {
  return {
    schema_version: "founder-revision-task-1.0.0",
    task_id: "revtask-geometry-verify",
    decision_id: "fd-geometry-verify",
    review_id: "rev-geometry-verify",
    prior_candidate_id: "cand-geometry-verify",
    prior_canvas_path: "canvas.json",
    founder_reason: "verify",
    requested_changes: [
      "Reflow the Skills content so every line is fully readable and vertically separated within the existing sidebar width.",
    ],
    role: "Verify",
    design_family: null,
    status: "PENDING",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    revised_candidate_id: null,
    revised_review_id: null,
    revision_number: 1,
    error: null,
    openai_execution_path: null,
    publication_allowed: false,
    live: false,
  };
}

async function main(): Promise<void> {
  process.env.SOS_AIOS_LIVE = "0";
  process.env.SOS_AI_FOUNDER_OPENAI_ONE_TEST = "0";
  delete process.env.OPENAI_API_KEY;

  const checks: Check[] = [];
  const fixture = underHeightPairFixture();
  const a = (fixture.objects ?? []).find((o) => o.id === "body-a")!;
  const effA = effectiveTextHeightScaled(a);
  checks.push(
    assert(
      effA > Number(a.height),
      "fixture_effective_taller_than_stored",
      `eff=${effA} stored=${a.height}`,
    ),
  );
  checks.push(
    assert(
      findTextOverlapFindings(fixture).length >= 1,
      "fixture_has_effective_overlap",
      `n=${findTextOverlapFindings(fixture).length}`,
    ),
  );

  // 1) Equal-delta +6/+6 → FAIL
  const equalDelta = planOps([
    {
      op: "set_position",
      target_id: "body-a",
      intended_change: "nudge A",
      values: { top: 182 },
      founder_feedback_item:
        "Reflow the Skills content so every line is fully readable and vertically separated within the existing sidebar width.",
      confidence: 0.9,
    },
    {
      op: "set_position",
      target_id: "body-b",
      intended_change: "nudge B",
      values: { top: 270 },
      founder_feedback_item:
        "Reflow the Skills content so every line is fully readable and vertically separated within the existing sidebar width.",
      confidence: 0.9,
    },
  ]);
  const eqGate = validatePlanGeometrySafety({
    canvas: fixture,
    plan: equalDelta,
  });
  checks.push(
    assert(
      eqGate.ok === false && eqGate.text_overlaps >= 1,
      "equal_delta_plan_rejected",
      `ok=${eqGate.ok} overlaps=${eqGate.text_overlaps} err=${eqGate.error}`,
    ),
  );

  // 2) Differential clearance → PASS
  const clearTop = Math.ceil(176 + effA + 2);
  const differential = planOps([
    {
      op: "set_position",
      target_id: "body-b",
      intended_change: "clear A effective bottom",
      values: { top: clearTop },
      founder_feedback_item:
        "Reflow the Skills content so every line is fully readable and vertically separated within the existing sidebar width.",
      confidence: 0.95,
    },
  ]);
  const diffGate = validatePlanGeometrySafety({
    canvas: fixture,
    plan: differential,
  });
  checks.push(
    assert(
      diffGate.ok === true && diffGate.text_overlaps === 0,
      "differential_clearance_plan_passes",
      `ok=${diffGate.ok} overlaps=${diffGate.text_overlaps} clearTop=${clearTop}`,
    ),
  );

  // 3) Short ordinary text → PASS
  const short = pageCanvas([
    {
      type: "textbox",
      id: "short-a",
      left: 48,
      top: 200,
      width: 200,
      height: 20,
      text: "Skills",
      fontSize: 12,
      lineHeight: 1.2,
      data: { section: "skills", id: "short-a" },
    },
    {
      type: "textbox",
      id: "short-b",
      left: 48,
      top: 230,
      width: 200,
      height: 20,
      text: "Projects",
      fontSize: 12,
      lineHeight: 1.2,
      data: { section: "projects", id: "short-b" },
    },
  ]);
  const shortGate = validatePlanGeometrySafety({
    canvas: short,
    plan: planOps([]),
  });
  checks.push(
    assert(
      shortGate.ok === true,
      "short_text_no_false_positive",
      `ok=${shortGate.ok}`,
    ),
  );

  // 4) Two columns horizontally separated → no false collision
  const twoCol = pageCanvas([
    {
      type: "textbox",
      id: "left-col",
      left: 40,
      top: 200,
      width: 200,
      height: 80,
      text: LONG_TEXT,
      fontSize: 10.5,
      lineHeight: 1.45,
      data: { section: "skills", id: "left-col" },
    },
    {
      type: "textbox",
      id: "right-col",
      left: 320,
      top: 210,
      width: 400,
      height: 80,
      text: LONG_TEXT,
      fontSize: 10.5,
      lineHeight: 1.45,
      data: { section: "summary", id: "right-col" },
    },
  ]);
  const twoColGate = validatePlanGeometrySafety({
    canvas: twoCol,
    plan: planOps([]),
  });
  checks.push(
    assert(
      twoColGate.ok === true,
      "two_column_no_false_collision",
      `ok=${twoColGate.ok} overlaps=${twoColGate.text_overlaps}`,
    ),
  );

  // 5) Legal n=2 stack → PASS
  const legalN2 = underHeightPairFixture({
    bTop: Math.ceil(176 + effA + 8),
  });
  checks.push(
    assert(
      findTextOverlapFindings(legalN2).length === 0,
      "legal_n2_stack_no_overlap",
      `n=${findTextOverlapFindings(legalN2).length}`,
    ),
  );
  const legalGate = validatePlanGeometrySafety({
    canvas: legalN2,
    plan: planOps([]),
  });
  checks.push(
    assert(legalGate.ok === true, "legal_n2_plan_pass", `ok=${legalGate.ok}`),
  );

  // 6) Illegal n=2: normalizer with Founder reflow clears effective overlap
  const illegal = underHeightPairFixture();
  const reflowItem =
    "Reflow the Skills content so every line is fully readable and vertically separated within the existing sidebar width.";
  checks.push(
    assert(
      isFounderInternalContentRhythmRequest(reflowItem) === true,
      "reflow_intent_gates_internal_rhythm",
      "expected Skills reflow wording to match gate",
    ),
  );
  const norm = normalizeRevisionLayout({
    canvas: illegal,
    requested_changes: [reflowItem],
  });
  const afterOverlaps = findTextOverlapFindings(norm.canvas);
  checks.push(
    assert(
      norm.report.ok === true && afterOverlaps.length === 0,
      "normalizer_clears_n2_effective_overlap",
      `ok=${norm.report.ok} overlaps=${afterOverlaps.length} resolutions=${norm.report.collision_resolutions.slice(-3).join(" | ")}`,
    ),
  );

  // 7) Page OOB — move text below page
  const oobPlan = planOps([
    {
      op: "set_position",
      target_id: "body-a",
      intended_change: "push off page",
      values: { top: 1100 },
      founder_feedback_item: reflowItem,
      confidence: 0.5,
    },
  ]);
  const oobGate = validatePlanGeometrySafety({
    canvas: underHeightPairFixture(),
    plan: oobPlan,
  });
  checks.push(
    assert(
      oobGate.ok === false && oobGate.page_oob >= 1,
      "page_oob_rejected",
      `ok=${oobGate.ok} page_oob=${oobGate.page_oob}`,
    ),
  );

  // Planner inventory / prompt contract
  const inv = buildCanvasInventory(fixture);
  const invA = inv.find((o) => o.id === "body-a")!;
  checks.push(
    assert(
      invA.stored_height === 84 &&
        invA.effective_height != null &&
        invA.effective_height > 84 &&
        invA.effective_bottom != null &&
        invA.text_len === LONG_TEXT.length,
      "inventory_exposes_effective_geometry",
      JSON.stringify({
        stored: invA.stored_height,
        eff: invA.effective_height,
        bottom: invA.effective_bottom,
        text_len: invA.text_len,
      }),
    ),
  );
  const summary = inventorySummary(inv);
  checks.push(
    assert(
      summary.includes("effective_height=") &&
        summary.includes("effective_bottom=") &&
        summary.includes("stored_height=") &&
        summary.includes("text_len="),
      "inventory_summary_includes_contract_fields",
      summary.split("\n").find((l) => l.includes("body-a")) ?? summary.slice(0, 200),
    ),
  );
  const prompt = buildRevisionPlannerPrompt({
    task: stubTask(),
    inventory: inv,
    page_width: 794,
    page_height: 1123,
    preview_width: 794,
    preview_height: 1123,
  });
  checks.push(
    assert(
      prompt.instructions.includes("WRAP-AWARE GEOMETRY CONTRACT") &&
        prompt.instructions.includes("effective_bottom") &&
        prompt.instructions.includes("DIFFERENTIAL") &&
        prompt.instructions.includes("Geometry field legend"),
      "prompt_describes_geometry_contract",
      "missing wrap-aware contract language",
    ),
  );

  // Acceptance still fail-closed on illegal fixture
  const acc = runCollisionBoundsCheck(
    fixture,
    "The final revised resume must have zero text overlap, zero clipping, zero section intrusion, and all sidebar text must be fully readable.",
  );
  checks.push(
    assert(
      acc.pass === false && acc.findings.length >= 1,
      "acceptance_still_fail_closed",
      `pass=${acc.pass} findings=${acc.findings.length}`,
    ),
  );

  // Optional production canvas offline replay (read-only)
  const prodPath = join(
    REPO,
    "SOS/07_LOGS/saios/first-production-cycle/candidates/cand-executive-vp-of-operations-20260811T095415Z-f2118c-revfb-6aa0df-revfb-e61104-revfb-020593/canvas.json",
  );
  if (existsSync(prodPath)) {
    const prod = JSON.parse(readFileSync(prodPath, "utf8")) as FabricCanvasDoc;
    const prodEqual = planOps([
      {
        op: "set_position",
        target_id: "block-skills-4-t2",
        intended_change: "nudge",
        values: { top: 182 },
        founder_feedback_item: reflowItem,
        confidence: 0.9,
      },
      {
        op: "set_position",
        target_id: "block-skills-4-t3",
        intended_change: "nudge",
        values: { top: 270 },
        founder_feedback_item: reflowItem,
        confidence: 0.9,
      },
    ]);
    const prodEq = validatePlanGeometrySafety({
      canvas: prod,
      plan: prodEqual,
    });
    checks.push(
      assert(
        prodEq.ok === false && prodEq.text_overlaps >= 1,
        "prod_canvas_equal_delta_rejected",
        `ok=${prodEq.ok} overlaps=${prodEq.text_overlaps}`,
      ),
    );
    const t2 = (prod.objects ?? []).find((o) => o.id === "block-skills-4-t2");
    if (t2) {
      const eff = effectiveTextHeightScaled(t2);
      const top = Number(t2.top ?? 176);
      const prodDiff = planOps([
        {
          op: "set_position",
          target_id: "block-skills-4-t3",
          intended_change: "clear skills wrap",
          values: { top: Math.ceil(top + eff + 4) },
          founder_feedback_item: reflowItem,
          confidence: 0.95,
        },
      ]);
      const prodDiffGate = validatePlanGeometrySafety({
        canvas: prod,
        plan: prodDiff,
      });
      checks.push(
        assert(
          prodDiffGate.ok === true,
          "prod_canvas_differential_passes_preexec",
          `ok=${prodDiffGate.ok} overlaps=${prodDiffGate.text_overlaps}`,
        ),
      );
      const prodNorm = normalizeRevisionLayout({
        canvas: prod,
        requested_changes: [
          reflowItem,
          "Keep Skills, Projects, Certifications, and Languages as one consistent sidebar section system with uniform heading-to-content spacing and section-to-section gaps.",
          "Reflow the Certifications section so every certification is individually readable with consistent line spacing and no overlap.",
        ],
        prior_canvas: prod,
      });
      const prodNormOverlaps = findTextOverlapFindings(prodNorm.canvas);
      const maxBottom = Math.max(
        ...((prodNorm.canvas.objects ?? [])
          .filter((o) => String(o.type).toLowerCase().includes("text"))
          .map((o) => effectiveTextHeightScaled(o) + Number(o.top ?? 0))),
      );
      checks.push(
        assert(
          prodNorm.report.ok === true && prodNormOverlaps.length === 0,
          "prod_canvas_normalizer_zero_effective_overlap",
          `ok=${prodNorm.report.ok} overlaps=${prodNormOverlaps.length}`,
        ),
      );
      checks.push(
        assert(
          maxBottom <= 1123 + 0.5 && prodNorm.report.page_fit?.fit_pass !== false,
          "prod_canvas_one_page_feasible",
          `maxBottom=${maxBottom} fit=${JSON.stringify(prodNorm.report.page_fit)}`,
        ),
      );
    }
  } else {
    checks.push(
      assert(
        true,
        "prod_canvas_offline_replay_skipped",
        "production candidate canvas not present locally",
      ),
    );
  }

  const failed = checks.filter((c) => !c.pass);
  const report = {
    schema_version: "verify-plan-geometry-safety-1.0.0",
    at: new Date().toISOString(),
    ok: failed.length === 0,
    openai_calls: 0,
    checks,
    failed: failed.map((c) => c.name),
  };
  mkdirSync(join(OUT, ".."), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ ok: report.ok, failed: report.failed, out: OUT }, null, 2));
  if (!report.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
