/**
 * Deterministic verify: wrap-aware effective text height for Founder revision
 * acceptance, normalizer, coverage, and classification.
 * No OpenAI. No production mutation.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildFeedbackCoverage,
  requiresOverlapReadabilityGeometricProof,
} from "./FeedbackCoverage.js";
import {
  classifyRequestedChange,
  verificationCheckTypes,
} from "./RequestedChangeClassification.js";
import {
  findTextOverlapFindings,
  runCollisionBoundsCheck,
  runRevisionAcceptanceChecks,
} from "./RevisionAcceptanceChecks.js";
import {
  MIN_SECTION_GAP_PX,
  normalizeRevisionLayout,
} from "./RevisionLayoutNormalizer.js";
import {
  effectiveTextHeightScaled,
  estimateWrappedLineCount,
} from "./TextEffectiveHeight.js";
import type {
  CanvasOperation,
  RevisionPlan,
} from "./revision-task-types.js";
import type { FabricCanvasDoc } from "./CanvasInventory.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/founder-revision/verify-wrap-aware-text-height.json",
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
        system: true,
        data: { role: "pageBackground", system: true },
      },
      ...extra,
    ],
  } as FabricCanvasDoc;
}

/** Production-shaped under-height body (generic ids — not VP-specific runtime). */
function underHeightLongTextboxFixture(opts?: {
  nextTop?: number;
  storedHeight?: number;
}): FabricCanvasDoc {
  const longText =
    "Strategic Operational Leadership  ·  P&L Management  ·  Digital Transformation  ·  Lean Six Sigma & Continuous Improvement  ·  Supply Chain Optimization  ·  Cross-Functional Team Leadership  ·  Budgeting & Forecasting  ·  Predictive Analytics Implementation  ·  Vendor Management  ·  Change Management";
  const storedHeight = opts?.storedHeight ?? 84;
  const body = {
    type: "textbox",
    id: "fixture-body-long",
    left: 48,
    top: 500,
    width: 220,
    height: storedHeight,
    text: longText,
    fontSize: 10.5,
    fontFamily: "Inter",
    fontWeight: 400,
    lineHeight: 1.45,
    scaleX: 1,
    scaleY: 1,
    data: { section: "skills", role: "body" },
  };
  const eff = effectiveTextHeightScaled(body);
  const nextTop = opts?.nextTop ?? 500 + storedHeight + 4; // just below stored bbox
  if (eff <= storedHeight) {
    throw new Error(
      `fixture under-height precondition failed: eff=${eff} stored=${storedHeight}`,
    );
  }
  return pageCanvas([
    body,
    {
      type: "textbox",
      id: "fixture-next-heading",
      left: 48,
      top: nextTop,
      width: 220,
      height: 18,
      text: "PROJECTS",
      fontSize: 12,
      fontFamily: "Inter",
      fontWeight: "bold",
      lineHeight: 1.16,
      scaleX: 1,
      scaleY: 1,
      data: { section: "projects", role: "section-heading" },
    },
  ]);
}

function legalLongTextboxWithSpace(): FabricCanvasDoc {
  const longText =
    "Strategic Operational Leadership  ·  P&L Management  ·  Digital Transformation  ·  Lean Six Sigma & Continuous Improvement  ·  Supply Chain Optimization  ·  Cross-Functional Team Leadership  ·  Budgeting & Forecasting  ·  Predictive Analytics Implementation  ·  Vendor Management  ·  Change Management";
  const bodyProps = {
    type: "textbox",
    text: longText,
    width: 220,
    height: 84,
    fontSize: 10.5,
    lineHeight: 1.45,
  };
  const eff = effectiveTextHeightScaled(bodyProps);
  return pageCanvas([
    {
      type: "textbox",
      id: "legal-body-long",
      left: 48,
      top: 400,
      width: 220,
      height: 84,
      text: longText,
      fontSize: 10.5,
      lineHeight: 1.45,
      data: { section: "skills" },
    },
    {
      type: "textbox",
      id: "legal-next-heading",
      left: 48,
      top: 400 + eff + MIN_SECTION_GAP_PX + 8,
      width: 220,
      height: 18,
      text: "PROJECTS",
      fontSize: 12,
      fontWeight: "bold",
      data: { section: "projects", role: "section-heading" },
    },
  ]);
}

