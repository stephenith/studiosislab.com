import type { BusinessDeliverableProfile } from "./BusinessFeatureProfiles.js";
import type { StudiosisLabKnowledge } from "./types.js";

export type BusinessObjectiveIntent =
  | "revenue"
  | "traffic"
  | "seo"
  | "acquisition"
  | "ads"
  | "general";

export type IntentWeights = {
  revenue: number;
  traffic: number;
  seo: number;
  acquisition: number;
  ads: number;
  development_cost: number;
  dependency_cost: number;
};

export type ScoredDeliverable = {
  deliverable_id: string;
  name: string;
  catalog_feature_id: string | null;
  revenue_impact_score: number;
  traffic_impact_score: number;
  development_cost: number;
  dependency_cost: number;
  priority_score: number;
  rank: number;
  profile: BusinessDeliverableProfile;
};

const INTENT_WEIGHT_PRESETS: Record<BusinessObjectiveIntent, IntentWeights> = {
  revenue: {
    revenue: 0.35,
    traffic: 0.2,
    seo: 0.15,
    acquisition: 0.15,
    ads: 0.1,
    development_cost: 0.1,
    dependency_cost: 0.05,
  },
  traffic: {
    revenue: 0.15,
    traffic: 0.35,
    seo: 0.25,
    acquisition: 0.1,
    ads: 0.05,
    development_cost: 0.08,
    dependency_cost: 0.02,
  },
  seo: {
    revenue: 0.15,
    traffic: 0.25,
    seo: 0.35,
    acquisition: 0.1,
    ads: 0.05,
    development_cost: 0.08,
    dependency_cost: 0.02,
  },
  acquisition: {
    revenue: 0.2,
    traffic: 0.2,
    seo: 0.15,
    acquisition: 0.3,
    ads: 0.05,
    development_cost: 0.08,
    dependency_cost: 0.02,
  },
  ads: {
    revenue: 0.2,
    traffic: 0.25,
    seo: 0.1,
    acquisition: 0.1,
    ads: 0.25,
    development_cost: 0.08,
    dependency_cost: 0.02,
  },
  general: {
    revenue: 0.2,
    traffic: 0.2,
    seo: 0.2,
    acquisition: 0.15,
    ads: 0.1,
    development_cost: 0.1,
    dependency_cost: 0.05,
  },
};

export function detectBusinessIntents(objectiveText: string): BusinessObjectiveIntent[] {
  const text = objectiveText.toLowerCase();
  const intents: BusinessObjectiveIntent[] = [];

  if (/\b(revenue|monetiz|recurring|income|profit|\$\d|60 days|60-day)\b/.test(text)) {
    intents.push("revenue");
  }
  if (/\b(traffic|visitors|sessions|pageviews)\b/.test(text)) {
    intents.push("traffic");
  }
  if (/\b(seo|search|organic|ranking|landing pages?)\b/.test(text)) {
    intents.push("seo");
  }
  if (/\b(acquisition|users?|signups?|convert)\b/.test(text)) {
    intents.push("acquisition");
  }
  if (/\b(ads?|advertis|programmatic|display ads?|video ads?)\b/.test(text)) {
    intents.push("ads");
  }

  return intents.length > 0 ? intents : ["revenue", "general"];
}

export function mergeIntentWeights(intents: BusinessObjectiveIntent[]): IntentWeights {
  const merged: IntentWeights = {
    revenue: 0,
    traffic: 0,
    seo: 0,
    acquisition: 0,
    ads: 0,
    development_cost: 0,
    dependency_cost: 0,
  };

  for (const intent of intents) {
    const preset = INTENT_WEIGHT_PRESETS[intent];
    merged.revenue += preset.revenue;
    merged.traffic += preset.traffic;
    merged.seo += preset.seo;
    merged.acquisition += preset.acquisition;
    merged.ads += preset.ads;
    merged.development_cost += preset.development_cost;
    merged.dependency_cost += preset.dependency_cost;
  }

  const total =
    merged.revenue +
    merged.traffic +
    merged.seo +
    merged.acquisition +
    merged.ads +
    merged.development_cost +
    merged.dependency_cost;

  if (total === 0) return INTENT_WEIGHT_PRESETS.general;

  return {
    revenue: merged.revenue / total,
    traffic: merged.traffic / total,
    seo: merged.seo / total,
    acquisition: merged.acquisition / total,
    ads: merged.ads / total,
    development_cost: merged.development_cost / total,
    dependency_cost: merged.dependency_cost / total,
  };
}

