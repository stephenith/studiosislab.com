/**
 * Phase 6K — canonical final-state layout-intent proof matrix.
 *
 * Production origin: revtask-dd26226e-d8b FAILED_COVERAGE after Phase 6J.
 * Ownership PASS / coverage FAIL on Skills t2→t3 (52.32→37.10, 35% rule).
 * No OpenAI. No production mutation.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { buildFeedbackCoverage } from "./FeedbackCoverage.js";
import { buildPlanWithDeterministicSpacingOwnership } from "./DeterministicSpacingPlan.js";
import { isDeterministicLayoutNormalizerOwnedChange } from "./DeterministicSpacingPlan.js";
import {
  CANONICAL_LAYOUT_COVERED_BY,
  evaluateCanonicalFinalStateLayoutProof,
} from "./CanonicalFinalStateLayoutProof.js";
import { executeCanvasOperations } from "./CanvasOperationExecutor.js";
import {
  findTextOverlapFindings,
  runRevisionAcceptanceChecks,
} from "./RevisionAcceptanceChecks.js";
import { evaluateSectionReplacementCompleteness } from "./SectionReplacementCompleteness.js";
import { normalizeRevisionLayout } from "./RevisionLayoutNormalizer.js";
import { evaluateRevisionRoleTargetIntegrity } from "../role-integrity/RevisionRoleTargetIntegrity.js";
import { visualTextContentBottom, visualTextContentHeightScaled } from "./TextEffectiveHeight.js";
import { listRevisionTasks } from "./RevisionTaskStore.js";
import type { FabricCanvasDoc } from "./CanvasInventory.js";
import type { OperationLogEntry, RevisionPlan } from "./revision-task-types.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const FIX = resolve(
  REPO,
  ".cursor/debug-fixtures/revtask-dd26226e-d8b-sanitized",
);
const HIST = {
  b5339d03: resolve(REPO, ".cursor/debug-fixtures/revtask-b5339d03-b67-sanitized"),
  "9441fe34": resolve(REPO, ".cursor/debug-fixtures/revtask-9441fe34-4ba-sanitized"),
  b9a65ad0: resolve(REPO, ".cursor/debug-fixtures/revtask-b9a65ad0-eb0-sanitized"),
  "33ef5466": resolve(REPO, ".cursor/debug-fixtures/revtask-33ef5466-f24-sanitized"),
  "7a1c0899": resolve(REPO, ".cursor/debug-fixtures/revtask-7a1c0899-4d6-sanitized"),
  dd26226e: FIX,
};
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/founder-revision/verify-canonical-layout-proof-6k.json",
);

const SKILLS_LINE =
  "Reorganize the Skills section into a clean, readable structure with consistent line spacing and wrapping; the skills must not appear scattered, cramped, duplicated, or visually disconnected.";

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function assert(ok: boolean, name: string, detail = ""): void {
  checks.push({ name, pass: Boolean(ok), detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  " + detail : ""}`);
}

function loadJson<T>(dir: string, name: string): T {
  return JSON.parse(readFileSync(join(dir, name), "utf8")) as T;
}

function unwrapCanvas(raw: unknown): FabricCanvasDoc {
  if (raw && typeof raw === "object" && "canvas" in raw) {
    return (raw as { canvas: FabricCanvasDoc }).canvas;
  }
  return raw as FabricCanvasDoc;
}

function findObj(canvas: FabricCanvasDoc, id: string): Record<string, unknown> {
  const o = ((canvas.objects ?? []) as Array<Record<string, unknown>>).find(
    (x) => String(x.id ?? "") === id,
  );
  if (!o) throw new Error(`missing ${id}`);
  return o;
}

function visualGap(canvas: FabricCanvasDoc, a: string, b: string): number {
  return Number(findObj(canvas, b).top ?? 0) - visualTextContentBottom(findObj(canvas, a));
}

function oobCount(canvas: FabricCanvasDoc): number {
  const pageW = Number(canvas.width ?? 794);
  const pageH = Number(canvas.height ?? 1123);
  let n = 0;
  for (const o of (canvas.objects ?? []) as Array<Record<string, unknown>>) {
    const left = Number(o.left ?? 0);
    const top = Number(o.top ?? 0);
    const w = Number(o.width ?? 0) * Number(o.scaleX ?? 1);
    const h = Number(o.height ?? 0) * Number(o.scaleY ?? 1);
    if (left < -1 || top < -1 || left + w > pageW + 1 || top + h > pageH + 1) n += 1;
  }
  return n;
}

function textObj(spec: {
  id: string;
  text: string;
  top: number;
  height?: number;
  left?: number;
  width?: number;
  fontSize?: number;
  role?: string;
}): Record<string, unknown> {
  const o: Record<string, unknown> = {
    id: spec.id,
    type: "textbox",
    text: spec.text,
    left: spec.left ?? 60,
    top: spec.top,
    width: spec.width ?? 180,
    height: spec.height ?? 12,
    fontSize: spec.fontSize ?? 11,
    lineHeight: 1.16,
    scaleX: 1,
    scaleY: 1,
    data: { section: "skills", role: spec.role ?? "body" },
  };
  if (spec.height == null) {
    o.height = visualTextContentHeightScaled(o);
  }
  return o;
}

function miniCanvas(objects: Record<string, unknown>[]): FabricCanvasDoc {
  return { version: "5.3.0", width: 794, height: 1123, objects } as FabricCanvasDoc;
}

function runVerify(rel: string, name: string): boolean {
  const r = spawnSync("npx", ["--yes", "tsx", rel], {
    cwd: REPO,
    encoding: "utf8",
    timeout: 300000,
  });
  const ok = r.status === 0;
  assert(ok, name, r.status === 0 ? "PASS" : (r.stderr || r.stdout).slice(-500));
  return ok;
}

const beforeTasks = listRevisionTasks().map((t) => `${t.task_id}:${t.status}`);

const prior = loadJson<FabricCanvasDoc>(FIX, "prior-canvas.json");
const frozenFinal = unwrapCanvas(
  loadJson<unknown>(FIX, "post-normalization-canvas.json"),
);
const task = loadJson<{
  requested_changes: string[];
  status: string;
  role: string;
}>(FIX, "task.json");
const plan = loadJson<RevisionPlan>(FIX, "revision-plan.json");
const log = loadJson<OperationLogEntry[]>(FIX, "operation-log.json");
const ownArt = loadJson<{ ok?: boolean; overlap_count?: number; page_oob_count?: number }>(
  FIX,
  "deterministic-spacing-ownership.json",
);
const prodCov = loadJson<{
  items: Array<{ founder_feedback_item: string; status: string }>;
}>(FIX, "feedback-coverage.json");

/* 1. exact split verdict from immutable production artifacts */
const srcGap = visualGap(prior, "block-skills-4-t2", "block-skills-4-t3");
const frozenGap = visualGap(frozenFinal, "block-skills-4-t2", "block-skills-4-t3");
const frozenT2 = findObj(frozenFinal, "block-skills-4-t2");
const frozenT3 = findObj(frozenFinal, "block-skills-4-t3");
assert(
  Math.abs(srcGap - 52.32) < 0.05 && Math.abs(frozenGap - 37.1) < 0.05,
  "1_split_verdict_geometry_reproduced",
  `${srcGap.toFixed(2)}→${frozenGap.toFixed(2)}`,
);
assert(ownArt.ok === true, "1b_production_ownership_pass", String(ownArt.ok));
assert(
  prodCov.items[6]?.status === "partially_addressed" &&
    prodCov.items.filter((i) => i.status === "addressed").length === 27,
  "1c_production_coverage_27_of_28",
  prodCov.items[6]?.status ?? "missing",
);

