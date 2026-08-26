import type { Priority } from "../shared/types.js";

export type FounderObjective = {
  raw_text: string;
  id?: string;
};

export type ProductEpic = {
  id: string;
  title: string;
  objective: string;
  priority: Priority;
  quantity: number;
  domain: string;
  created_at: string;
};

export type ProductFeature = {
  id: string;
  epic_id: string;
  name: string;
  description: string;
  worker_type: string;
  capability: string;
  estimated_jobs: number;
  parallel_safe: boolean;
};

export type EngineeringJobSpec = {
  id: string;
  feature_id: string;
  feature_name: string;
  title: string;
  description: string;
  worker_type: string;
  capability: string;
  priority: Priority;
  index: number;
};

export type TaskBatch = {
  id: string;
  name: string;
  feature_id: string;
  job_ids: string[];
  worker_types: string[];
  parallel_safe: boolean;
  batch_index: number;
};

export type DependencyKind = "must_finish_first" | "blocks";

export type DependencyEdge = {
  from_job_id: string;
  to_job_id: string;
  kind: DependencyKind;
  reason: string;
};

export type DependencyGraph = {
  edges: DependencyEdge[];
  must_finish_first: string[][];
  parallel_groups: string[][];
  blocked_jobs: Record<string, string[]>;
};

export type DeliveryPlan = {
  epic: ProductEpic;
  features: ProductFeature[];
  jobs: EngineeringJobSpec[];
  batches: TaskBatch[];
  dependencies: DependencyGraph;
  execution_order: string[];
};

export type DeliveryReport = {
  report_id: string;
  objective: string;
  epic_id: string;
  total_features: number;
  total_jobs: number;
  total_batches: number;
  estimated_parallelism: number;
  critical_path: string[];
  critical_path_length: number;
  estimated_completion_order: string[];
  features: ProductFeature[];
  batches: TaskBatch[];
  dependency_edge_count: number;
  parallel_group_count: number;
  generated_at: string;
  report_path: string;
  plan: DeliveryPlan;
};

export type PrioritizedBusinessFeature = {
  rank: number;
  deliverable_id: string;
  name: string;
  catalog_feature_id: string | null;
  revenue_impact_score: number;
  traffic_impact_score: number;
  development_cost: number;
  dependency_cost: number;
  priority_score: number;
  estimated_jobs: number;
  worker_type: string;
  capability: string;
  parallel_safe: boolean;
};

export type BusinessImpactSummary = {
  objective_intents: string[];
  horizon_days: number;
  primary_revenue_streams: string[];
  expected_traffic_lift: string;
  expected_revenue_path: string;
  top_priority_feature: string;
};

export type BusinessExecutionPlan = {
  plan_id: string;
  objective: string;
  features: PrioritizedBusinessFeature[];
  jobs: EngineeringJobSpec[];
  batches: TaskBatch[];
  dependencies: DependencyGraph;
  execution_order: string[];
  expected_completion_order: string[];
  business_impact: BusinessImpactSummary;
  total_jobs: number;
  total_batches: number;
  estimated_parallelism: number;
  generated_at: string;
  delivery_plan: DeliveryPlan;
};
