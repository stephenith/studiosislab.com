/**
 * Writes production dashboard artifacts.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { summarizeQueue } from "./DashboardBuilder.js";
import type { ProductionDashboard } from "./types.js";

const REPO_ROOT = resolve(import.meta.dirname, "../../../..");
const SOS_ROOT = join(REPO_ROOT, "SOS");
const DASHBOARD_DIR = join(SOS_ROOT, "07_LOGS/saios/production-dashboard");
const REPORT_PATH = join(SOS_ROOT, "09_REPORTS/PRODUCTION_BATCH_DASHBOARD_V1_REPORT.md");

export function renderDashboardMarkdown(dashboard: ProductionDashboard): string {
  const fh = dashboard.factory_health;
  const bh = dashboard.batch_health;
  const queueSummary = summarizeQueue(dashboard.queue);

  const pendingFounder = dashboard.queue.filter((r) => r.current_stage === "founder_review");
  const readyPublish = dashboard.queue.filter((r) => r.current_stage === "ready_to_publish");
  const stale = dashboard.queue.filter((r) => r.freshness.stale);

  const lines = [
    "# Production Dashboard",
    "",
    `Generated: ${dashboard.generated_at}`,
    "",
    "## Factory Health",
    "",
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Status | ${fh.status} |`,
    `| Templates Generated | ${fh.templates_generated} |`,
    `| Templates Published | ${fh.templates_published} |`,
    `| Waiting Founder | ${fh.templates_waiting_founder} |`,
    `| Ready To Publish | ${fh.templates_ready_to_publish} |`,
    `| Failed QA | ${fh.templates_failed_qa} |`,
    `| Released | ${fh.templates_released} |`,
    `| Rolled Back | ${fh.templates_rolled_back} |`,
    `| Under Review | ${fh.templates_under_review} |`,
    `| Current Batch | ${fh.current_batch} |`,
    `| Current Release | ${fh.current_release} |`,
    `| Factory Version | ${fh.current_factory_version} |`,
    `| Issues Detected | ${fh.issues_detected} |`,
    `| Stale Templates | ${fh.stale_templates} |`,
    "",
    "## Batch Health",
    "",
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Batch | ${bh.batch_id} |`,
    `| Template Count | ${bh.template_count} |`,
    `| Overall Completion | ${bh.overall_completion_pct}% |`,
    `| QA | ${bh.qa_pct}% |`,
    `| Publication | ${bh.publication_pct}% |`,
    `| Founder Approval | ${bh.founder_approval_pct}% |`,
    `| Avg Premium | ${bh.averages.premium_score ?? "n/a"} |`,
    `| Avg ATS | ${bh.averages.ats_score ?? "n/a"} |`,
    `| Avg Render | ${bh.averages.render_score ?? "n/a"} |`,
    `| Avg Competitive | ${bh.averages.competitive_score ?? "n/a"} |`,
    `| Avg Confidence | ${bh.averages.confidence ?? "n/a"} |`,
    "",
    "## Production Queue",
    "",
    ...Object.entries(queueSummary).map(([stage, count]) => `- **${stage}**: ${count}`),
    "",
    "## Pending Founder Reviews",
    "",
    ...(pendingFounder.length
      ? pendingFounder.map(
          (r) =>
            `- ${r.prototype_id} (${r.catalog_id ?? "no catalog"}) — ${r.role ?? "unknown role"}`,
        )
      : ["- None"]),
    "",
    "## Ready To Publish",
    "",
    ...(readyPublish.length
      ? readyPublish.map((r) => `- ${r.catalog_id} — ${r.prototype_id} (${r.role ?? "?"})`)
      : ["- None"]),
    "",
    "## Stale / Attention Required",
    "",
    ...(stale.length
      ? stale.map((r) => `- ${r.prototype_id}: ${r.freshness.reasons.join(", ")}`)
      : ["- None"]),
    "",
    "## Top Issues",
    "",
    ...(dashboard.issues.slice(0, 30).length
      ? dashboard.issues.slice(0, 30).map((i) => `- ${i}`)
      : ["- None"]),
    "",
  ];
  return lines.join("\n");
}

export function renderV1Report(dashboard: ProductionDashboard): string {
  const md = renderDashboardMarkdown(dashboard);
  return [
    "# PRODUCTION BATCH DASHBOARD V1 REPORT",
    "",
    "**Agent:** #096 — Autonomous Production Dashboard & Batch Operations Manager",
    "**Role:** Orchestration / visibility only — no generation, no publication.",
    "",
    md,
    "",
    "## Verification Scope",
    "",
    "- Factory State consistency",
    "- Production Queue integrity",
    "- Batch completeness",
    "- Publication freshness",
    "- Release consistency",
    "- Founder Review consistency",
    "- Catalog consistency",
    "- Runtime Catalog consistency",
    "- Dashboard integrity",
    "- No stale published templates (flag only)",
    "",
  ].join("\n");
}

export function persistDashboardArtifacts(dashboard: ProductionDashboard): {
  dashboard_dir: string;
  report_path: string;
  files: string[];
} {
  mkdirSync(DASHBOARD_DIR, { recursive: true });
  mkdirSync(join(SOS_ROOT, "09_REPORTS"), { recursive: true });

  const files = {
    dashboard: join(DASHBOARD_DIR, "dashboard.json"),
    dashboard_md: join(DASHBOARD_DIR, "dashboard.md"),
    batch_health: join(DASHBOARD_DIR, "batch-health.json"),
    queue: join(DASHBOARD_DIR, "queue.json"),
    publication_status: join(DASHBOARD_DIR, "publication-status.json"),
    factory_health: join(DASHBOARD_DIR, "factory-health.json"),
  };

  writeFileSync(files.dashboard, JSON.stringify(dashboard, null, 2));
  writeFileSync(files.dashboard_md, renderDashboardMarkdown(dashboard));
  writeFileSync(files.batch_health, JSON.stringify(dashboard.batch_health, null, 2));
  writeFileSync(
    files.queue,
    JSON.stringify(
      {
        generated_at: dashboard.generated_at,
        summary: summarizeQueue(dashboard.queue),
        items: dashboard.queue,
      },
      null,
      2,
    ),
  );
  writeFileSync(files.publication_status, JSON.stringify(dashboard.publication_status, null, 2));
  writeFileSync(files.factory_health, JSON.stringify(dashboard.factory_health, null, 2));
  writeFileSync(REPORT_PATH, renderV1Report(dashboard));

  return {
    dashboard_dir: DASHBOARD_DIR,
    report_path: REPORT_PATH,
    files: Object.values(files).concat(REPORT_PATH),
  };
}

export { DASHBOARD_DIR, REPORT_PATH };
