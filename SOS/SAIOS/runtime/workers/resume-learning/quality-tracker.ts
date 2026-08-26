/**
 * Track generation and founder review quality metrics over time.
 */
import type { LearningCategory, QualityHistory, StructuredFeedback } from "./types.js";

export function createDefaultQualityHistory(): QualityHistory {
  return {
    templates_generated: 0,
    founder_approvals: 0,
    founder_rejections: 0,
    founder_revisions: 0,
    approval_percentage: 0,
    most_common_corrections: [],
    recurring_mistakes: [],
    design_trends: [],
    reviews: [],
  };
}

export function updateQualityHistory(
  history: QualityHistory,
  feedback: StructuredFeedback[],
  templatesGeneratedDelta = 0,
): QualityHistory {
  const next = { ...history, reviews: [...history.reviews] };
  next.templates_generated += templatesGeneratedDelta;

  const correctionCounts = new Map<LearningCategory, number>();
  for (const item of feedback) {
    next.reviews.push({
      template_id: item.template_id,
      decision: item.founder_decision,
      feedback: item.raw,
      at: item.parsed_at,
    });

    if (item.founder_decision === "approved") next.founder_approvals += 1;
    else if (item.founder_decision === "rejected") next.founder_rejections += 1;
    else next.founder_revisions += 1;

    if (item.sentiment === "negative") {
      for (const cat of item.categories) {
        correctionCounts.set(cat, (correctionCounts.get(cat) ?? 0) + 1);
      }
    }
  }

  const totalDecisions =
    next.founder_approvals + next.founder_rejections + next.founder_revisions;
  next.approval_percentage =
    totalDecisions > 0
      ? Math.round((next.founder_approvals / totalDecisions) * 1000) / 10
      : 0;

  const merged = new Map<LearningCategory, number>();
  for (const entry of next.most_common_corrections) {
    merged.set(entry.category, entry.count);
  }
  for (const [cat, count] of correctionCounts) {
    merged.set(cat, (merged.get(cat) ?? 0) + count);
  }
  next.most_common_corrections = [...merged.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  next.recurring_mistakes = next.most_common_corrections
    .filter((c) => c.count >= 2)
    .map((c) => `Repeated ${c.category} corrections (${c.count}×)`);

  next.design_trends = inferDesignTrends(next);

  return next;
}

function inferDesignTrends(history: QualityHistory): string[] {
  const trends: string[] = [];
  const top = history.most_common_corrections[0];
  if (top) trends.push(`Founders frequently request ${top.category} adjustments`);
  if (history.approval_percentage >= 70) trends.push("Approval rate trending positive");
  else if (history.approval_percentage > 0 && history.approval_percentage < 40) {
    trends.push("Approval rate needs attention — review generation defaults");
  }
  if (history.founder_revisions > history.founder_approvals) {
    trends.push("Revision-heavy cycle — tighten QA before founder review");
  }
  return trends;
}