function shortTextboxStack(): FabricCanvasDoc {
  return pageCanvas([
    {
      type: "textbox",
      id: "short-a",
      left: 48,
      top: 200,
      width: 220,
      height: 20,
      text: "Short line A",
      fontSize: 10,
      lineHeight: 1.16,
      data: { section: "skills" },
    },
    {
      type: "textbox",
      id: "short-b",
      left: 48,
      top: 230,
      width: 220,
      height: 20,
      text: "Short line B",
      fontSize: 10,
      lineHeight: 1.16,
      data: { section: "skills" },
    },
  ]);
}

function twoColumnNoHorizontalOverlap(): FabricCanvasDoc {
  const longText =
    "Inventory management, logistics coordination, vendor negotiations, process optimization, KPI tracking, and continuous improvement across multi-site operations with measurable outcomes.";
  return pageCanvas([
    {
      type: "textbox",
      id: "col-left",
      left: 40,
      top: 300,
      width: 220,
      height: 60,
      text: longText,
      fontSize: 10,
      lineHeight: 1.16,
      data: { section: "skills" },
    },
    {
      type: "textbox",
      id: "col-right",
      left: 320,
      top: 300,
      width: 400,
      height: 40,
      text: "Main column body that sits beside the sidebar.",
      fontSize: 11,
      lineHeight: 1.2,
      data: { section: "summary" },
    },
  ]);
}

function emptyPlan(ops: CanvasOperation[]): RevisionPlan {
  return {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "wrap-aware fixture plan",
    notes: [],
    operations: ops,
  };
}

