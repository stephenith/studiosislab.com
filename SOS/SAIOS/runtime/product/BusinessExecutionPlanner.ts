import { randomBytes } from "node:crypto";
import type { Priority } from "../shared/types.js";
import {
  BUSINESS_DELIVERABLES,
  detectBusinessIntents,
  estimateHorizonDays,
  loadStudiosisLabKnowledge,
  RESUME_CATEGORIES,
  scoreBusinessDeliverables,
  TOTAL_RECOMMENDED_TEMPLATES,
} from "../../domain/studiosislab/index.js";
import type { BusinessDeliverableProfile } from "../../domain/studiosislab/BusinessFeatureProfiles.js";
import { EpicDecomposer } from "./EpicDecomposer.js";
import { TaskBatchBuilder } from "./TaskBatchBuilder.js";
import { DependencyResolver } from "./DependencyResolver.js";
import { FeaturePlanner } from "./FeaturePlanner.js";
import type {
  BusinessExecutionPlan,
  BusinessImpactSummary,
  DeliveryPlan,
  EngineeringJobSpec,
  FounderObjective,
  PrioritizedBusinessFeature,
  ProductEpic,
  ProductFeature,
} from "./types.js";

function generatePlanId(): string {
  return `BIZ-EXEC-${Date.now()}-${randomBytes(2).toString("hex")}`;
}

function jobCountForDeliverable(profile: BusinessDeliverableProfile): number {
  switch (profile.job_count_strategy) {
    case "category_templates":
      return TOTAL_RECOMMENDED_TEMPLATES;
    case "category_seo_pages":
      return RESUME_CATEGORIES.length + 5;
    case "fixed":
      return profile.fixed_job_count ?? 5;
    default:
      return 5;
  }
}

function buildProductFeatures(
  epic: ProductEpic,
  scored: PrioritizedBusinessFeature[],
): ProductFeature[] {
  return scored.map((item) => ({
    id: `${epic.id}-FEAT-${item.deliverable_id}`,
    epic_id: epic.id,
    name: item.name,
    description: `Business-prioritized deliverable: ${item.name}`,
    worker_type: item.worker_type,
    capability: item.capability,
    estimated_jobs: item.estimated_jobs,
    parallel_safe: item.parallel_safe,
  }));
}

function buildBusinessImpact(
  objective: string,
  intents: string[],
  horizonDays: number,
  features: PrioritizedBusinessFeature[],
): BusinessImpactSummary {
  const knowledge = loadStudiosisLabKnowledge();
  return {
    objective_intents: intents,
    horizon_days: horizonDays,
    primary_revenue_streams: knowledge.revenue.objective.primary_streams,
    expected_traffic_lift:
      features[0]?.name === "SEO Landing Pages"
        ? "High — SEO pages drive organic sessions within 14–30 days"
        : "Moderate — templates + SEO compound traffic over 30–60 days",
    expected_revenue_path:
      "SEO traffic → template discovery → downloads → display ads → paid exports",
    top_priority_feature: features[0]?.name ?? "Resume Templates",
  };
}

export type BusinessExecutionPlannerOptions = {
  batch_size?: number;
};

/**
 * Business-aware product execution planner.
 * Connects Product Delivery Engine with StudiosisLab Domain Knowledge.
 * Planning only — never touches Queue, Registry, Cursor, or runtime.
 */
export class BusinessExecutionPlanner {
  private readonly featurePlanner: FeaturePlanner;
  private readonly epicDecomposer: EpicDecomposer;
  private readonly batchBuilder: TaskBatchBuilder;
  private readonly dependencyResolver: DependencyResolver;

  constructor(options: BusinessExecutionPlannerOptions = {}) {
    this.featurePlanner = new FeaturePlanner();
    this.epicDecomposer = new EpicDecomposer();
    this.batchBuilder = new TaskBatchBuilder({ batch_size: options.batch_size ?? 10 });
    this.dependencyResolver = new DependencyResolver();
  }

  plan(objective: FounderObjective): BusinessExecutionPlan {
    const knowledge = loadStudiosisLabKnowledge();
    const text = objective.raw_text.trim();
    const intents = detectBusinessIntents(text);
    const horizonDays = estimateHorizonDays(text, knowledge);

    const scored = scoreBusinessDeliverables(BUSINESS_DELIVERABLES, text, knowledge);

    const prioritizedFeatures: PrioritizedBusinessFeature[] = scored.map((s) => ({
      rank: s.rank,
      deliverable_id: s.deliverable_id,
      name: s.name,
      catalog_feature_id: s.catalog_feature_id,
      revenue_impact_score: s.revenue_impact_score,
      traffic_impact_score: s.traffic_impact_score,
      development_cost: s.development_cost,
      dependency_cost: s.dependency_cost,
      priority_score: s.priority_score,
      estimated_jobs: jobCountForDeliverable(s.profile),
      worker_type: s.profile.worker_type,
      capability: s.profile.capability,
      parallel_safe: s.profile.parallel_safe,
    }));

    const epic = this.featurePlanner.planEpic({
      ...objective,
      raw_text: text,
    });
    epic.quantity = prioritizedFeatures.reduce((sum, f) => sum + f.estimated_jobs, 0);

    const productFeatures = buildProductFeatures(epic, prioritizedFeatures);
    const jobs = this.decomposeBusinessJobs(epic, productFeatures, prioritizedFeatures);
    const batches = this.batchBuilder.buildBatches(productFeatures, jobs);
    const dependencies = this.resolveBusinessDependencies(
      prioritizedFeatures,
      productFeatures,
      jobs,
    );
    const execution_order = this.dependencyResolver.topologicalOrder(jobs, dependencies);
    const expected_completion_order = this.buildBusinessExecutionOrder(
      prioritizedFeatures,
      jobs,
      dependencies,
    );

    const deliveryPlan: DeliveryPlan = {
      epic,
      features: productFeatures,
      jobs,
      batches,
      dependencies,
      execution_order,
    };

    const parallelism = Math.max(...batches.map((b) => b.job_ids.length), 1);

    return {
      plan_id: generatePlanId(),
      objective: text,
      features: prioritizedFeatures,
      jobs,
      batches,
      dependencies,
      execution_order,
      expected_completion_order,
      business_impact: buildBusinessImpact(text, intents, horizonDays, prioritizedFeatures),
      total_jobs: jobs.length,
      total_batches: batches.length,
      estimated_parallelism: parallelism,
      generated_at: new Date().toISOString(),
      delivery_plan: deliveryPlan,
    };
  }

