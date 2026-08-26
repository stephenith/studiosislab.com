/**
 * Factory State Manager — shared types.
 * Orchestration only; no AI or production intelligence.
 */

export type AgentRecord = {
  number: number;
  label: string;
  sources: string[];
  report_path: string | null;
};

export type FounderReviewRecord = {
  number: number;
  id: string;
  path: string;
  status: string;
  calibration_version: string | null;
  updated_at: string | null;
};

export type ReleaseRecord = {
  release_id: string;
  catalog_id: string;
  release_date: string;
  status: string;
  checksum: string;
  rollback_available: boolean;
};

export type PublicationQueueEntry = {
  catalog_id: string;
  prototype_id: string;
  title: string;
  state: string;
  package_dir: string | null;
};

export type HistoryEntry = {
  at: string;
  type: string;
  summary: string;
  ref: string;
};

export type FactoryProjectState = {
  factory_version: string;
  generated_at: string;
  latest_agent: string;
  next_agent: string;
  latest_founder_review: string;
  next_founder_review: string;
  latest_release: string;
  latest_catalog: string;
  latest_calibration: string;
  latest_design_dna: string;
  latest_batch: string;
  latest_generation: string;
  latest_template: string;
  publication_status: string;
  qa_status: string;
  competitive_validation_status: string;
  design_dna_status: string;
  release_manager_status: string;
  runtime_catalog_status: string;
  pending_actions: string[];
  history: HistoryEntry[];
  discovery: {
    agents: {
      records: AgentRecord[];
      missing_numbers: number[];
      duplicate_numbers: number[];
    };
    founder_reviews: FounderReviewRecord[];
    releases: ReleaseRecord[];
    published_templates: string[];
    draft_templates: string[];
    publication_queue: PublicationQueueEntry[];
    operational_modules: string[];
  };
};
