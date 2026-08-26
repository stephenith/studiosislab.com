import type { ExecutionResult } from "./types.js";

export type ReviewVerdict = "accept" | "reject_blocker" | "needs_pm";

export function reviewExecution(result: ExecutionResult): {
  verdict: ReviewVerdict;
  message: string;
} {
  if (result.blocker) {
    return {
      verdict: "reject_blocker",
      message: result.blocker_reason ?? "Execution blocked",
    };
  }

  if (!result.build_passed && result.files_changed.length > 0) {
    return {
      verdict: "needs_pm",
      message: "Build/lint failed after changes — PM review required",
    };
  }

  if (result.confidence < 50) {
    return {
      verdict: "needs_pm",
      message: `Low confidence (${result.confidence}%) — PM review required`,
    };
  }

  return {
    verdict: "accept",
    message: "Execution accepted; PM completion report written",
  };
}
