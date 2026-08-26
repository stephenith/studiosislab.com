import { mkdir, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import type { DeliveryPlan, DeliveryReport } from "./types.js";
import { deliveryReportPath, resolveProductPaths } from "./paths.js";

function generateReportId(): string {
  return `PD-REPORT-${Date.now()}-${randomBytes(3).toString("hex")}`;
}

export function buildDeliveryReport(plan: DeliveryPlan, criticalPath?: string[]): DeliveryReport {
  const parallelism = Math.max(
    ...plan.dependencies.parallel_groups.map((g) => g.length),
    1,
  );

  const path =
    criticalPath && criticalPath.length > 0
      ? criticalPath
      : plan.execution_order.slice(0, Math.min(10, plan.execution_order.length));

  const reportId = generateReportId();
  const relPath = `SOS/07_LOGS/saios/product/delivery-reports/${reportId}.json`;

  return {
    report_id: reportId,
    objective: plan.epic.objective,
    epic_id: plan.epic.id,
    total_features: plan.features.length,
    total_jobs: plan.jobs.length,
    total_batches: plan.batches.length,
    estimated_parallelism: parallelism,
    critical_path: path,
    critical_path_length: path.length,
    estimated_completion_order: plan.execution_order,
    features: plan.features,
    batches: plan.batches,
    dependency_edge_count: plan.dependencies.edges.length,
    parallel_group_count: plan.dependencies.parallel_groups.length,
    generated_at: new Date().toISOString(),
    report_path: relPath,
    plan,
  };
}

export async function writeDeliveryReport(
  report: DeliveryReport,
  reportsDir?: string,
): Promise<string> {
  const dir = reportsDir ?? resolveProductPaths().reportsDir;
  await mkdir(dir, { recursive: true });
  const absPath = deliveryReportPath(dir, report.report_id);
  await writeFile(absPath, JSON.stringify(report, null, 2), "utf8");
  return absPath;
}