const frozenProof = evaluateCanonicalFinalStateLayoutProof({
  requestedChange: SKILLS_LINE,
  beforeCanvas: prior,
  afterCanvas: frozenFinal,
});
assert(
  frozenProof.pass === false && frozenProof.reason === "VISUAL_GAP_TOO_LARGE",
  "1d_unrepaired_frozen_final_fails_canonical",
  `${frozenProof.reason}: ${frozenProof.final_condition}`,
);

/* 2–4. re-run pipeline; ownership + coverage share one verdict */
const owned = buildPlanWithDeterministicSpacingOwnership({
  priorCanvas: prior,
  requested_changes: task.requested_changes,
  aiPlan: plan,
});
assert(owned.ok === true && owned.plan != null, "2_ownership_rerun_ok", owned.error ?? "ok");

const exec = executeCanvasOperations({
  canvas: prior,
  operations: owned.plan?.operations ?? [],
});
assert(exec.ok === true, "2b_execute_ok", exec.error ?? "ok");
const after = exec.canvas;
const t2 = findObj(after, "block-skills-4-t2");
const t3 = findObj(after, "block-skills-4-t3");
const afterGap = visualGap(after, "block-skills-4-t2", "block-skills-4-t3");
const afterVisualH = visualTextContentHeightScaled(t2);
const afterStoredH = Number(t2.height ?? 0) * Number(t2.scaleY ?? 1);

