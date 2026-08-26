import type { BacklogItem, PmState } from "./types.js";
import { filterActionableBacklogItems, isBacklogIdConsumed, isVagueTask } from "./readers.js";
import {
  assessLaunchReadiness,
  computeCombinedScore,
  enrichLaunchReadinessWithKnowledge,
  scoreFounderPriority,
  shouldRefuseTaskWhileBlockers,
  type FounderCategory,
  type LaunchReadiness,
} from "./founder-priority.js";
import { isProductOnlyModeRefused, runtimeRefusalReason } from "./runtime-guard.js";

export type TaskTier = 1 | 2 | 3 | 4 | 5;

export type ScoredBacklogItem = {
  item: BacklogItem;
  tier: TaskTier;
  technical_score: number;
  founder_score: number;
  combined_score: number;
  /** @deprecated Use combined_score — kept for backward compatibility */
  score: number;
  founder_category: FounderCategory;
  founder_category_label: string;
  launch_stage: string;
  tier_label: string;
  reasons: string[];
  founder_reasons: string[];
  refused_while_blockers: boolean;
};

export type SkippedTask = {
  backlog_id: string;
  title: string;
  tier: TaskTier;
  technical_score: number;
  founder_score: number;
  combined_score: number;
  score: number;
  founder_category: FounderCategory;
  why_skipped: string;
};

export type SelectionRankingEntry = {
  backlog_id: string;
  title: string;
  technical_score: number;
  founder_score: number;
  combined_score: number;
  founder_category: FounderCategory;
  founder_category_label: string;
  refused_while_blockers: boolean;
};

export type SelectionReport = {
  selected: ScoredBacklogItem | null;
  selected_reason: string | null;
  skipped: SkippedTask[];
  ranking: SelectionRankingEntry[];
  launch_readiness: LaunchReadiness;
  tier_counts: {
    tier_1: number;
    tier_2: number;
    tier_3: number;
    tier_4: number;
    tier_5: number;
  };
  remaining_by_tier: {
    tier_1: number;
    tier_2: number;
    tier_3: number;
    tier_4: number;
    tier_5: number;
  };
};

const TIER_LABELS: Record<TaskTier, string> = {
  1: "StudiosisLab launch blockers",
  2: "Critical QA / user failures",
  3: "Performance, security, reliability",
  4: "Internal product improvements",
  5: "Documentation / internal ops",
};

const TIER_1 =
  /resume|mobile|hub|authentication|auth\b|template|firebase|firestore|export|download|dashboard|editor|e-sign|esign|bug|users cannot|phone users|cannot edit|launch|gallery|recents/i;
const TIER_2 =
  /qa fail|critical failure|regression|broken|blocked user|production bug|cannot access|fails for users/i;
const TIER_3 = /security|performance|reliability|retention|firestore\.rules|storage\.rules|rules align/i;
const TIER_4 =
  /seo|manifest|categoryid|orphan|normalize|cleanup|publisher dashboard|internal|tooling|pipeline/i;
const TIER_5 =
  /constitution|sos constitution|00_constitution|knowledge cleanup|internal doc|readme for studiosislab|author sos|mission\.md|vision\.md|approval matrix|documentation|report|knowledge base/i;

function evidenceText(item: BacklogItem): string {
  return `${item.title} ${item.description} ${item.evidence.join(" ")}`.toLowerCase();
}

function isDocumentationTask(item: BacklogItem): boolean {
  const text = evidenceText(item);
  if (TIER_5.test(text)) return true;
  if (item.evidence.every((e) => e.startsWith("SOS/"))) return true;
  if (item.evidence.some((e) => /00_CONSTITUTION|01_KNOWLEDGE/i.test(e))) return true;
  return false;
}

export function classifyTier(item: BacklogItem): TaskTier {
  const text = evidenceText(item);

  if (isDocumentationTask(item)) return 5;

  if (
    TIER_1.test(text)
    || (item.section === "blocked" && item.priority === "Critical")
    || item.evidence.some((e) => /ResumeHub|resume\/|editor\/|template/i.test(e))
  ) {
    return 1;
  }

  if (TIER_2.test(text) || (item.priority === "Critical" && item.completionPct === 0)) {
    return 2;
  }

  if (TIER_3.test(text) || item.evidence.some((e) => /security|firestore|rules/i.test(e))) {
    return 3;
  }

  if (TIER_4.test(text)) return 4;

  if (item.evidence.some((e) => e.startsWith("src/"))) return 1;

  return 4;
}

