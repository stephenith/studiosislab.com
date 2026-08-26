import { randomUUID } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { DeveloperPaths } from "./paths.js";
import type { ProgressMilestone, ProgressReport } from "./types.js";

export async function emitProgress(
  paths: DeveloperPaths,
  taskId: string,
  correlationId: string,
  milestone: ProgressMilestone,
  message: string,
  percent?: number,
  metadata?: Record<string, unknown>,
): Promise<ProgressReport> {
  const report: ProgressReport = {
    report_id: randomUUID(),
    task_id: taskId,
    correlation_id: correlationId,
    milestone,
    timestamp: new Date().toISOString(),
    message,
    percent_complete: percent,
    metadata,
  };

  const taskDir = join(paths.progress, taskId);
  await mkdir(taskDir, { recursive: true });
  await writeFile(
    join(taskDir, `${milestone}.json`),
    JSON.stringify(report, null, 2),
    "utf8",
  );

  await writeFile(
    join(paths.reports, `${taskId}-latest-progress.json`),
    JSON.stringify(report, null, 2),
    "utf8",
  );

  return report;
}
