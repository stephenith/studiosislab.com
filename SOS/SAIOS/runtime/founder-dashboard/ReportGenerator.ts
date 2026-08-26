/**
 * Report generator — daily, weekly, production, quality, founder, publication, learning.
 */
import { buildCategoryCoverage } from "./CategoryCoverage.js";
import { buildHealthMonitor } from "./HealthMonitor.js";
import { buildLearningView } from "./LearningView.js";
import { buildQueueMonitor } from "./QueueMonitor.js";
import { buildReviewQueue } from "./ReviewQueue.js";
import { loadUnifiedRuns, loadSchedulerConfig } from "./DataAggregator.js";
import { resolveFactoryStatus } from "./FactoryController.js";

export function buildReportsBundle() {
  const runs = loadUnifiedRuns();
  const review = buildReviewQueue();
  const queue = buildQueueMonitor();
  const health = buildHealthMonitor();
  const learning = buildLearningView();
  const coverage = buildCategoryCoverage();
  const config = loadSchedulerConfig();

  return {
    generated_at: new Date().toISOString(),
    daily: {
      date: new Date().toISOString().slice(0, 10),
      factory_status: resolveFactoryStatus(),
      jobs_queued: queue.totals.queued,
      jobs_completed: queue.totals.completed,
      waiting_founder: review.total,
      health: health.recovery_status,
    },
    weekly: {
      week: getWeekId(),
      total_runs: runs.length,
      waiting_founder: runs.filter((r) => r.status === "waiting_founder").length,
      failed: runs.filter((r) => r.status === "failed").length,
    },
    monthly: {
      month: new Date().toISOString().slice(0, 7),
      total_runs: runs.length,
      categories_covered: coverage.filter((c) => c.published + c.draft > 0).length,
    },
    production: {
      active_runs: runs.filter((r) => r.status === "running").length,
      completed: runs.filter((r) => r.status === "waiting_founder").length,
      objectives: runs.slice(0, 10).map((r) => r.objective),
    },
    quality: {
      average_quality: health.average_quality,
      average_confidence: health.average_confidence,
      failure_rate_pct: health.failure_rate_pct,
    },
    founder: {
      pending_reviews: review.items,
      decisions_path: "founder-decisions.json",
    },
    publication: {
      ready_to_publish: review.items.filter((i) => i.publication_status === "ready_to_publish").length,
      waiting_founder: review.total,
      draft: review.items.filter((i) => i.publication_status === "draft").length,
    },
    learning,
    goals: config?.workload ?? {},
  };
}

function getWeekId(): string {
  const d = new Date();
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - onejan.getTime()) / 86_400_000 + onejan.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${week}`;
}
