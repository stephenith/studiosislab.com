import type { WorkerExecutionContext } from "../directors/engineering/WorkerExecutionContext.js";

export const ENGINEERING_EXECUTION_VERIFY_PROMPT = `Create a markdown file inside
SOS/07_LOGS/saios/directors/engineering/execution/verify/
named resume-task.md

Contents:

# Resume Worker Task

SAIOS Engineering Execution Pipeline verification.`;

export const ENGINEERING_EXECUTION_VERIFY_PATH =
  "SOS/07_LOGS/saios/directors/engineering/execution/verify/resume-task.md";

export const ENGINEERING_EXECUTION_VERIFY_CONTENT = `# Resume Worker Task

SAIOS Engineering Execution Pipeline verification.`;

/**
 * Build Cursor prompt from engineering worker execution context.
 */
export function buildEngineeringCursorPrompt(context: WorkerExecutionContext): string {
  return context.prompt;
}

export function isVerificationWorkerType(workerType: string): boolean {
  return workerType === "testing-worker" || workerType.includes("testing");
}