const skillsProof = evaluateCanonicalFinalStateLayoutProof({
  requestedChange: SKILLS_LINE,
  beforeCanvas: prior,
  afterCanvas: after,
});
const ownSkills = (owned.canonical_layout_evidence ?? []).find(
  (e) => e.founder_feedback_item === SKILLS_LINE,
);
assert(Boolean(ownSkills), "2_canonical_layout_evidence_generated", ownSkills?.reason ?? "missing");
assert(
  ownSkills?.pass === skillsProof.pass && ownSkills?.reason === skillsProof.reason,
  "3_ownership_uses_canonical_verdict",
  `${ownSkills?.reason} vs ${skillsProof.reason}`,
);

const normalizedAfter = normalizeRevisionLayout({
  canvas: after,
  requested_changes: task.requested_changes,
  prior_canvas: prior,
});
const acceptance = runRevisionAcceptanceChecks({
  afterCanvas: after,
  beforeCanvas: prior,
  plan: owned.plan,
  requested_changes: task.requested_changes,
  target_role: task.role,
  page_fit: normalizedAfter.report.page_fit,
});
const cov = buildFeedbackCoverage({
  requested_changes: task.requested_changes,
  plan: owned.plan!,
  log: exec.log,
  beforeCanvas: prior,
  afterCanvas: after,
  acceptanceReport: acceptance,
  layoutNormalizationReport: normalizedAfter.report,
});
const item6 = cov.items[6];
assert(
  item6?.evidence.notes?.includes(`COVERED_BY=${CANONICAL_LAYOUT_COVERED_BY}`) === true,
  "4_feedback_coverage_uses_canonical_verdict",
  item6?.evidence.notes ?? "",
);
assert(
  item6?.evidence.notes?.includes("need −>") !== true &&
    item6?.evidence.notes?.includes("REDUCE_GAP") !== true,
  "11_source_relative_35_percent_not_layout_gate",
  item6?.evidence.notes ?? "",
);
assert(
  item6?.status === (skillsProof.pass ? "addressed" : "not_addressed"),
  "4b_coverage_matches_canonical_pass",
  `${item6?.status} vs canonical ${skillsProof.pass}`,
);

const addressed = cov.items.filter((i) => i.status === "addressed").length;
assert(
  skillsProof.pass === true && item6?.status === "addressed" && addressed === 28,
  "13_fixture_coverage_28_of_28",
  `${addressed}/28 canonical=${skillsProof.reason} gap=${afterGap.toFixed(2)}`,
);
assert(
  afterStoredH + 1e-6 < 92 && afterStoredH <= afterVisualH + 2,
  "12_unused_text_frame_slack_repaired",
  `stored=${afterStoredH.toFixed(2)} visual=${afterVisualH.toFixed(2)}`,
);
assert(
  afterGap + 1e-9 >= 2 && afterGap < frozenGap - 1,
  "6_safe_final_rhythm",
  afterGap.toFixed(2),
);

