/**
 * Extract recurring patterns from structured founder feedback.
 */
import type { LearnedPattern, LearningCategory, StructuredFeedback } from "./types.js";

export function extractPatterns(feedback: StructuredFeedback[]): LearnedPattern[] {
  const buckets = new Map<string, LearnedPattern>();

  for (const item of feedback) {
    for (const category of item.categories) {
      for (const signal of item.signals) {
        const key = `${category}:${signal}:${item.action}`;
        const existing = buckets.get(key);
        if (existing) {
          existing.occurrences += 1;
          existing.last_seen = item.parsed_at;
          if (!existing.example_feedback.includes(item.raw)) {
            existing.example_feedback.push(item.raw);
          }
          existing.confidence = Math.min(0.99, existing.occurrences / Math.max(1, feedback.length));
        } else {
          buckets.set(key, {
            id: key.replace(/[^a-z0-9]+/gi, "-").toLowerCase(),
            category,
            pattern: signal,
            action: item.action,
            occurrences: 1,
            confidence: 1 / Math.max(1, feedback.length),
            first_seen: item.parsed_at,
            last_seen: item.parsed_at,
            example_feedback: [item.raw],
          });
        }
      }
    }
  }

  return [...buckets.values()].sort((a, b) => b.occurrences - a.occurrences);
}

export function topPatternsByCategory(
  patterns: LearnedPattern[],
  category: LearningCategory,
  limit = 3,
): LearnedPattern[] {
  return patterns.filter((p) => p.category === category).slice(0, limit);
}
