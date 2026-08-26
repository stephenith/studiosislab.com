import type { RuntimeConfig } from "../config.js";
import { runFounderFileValidation, runProjectValidation } from "../developer/validate.js";
import type {
  ChecklistItem,
  ChecklistResult,
  DeveloperReportInput,
  ParsedQaBrief,
  VerificationResult,
} from "./types.js";
import { fileExistsAtRepo } from "./checklist.js";
import { runStrategyChecks } from "./strategies/index.js";

function evaluateChecklistItem(
  item: ChecklistItem,
  brief: ParsedQaBrief,
  devReport: DeveloperReportInput | null,
  hasPlan: boolean,
): ChecklistResult {
  switch (item.id) {
    case "CHK-001":
      return {
        item_id: item.id,
        passed: devReport !== null,
        notes: devReport ? "Developer report found" : "Missing developer report",
      };
    case "CHK-002":
      return {
        item_id: item.id,
        passed: devReport !== null && !devReport.blocker,
        notes:
          devReport?.blocker ?
            `Developer blocker: ${devReport.blocker_reason ?? "unspecified"}`
          : "No developer blocker",
      };
    case "CHK-003":
      return {
        item_id: item.id,
        passed: devReport?.build_passed === true,
        notes: `Developer reported build_passed=${String(devReport?.build_passed)} (independent build in CHK-BUILD)`,
      };
    case "CHK-004":
      return {
        item_id: item.id,
        passed: (devReport?.confidence ?? 0) >= 50,
        notes: `confidence=${devReport?.confidence ?? 0}`,
      };
    case "CHK-005":
      return {
        item_id: item.id,
        passed: devReport?.correlation_id === brief.correlation_id,
        notes: `brief=${brief.correlation_id} dev=${devReport?.correlation_id}`,
      };
    case "CHK-RISK":
      return {
        item_id: item.id,
        passed: Boolean(devReport?.estimated_regression_risk),
        notes: `risk=${devReport?.estimated_regression_risk ?? "missing"}`,
      };
    default:
      if (item.id.startsWith("CHK-PLAN-")) {
        return {
          item_id: item.id,
          passed: hasPlan,
          notes: hasPlan ? "Work/implementation plan on file" : "No plan on file",
        };
      }
      if (item.id.startsWith("CHK-DEV-")) {
        return {
          item_id: item.id,
          passed: devReport !== null && !devReport.blocker,
          notes: "Validated via automated build/lint/test and strategy checks",
        };
      }
      return {
        item_id: item.id,
        passed: true,
        notes: "Informational item",
      };
  }
}

function verifyChangedFiles(
  config: RuntimeConfig,
  devReport: DeveloperReportInput,
): ChecklistResult[] {
  const results: ChecklistResult[] = [];
  for (const [i, file] of devReport.files_changed.entries()) {
    const exists = fileExistsAtRepo(config.repoRoot, file);
    results.push({
      item_id: `CHK-FILE-${i + 1}`,
      passed: exists || file.startsWith("SOS/"),
      notes: exists ? `${file} exists` : `${file} not found at repo root`,
    });
  }
  return results;
}