/* 5. ops count does not alter owner */
const dummyOps: RevisionPlan = {
  schema_version: "founder-canvas-revision-plan-1.0.0",
  summary: "dummy",
  operations: [
    {
      op: "set_position",
      target_id: "block-projects-5-t2",
      before_summary: "unrelated",
      intended_change: "unrelated sidebar move",
      values: { top: Number(findObj(after, "block-projects-5-t2").top ?? 0) },
      founder_feedback_item: SKILLS_LINE,
      confidence: 1,
    },
  ],
};
const covOps = buildFeedbackCoverage({
  requested_changes: [SKILLS_LINE],
  plan: dummyOps,
  log: [
    {
      op_index: 0,
      op: "set_position",
      target_id: "block-projects-5-t2",
      ok: true,
      founder_feedback_item: SKILLS_LINE,
    } as OperationLogEntry,
  ],
  beforeCanvas: prior,
  afterCanvas: after,
});
assert(
  covOps.items[0]?.evidence.notes?.includes(CANONICAL_LAYOUT_COVERED_BY) === true &&
    covOps.items[0]?.status === item6?.status,
  "5_ops_present_owner_still_canonical",
  covOps.items[0]?.evidence.notes ?? "",
);

const zeroPlan: RevisionPlan = {
  schema_version: "founder-canvas-revision-plan-1.0.0",
  summary: "zero",
  operations: [],
};
const covZero = buildFeedbackCoverage({
  requested_changes: [SKILLS_LINE],
  plan: zeroPlan,
  log: [],
  beforeCanvas: prior,
  afterCanvas: after,
});
assert(
  covZero.items[0]?.status === item6?.status &&
    covZero.items[0]?.evidence.notes?.includes(CANONICAL_LAYOUT_COVERED_BY) === true,
  "5b_zero_ops_same_canonical_owner",
  covZero.items[0]?.status ?? "",
);

/* 7–10 / A–E synthetic finals */
const heading = textObj({
  id: "block-skills-4-t1",
  text: "SKILLS",
  top: 150,
  role: "section-heading",
  fontSize: 12,
});
const headingH = visualTextContentHeightScaled(heading);
const goodT2 = textObj({
  id: "block-skills-4-t2",
  text: "Process Design",
  top: 150 + headingH + 8,
});
const t2H = visualTextContentHeightScaled(goodT2);
const goodT3 = textObj({
  id: "block-skills-4-t3",
  text: "Excel",
  top: Number(goodT2.top) + t2H + 8,
});
const goodFinal = miniCanvas([heading, goodT2, goodT3]);
const goodSrc = miniCanvas([
  heading,
  textObj({
    id: "block-skills-4-t2",
    text: "Process Design",
    top: 168,
    height: 92,
  }),
  textObj({
    id: "block-skills-4-t3",
    text: "Excel",
    top: 274,
  }),
]);
const goodProof = evaluateCanonicalFinalStateLayoutProof({
  requestedChange: SKILLS_LINE,
  beforeCanvas: goodSrc,
  afterCanvas: goodFinal,
});
assert(goodProof.pass === true, "6_safe_positive_readable_pass", goodProof.condition);

const excessive = miniCanvas([
  heading,
  goodT2,
  textObj({ ...goodT3, top: 320, id: "block-skills-4-t3", text: goodT3.text as string }),
]);
const excessiveProof = evaluateCanonicalFinalStateLayoutProof({
  requestedChange: SKILLS_LINE,
  beforeCanvas: goodFinal,
  afterCanvas: excessive,
});
assert(
  excessiveProof.pass === false &&
    (excessiveProof.reason === "VISUAL_GAP_TOO_LARGE" ||
      excessiveProof.reason === "LAYOUT_RHYTHM_UNSATISFIED"),
  "7_excessive_gap_fails",
  `${excessiveProof.reason}: ${excessiveProof.final_condition}`,
);

