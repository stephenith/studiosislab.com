import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { RuntimeConfig } from "../../config.js";
import { loadPlatformStatus } from "../inbox-ai/status.js";

export type CommanderStatusSummary = {
  commander_status: string;
  pm_loop: string;
  current_task: string | null;
  developer_state: string;
  qa_state: string;
  queue_count: number;
  generated_at: string;
};

export async function loadCommanderStatusSummary(
  config: RuntimeConfig,
): Promise<CommanderStatusSummary> {
  const platform = await loadPlatformStatus(config);
  const pm = platform.pm as Record<string, unknown>;
  const dev = platform.developer as Record<string, unknown>;
  const qa = platform.qa as Record<string, unknown>;

  let commanderStatus = "unknown";
  const healthPath = join(config.logsRoot, "commander", "health.json");
  if (existsSync(healthPath)) {
    try {
      const health = JSON.parse(await readFile(healthPath, "utf8")) as { status?: string };
      commanderStatus = health.status ?? "unknown";
    } catch {
      commanderStatus = "health_unreadable";
    }
  }

  return {
    commander_status: commanderStatus,
    pm_loop: String(pm.loop_status ?? pm.state ?? "unknown"),
    current_task:
      typeof pm.current_task_id === "string" ? pm.current_task_id
      : typeof pm.current_task_title === "string" ? pm.current_task_title
      : null,
    developer_state: String(dev.state ?? dev.runtime_state ?? "unknown"),
    qa_state: String(qa.state ?? qa.runtime_state ?? "unknown"),
    queue_count: platform.queue_count,
    generated_at: new Date().toISOString(),
  };
}

export function formatStatusSummaryForPrompt(summary: CommanderStatusSummary): string {
  return [
    `- Commander: ${summary.commander_status}`,
    `- PM loop: ${summary.pm_loop}`,
    `- Current task: ${summary.current_task ?? "none"}`,
    `- Developer: ${summary.developer_state}`,
    `- QA: ${summary.qa_state}`,
    `- PM queue (actionable): ${summary.queue_count}`,
    `- Snapshot: ${summary.generated_at}`,
  ].join("\n");
}
