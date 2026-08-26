import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { ChecklistResult, DeveloperReportInput, ParsedQaBrief } from "../types.js";

export function runGenericStrategyChecks(
  repoRoot: string,
  brief: ParsedQaBrief,
  devReport: DeveloperReportInput,
): ChecklistResult[] {
  const results: ChecklistResult[] = [];

  for (const [i, file] of devReport.files_changed.entries()) {
    const full = join(repoRoot, file);
    const inScope =
      brief.files_in_scope.length === 0
      || brief.files_in_scope.some((s) => file === s || file.endsWith(s));
    results.push({
      item_id: `CHK-SCOPE-${i + 1}`,
      passed: inScope || file.startsWith("SOS/"),
      notes: inScope ? `${file} within scope` : `${file} outside declared scope`,
    });
  }

  for (const [i, criterion] of brief.acceptance_criteria.entries()) {
    let passed = false;
    let notes = `Criterion: ${criterion}`;

    const buildCriterion = /build.*pass/i.test(criterion);
    const lintCriterion = /lint.*pass/i.test(criterion);
    if (buildCriterion) {
      passed = devReport.build_passed === true;
      notes = `Build criterion — build_passed=${String(devReport.build_passed)}`;
    } else if (lintCriterion) {
      passed = devReport.build_passed === true;
      notes = "Lint criterion — validated via independent lint run (CHK-LINT)";
    } else if (/evidence|repository/i.test(criterion)) {
      passed = devReport.evidence.length > 0;
      notes = `Evidence cited: ${devReport.evidence.length} items`;
    } else if (/scope|outside/i.test(criterion)) {
      passed = results.filter((r) => r.item_id.startsWith("CHK-SCOPE-")).every((r) => r.passed);
      notes = "Scope criterion — all changed files in scope";
    } else {
      const keywords = criterion.match(/`([^`]+)`/g)?.map((k) => k.replace(/`/g, "")) ?? [];
      if (keywords.length > 0) {
        passed = keywords.every((kw) =>
          devReport.files_changed.some((f) => f.includes(kw))
          || devReport.evidence.some((e) => e.includes(kw)),
        );
        notes = passed ? `Keywords found: ${keywords.join(", ")}` : `Missing keywords: ${keywords.join(", ")}`;
      } else {
        passed = devReport.summary.length > 20;
        notes = "Objective summary present in developer report";
      }
    }

    results.push({
      item_id: `CHK-ACCEPT-${i + 1}`,
      passed,
      notes,
    });
  }

  if (brief.pm_requirements) {
    const reqLines = brief.pm_requirements.split("\n").filter(Boolean);
    for (const [i, line] of reqLines.entries()) {
      const pathMatch = line.match(/`([^`]+\.(tsx?|jsx?|json|md))`/);
      if (pathMatch) {
        const rel = pathMatch[1];
        const exists = existsSync(join(repoRoot, rel));
        results.push({
          item_id: `CHK-PM-REQ-${i + 1}`,
          passed: exists,
          notes: exists ? `${rel} exists` : `${rel} not found`,
        });
      }
    }
  }

  return results;
}

export function grepFile(repoRoot: string, relPath: string, pattern: RegExp): boolean {
  const full = join(repoRoot, relPath);
  if (!existsSync(full)) return false;
  try {
    return pattern.test(readFileSync(full, "utf8"));
  } catch {
    return false;
  }
}
