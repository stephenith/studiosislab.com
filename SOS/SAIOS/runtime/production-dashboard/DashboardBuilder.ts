/**
 * Builds production dashboard aggregates from discovered lifecycles.
 */
import type {
  BatchHealth,
  FactoryHealth,
  ProductionDashboard,
  QueueStage,
  TemplateLifecycleRecord,
} from "./types.js";

function avg(values: Array<number | null>): number | null {
  const nums = values.filter((v): v is number => typeof v === "number");
  if (nums.length === 0) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100;
}

function pct(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 10000) / 100;
}

export function buildBatchHealth(
  batchId: string,
  records: TemplateLifecycleRecord[],
): BatchHealth {
  const batchRecords = records.filter((r) => r.batch_id === batchId);
  const count = batchRecords.length || records.length;
  const scoped = batchRecords.length > 0 ? batchRecords : records;

  const qaPass = scoped.filter((r) => r.qa_status === "PASS").length;
  const published = scoped.filter((r) => r.current_stage === "published").length;
  const founderApproved = scoped.filter(
    (r) => r.founder_approval === "published" || r.current_stage === "ready_to_publish",
  ).length;
  const completed = scoped.filter(
    (r) =>
      r.current_stage === "published" ||
      r.current_stage === "ready_to_publish" ||
      r.current_stage === "qa_complete",
  ).length;

  return {
    batch_id: batchId,
    template_count: scoped.length,
    overall_completion_pct: pct(completed, scoped.length),
    qa_pct: pct(qaPass, scoped.length),
    publication_pct: pct(published, scoped.length),
    founder_approval_pct: pct(founderApproved, scoped.length),
    averages: {
      premium_score: avg(scoped.map((r) => r.scores.premium)),
      ats_score: avg(scoped.map((r) => r.scores.ats)),
      render_score: avg(scoped.map((r) => r.scores.render)),
      competitive_score: avg(scoped.map((r) => r.scores.competitive)),
      confidence: avg(scoped.map((r) => r.scores.confidence)),
    },
  };
}

export function buildFactoryHealth(input: {
  records: TemplateLifecycleRecord[];
  currentBatch: string;
  currentRelease: string;
  factoryVersion: string;
}): FactoryHealth {
  const { records, currentBatch, currentRelease, factoryVersion } = input;
  const issues = records.flatMap((r) => r.issues);
  const stale = records.filter((r) => r.freshness.stale).length;

  const health: FactoryHealth = {
    status: issues.length > 10 || stale > 0 ? "attention_required" : "healthy",
    templates_generated: records.filter((r) => r.generation_status === "complete").length,
    templates_published: records.filter((r) => r.current_stage === "published").length,
    templates_waiting_founder: records.filter((r) => r.current_stage === "founder_review").length,
    templates_ready_to_publish: records.filter((r) => r.current_stage === "ready_to_publish").length,
    templates_failed_qa: records.filter((r) => r.qa_status === "FAIL").length,
    templates_released: records.filter((r) => r.release_status === "released").length,
    templates_rolled_back: records.filter((r) => r.rollback_status === "rolled_back").length,
    templates_under_review: records.filter(
      (r) => r.current_stage === "founder_review" || r.founder_critic_status.startsWith("ready"),
    ).length,
    current_batch: currentBatch,
    current_queue_size: records.length,
    current_release: currentRelease,
    current_factory_version: factoryVersion,
    issues_detected: issues.length,
    stale_templates: stale,
  };

  if (health.templates_failed_qa > 0) health.status = "degraded";
  return health;
}

export function buildProductionDashboard(input: {
  records: TemplateLifecycleRecord[];
  factoryVersion: string;
  currentBatch: string;
  currentRelease: string;
}): ProductionDashboard {
  const globalIssues = input.records.flatMap((r) =>
    r.issues.map((issue) => `${r.prototype_id}:${issue}`),
  );

  const queueByStage = (stage: QueueStage) =>
    input.records.filter((r) => r.current_stage === stage);

  const publicationStatus = input.records
    .filter((r) => r.catalog_id)
    .map((r) => ({
      catalog_id: r.catalog_id!,
      prototype_id: r.prototype_id,
      publication_state: r.publication_status,
      live: r.current_stage === "published",
      package_exists: Boolean(r.paths.package_dir),
      release_id: r.release_id,
    }));

  return {
    generated_at: new Date().toISOString(),
    factory_health: buildFactoryHealth(input),
    batch_health: buildBatchHealth(input.currentBatch, input.records),
    queue: input.records,
    publication_status: publicationStatus,
    issues: globalIssues,
    search_index: input.records.map((r) => ({
      key: `${r.catalog_id ?? "none"}:${r.prototype_id}`,
      prototype_id: r.prototype_id,
      catalog_id: r.catalog_id,
      stage: r.current_stage,
    })),
  };
}

export function summarizeQueue(records: TemplateLifecycleRecord[]): Record<QueueStage, number> {
  const stages: QueueStage[] = [
    "draft",
    "generated",
    "qa_complete",
    "founder_review",
    "ready_to_publish",
    "published",
    "archived",
    "rolled_back",
  ];
  return Object.fromEntries(
    stages.map((stage) => [stage, records.filter((r) => r.current_stage === stage).length]),
  ) as Record<QueueStage, number>;
}
