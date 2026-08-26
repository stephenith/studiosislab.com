import type { BacklogItem } from "./types.js";
import { RUNTIME_FROZEN } from "../runtime/version.js";

export type TaskScope = "PRODUCT" | "RUNTIME_CHANGE" | "RUNTIME_BUG";

const RUNTIME_PATH_PATTERNS = [
  /\bSOS\/runtime\b/i,
  /\bSOS\/runtime\//i,
  /\bruntime\/src\b/i,
  /\bcommander\b/i,
  /\bpm-run\b/i,
  /\bpm runtime\b/i,
  /\bdeveloper runtime\b/i,
  /\bqa runtime\b/i,
  /\bdispatcher\b/i,
  /\bheartbeat\b/i,
  /\bsupervisor\b/i,
  /\broadmap engine\b/i,
  /\bfounder engine\b/i,
  /\bnotification pipeline\b/i,
  /\bruntime freeze\b/i,
  /\bruntime-heartbeat\b/i,
  /\bsingle-instance\b/i,
];

const RUNTIME_BUG_PATTERNS =
  /\bruntime bug\b|\bruntime crash\b|\bcommander crash\b|\bworker crash\b|\bstale heartbeat\b|\borphan process\b|\bproduction blocker\b/i;

function taskText(item: BacklogItem): string {
  return `${item.title} ${item.description} ${item.evidence.join(" ")}`.toLowerCase();
}

export function classifyTaskScope(item: BacklogItem): TaskScope {
  const text = taskText(item);

  if (RUNTIME_BUG_PATTERNS.test(text)) return "RUNTIME_BUG";

  if (item.evidence.some((e) => /SOS\/runtime|commander\/|runtime\//i.test(e))) {
    return "RUNTIME_CHANGE";
  }

  if (RUNTIME_PATH_PATTERNS.some((p) => p.test(text))) {
    return "RUNTIME_CHANGE";
  }

  return "PRODUCT";
}

export function hasCommanderRuntimeApproval(item: BacklogItem): boolean {
  const text = taskText(item);
  return /\bcommander.runtime.approval\b/i.test(text)
    || /\bruntime_change_approved\b/i.test(text);
}

/** Product-only mode: refuse runtime improvement work unless bug/crash/approved. */
export function isProductOnlyModeRefused(item: BacklogItem): boolean {
  if (!RUNTIME_FROZEN) return false;

  const scope = classifyTaskScope(item);
  if (scope === "PRODUCT" || scope === "RUNTIME_BUG") return false;
  if (hasCommanderRuntimeApproval(item)) return false;

  return scope === "RUNTIME_CHANGE";
}

export function runtimeRefusalReason(item: BacklogItem): string {
  const scope = classifyTaskScope(item);
  return `RUNTIME_CHANGE (${scope}) — runtime is frozen; requires Commander approval or must be a runtime bug/crash fix`;
}
