import type { WorkerHealth } from "./types.js";

/** Exit codes that indicate intentional shutdown (128 + signal number). */
export const EXPECTED_EXIT_CODES = new Set([0, 130, 143]);

export type WorkerKillReason = "stale_heartbeat" | "supervisor_stop";

export type WorkerExitContext = {
  commanderStopping: boolean;
  killReason?: WorkerKillReason | null;
};

export type WorkerExitClassification = {
  expected: boolean;
  last_exit_reason: string;
  shutdown_reason: string | null;
  shouldRestart: boolean;
  isCrash: boolean;
};

function signalExitCode(signal: NodeJS.Signals): number {
  const map: Record<string, number> = {
    SIGHUP: 129,
    SIGINT: 130,
    SIGQUIT: 131,
    SIGTERM: 143,
  };
  return map[signal] ?? 128;
}

export function classifyWorkerExit(
  code: number | null,
  signal: NodeJS.Signals | null,
  ctx: WorkerExitContext,
): WorkerExitClassification {
  const effectiveCode = code ?? (signal ? signalExitCode(signal) : null);

  if (ctx.commanderStopping) {
    const detail = signal ?? (effectiveCode !== null ? String(effectiveCode) : "stop");
    return {
      expected: true,
      last_exit_reason: `graceful_shutdown (${detail})`,
      shutdown_reason: "graceful_shutdown",
      shouldRestart: false,
      isCrash: false,
    };
  }

  if (ctx.killReason === "stale_heartbeat") {
    return {
      expected: false,
      last_exit_reason: "heartbeat_timeout",
      shutdown_reason: null,
      shouldRestart: true,
      isCrash: true,
    };
  }

  if (signal === "SIGKILL") {
    return {
      expected: false,
      last_exit_reason: "killed_by_sigkill",
      shutdown_reason: null,
      shouldRestart: true,
      isCrash: true,
    };
  }

  if (signal === "SIGTERM" || effectiveCode === 143) {
    return {
      expected: true,
      last_exit_reason: "sigterm",
      shutdown_reason: null,
      shouldRestart: true,
      isCrash: false,
    };
  }

  if (signal === "SIGINT" || effectiveCode === 130) {
    return {
      expected: true,
      last_exit_reason: "sigint",
      shutdown_reason: null,
      shouldRestart: true,
      isCrash: false,
    };
  }

  if (effectiveCode === 0) {
    return {
      expected: true,
      last_exit_reason: "clean_exit",
      shutdown_reason: null,
      shouldRestart: true,
      isCrash: false,
    };
  }

  if (effectiveCode !== null && EXPECTED_EXIT_CODES.has(effectiveCode)) {
    return {
      expected: true,
      last_exit_reason: `exit_code_${effectiveCode}`,
      shutdown_reason: null,
      shouldRestart: true,
      isCrash: false,
    };
  }

  const reason = signal
    ? `unexpected_signal_${signal}`
    : `unexpected_exit_code_${effectiveCode ?? "unknown"}`;

  return {
    expected: false,
    last_exit_reason: reason,
    shutdown_reason: null,
    shouldRestart: true,
    isCrash: true,
  };
}

export function formatWorkerExitError(
  code: number | null,
  signal: NodeJS.Signals | null,
  classification: WorkerExitClassification,
): string {
  if (classification.isCrash) {
    if (classification.last_exit_reason === "heartbeat_timeout") {
      return "Stale heartbeat — supervisor killed process";
    }
    if (signal) return `Terminated by signal ${signal}`;
    return `Exited with code ${code ?? "unknown"}`;
  }
  return classification.last_exit_reason;
}

export function isUnexpectedCrash(worker: Pick<WorkerHealth, "expected_exit" | "status">): boolean {
  return worker.status === "crashed" && worker.expected_exit !== true;
}
