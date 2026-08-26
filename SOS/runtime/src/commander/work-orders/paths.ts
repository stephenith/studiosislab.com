import { join } from "node:path";
import type { RuntimeConfig } from "../../config.js";

export type WorkOrderPaths = {
  root: string;
  inbox: string;
  prompts: string;
  processed: string;
  reports: string;
};

export function getWorkOrderPaths(config: RuntimeConfig): WorkOrderPaths {
  const root = join(config.logsRoot, "work-orders");
  return {
    root,
    inbox: join(root, "inbox"),
    prompts: join(root, "prompts"),
    processed: join(root, "processed"),
    reports: join(root, "reports"),
  };
}

/** Repo-relative path for Telegram replies (from repo root). */
export function promptPathRelative(config: RuntimeConfig, workOrderId: string): string {
  const logsRel = config.logsRoot.startsWith(config.repoRoot)
    ? config.logsRoot.slice(config.repoRoot.length + 1)
    : "SOS/07_LOGS";
  return `${logsRel}/work-orders/prompts/${workOrderId}.md`;
}

export function inboxJsonPath(paths: WorkOrderPaths, workOrderId: string): string {
  return join(paths.inbox, `${workOrderId}.json`);
}

export function promptMdPath(paths: WorkOrderPaths, workOrderId: string): string {
  return join(paths.prompts, `${workOrderId}.md`);
}
