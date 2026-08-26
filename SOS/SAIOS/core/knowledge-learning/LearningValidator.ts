/**
 * Learning validators — Agent #125.
 */
import type { LearningEntry } from "./types.js";

const SECRET = /(token|secret|password|api[_-]?key|sk-|TELEGRAM|AIza)/i;

export function validateLearningEntry(entry: LearningEntry): {
  ok: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (!entry.learning_id) errors.push("learning_id required");
  if (!entry.source_decision_id) errors.push("source_decision_id required");
  if (!entry.category) errors.push("category required");
  if (!entry.observation?.trim()) errors.push("observation required");
  const blob = JSON.stringify(entry);
  if (SECRET.test(blob)) errors.push("secrets forbidden in learning");
  if (entry.fixture) errors.push("fixture learning must not enter real store");
  return { ok: errors.length === 0, errors };
}
