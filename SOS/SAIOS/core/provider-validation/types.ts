/**
 * Provider Validation Preparation — Agent #134.
 * Comparison harness only. No real-provider execution.
 */

export type CandidateSelectionStatus =
  | "SELECTED"
  | "BLOCKED"
  | "INELIGIBLE";

export type RealProviderReadinessState =
  | "NOT_IMPLEMENTED"
  | "MISSING_CREDENTIALS"
  | "MISSING_BUDGETS"
  | "WAITING_FOUNDER_AUTHORIZATION"
  | "READY_FOR_ONE_TEST"
  | "TEST_IN_PROGRESS"
  | "TEST_COMPLETED"
  | "TEST_FAILED"
  | "TEST_BLOCKED";

export type AuthorizationStatus =
  | "DEFINED"
  | "PENDING"
  | "APPROVED"
  | "CONSUMED"
  | "EXPIRED"
  | "REVOKED";

export type ValidationEventType =
  | "PROVIDER_VALIDATION_CANDIDATE_SELECTED"
  | "PROVIDER_VALIDATION_CANDIDATE_BLOCKED"
  | "VALIDATION_INPUT_FROZEN"
  | "MOCK_BASELINE_STARTED"
  | "MOCK_BASELINE_COMPLETED"
  | "REAL_PROVIDER_CONFIGURATION_MISSING"
  | "REAL_PROVIDER_WAITING_FOUNDER_AUTHORIZATION"
  | "REAL_PROVIDER_READY_FOR_ONE_TEST"
  | "PROVIDER_VALIDATION_BLOCKED";

export type ComparisonDimensionId =
  | "schema_compliance"
  | "objective_fulfilment"
  | "knowledge_usage"
  | "skill_adherence"
  | "designbrief_completeness"
  | "ats_compliance"
  | "visual_quality_proxy"
  | "typography_planning"
  | "layout_planning"
  | "revision_usefulness"
  | "deterministic_downstream_compatibility"
  | "critic_scores"
  | "latency"
  | "token_usage"
  | "estimated_cost"
  | "safety_privacy_compliance"
  | "hallucination_or_unsupported_claims"
  | "founder_preference_alignment";

export type ComparisonDimension = {
  id: ComparisonDimensionId;
  label: string;
  score_range: [number, number];
  evidence_source: string;
  pass_threshold: number;
  blocking: boolean;
  comparison_method: string;
  notes: string;
};

export type ValidationCandidate = {
  candidate_id: string;
  task_id: string;
  cycle_id: string;
  review_id: string;
  title: string;
  founder_decision_id: string | null;
  decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED" | null;
  source: "interactive_dashboard" | "historical_auto" | "none";
  publication_allowed: false;
  editor_compat_pass: boolean;
  critic_pass: boolean;
  critic_gate_pass: boolean;
  reached_waiting_founder: boolean;
  evidence_complete: boolean;
  eligible: boolean;
  blocking_reasons: string[];
  artifact_dir: string;
  fixture?: boolean;
};

export type ValidationInputPackage = {
  validation_id: string;
  candidate_id: string;
  task_id: string;
  cycle_id: string;
  founder_decision_id: string;
  objective: string;
  department: "resume";
  capability: string;
  quality_tier: string;
  skill_request: {
    skill_id: string;
    status: string;
  };
  knowledge_snapshot_references: string[];
  knowledge_snapshot_id: string | null;
  expected_structured_response_schema: string;
  privacy_classification: string;
  token_ceilings_placeholder: {
    max_input_tokens: null;
    max_output_tokens: null;
  };
  cost_ceiling_placeholder: {
    max_cost_usd: null;
  };
  designbrief_contract_version: string;
  renderer_contract_version: string;
  critic_rules_version: string;
  input_checksum: string;
  created_at: string;
  provider_prompt_locked: true;
  dry_run: true;
  publication_allowed: false;
  fixture?: boolean;
};

export type MockBaselineResult = {
  baseline_id: string;
  validation_id: string;
  provider: "mock";
  normalized_response: unknown;
  validation_result: { ok: boolean; errors: string[] };
  designbrief_reference: string | null;
  render_instructions_reference: string | null;
  canvas_json_reference: string | null;
  editor_compatibility: unknown;
  critic_scores: unknown;
  critic_gate: unknown;
  execution_duration_ms: number;
  estimated_tokens: number;
  cost_usd: 0;
  deterministic_checksum: string;
  publication_candidate_created: false;
  completed_at: string;
  fixture?: boolean;
};

export type BudgetEnvKeys = {
  SOS_AI_MONTHLY_BUDGET_USD: string;
  SOS_AI_DAILY_LIMIT_USD: string;
  SOS_AI_PER_TASK_TOKEN_LIMIT: string;
  SOS_AI_AUTO_PAUSE_THRESHOLD_PCT: string;
  SOS_AI_FOUNDER_ALERT_THRESHOLD_PCT: string;
  SOS_AI_SINGLE_TEST_MAX_COST_USD: string;
};

export type BudgetValidationResult = {
  ok: boolean;
  missing: string[];
  errors: string[];
  values: Record<string, number | null>;
};

export type FounderAuthorizationContract = {
  authorization_id: string;
  validation_id: string;
  provider: string;
  purpose: string;
  maximum_test_cost_usd: number | null;
  maximum_input_tokens: number | null;
  maximum_output_tokens: number | null;
  expires_at: string | null;
  founder_actor: string;
  approved_at: string | null;
  consumed_at: string | null;
  status: AuthorizationStatus;
  permits_exactly_one_request: true;
  enables_live: false;
  enables_publication: false;
  enables_general_production: false;
  notes: string;
};

export type RealProviderReadiness = {
  state: RealProviderReadinessState;
  provider: "openai" | "local" | "none";
  adapter_implemented: boolean;
  credentials_configured: boolean;
  provider_registry_enabled: boolean;
  live_off: boolean;
  dry_run: boolean;
  budgets: BudgetValidationResult;
  estimated_test_cost_within_budget: boolean | null;
  privacy_allows_external: boolean;
  founder_authorization: FounderAuthorizationContract | null;
  missing_configuration: string[];
  automatic_ready_forbidden: true;
  publication_allowed: false;
  evaluated_at: string;
};

export type ProviderValidationSnapshot = {
  generated_at: string;
  selection_status: CandidateSelectionStatus;
  candidate: ValidationCandidate | null;
  founder_action: string | null;
  package: ValidationInputPackage | null;
  mock_baseline: MockBaselineResult | null;
  readiness: RealProviderReadiness;
  comparison_dimensions_count: number;
  real_provider_request_executed: false;
  live: false;
  dry_run: true;
  openai_disabled: true;
  publication_allowed: false;
};
