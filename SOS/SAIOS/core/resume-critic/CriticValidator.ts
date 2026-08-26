/**
 * CriticValidator — validates critic result integrity (not the resume).
 */
import type { CriticResult } from "./types.js";

export function validateCriticResult(result: CriticResult): {
  pass: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (result.used_ai !== false) errors.push("used_ai must be false");
  if (result.used_mock_provider !== false) {
    errors.push("used_mock_provider must be false");
  }
  if (result.mutated_resume !== false) errors.push("mutated_resume must be false");
  if (result.dry_run !== true) errors.push("dry_run must be true");
  if (result.publication_allowed !== false) {
    errors.push("publication_allowed must be false");
  }
  if (result.live_enabled !== false) errors.push("live_enabled must be false");

  for (const key of Object.keys(result.scores) as Array<keyof typeof result.scores>) {
    const v = result.scores[key];
    if (typeof v !== "number" || v < 0 || v > 100) {
      errors.push(`invalid score ${key}=${v}`);
    }
  }

  const cats = [
    "ats",
    "visual",
    "typography",
    "layout",
    "technical",
    "consistency",
    "sections",
  ] as const;
  for (const c of cats) {
    if (!result.reports[c]) errors.push(`missing report ${c}`);
  }

  return { pass: errors.length === 0, errors };
}