const cramped = miniCanvas([
  heading,
  goodT2,
  textObj({ ...goodT3, top: 169, id: "block-skills-4-t3", text: goodT3.text as string }),
]);
const crampedProof = evaluateCanonicalFinalStateLayoutProof({
  requestedChange: SKILLS_LINE,
  beforeCanvas: goodFinal,
  afterCanvas: cramped,
});
assert(
  crampedProof.pass === false &&
    (crampedProof.reason === "VISUAL_GAP_TOO_SMALL" || crampedProof.reason === "OVERLAP"),
  "8_cramped_gap_fails",
  `${crampedProof.reason}: ${crampedProof.final_condition}`,
);

const overlapC = miniCanvas([
  heading,
  goodT2,
  textObj({ ...goodT3, top: 160, id: "block-skills-4-t3", text: goodT3.text as string }),
]);
const overlapProof = evaluateCanonicalFinalStateLayoutProof({
  requestedChange: SKILLS_LINE,
  beforeCanvas: goodFinal,
  afterCanvas: overlapC,
});
assert(
  overlapProof.pass === false && overlapProof.reason === "OVERLAP",
  "9_overlap_fails",
  `${overlapProof.reason}: ${overlapProof.final_condition}`,
);

const oobC = miniCanvas([
  heading,
  goodT2,
  textObj({
    ...goodT3,
    top: 1200,
    id: "block-skills-4-t3",
    text: goodT3.text as string,
  }),
]);
const oobProof = evaluateCanonicalFinalStateLayoutProof({
  requestedChange: SKILLS_LINE,
  beforeCanvas: goodFinal,
  afterCanvas: oobC,
});
assert(
  oobProof.pass === false && oobProof.reason === "OOB",
  "10_oob_fails",
  `${oobProof.reason}: ${oobProof.final_condition}`,
);

assert(
  goodProof.pass === true && srcGap > 40,
  "D_source_bad_final_good_pass",
  `src=${srcGap.toFixed(2)} final_good=${goodProof.pass}`,
);
assert(
  evaluateCanonicalFinalStateLayoutProof({
    requestedChange: SKILLS_LINE,
    beforeCanvas: goodFinal,
    afterCanvas: excessive,
  }).pass === false,
  "E_source_good_final_bad_fail",
  "ok",
);

assert(
  isDeterministicLayoutNormalizerOwnedChange(SKILLS_LINE) === true,
  "F_layout_owned_regardless_of_ops",
  "owned",
);
assert(
  evaluateCanonicalFinalStateLayoutProof({
    requestedChange: SKILLS_LINE,
    beforeCanvas: goodFinal,
    afterCanvas: goodFinal,
  }).pass === true,
  "G_zero_op_already_good_pass",
  "ok",
);

/* 20–23 fixture safety after repair */
const overlaps = findTextOverlapFindings(after).length;
const pageOob = oobCount(after);
assert(overlaps === 0, "20_fixture_text_overlaps_0", String(overlaps));
assert(pageOob === 0, "21_fixture_page_oob_0", String(pageOob));

const role = evaluateRevisionRoleTargetIntegrity({
  target_role: task.role,
  afterCanvas: after,
  beforeCanvas: prior,
  requested_changes: task.requested_changes,
  plan: owned.plan,
});
assert(role.pass === true, "22_fixture_role_integrity", role.reason ?? "");

const complete = evaluateSectionReplacementCompleteness({
  canvas: prior,
  plan: owned.plan!,
  requested_changes: task.requested_changes,
});
assert(complete.ok === true, "23_fixture_section_completeness", complete.error ?? "ok");