/** Technical tier scoring only (pre-founder). */
export function scoreTechnicalBacklogItem(item: BacklogItem): {
  tier: TaskTier;
  technical_score: number;
  tier_label: string;
  reasons: string[];
} {
  const tier = classifyTier(item);
  const reasons: string[] = [`Tier ${tier}: ${TIER_LABELS[tier]}`];

  const priorityWeight =
    item.priority === "Critical" ? 400
    : item.priority === "High" ? 280
    : item.priority === "Medium" ? 160
    : 60;

  const sectionWeight =
    item.section === "blocked"
      ? item.priority === "Critical" ? 250
      : item.priority === "High" ? 180
      : 60
    : 100;

  const evidenceBoost = Math.min(item.evidence.filter((e) => e.startsWith("src/")).length * 40, 120);
  const completionBonus = (100 - item.completionPct) / 5;
  const vaguePenalty = isVagueTask(item) ? 150 : 0;
  const verificationPenalty = item.needsVerification ? 20 : 0;

  if (item.priority === "Critical") reasons.push("Critical backlog priority");
  if (evidenceBoost > 0) reasons.push("Has src/ evidence (launch path)");
  if (isVagueTask(item)) reasons.push("Vague / low evidence penalty");

  const tierBase = (6 - tier) * 1000;
  const technical_score =
    tierBase
    + priorityWeight
    + sectionWeight
    + evidenceBoost
    + completionBonus
    - vaguePenalty
    - verificationPenalty;

  return { tier, technical_score, tier_label: TIER_LABELS[tier], reasons };
}

export function scoreBacklogItem(
  item: BacklogItem,
  readiness: LaunchReadiness,
): ScoredBacklogItem {
  const technical = scoreTechnicalBacklogItem(item);
  const founder = scoreFounderPriority(item, readiness);
  const combined_score = computeCombinedScore(founder, technical.technical_score);

  return {
    item,
    tier: technical.tier,
    technical_score: technical.technical_score,
    founder_score: founder.founder_score,
    combined_score,
    score: combined_score,
    founder_category: founder.category,
    founder_category_label: founder.category_label,
    launch_stage: founder.launch_stage,
    tier_label: technical.tier_label,
    reasons: [...technical.reasons, ...founder.reasons],
    founder_reasons: founder.reasons,
    refused_while_blockers: founder.refused_while_blockers,
  };
}

function countRemainingByTier(items: BacklogItem[], state: PmState): SelectionReport["remaining_by_tier"] {
  const counts = { tier_1: 0, tier_2: 0, tier_3: 0, tier_4: 0, tier_5: 0 };
  for (const item of items) {
    if (item.status === "completed" || item.completionPct >= 100) continue;
    if (item.section === "in_progress") continue;
    if (isBacklogIdConsumed(state, item.id)) continue;
    const tier = classifyTier(item);
    counts[`tier_${tier}` as keyof typeof counts] += 1;
  }
  return counts;
}

