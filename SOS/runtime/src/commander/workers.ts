import type { WorkerDefinition } from "./types.js";

export const COMMANDER_WORKERS: WorkerDefinition[] = [
  { id: "pm", name: "PM Runtime", script: "src/cli/pm-run.ts", stale_after_ms: 120_000 },
  {
    id: "developer",
    name: "Developer Runtime",
    script: "src/cli/developer-run.ts",
    depends_on: ["pm"],
    stale_after_ms: 120_000,
  },
  {
    id: "qa",
    name: "QA Runtime",
    script: "src/cli/qa-run.ts",
    depends_on: ["pm"],
    stale_after_ms: 120_000,
  },
  {
    id: "approvals",
    name: "Approvals Listener",
    script: "src/cli/approvals-listen.ts",
    env: { SOS_APPROVALS_SKIP_TELEGRAM: "true" },
    depends_on: ["pm"],
    stale_after_ms: 120_000,
  },
  {
    id: "telegram",
    name: "Telegram Inbound Poll",
    script: "src/cli/telegram-poll.ts",
    args: ["--timeout", "25"],
    depends_on: ["pm"],
    stale_after_ms: 180_000,
  },
  {
    id: "dispatcher",
    name: "Dispatcher + Retry",
    script: "src/cli/dispatch-loop.ts",
    depends_on: ["pm"],
    stale_after_ms: 180_000,
  },
];

export const CRASH_ALERT_THRESHOLD = 3;

export const STALE_STDOUT_HEARTBEAT_MS = parseInt(
  process.env.SOS_COMMANDER_STALE_HEARTBEAT_MS ?? "180000",
  10,
);

/** Dependents first, PM last. */
export const WORKER_SHUTDOWN_ORDER = [
  "dispatcher",
  "telegram",
  "approvals",
  "qa",
  "developer",
  "pm",
] as const;
