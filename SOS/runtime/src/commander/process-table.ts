import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type RuntimeWorkerId =
  | "pm"
  | "developer"
  | "qa"
  | "telegram"
  | "dispatcher"
  | "approvals"
  | "work-order-runner";

export const WORKER_SCRIPT_MARKERS: Record<RuntimeWorkerId, string> = {
  pm: "pm-run.ts",
  developer: "developer-run.ts",
  qa: "qa-run.ts",
  telegram: "telegram-poll.ts",
  dispatcher: "dispatch-loop.ts",
  approvals: "approvals-listen.ts",
  "work-order-runner": "work-order-runner.ts",
};

const __dirname = dirname(fileURLToPath(import.meta.url));
export const RUNTIME_ROOT = join(__dirname, "../..");

export type WorkerProcessInfo = {
  worker_id: RuntimeWorkerId;
  pid: number;
  ppid: number;
  command: string;
  owner: "commander" | "manual" | "unknown";
};

export type WorkerProcessCounts = {
  pm_processes_found: number;
  developer_processes_found: number;
  qa_processes_found: number;
  telegram_processes_found: number;
  dispatcher_processes_found: number;
  approvals_processes_found: number;
};

export type ProcessReconciliationReport = {
  scanned_at: string;
  before: WorkerProcessCounts & { total: number };
  terminated: WorkerProcessInfo[];
  after: WorkerProcessCounts & { total: number };
  processes: WorkerProcessInfo[];
};

const WORKER_IDS: RuntimeWorkerId[] = [
  "pm",
  "developer",
  "qa",
  "telegram",
  "dispatcher",
  "approvals",
  "work-order-runner",
];

