/**
 * Search — run ID, template ID, category, status, date.
 */
import { loadJobHistory, loadPublicationCatalog, loadQueueJobs, loadUnifiedRuns } from "./DataAggregator.js";

export function searchFactory(query: string) {
  const q = query.toLowerCase().trim();
  if (!q) return { results: [], total: 0 };

  const results: Array<{ type: string; id: string; status: string; match: string }> = [];

  for (const run of loadUnifiedRuns()) {
    const text = JSON.stringify(run).toLowerCase();
    if (text.includes(q)) {
      results.push({
        type: "run",
        id: String(run.run_id),
        status: String(run.status),
        match: String(run.objective ?? ""),
      });
    }
  }

  for (const job of loadQueueJobs()) {
    const text = JSON.stringify(job).toLowerCase();
    if (text.includes(q)) {
      results.push({
        type: "job",
        id: String(job.id),
        status: String(job.status),
        match: String(job.description ?? job.title),
      });
    }
  }

  for (const entry of loadPublicationCatalog()?.entries ?? []) {
    const text = JSON.stringify(entry).toLowerCase();
    if (text.includes(q)) {
      results.push({
        type: "publication",
        id: String(entry.catalog_id ?? entry.template_id),
        status: String(entry.state ?? "unknown"),
        match: String(entry.title ?? entry.catalog_id),
      });
    }
  }

  for (const entry of loadJobHistory()?.entries ?? []) {
    const text = JSON.stringify(entry).toLowerCase();
    if (text.includes(q)) {
      results.push({
        type: "scheduler_job",
        id: String(entry.job_id),
        status: String(entry.status),
        match: String(entry.category),
      });
    }
  }

  return { query, results: results.slice(0, 50), total: results.length };
}
