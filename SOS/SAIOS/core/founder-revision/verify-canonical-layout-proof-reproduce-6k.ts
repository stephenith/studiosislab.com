/**
 * Phase 6K step 2 — reproduce revtask-dd26226e-d8b split verdict OFFLINE
 * from the sanitized fixture BEFORE the canonical-layout architecture change.
 *
 * Expected on current judges:
 *   Skills visual gap 52.32 → 37.10
 *   ownership PASS (production artifact)
 *   feedback coverage FAIL / item 6 partially_addressed
 *   overall 27/28
 *
 * If this split verdict cannot be reproduced: STOP.
 * No OpenAI. No production mutation.
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { buildFeedbackCoverage } from "./FeedbackCoverage.js";
import { evaluateFounderSpacingIntents } from "./FounderSpacingIntent.js";
import { resolveFounderSpacingRelation } from "./FounderSpacingRelation.js";
import { isDeterministicLayoutNormalizerOwnedChange } from "./DeterministicSpacingPlan.js";
import { visualTextContentBottom } from "./TextEffectiveHeight.js";
import type { FabricCanvasDoc } from "./CanvasInventory.js";
import type { RevisionAcceptanceReport } from "./RevisionAcceptanceChecks.js";
import type { LayoutNormalizationReport } from "./RevisionLayoutNormalizer.js";
import type {
  OperationLogEntry,
  RevisionPlan,
} from "./revision-task-types.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const FIX = join(
  REPO,
  ".cursor/debug-fixtures/revtask-dd26226e-d8b-sanitized",
);

const SKILLS_LINE =
  "Reorganize the Skills section into a clean, readable structure with consistent line spacing and wrapping; the skills must not appear scattered, cramped, duplicated, or visually disconnected.";

function loadJson<T>(name: string): T {
  return JSON.parse(readFileSync(join(FIX, name), "utf8")) as T;
}

function findObj(
  canvas: FabricCanvasDoc,
  id: string,
): Record<string, unknown> {
  const o = ((canvas.objects ?? []) as Array<Record<string, unknown>>).find(
    (x) => String(x.id ?? "") === id,
  );
  if (!o) throw new Error(`missing ${id}`);
  return o;
}

function visualGap(canvas: FabricCanvasDoc, a: string, b: string): number {
  return Number(findObj(canvas, b).top ?? 0) - visualTextContentBottom(findObj(canvas, a));
}

const prior = loadJson<FabricCanvasDoc>("prior-canvas.json");
const finalWrap = loadJson<{ canvas?: FabricCanvasDoc } | FabricCanvasDoc>(
  "post-normalization-canvas.json",
);
const after: FabricCanvasDoc =
  finalWrap && typeof finalWrap === "object" && "canvas" in finalWrap && finalWrap.canvas
    ? finalWrap.canvas
    : (finalWrap as FabricCanvasDoc);
const plan = loadJson<RevisionPlan>("revision-plan.json");
const log = loadJson<OperationLogEntry[]>("operation-log.json");
const task = loadJson<{ requested_changes: string[]; status: string }>("task.json");
const own = loadJson<{
  ok?: boolean;
  ownership_mode?: string;
  overlap_count?: number;
  page_oob_count?: number;
}>("deterministic-spacing-ownership.json");
const prodCov = loadJson<{
  all_addressed?: boolean;
  gate_pass?: boolean;
  items: Array<{ founder_feedback_item: string; status: string }>;
}>("feedback-coverage.json");

const t2 = findObj(after, "block-skills-4-t2");
const t3 = findObj(after, "block-skills-4-t3");
const srcGap = visualGap(prior, "block-skills-4-t2", "block-skills-4-t3");
const finGap = visualGap(after, "block-skills-4-t2", "block-skills-4-t3");

const resolved = resolveFounderSpacingRelation({
  requestedChange: SKILLS_LINE,
  canvas: prior,
});
const intents = evaluateFounderSpacingIntents({
  requested_changes: [SKILLS_LINE],
  beforeCanvas: prior,
  afterCanvas: after,
  resolved_relations: [resolved],
});
const acceptance = loadJson<RevisionAcceptanceReport>(
  "revision-acceptance-checks.json",
);
const layout = loadJson<LayoutNormalizationReport>(
  "revision-layout-normalization.json",
);
const cov = buildFeedbackCoverage({
  requested_changes: task.requested_changes,
  plan,
  log,
  beforeCanvas: prior,
  afterCanvas: after,
  acceptanceReport: acceptance,
  layoutNormalizationReport: layout,
});
const item6 = cov.items[6];
const addressed = cov.items.filter((i) => i.status === "addressed").length;
const prodAddressed = prodCov.items.filter((i) => i.status === "addressed").length;

const srcOk = Math.abs(srcGap - 52.32) < 0.05;
const finOk = Math.abs(finGap - 37.1) < 0.05;
const ownOk = own.ok === true;
const productionSplit =
  prodCov.items[6]?.status === "partially_addressed" && prodAddressed === 27;
const owned = isDeterministicLayoutNormalizerOwnedChange(SKILLS_LINE);
const intentUnmet = intents.intents[0]?.satisfied === false;
const frozenStillFails =
  item6?.status !== "addressed" && cov.all_addressed === false;

const pass =
  srcOk &&
  finOk &&
  ownOk &&
  productionSplit &&
  frozenStillFails &&
  owned &&
  intentUnmet &&
  task.requested_changes.length === 28 &&
  task.status === "FAILED_COVERAGE";

const report = {
  schema_version: "phase-6k-split-verdict-reproduce-1.0.0",
  pass,
  source_visual_gap: Number(srcGap.toFixed(2)),
  final_visual_gap: Number(finGap.toFixed(2)),
  t2_stored_top: t2.top,
  t2_stored_height: t2.height,
  t3_stored_top: t3.top,
  ownership_ok: own.ok,
  ownership_mode: own.ownership_mode,
  layout_owned: owned,
  spacing_intent_satisfied: intents.intents[0]?.satisfied ?? null,
  spacing_intent_notes: intents.intents[0]?.notes ?? null,
  coverage_item6_status: item6?.status ?? null,
  coverage_item6_notes: item6?.evidence.notes ?? null,
  coverage_addressed: `${addressed}/28`,
  production_item6_status: prodCov.items[6]?.status ?? null,
  requested_change_count: task.requested_changes.length,
};

console.log(JSON.stringify(report, null, 2));
if (!pass) {
  console.error("SPLIT_VERDICT_NOT_REPRODUCED");
  process.exit(1);
}
console.log("SPLIT_VERDICT_REPRODUCED");