const skillsOps = (owned.plan?.operations ?? []).filter((op) => {
  const items = [
    "founder_feedback_item" in op ? String(op.founder_feedback_item ?? "") : "",
    ...(("founder_feedback_items" in op && Array.isArray(op.founder_feedback_items)
      ? op.founder_feedback_items
      : []) as string[]),
  ];
  return items.includes(SKILLS_LINE);
});
const unrelatedSidebar = skillsOps.filter((op) => {
  const id = "target_id" in op ? String(op.target_id ?? "") : "";
  return id.startsWith("block-") && !id.includes("skills");
});
assert(
  owned.plan?.operations.some(
    (op) =>
      op.op === "set_position" &&
      op.target_id === "block-skills-4-t3" &&
      Number(op.values?.top) === Number(t3.top),
  ) !== false || Number(t3.top) !== 274,
  "14_skills_relation_moved_or_resized",
  `t3top=${t3.top} t2h=${t2.height}`,
);

/* 15–19 regressions */
const sixG = runVerify(
  "SOS/SAIOS/core/founder-revision/verify-durable-request-contract-6g.ts",
  "15_phase_6g_regression",
);
const sixH = runVerify(
  "SOS/SAIOS/core/founder-revision/verify-post-content-reflow-6h.ts",
  "16_phase_6h_regression",
);
const sixI = runVerify(
  "SOS/SAIOS/core/founder-revision/verify-revision-role-integrity-6i.ts",
  "17_phase_6i_regression",
);
const sixJ = runVerify(
  "SOS/SAIOS/core/founder-revision/verify-section-replacement-completeness-6j.ts",
  "18_phase_6j_regression",
);
const mm = runVerify(
  "SOS/SAIOS/core/founder-revision/verify-revision-production-replay.ts",
  "19_historical_marketing_manager_revision",
);

for (const [key, dir] of Object.entries(HIST)) {
  assert(
    existsSync(join(dir, "meta.json")) || existsSync(join(dir, "task.json")),
    `24_${key}_fixture_present`,
    dir,
  );
}

const afterTasks = listRevisionTasks().map((t) => `${t.task_id}:${t.status}`);
assert(
  JSON.stringify(beforeTasks) === JSON.stringify(afterTasks),
  "24b_no_production_task_mutation",
  `${beforeTasks.length} tasks unchanged`,
);

const failed = checks.filter((c) => !c.pass);
const report = {
  schema_version: "verify-canonical-layout-proof-6k-1.0.0",
  ok: failed.length === 0,
  passed: checks.length - failed.length,
  failed: failed.length,
  fixture_skills_t2_stored_height_before: frozenT2.height,
  fixture_skills_t2_stored_height_after: t2.height,
  fixture_skills_t2_visual_height: Number(afterVisualH.toFixed(2)),
  fixture_skills_t3_top_before: frozenT3.top,
  fixture_skills_t3_top_after: t3.top,
  fixture_skills_visual_gap_before: Number(frozenGap.toFixed(2)),
  fixture_skills_visual_gap_after: Number(afterGap.toFixed(2)),
  fixture_canonical_layout_verdict: skillsProof.pass ? "PASS" : "FAIL",
  fixture_canonical_reason: skillsProof.reason,
  fixture_feedback_coverage_after: `${addressed}/28`,
  fixture_text_overlaps: overlaps,
  fixture_page_oob: pageOob,
  unrelated_sidebar_ops_attributed_to_skills: unrelatedSidebar.length,
  six_g: sixG,
  six_h: sixH,
  six_i: sixI,
  six_j: sixJ,
  marketing_manager_replay: mm,
  openai_called: false,
  production_tasks_mutated: false,
  checks,
};
mkdirSync(join(REPO, "SOS/07_LOGS/saios/founder-revision"), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
if (!report.ok) {
  console.error(
    "FAIL verify-canonical-layout-proof-6k",
    failed.map((c) => c.name),
  );
  process.exit(1);
}
console.log(`CANONICAL_LAYOUT_PROOF_6K=PASS (${checks.length}/${checks.length})`);
