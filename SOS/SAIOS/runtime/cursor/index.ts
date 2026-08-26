/**
 * SAIOS Cursor Runner module — public exports
 */

export { CursorRunner } from "./CursorRunner.js";
export { CursorJobExecutor } from "./CursorJobExecutor.js";
export type { CursorJobExecutorOptions } from "./CursorJobExecutor.js";
export { CursorResultParser } from "./CursorResultParser.js";
export { discoverCursorCli, runCursorAgentPrint } from "./CursorProcess.js";
export type { CursorDiscovery, RunCursorAgentOptions } from "./CursorProcess.js";
export { resolveCursorPaths, reportFilePath } from "./paths.js";

export type {
  CursorProcessResult,
  CursorParsedResult,
  CursorRunRequest,
  CursorRunOutcome,
  CursorJobExecutionResult,
} from "./types.js";

export {
  CURSOR_VERIFY_PROMPT,
  CURSOR_VERIFY_HELLO_PATH,
  CURSOR_VERIFY_HELLO_CONTENT,
} from "./types.js";

export {
  buildEngineeringCursorPrompt,
  isVerificationWorkerType,
  ENGINEERING_EXECUTION_VERIFY_PROMPT,
  ENGINEERING_EXECUTION_VERIFY_PATH,
  ENGINEERING_EXECUTION_VERIFY_CONTENT,
} from "./EngineeringCursorAdapter.js";