export function isProcessAlive(pid: number | null | undefined): boolean {
  if (!pid || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function getProcessCommand(pid: number): string | null {
  if (!isProcessAlive(pid)) return null;
  try {
    return execSync(`ps -p ${pid} -o command=`, { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

function parsePsLine(line: string): { pid: number; ppid: number; command: string } | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(/\s+/);
  if (parts.length < 2) return null;
  const pid = parseInt(parts[0], 10);
  const ppid = parseInt(parts[1], 10);
  if (Number.isNaN(pid) || Number.isNaN(ppid)) return null;
  const command = trimmed.slice(parts[0].length + parts[1].length).trim();
  return { pid, ppid, command };
}

function classifyWorker(command: string): RuntimeWorkerId | null {
  for (const workerId of WORKER_IDS) {
    if (command.includes(WORKER_SCRIPT_MARKERS[workerId])) {
      return workerId;
    }
  }
  return null;
}

function inferOwner(command: string): WorkerProcessInfo["owner"] {
  if (command.includes("commander-start") || command.includes("commander/supervisor")) {
    return "commander";
  }
  if (command.includes("npm run commander:start")) {
    return "commander";
  }
  if (command.includes("npm run pm:run") || command.includes("npm run developer:run")) {
    return "manual";
  }
  return "unknown";
}

function dedupeWorkerInstances(processes: WorkerProcessInfo[]): WorkerProcessInfo[] {
  const pidSet = new Set(processes.map((p) => p.pid));
  const byWorker = new Map<RuntimeWorkerId, WorkerProcessInfo[]>();

  for (const proc of processes) {
    const list = byWorker.get(proc.worker_id) ?? [];
    list.push(proc);
    byWorker.set(proc.worker_id, list);
  }

  const roots: WorkerProcessInfo[] = [];
  for (const [, group] of byWorker) {
    const groupPids = new Set(group.map((p) => p.pid));
    for (const proc of group) {
      const parentInGroup = groupPids.has(proc.ppid);
      if (!parentInGroup) {
        roots.push(proc);
      }
    }
  }

  return roots.sort((a, b) => a.worker_id.localeCompare(b.worker_id) || a.pid - b.pid);
}

export function scanWorkerProcesses(runtimeRoot = RUNTIME_ROOT): WorkerProcessInfo[] {
  const markers = Object.values(WORKER_SCRIPT_MARKERS);
  let raw = "";
  try {
    raw = execSync("ps -axo pid=,ppid=,command=", { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
  } catch {
    return [];
  }

  const found: WorkerProcessInfo[] = [];
  const seen = new Set<string>();

  for (const line of raw.split("\n")) {
    if (!markers.some((m) => line.includes(m))) continue;
    const parsed = parsePsLine(line);
    if (!parsed) continue;
    const workerId = classifyWorker(parsed.command);
    if (!workerId) continue;
    const key = `${workerId}:${parsed.pid}`;
    if (seen.has(key)) continue;
    seen.add(key);
    found.push({
      worker_id: workerId,
      pid: parsed.pid,
      ppid: parsed.ppid,
      command: parsed.command,
      owner: inferOwner(parsed.command),
    });
  }

  return dedupeWorkerInstances(found);
}

export function countWorkerProcesses(runtimeRoot = RUNTIME_ROOT): WorkerProcessCounts & { total: number } {
  const processes = scanWorkerProcesses(runtimeRoot);
  const counts: WorkerProcessCounts = {
    pm_processes_found: 0,
    developer_processes_found: 0,
    qa_processes_found: 0,
    telegram_processes_found: 0,
    dispatcher_processes_found: 0,
    approvals_processes_found: 0,
  };

  for (const proc of processes) {
    switch (proc.worker_id) {
      case "pm":
        counts.pm_processes_found += 1;
        break;
      case "developer":
        counts.developer_processes_found += 1;
        break;
      case "qa":
        counts.qa_processes_found += 1;
        break;
      case "telegram":
        counts.telegram_processes_found += 1;
        break;
      case "dispatcher":
        counts.dispatcher_processes_found += 1;
        break;
      case "approvals":
        counts.approvals_processes_found += 1;
        break;
    }
  }

  const total =
    counts.pm_processes_found
    + counts.developer_processes_found
    + counts.qa_processes_found
    + counts.telegram_processes_found
    + counts.dispatcher_processes_found
    + counts.approvals_processes_found;

  return { ...counts, total };
}

export function isSingleInstanceHealthy(counts: WorkerProcessCounts): boolean {
  return (
    counts.pm_processes_found <= 1
    && counts.developer_processes_found <= 1
    && counts.qa_processes_found <= 1
    && counts.telegram_processes_found <= 1
    && counts.dispatcher_processes_found <= 1
  );
}

export function killProcessTree(pid: number): boolean {
  if (!isProcessAlive(pid)) return true;
  try {
    const children = execSync(`pgrep -P ${pid}`, { encoding: "utf8" })
      .split("\n")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !Number.isNaN(n));
    for (const childPid of children) {
      killProcessTree(childPid);
    }
  } catch {
    /* no children */
  }

  try {
    process.kill(pid, "SIGTERM");
  } catch {
    return !isProcessAlive(pid);
  }

  const deadline = Date.now() + 5000;
  while (isProcessAlive(pid) && Date.now() < deadline) {
    sleep(100);
  }

  if (isProcessAlive(pid)) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      return !isProcessAlive(pid);
    }
  }

  return !isProcessAlive(pid);
}

function sleep(ms: number): void {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    /* spin-wait — sync context for pre-spawn cleanup */
  }
}

export function terminateWorkerProcesses(
  processes: WorkerProcessInfo[],
  allowedPids: Set<number> = new Set(),
): WorkerProcessInfo[] {
  const terminated: WorkerProcessInfo[] = [];
  for (const proc of processes) {
    if (allowedPids.has(proc.pid)) continue;
    if (killProcessTree(proc.pid)) {
      terminated.push(proc);
    }
  }
  return terminated;
}

export async function reconcileWorkerProcessesBeforeStart(
  runtimeRoot = RUNTIME_ROOT,
): Promise<ProcessReconciliationReport> {
  const before = countWorkerProcesses(runtimeRoot);
  const processes = scanWorkerProcesses(runtimeRoot);
  const terminated = terminateWorkerProcesses(processes);
  sleep(500);
  const after = countWorkerProcesses(runtimeRoot);

  return {
    scanned_at: new Date().toISOString(),
    before,
    terminated,
    after,
    processes: scanWorkerProcesses(runtimeRoot),
  };
}

export async function ensureWorkerSlotBeforeSpawn(
  workerId: RuntimeWorkerId,
  allowedPid: number | null = null,
  runtimeRoot = RUNTIME_ROOT,
): Promise<{ terminated: WorkerProcessInfo[]; remaining: number }> {
  const processes = scanWorkerProcesses(runtimeRoot).filter((p) => p.worker_id === workerId);
  const allowed = new Set<number>();
  if (allowedPid && isProcessAlive(allowedPid)) {
    allowed.add(allowedPid);
  }
  const terminated = terminateWorkerProcesses(processes, allowed);
  sleep(300);
  const remaining = scanWorkerProcesses(runtimeRoot).filter((p) => p.worker_id === workerId).length;
  return { terminated, remaining };
}

export type WorkerStopVerification = {
  verified_at: string;
  counts: WorkerProcessCounts & { total: number };
  remaining: WorkerProcessInfo[];
  all_clear: boolean;
  force_terminated: WorkerProcessInfo[];
};

export async function verifyWorkersStopped(
  runtimeRoot = RUNTIME_ROOT,
  options: { forceTerminate?: boolean } = {},
): Promise<WorkerStopVerification> {
  let processes = scanWorkerProcesses(runtimeRoot);
  let forceTerminated: WorkerProcessInfo[] = [];

  if (options.forceTerminate && processes.length > 0) {
    forceTerminated = terminateWorkerProcesses(processes);
    sleep(500);
    processes = scanWorkerProcesses(runtimeRoot);
  }

  const counts = countWorkerProcesses(runtimeRoot);
  const monitored: RuntimeWorkerId[] = ["pm", "developer", "qa", "telegram", "dispatcher"];

  return {
    verified_at: new Date().toISOString(),
    counts,
    remaining: processes.filter((p) => monitored.includes(p.worker_id)),
    all_clear: monitored.every((id) => {
      const key = `${id}_processes_found` as keyof WorkerProcessCounts;
      return counts[key] === 0;
    }),
    force_terminated: forceTerminated,
  };
}