function main(): void {
  const checks: Check[] = [];

  // --- Metric unit proofs ---
  const prodLike = {
    type: "textbox",
    text: "Strategic Operational Leadership  ·  P&L Management  ·  Digital Transformation  ·  Lean Six Sigma & Continuous Improvement  ·  Supply Chain Optimization  ·  Cross-Functional Team Leadership  ·  Budgeting & Forecasting  ·  Predictive Analytics Implementation  ·  Vendor Management  ·  Change Management",
    width: 220,
    height: 84,
    fontSize: 10.5,
    lineHeight: 1.45,
    scaleY: 1,
  };
  const eff = effectiveTextHeightScaled(prodLike);
  const lines = estimateWrappedLineCount(prodLike);
  checks.push(
    assert(
      lines > 5 && eff > 84,
      "metric_prod_shaped_taller_than_stored",
      `lines=${lines} eff=${eff} stored=84`,
    ),
  );

  // --- Production-shaped under-height → COLLISION FAIL ---
  const broken = underHeightLongTextboxFixture();
  const storedOnlyGap =
    500 + 84 + 4 - (500 + 84); // next just below stored bottom
  void storedOnlyGap;
  const overlaps = findTextOverlapFindings(broken);
  checks.push(
    assert(
      overlaps.length >= 1,
      "acceptance_underheight_detects_overlap",
      JSON.stringify(overlaps.slice(0, 2)),
    ),
  );
  const coll = runCollisionBoundsCheck(
    broken,
    "Final output must have zero text overlap and all text must be fully readable",
  );
  checks.push(
    assert(
      coll.pass === false && coll.evaluable === true,
      "collision_bounds_fail_underheight",
      JSON.stringify({
        pass: coll.pass,
        findings: coll.findings.length,
        metrics: coll.metrics,
      }),
    ),
  );

  // --- Legal non-overlap ---
  const legal = legalLongTextboxWithSpace();
  checks.push(
    assert(
      findTextOverlapFindings(legal).length === 0,
      "legal_long_textbox_no_overlap",
      "spaced below effective height",
    ),
  );
  checks.push(
    assert(
      findTextOverlapFindings(shortTextboxStack()).length === 0,
      "short_textbox_stack_pass",
      "ordinary short text",
    ),
  );
  checks.push(
    assert(
      findTextOverlapFindings(twoColumnNoHorizontalOverlap()).length === 0,
      "two_column_no_false_collision",
      "columns without horizontal intersection",
    ),
  );

  // --- Normalizer respects effective body bottom ---
  const normBefore = pageCanvas([
    {
      type: "textbox",
      id: "nh",
      left: 48,
      top: 400,
      width: 220,
      height: 18,
      text: "SKILLS",
      fontSize: 12,
      fontWeight: "bold",
      data: { section: "skills", role: "section-heading" },
    },
    {
      type: "textbox",
      id: "nb",
      left: 48,
      top: 426,
      width: 220,
      height: 84,
      text: prodLike.text,
      fontSize: 10.5,
      lineHeight: 1.45,
      data: { section: "skills", role: "body" },
    },
    {
      type: "textbox",
      id: "np",
      left: 48,
      // Intentionally placed using stored body bottom + tiny gap (illegal for wrap).
      top: 426 + 84 + 4,
      width: 220,
      height: 18,
      text: "PROJECTS",
      fontSize: 12,
      fontWeight: "bold",
      data: { section: "projects", role: "section-heading" },
    },
  ]);
  const normalized = normalizeRevisionLayout({
    canvas: normBefore,
    requested_changes: [
      "Ensure each sidebar section fully contains its own content before the next section begins.",
    ],
  });
  const afterObjs = normalized.canvas.objects ?? [];
  const body = afterObjs.find((o) => o.id === "nb")!;
  const nextH = afterObjs.find((o) => o.id === "np")!;
  const bodyBottom =
    Number(body.top ?? 0) + effectiveTextHeightScaled(body as never);
  const nextTop = Number(nextH.top ?? 0);
  checks.push(
    assert(
      nextTop + 1e-9 >= bodyBottom + MIN_SECTION_GAP_PX - 0.5,
      "normalizer_respects_effective_body_bottom",
      `bodyBottom=${bodyBottom} nextTop=${nextTop} gap=${nextTop - bodyBottom}`,
    ),
  );

  // --- Classification ---
  const finalZero = classifyRequestedChange(
    "Final output must have zero text overlap and all text must be fully readable",
  );
  checks.push(
    assert(
      finalZero.classification === "VERIFICATION_ACCEPTANCE" &&
        verificationCheckTypes(finalZero).includes("COLLISION_BOUNDS"),
      "classify_final_zero_overlap",
      JSON.stringify(finalZero),
    ),
  );
  const afterVerify = classifyRequestedChange(
    "After all changes, verify zero text overlap / zero clipping / zero section intrusion",
  );
  checks.push(
    assert(
      afterVerify.classification === "VERIFICATION_ACCEPTANCE" &&
        verificationCheckTypes(afterVerify).includes("COLLISION_BOUNDS"),
      "classify_after_all_verify_zero",
      JSON.stringify(afterVerify),
    ),
  );
  checks.push(
    assert(
      classifyRequestedChange("Keep entire resume on one page").check_types.includes(
        "PAGE_FIT",
      ),
      "classify_page_fit_unchanged",
      "page fit still verification",
    ),
  );
  checks.push(
    assert(
      classifyRequestedChange(
        "Do not remove, shorten, invent or alter factual content",
      ).check_types.includes("CONTENT_PRESERVATION"),
      "classify_content_preservation_unchanged",
      "content preservation still verification",
    ),
  );
  checks.push(
    assert(
      classifyRequestedChange(
        "Preserve the improved Summary to Experience spacing; do not undo it",
      ).check_types.includes("LAYOUT_PRESERVATION"),
      "classify_layout_preservation_unchanged",
      "layout preservation still verification",
    ),
  );

  // --- Coverage: ops alone insufficient; geometric proof required ---
  const zeroOverlapItem =
    "Final output must have zero text overlap and all text must be fully readable";
  // Mutation-phrased sibling for op attribution path
  const removeOverlapItem =
    "Remove every visible text overlap and collision in the left sidebar so every line is fully readable.";
  checks.push(
    assert(
      requiresOverlapReadabilityGeometricProof(
        removeOverlapItem.toLowerCase(),
      ),
      "requires_overlap_geo_proof_flag",
      "mutation overlap item requires geometric proof",
    ),
  );

  const badAfter = underHeightLongTextboxFixture();
  const plan = emptyPlan([
    {
      op: "set_position",
      target_id: "fixture-body-long",
      before_summary: "prior",
      intended_change: "nudge body",
      values: { top: 500 },
      founder_feedback_item: removeOverlapItem,
      confidence: 0.9,
    },
  ]);
  const log = [
    {
      index: 0,
      ok: true,
      op: "set_position",
      target_id: "fixture-body-long",
      founder_feedback_item: removeOverlapItem,
      before: { id: "fixture-body-long", top: 490 },
      after: { id: "fixture-body-long", top: 500 },
    },
  ];
  const acceptanceFail = runRevisionAcceptanceChecks({
    afterCanvas: badAfter,
    requested_changes: [zeroOverlapItem],
  });
  const covFail = buildFeedbackCoverage({
    requested_changes: [removeOverlapItem, zeroOverlapItem],
    plan,
    log: log as never,
    beforeCanvas: badAfter,
    afterCanvas: badAfter,
    acceptanceReport: acceptanceFail,
  });
  const removeItem = covFail.items.find(
    (i) => i.founder_feedback_item === removeOverlapItem,
  );
  const verifyItem = covFail.items.find(
    (i) => i.founder_feedback_item === zeroOverlapItem,
  );
  checks.push(
    assert(
      removeItem?.status !== "addressed",
      "coverage_ops_alone_not_addressed_when_collision",
      JSON.stringify(removeItem),
    ),
  );
  checks.push(
    assert(
      verifyItem?.status === "not_addressed",
      "coverage_verify_not_addressed_on_collision_fail",
      JSON.stringify(verifyItem),
    ),
  );

  const goodAfter = legalLongTextboxWithSpace();
  const acceptancePass = runRevisionAcceptanceChecks({
    afterCanvas: goodAfter,
    requested_changes: [zeroOverlapItem],
  });
  const planGood = emptyPlan([
    {
      op: "set_position",
      target_id: "legal-body-long",
      before_summary: "prior",
      intended_change: "restack",
      values: { top: 400 },
      founder_feedback_item: removeOverlapItem,
      confidence: 0.9,
    },
  ]);
  const logGood = [
    {
      index: 0,
      ok: true,
      op: "set_position",
      target_id: "legal-body-long",
      founder_feedback_item: removeOverlapItem,
      before: { id: "legal-body-long", top: 390 },
      after: { id: "legal-body-long", top: 400 },
    },
  ];
  const covPass = buildFeedbackCoverage({
    requested_changes: [removeOverlapItem, zeroOverlapItem],
    plan: planGood,
    log: logGood as never,
    beforeCanvas: goodAfter,
    afterCanvas: goodAfter,
    acceptanceReport: acceptancePass,
  });
  const removeOk = covPass.items.find(
    (i) => i.founder_feedback_item === removeOverlapItem,
  );
  const verifyOk = covPass.items.find(
    (i) => i.founder_feedback_item === zeroOverlapItem,
  );
  checks.push(
    assert(
      removeOk?.status === "addressed",
      "coverage_addressed_when_geo_proof_passes",
      JSON.stringify(removeOk),
    ),
  );
  checks.push(
    assert(
      verifyOk?.status === "addressed",
      "coverage_verify_addressed_on_collision_pass",
      JSON.stringify(verifyOk),
    ),
  );

  // --- Prior visually-broken candidate replay (read-only if present) ---
  const candidatePaths = [
    join(
      REPO,
      "SOS/07_LOGS/saios/founder-revision/fixtures/cand-executive-vp-of-operations-revfb-020593-canvas.json",
    ),
    join(
      REPO,
      "SOS/07_LOGS/saios/candidates/cand-executive-vp-of-operations-20260811T095415Z-f2118c-revfb-6aa0df-revfb-e61104-revfb-020593/canvas.json",
    ),
  ];
  let replayDetail = "candidate canvas unavailable locally";
  let replayPass = false;
  let found = false;
  for (const p of candidatePaths) {
    if (!existsSync(p)) continue;
    found = true;
    const canvas = JSON.parse(readFileSync(p, "utf8")) as FabricCanvasDoc;
    const findings = findTextOverlapFindings(canvas);
    replayPass = findings.length >= 1;
    const skills = (canvas.objects ?? []).find(
      (o) => o.id === "block-skills-4-t2",
    );
    const eff = skills ? effectiveTextHeightScaled(skills as never) : null;
    replayDetail = `path=${p} overlaps=${findings.length} skills_eff=${eff} skills_stored=${skills && (skills as { height?: number }).height} sample=${JSON.stringify(findings.slice(0, 3))}`;
    break;
  }
  if (!found) replayPass = true; // non-blocking skip
  checks.push(
    assert(
      replayPass,
      "prior_vp_ops_candidate_replay_or_skip",
      replayDetail,
    ),
  );

  const failed = checks.filter((c) => !c.pass);
  const report = {
    schema_version: "verify-wrap-aware-text-height-1.0.0",
    at: new Date().toISOString(),
    pass: failed.length === 0,
    checks,
    failed: failed.map((c) => c.name),
  };
  mkdirSync(join(REPO, "SOS/07_LOGS/saios/founder-revision"), {
    recursive: true,
  });
  writeFileSync(OUT, JSON.stringify(report, null, 2));
  const sha = createHash("sha256")
    .update(readFileSync(fileURLToPath(import.meta.url)))
    .digest("hex");
  console.log(
    JSON.stringify(
      {
        pass: report.pass,
        failed: report.failed,
        out: OUT,
        verifier_sha256: sha,
      },
      null,
      2,
    ),
  );
  if (!report.pass) process.exit(1);
}

main();
