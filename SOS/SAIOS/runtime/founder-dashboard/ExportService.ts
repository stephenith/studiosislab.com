/**
 * Export service — JSON, CSV, PDF-ready summary.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ExportFormat } from "./types.js";

export function exportDashboardData(
  outputDir: string,
  data: {
    snapshot: object;
    queue: object;
    review: object;
    reports: object;
    statistics: object;
  },
): string[] {
  mkdirSync(join(outputDir, "exports"), { recursive: true });
  const files: string[] = [];

  const jsonPath = join(outputDir, "exports", "production-summary.json");
  writeFileSync(jsonPath, JSON.stringify(data, null, 2));
  files.push(jsonPath);

  const csvPath = join(outputDir, "exports", "production-summary.csv");
  writeFileSync(csvPath, toCsv(data.snapshot as Record<string, unknown>));
  files.push(csvPath);

  const pdfPath = join(outputDir, "exports", "founder-summary.pdf.md");
  writeFileSync(pdfPath, toPdfReadyMarkdown(data));
  files.push(pdfPath);

  const founderJson = join(outputDir, "exports", "founder-summary.json");
  writeFileSync(
    founderJson,
    JSON.stringify({ review: data.review, generated_at: new Date().toISOString() }, null, 2),
  );
  files.push(founderJson);

  return files;
}

function toCsv(obj: Record<string, unknown>): string {
  const rows = Object.entries(obj).map(([k, v]) => `${k},${JSON.stringify(v)}`);
  return ["key,value", ...rows].join("\n");
}

function toPdfReadyMarkdown(data: {
  snapshot: object;
  queue: object;
  review: object;
  statistics: object;
}): string {
  return [
    "# StudiosisLab Founder Operations Summary",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Factory Status",
    "```json",
    JSON.stringify(data.snapshot, null, 2),
    "```",
    "",
    "## Queue",
    "```json",
    JSON.stringify((data.queue as { totals?: unknown }).totals ?? data.queue, null, 2),
    "```",
    "",
    "## Pending Reviews",
    "```json",
    JSON.stringify(data.review, null, 2),
    "```",
    "",
    "## Statistics",
    "```json",
    JSON.stringify(data.statistics, null, 2),
    "```",
    "",
    "*Print this document to PDF from your browser or PDF tool.*",
  ].join("\n");
}

export function exportFormat(_format: ExportFormat, outputDir: string, data: object): string {
  const files = exportDashboardData(outputDir, data as Parameters<typeof exportDashboardData>[1]);
  return files[0] ?? "";
}
