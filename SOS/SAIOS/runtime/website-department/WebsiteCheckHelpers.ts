/**
 * Outcome helpers — authoritative WebsiteCheckOutcome with compatible pass boolean.
 */
import type {
  CoverageExecution,
  ScenarioResult,
  WebsiteCheckOutcome,
} from "./types.js";

/** pass is true only for outcome "pass". */
export function passFromOutcome(outcome: WebsiteCheckOutcome): boolean {
  return outcome === "pass";
}

export function outcomeFromExecuted(ok: boolean): WebsiteCheckOutcome {
  return ok ? "pass" : "fail";
}

/** Static evidence success/failure maps to pass/fail with static_evidence_only execution. */
export function outcomeFromStaticEvidence(ok: boolean): WebsiteCheckOutcome {
  return ok ? "pass" : "fail";
}

export function isActionableFailure(outcome: WebsiteCheckOutcome): boolean {
  return outcome === "fail";
}

export function isSkippedOutcome(outcome: WebsiteCheckOutcome): boolean {
  return outcome === "not_run" || outcome === "unsupported";
}

export function formatOutcomeLabel(outcome: WebsiteCheckOutcome): string {
  switch (outcome) {
    case "pass":
      return "PASS";
    case "fail":
      return "FAIL";
    case "not_run":
      return "NOT_RUN";
    case "unsupported":
      return "UNSUPPORTED";
    default:
      return String(outcome).toUpperCase();
  }
}

export function scenarioResult(input: {
  id: string;
  label: string;
  outcome: WebsiteCheckOutcome;
  severity: ScenarioResult["severity"];
  details: string;
  execution: CoverageExecution;
  evidence?: Record<string, unknown>;
}): ScenarioResult {
  return {
    id: input.id,
    label: input.label,
    outcome: input.outcome,
    pass: passFromOutcome(input.outcome),
    severity: input.severity,
    details: input.details,
    execution: input.execution,
    evidence: input.evidence,
  };
}

/** Module pass = no critical actionable failures (skips not_run/unsupported). */
export function modulePassFromScenarios(scenarios: ScenarioResult[]): boolean {
  return !scenarios.some((s) => s.severity === "critical" && s.outcome === "fail");
}

export function criticalActionableFailures(scenarios: ScenarioResult[]): boolean {
  return scenarios.some(
    (s) => s.severity === "critical" && s.outcome === "fail",
  );
}