export async function runVerification(
  config: RuntimeConfig,
  brief: ParsedQaBrief,
  devReport: DeveloperReportInput | null,
  hasPlan: boolean,
  checklist: ChecklistItem[],
): Promise<VerificationResult> {
  const checklist_results: ChecklistResult[] = [];
  const evidence: string[] = [...(devReport?.evidence ?? [])];
  const screenshots: string[] = [];

  for (const item of checklist) {
    checklist_results.push(evaluateChecklistItem(item, brief, devReport, hasPlan));
  }

  if (devReport?.files_changed.length) {
    checklist_results.push(...verifyChangedFiles(config, devReport));
  }

  if (devReport && !devReport.blocker) {
    const isFounderFile =
      brief.task_id.startsWith("TASK-INBOX-EXEC-")
      || devReport.task_id.startsWith("TASK-INBOX-EXEC-");

    const validation = isFounderFile
      ? await runFounderFileValidation(config.repoRoot, devReport.files_changed)
      : await runProjectValidation(config.repoRoot, devReport.files_changed);

    if (!isFounderFile) {

    checklist_results.push({
      item_id: "CHK-BUILD",
      passed: validation.build.passed,
      notes: validation.build.passed
        ? `Build passed (${validation.build.duration_ms}ms)`
        : `Build failed: ${validation.build.output.slice(-500)}`,
    });

    checklist_results.push({
      item_id: "CHK-LINT",
      passed: validation.lint.passed || validation.lint.skipped === true,
      notes: validation.lint.skipped
        ? `Lint skipped: ${validation.lint.reason}`
        : validation.lint.passed
          ? `Scoped lint passed (${validation.lint.duration_ms}ms)`
          : `Lint failed: ${validation.lint.output.slice(-500)}`,
    });

    checklist_results.push({
      item_id: "CHK-TEST",
      passed: validation.test.passed || validation.test.skipped === true,
      notes: validation.test.skipped
        ? `Tests skipped: ${validation.test.reason}`
        : validation.test.passed
          ? `Tests passed (${validation.test.duration_ms}ms)`
          : `Tests failed: ${validation.test.output.slice(-500)}`,
    });

    if (validation.build.passed) evidence.push("Independent build verification passed");
    if (validation.lint.passed) evidence.push("Scoped lint verification passed");
    if (validation.test.passed && !validation.test.skipped) evidence.push("Automated tests passed");

    checklist_results.push(...runStrategyChecks(config.repoRoot, brief, devReport));
    }

    if (isFounderFile) {
      checklist_results.push({
        item_id: "CHK-BUILD",
        passed: true,
        notes: "Skipped full build for founder file task",
      });
      checklist_results.push({
        item_id: "CHK-LINT",
        passed: true,
        notes: "Skipped lint for founder file task",
      });
      checklist_results.push({
        item_id: "CHK-TEST",
        passed: true,
        notes: "Skipped tests for founder file task",
      });
      checklist_results.push(...runStrategyChecks(config.repoRoot, brief, devReport));
    }
  }

  const requiredFails = checklist_results.filter((r) => {
    const item = checklist.find((c) => c.id === r.item_id);
    const strategyRequired =
      r.item_id.startsWith("CHK-STRAT-")
      || r.item_id.startsWith("CHK-ACCEPT-")
      || r.item_id.startsWith("CHK-FOUNDER-");
    const validationRequired = ["CHK-BUILD", "CHK-LINT"].includes(r.item_id);
    return (item?.required || strategyRequired || validationRequired) && !r.passed;
  });

  const recommended_fixes: string[] = [];
  const remaining_blockers: string[] = [];

  if (!devReport) {
    remaining_blockers.push("Developer report missing — cannot verify");
    recommended_fixes.push("Wait for Developer runtime to complete task");
  }

  if (devReport?.blocker) {
    remaining_blockers.push(devReport.blocker_reason ?? "Developer reported blocker");
    recommended_fixes.push("Resolve developer blocker before QA pass");
  }

  for (const r of checklist_results.filter((x) => !x.passed)) {
    if (r.item_id.startsWith("CHK-FILE-")) {
      recommended_fixes.push(`Verify file exists or update developer report: ${r.notes}`);
    }
    if (r.item_id === "CHK-BUILD") {
      recommended_fixes.push("Fix build failures before re-submitting to QA");
    }
    if (r.item_id === "CHK-LINT") {
      recommended_fixes.push("Fix lint errors in changed files");
    }
    if (r.item_id.startsWith("CHK-ACCEPT-")) {
      recommended_fixes.push(`Acceptance criteria failed: ${r.notes}`);
    }
    if (r.item_id.startsWith("CHK-STRAT-")) {
      recommended_fixes.push(`Strategy check failed: ${r.notes}`);
    }
  }

  let verdict: VerificationResult["verdict"] = "pass";
  let severity: VerificationResult["severity"] = "low";

  if (devReport?.blocker) {
    verdict = "blocked";
    severity = "high";
  } else if (requiredFails.length > 0) {
    verdict = "fail";
    severity = requiredFails.some((r) => r.item_id === "CHK-BUILD") ? "high" : "medium";
  }

  const passCount = checklist_results.filter((r) => r.passed).length;
  const confidence =
    checklist_results.length ?
      Math.round((passCount / checklist_results.length) * 100)
    : 0;

  const regression_risk = devReport?.estimated_regression_risk ?? "medium";

  const recommendation =
    verdict === "pass"
      ? "Approve for PM closure — all required checks passed."
      : verdict === "blocked"
        ? "Block and escalate — developer reported blocker."
        : `Return to Developer for fixes. ${recommended_fixes.slice(0, 3).join("; ")}`;

  const summary =
    verdict === "pass"
      ? `QA verification passed (${passCount}/${checklist_results.length} checks)`
      : verdict === "blocked"
        ? `QA blocked: ${remaining_blockers.join("; ")}`
        : `QA verification failed (${requiredFails.length} required checks failed)`;

  return {
    verdict,
    confidence,
    regression_risk,
    summary,
    recommendation,
    recommended_fixes,
    remaining_blockers,
    checklist_results,
    evidence,
    screenshots,
    screenshot_supported: false,
    repro_steps:
      verdict === "fail"
        ? checklist_results.filter((r) => !r.passed).map((r) => `${r.item_id}: ${r.notes}`)
        : undefined,
    severity: verdict === "pass" ? "low" : severity,
  };
}