  private decomposeBusinessJobs(
    epic: ProductEpic,
    features: ProductFeature[],
    prioritized: PrioritizedBusinessFeature[],
  ): EngineeringJobSpec[] {
    const rankByFeatureId = new Map(
      features.map((f, i) => [f.id, prioritized[i]?.rank ?? i + 1]),
    );

    const jobs = this.epicDecomposer.decompose(epic, features);
    const priorityMap: Record<Priority, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };

    return jobs.map((job) => {
      const rank = rankByFeatureId.get(job.feature_id) ?? 99;
      const priority: Priority = rank <= 2 ? "P0" : rank <= 4 ? "P1" : rank <= 6 ? "P2" : "P3";
      return { ...job, priority };
    }).sort((a, b) => {
      const fa = features.find((f) => f.id === a.feature_id);
      const fb = features.find((f) => f.id === b.feature_id);
      const ra = fa ? (rankByFeatureId.get(fa.id) ?? 99) : 99;
      const rb = fb ? (rankByFeatureId.get(fb.id) ?? 99) : 99;
      if (ra !== rb) return ra - rb;
      return priorityMap[a.priority] - priorityMap[b.priority] || a.index - b.index;
    });
  }

  private resolveBusinessDependencies(
    prioritized: PrioritizedBusinessFeature[],
    features: ProductFeature[],
    jobs: EngineeringJobSpec[],
  ) {
    const profileByDeliverable = new Map(
      BUSINESS_DELIVERABLES.map((p) => [p.id, p]),
    );
    const featureByDeliverable = new Map(
      prioritized.map((p, i) => [p.deliverable_id, features[i]!]),
    );
    const jobsByFeature = new Map<string, EngineeringJobSpec[]>();
    for (const job of jobs) {
      const list = jobsByFeature.get(job.feature_id) ?? [];
      list.push(job);
      jobsByFeature.set(job.feature_id, list);
    }

    const base = this.dependencyResolver.resolve(features, jobs);
    const edges = [...base.edges];

    for (const item of prioritized) {
      const profile = profileByDeliverable.get(item.deliverable_id);
      const targetFeature = featureByDeliverable.get(item.deliverable_id);
      if (!profile || !targetFeature) continue;

      const targetJobs = jobsByFeature.get(targetFeature.id) ?? [];
      for (const depId of profile.dependency_ids) {
        const sourceFeature = featureByDeliverable.get(depId);
        if (!sourceFeature) continue;
        const sourceJobs = jobsByFeature.get(sourceFeature.id) ?? [];
        const sourceJob = sourceJobs[0];
        const targetJob = targetJobs[0];
        if (!sourceJob || !targetJob) continue;
        const exists = edges.some(
          (e) => e.from_job_id === sourceJob.id && e.to_job_id === targetJob.id,
        );
        if (!exists) {
          edges.push({
            from_job_id: sourceJob.id,
            to_job_id: targetJob.id,
            kind: "must_finish_first",
            reason: `${item.name} depends on ${sourceFeature.name}`,
          });
        }
      }
    }

    const blocked_jobs: Record<string, string[]> = {};
    for (const edge of edges) {
      const list = blocked_jobs[edge.to_job_id] ?? [];
      list.push(edge.from_job_id);
      blocked_jobs[edge.to_job_id] = list;
    }

    const graph = {
      edges,
      must_finish_first: edges
        .filter((e) => e.kind === "must_finish_first")
        .map((e) => [e.from_job_id, e.to_job_id]),
      parallel_groups: base.parallel_groups,
      blocked_jobs,
    };

    return graph;
  }

  private buildBusinessExecutionOrder(
    prioritized: PrioritizedBusinessFeature[],
    jobs: EngineeringJobSpec[],
    dependencies: DeliveryPlan["dependencies"],
  ): string[] {
    const featureOrder = prioritized.map((p) => p.deliverable_id);

    const jobsByDeliverable = new Map<string, EngineeringJobSpec[]>();
    for (const job of jobs) {
      const deliverableId = job.feature_id.split("-FEAT-")[1] ?? "";
      const list = jobsByDeliverable.get(deliverableId) ?? [];
      list.push(job);
      jobsByDeliverable.set(deliverableId, list);
    }

    const ordered: string[] = [];
    for (const deliverableId of featureOrder) {
      const featureJobs = jobsByDeliverable.get(deliverableId) ?? [];
      const topo = this.dependencyResolver.topologicalOrder(featureJobs, dependencies);
      for (const id of topo) {
        if (!ordered.includes(id)) ordered.push(id);
      }
    }

    for (const job of jobs) {
      if (!ordered.includes(job.id)) ordered.push(job.id);
    }

    return ordered;
  }
}
