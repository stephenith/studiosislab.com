/**
 * ActivationPolicy — scoring + evaluation policy (Agent #185).
 * Metadata scoring only. No automatic approval. Never enables execution.
 */
import type {
  ActivationChecklistItem,
  ActivationScorecard,
} from "./ActivationGateTypes.js";
import {
  ACTIVATION_CHECKLIST_CATALOGUE,
  type ChecklistDefinition,
} from "./ActivationChecklist.js";

function categoryOf(checkId: string): ChecklistDefinition["category"] | null {
  const def = ACTIVATION_CHECKLIST_CATALOGUE.find((c) => c.check_id === checkId);
  return def?.category ?? null;
}

function scoreItems(items: ActivationChecklistItem[]): number {
  if (items.length === 0) return 0;
  let pts = 0;
  for (const item of items) {
    if (item.status === "pass") pts += 100;
    else if (item.status === "warn") pts += 50;
    else pts += 0;
  }
  return Math.round(pts / items.length);
}

export function computeActivationScorecard(
  checklist: ActivationChecklistItem[],
): ActivationScorecard {
  const byCat = (cat: ChecklistDefinition["category"]) =>
    checklist.filter((i) => categoryOf(i.check_id) === cat);

  const governance = scoreItems(byCat("governance"));
  const execution = scoreItems(byCat("execution"));
  const department = scoreItems(byCat("department"));
  const workers = scoreItems(byCat("workers"));
  const budget = scoreItems(byCat("budget"));
  const telemetry = scoreItems(byCat("telemetry"));
  const providers = scoreItems(byCat("providers"));
  const security = scoreItems(byCat("security"));
  const rollback = scoreItems(byCat("rollback"));
  const retry = scoreItems(byCat("retry"));

  const dims = [
    governance,
    execution,
    department,
    workers,
    budget,
    telemetry,
    providers,
    security,
    rollback,
    retry,
  ];
  const overall = Math.round(dims.reduce((a, b) => a + b, 0) / dims.length);

  return {
    governance,
    execution,
    department,
    workers,
    budget,
    telemetry,
    providers,
    security,
    rollback,
    retry,
    overall,
  };
}

export function deriveBlockingItems(
  checklist: ActivationChecklistItem[],
): string[] {
  return checklist
    .filter((i) => i.blocking)
    .map((i) => `${i.check_id}: ${i.detail}`);
}

export function deriveWarnings(checklist: ActivationChecklistItem[]): string[] {
  return checklist
    .filter((i) => i.status === "warn")
    .map((i) => `${i.check_id}: ${i.detail}`);
}

export function deriveRecommendations(
  checklist: ActivationChecklistItem[],
): string[] {
  const recs: string[] = [
    "Activation eligibility does not enable execution.",
    "All safety allow-flags must remain false.",
    "LIVE must remain OFF.",
  ];
  for (const item of checklist.filter((i) => i.blocking)) {
    recs.push(`Resolve blocking check: ${item.label}`);
  }
  return recs;
}

/**
 * Eligibility outcome from checklist — never grants execution.
 * ACTIVATION_ELIGIBLE requires zero blocking items AND live_disabled pass.
 */
export function decideActivationOutcome(
  checklist: ActivationChecklistItem[],
): "ACTIVATION_BLOCKED" | "ACTIVATION_ELIGIBLE" {
  const live = checklist.find((i) => i.check_id === "live_disabled");
  if (!live || live.status !== "pass") return "ACTIVATION_BLOCKED";
  if (checklist.some((i) => i.blocking)) return "ACTIVATION_BLOCKED";
  return "ACTIVATION_ELIGIBLE";
}