function revenueStreamBoost(
  deliverable: BusinessDeliverableProfile,
  knowledge: StudiosisLabKnowledge,
): number {
  const primary = knowledge.revenue.objective.primary_streams;
  let boost = 0;
  if (deliverable.id === "resume-templates" && primary.includes("resume-templates")) boost += 2;
  if (deliverable.id === "seo-landing-pages" && primary.includes("seo-pages")) boost += 2;
  if (deliverable.catalog_feature_id === "ats-checker") boost += 1;
  if (primary.includes("downloads") && deliverable.id === "pdf-tools") boost += 1;
  if (primary.includes("display-ads") && deliverable.ads_impact_base >= 6) boost += 1;
  return boost;
}

function dependencyCost(
  deliverable: BusinessDeliverableProfile,
  rankedSoFar: Map<string, number>,
): number {
  if (deliverable.dependency_ids.length === 0) return 0;
  let maxDepRank = 0;
  for (const depId of deliverable.dependency_ids) {
    const rank = rankedSoFar.get(depId) ?? deliverable.dependency_ids.length;
    maxDepRank = Math.max(maxDepRank, rank);
  }
  return maxDepRank * 2 + deliverable.dependency_ids.length;
}

/**
 * Score and rank business deliverables for a founder objective.
 */
export function scoreBusinessDeliverables(
  profiles: readonly BusinessDeliverableProfile[],
  objectiveText: string,
  knowledge: StudiosisLabKnowledge,
): ScoredDeliverable[] {
  const intents = detectBusinessIntents(objectiveText);
  const weights = mergeIntentWeights(intents);

  const preliminary = profiles.map((profile) => {
    const streamBoost = revenueStreamBoost(profile, knowledge);
    const revenue_impact_score = Math.min(
      10,
      profile.revenue_impact_base + streamBoost * 0.5,
    );
    const traffic_impact_score = Math.min(
      10,
      profile.traffic_impact_base +
        (intents.includes("traffic") ? 1 : 0) +
        (intents.includes("seo") ? profile.seo_impact_base * 0.1 : 0),
    );

    const priority_score =
      revenue_impact_score * weights.revenue +
      traffic_impact_score * weights.traffic +
      profile.seo_impact_base * weights.seo +
      profile.acquisition_impact_base * weights.acquisition +
      profile.ads_impact_base * weights.ads -
      profile.development_cost * weights.development_cost;

    return {
      deliverable_id: profile.id,
      name: profile.name,
      catalog_feature_id: profile.catalog_feature_id,
      revenue_impact_score: Math.round(revenue_impact_score * 10) / 10,
      traffic_impact_score: Math.round(traffic_impact_score * 10) / 10,
      development_cost: profile.development_cost,
      dependency_cost: 0,
      priority_score: Math.round(priority_score * 100) / 100,
      rank: 0,
      profile,
    };
  });

  preliminary.sort((a, b) => b.priority_score - a.priority_score);

  const rankMap = new Map<string, number>();
  const scored: ScoredDeliverable[] = [];

  for (let i = 0; i < preliminary.length; i++) {
    const item = preliminary[i]!;
    const depCost = dependencyCost(item.profile, rankMap);
    const adjustedScore = item.priority_score - depCost * weights.dependency_cost;
    rankMap.set(item.deliverable_id, i + 1);
    scored.push({
      ...item,
      dependency_cost: depCost,
      priority_score: Math.round(adjustedScore * 100) / 100,
      rank: i + 1,
    });
  }

  scored.sort((a, b) => {
    if (b.priority_score !== a.priority_score) return b.priority_score - a.priority_score;
    return a.rank - b.rank;
  });

  const ranked = scored.map((s, i) => ({ ...s, rank: i + 1 }));

  if (intents.includes("revenue")) {
    return applyRevenueOrdering(ranked);
  }

  return ranked;
}

export function estimateHorizonDays(objectiveText: string, knowledge: StudiosisLabKnowledge): number {
  if (/\b60[- ]?day/i.test(objectiveText)) return 60;
  if (/\b30[- ]?day/i.test(objectiveText)) return 30;
  return knowledge.revenue.objective.horizon_days;
}

/** Canonical build order for revenue-focused founder objectives. */
export const REVENUE_EXECUTION_ORDER: readonly string[] = [
  "resume-templates",
  "seo-landing-pages",
  "ats-improvements",
  "resume-assets",
  "cover-letter",
  "invoice-generator",
  "portfolio-builder",
  "pdf-tools",
];

function applyRevenueOrdering(scored: ScoredDeliverable[]): ScoredDeliverable[] {
  const orderMap = new Map(REVENUE_EXECUTION_ORDER.map((id, i) => [id, i]));
  const sorted = [...scored].sort((a, b) => {
    const ia = orderMap.get(a.deliverable_id) ?? 99;
    const ib = orderMap.get(b.deliverable_id) ?? 99;
    if (ia !== ib) return ia - ib;
    return b.priority_score - a.priority_score;
  });
  return sorted.map((s, i) => ({ ...s, rank: i + 1 }));
}