export function buildSelectionReport(
  actionable: BacklogItem[],
  allItems: BacklogItem[],
  state: PmState,
  readiness?: LaunchReadiness,
): SelectionReport {
  const launch_readiness = readiness ?? assessLaunchReadiness(state, allItems);

  const scored = actionable
    .map((item) => scoreBacklogItem(item, launch_readiness))
    .sort((a, b) => {
      if (b.combined_score !== a.combined_score) return b.combined_score - a.combined_score;
      if (b.founder_score !== a.founder_score) return b.founder_score - a.founder_score;
      return b.technical_score - a.technical_score;
    });

  const remaining_by_tier = countRemainingByTier(allItems, state);

  const tier_counts = { tier_1: 0, tier_2: 0, tier_3: 0, tier_4: 0, tier_5: 0 };
  for (const s of scored) {
    tier_counts[`tier_${s.tier}` as keyof typeof tier_counts] += 1;
  }

  const hasLaunchBlockers = launch_readiness.launch_blockers_open.length > 0;

  const eligible = scored.filter((s) => {
    if (s.refused_while_blockers) return false;
    if (isProductOnlyModeRefused(s.item)) return false;
    if (
      hasLaunchBlockers
      && shouldRefuseTaskWhileBlockers(s.item, s.founder_category, launch_readiness.launch_blockers_open)
    ) {
      return false;
    }
    if (hasLaunchBlockers && s.founder_category === "documentation") return false;
    return true;
  });

  const hasProductWork = eligible.some(
    (s) => s.founder_category !== "documentation" && s.founder_category !== "deferred",
  );

  const finalEligible =
    hasProductWork
      ? eligible.filter((s) => s.founder_category !== "documentation" && s.tier <= 4)
      : eligible;

  const selected = finalEligible[0] ?? null;

  const skipped: SkippedTask[] = [];
  for (const s of scored) {
    if (selected && s.item.id === selected.item.id) continue;

    let why = `Lower combined score (${s.combined_score}) than selected`;
    if (s.refused_while_blockers) {
      why = "Refused while launch blockers open — documentation/cleanup/refactor deferred";
    } else if (isProductOnlyModeRefused(s.item)) {
      why = runtimeRefusalReason(s.item);
    } else if (s.founder_category === "documentation" && hasProductWork) {
      why = "Documentation deferred — higher launch-value product work available";
    } else if (s.tier === 5 && hasProductWork) {
      why = "Tier 5 documentation deferred — product work available";
    } else if (isVagueTask(s.item)) {
      why = "Vague task — higher-scored actionable work exists";
    } else if (selected && s.founder_category !== selected.founder_category) {
      why = `Lower founder category (${s.founder_category_label}) than ${selected.founder_category_label}`;
    }

    skipped.push({
      backlog_id: s.item.id,
      title: s.item.title,
      tier: s.tier,
      technical_score: s.technical_score,
      founder_score: s.founder_score,
      combined_score: s.combined_score,
      score: s.combined_score,
      founder_category: s.founder_category,
      why_skipped: why,
    });
  }

  const selected_reason = selected
    ? [
        `Selected because it is currently the highest launch-value task.`,
        `Founder: ${selected.founder_category_label} (${selected.founder_score})`,
        `Technical: ${selected.technical_score}`,
        `Combined: ${selected.combined_score}`,
        `Launch stage: ${selected.launch_stage}`,
        selected.reasons.join("; "),
      ].join(" ")
    : null;

  const ranking: SelectionRankingEntry[] = scored.slice(0, 10).map((s) => ({
    backlog_id: s.item.id,
    title: s.item.title,
    technical_score: s.technical_score,
    founder_score: s.founder_score,
    combined_score: s.combined_score,
    founder_category: s.founder_category,
    founder_category_label: s.founder_category_label,
    refused_while_blockers: s.refused_while_blockers,
  }));

  return {
    selected,
    selected_reason,
    skipped,
    ranking,
    launch_readiness,
    tier_counts,
    remaining_by_tier,
  };
}

export async function buildSelectionReportWithKnowledge(
  actionable: BacklogItem[],
  allItems: BacklogItem[],
  state: PmState,
  knowledgeRoot: string,
): Promise<SelectionReport> {
  let readiness = assessLaunchReadiness(state, allItems);
  readiness = await enrichLaunchReadinessWithKnowledge(readiness, knowledgeRoot);
  return buildSelectionReport(actionable, allItems, state, readiness);
}

/** Technical-only selection (pre–Phase 8 Step 3) for comparison. */
export function selectHighestTechnicalTask(
  actionable: BacklogItem[],
): BacklogItem | null {
  const scored = actionable
    .map((item) => ({ item, ...scoreTechnicalBacklogItem(item) }))
    .filter((s) => s.tier <= 4 || !actionable.some((i) => classifyTier(i) <= 4))
    .sort((a, b) => b.technical_score - a.technical_score);
  return scored[0]?.item ?? null;
}

export function selectHighestPriorityTask(
  actionable: BacklogItem[],
  allItems: BacklogItem[],
  state: PmState,
  readiness?: LaunchReadiness,
): { item: BacklogItem | null; report: SelectionReport } {
  const report = buildSelectionReport(actionable, allItems, state, readiness);
  return { item: report.selected?.item ?? null, report };
}

export async function selectHighestPriorityTaskWithKnowledge(
  actionable: BacklogItem[],
  allItems: BacklogItem[],
  state: PmState,
  knowledgeRoot: string,
): Promise<{ item: BacklogItem | null; report: SelectionReport }> {
  const report = await buildSelectionReportWithKnowledge(actionable, allItems, state, knowledgeRoot);
  return { item: report.selected?.item ?? null, report };
}

export function hasActivePipelineTask(state: PmState): boolean {
  const active = new Set([
    "assigned_developer",
    "developer_working",
    "awaiting_dev_report",
    "reviewing_dev",
    "assigned_qa",
    "qa_working",
    "awaiting_qa_report",
    "reviewing_qa",
    "awaiting_approval",
  ]);
  if (state.developer_assignment || state.qa_assignment) return true;
  return state.task_queue.some((t) => active.has(t.status));
}

export { filterActionableBacklogItems, isBacklogIdConsumed };
