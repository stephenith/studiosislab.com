import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { QaPaths } from "./paths.js";
import type { ProgressMilestone, QaProgressReport } from "./types.js";

export async function emitQaProgress(
  paths: QaPaths,
  taskId: string,
  correlationId: string,
  milestone: ProgressMilestone,
  message: string,
  metadata?: Record<string, unknown>,
): Promise<QaProgressReport> {
  const report: QaProgressReport = {
    report_id: randomUUID(),
    task_id: taskId,
    correlation_id: correlationId,
    milestone,
    timestamp: new Date().toISOString(),
    message,
    metadata,
  };

  const taskDir = join(paths.progress, taskId);
  await mkdir(taskDir, { recursive: true });
  await writeFile(join(taskDir, `${milestone}.json`), JSON.stringify(report, null, 2), "utf8");
  await writeFile(
    join(paths.reports, `${taskId}-latest-progress.json`),
    JSON.stringify(report, null, 2),
    "utf8",
  );

  return report;
}
