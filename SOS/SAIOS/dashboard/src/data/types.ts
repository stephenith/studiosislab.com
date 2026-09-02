/**
 * Dashboard normalized models — Agent #123.
 */
export type AiosStatus =
  | "idle"
  | "queued"
  | "planning"
  | "running"
  | "waiting_founder"
  | "blocked"
  | "failed"
  | "completed"
  | "disabled"
  | "degraded"
  | "healthy";

export type DashboardRoute =
  | "command-center"
  | "fcc-production"
  | "fcc-portfolio"
  | "fcc-strategy"
  | "fcc-governance"
  | "fcc-advisor"
  | "fcc-reports"
  | "home"
  | "resume"
  | "knowledge"
  | "brain"
  | "skills"
  | "activity"
  | "review"
  | "mission-approval"
  | "queue-admission"
  | "execution-package"
  | "queue-submission"
  | "shadow-queue"
  | "runtime-plan"
  | "runtime-release"
  | "system-readiness"
  | "execution-controller"
  | "department-registry"
  | "cost-ledger"
  | "worker-runtime"
  | "telemetry-registry"
  | "activation-gate"
  | "execution-authorization"
  | "pre-dispatch-simulation"
  | "provider-validation"
  | "settings";

export type DepartmentRow = {
  id: string;
  label: string;
  status: AiosStatus;
  mode: string;
  queue_depth: number | null;
  last_activity: string | null;
  health: AiosStatus;
  open_route: DashboardRoute | null;
  notes?: string;
};

export type CycleItem = {
  id: string;
  title: string;
  status: AiosStatus;
  department: string;
  skill_id?: string;
  updated_at?: string;
  source: string;
};

export type ExceptionItem = {
  id: string;
  severity: "fail" | "degraded" | "blocked" | "founder";
  title: string;
  detail: string;
  source: string;
};

export type FounderAction = {
  id: string;
  priority: string;
  title: string;
  detail: string;
  source: string;
  category?: string;
};

export type KnowledgeDomainRow = {
  id: string;
  owner: string;
  read: string;
  write: string;
  entry_count: number | null;
  last_update: string | null;
  health: AiosStatus;
};

export type SkillRow = {
  id: string;
  name: string;
  domain: "resume" | "website" | "common" | string;
  active: boolean;
  notes?: string;
};

export type ActivityEvent = {
  id: string;
  timestamp: string;
  event_type: string;
  department: string;
  run_id: string | null;
  summary: string;
  status: AiosStatus;
};

export type BrainNode = {
  id: string;
  label: string;
  kind: string;
  meta: Record<string, string | number | boolean | null>;
};

export type DataSourceState = {
  id: string;
  path: string;
  available: boolean;
  error?: string;
};

export type TopBarState = {
  live: false;
  live_label: "LIVE OFF";
  mode: "dry_run";
  provider: "Mock";
  heartbeat_age: string;
  cost_today_usd: "0.00";
  latest_agent: string;
  next_agent: string;
};

export type ResumeDepartmentView = {
  enabled: boolean;
  mode: "dry_run";
  batch_size: number;
  provider: "Mock";
  queue_depth: number;
  latest_run: CycleItem | null;
  approval_state: string;
  ai_path: string[];
  deterministic_safeguards: string[];
  stages: string[];
};

export type CriticScoresView = {
  overall: number;
  ats: number;
  visual: number;
  typography: number;
  layout: number;
  technical: number;
  consistency: number;
  sections: number;
  ready: boolean;
  founder_review_allowed: boolean;
  publication_allowed: false;
  blocking_reasons: string[];
  critic_report_reference: string;
  gate_id: string | null;
  source: string;
};

export type ProductionCycleView = {
  current_stage: string | null;
  current_candidate: string | null;
  current_duration_ms: number | null;
  current_queue: string | null;
  critic_score: {
    overall: number;
    ats: number;
    ready: boolean;
  } | null;
  founder_waiting: boolean;
  completed_cycle: boolean;
  recent_learning: number | null;
  task_id: string | null;
  waiting_duration_ms: number | null;
  source: string | null;
};

export type FounderReviewQueueItem = {
  review_id: string;
  candidate_id: string;
  task_id: string;
  cycle_id: string;
  title: string;
  template: string;
  department: string;
  provider: string;
  status:
    | "waiting_founder"
    | "approved"
    | "rejected"
    | "changes_requested"
    | "revision_failed";
  ready: boolean;
  badge: "ready" | "blocked" | "waiting";
  created_at: string;
  preview_url: string | null;
  preview_path: string | null;
  thumbnail_path: string | null;
  critic: CriticScoresView | null;
  decision_id?: string;
  learning_impact: string;
  source: string;
  /** Agent #208 — relative paths under candidate folder (no content duplication). */
  artifact_refs?: {
    production_target: string | null;
    research_context: string | null;
    canvas: string | null;
    critic: string | null;
    gate: string | null;
    dashboard: string | null;
    review: string | null;
    preview: string | null;
  };
  production_target?: {
    category: string;
    title: string;
    industry: string;
    seniority: string;
    objective?: string;
  } | null;
  candidate_directory?: string | null;
  /** Founder revision metadata (rev249 / OpenAI revfb) */
  revision?: {
    revised?: boolean;
    revision_number?: number;
    prior_status?: string;
    requested_changes?: string[];
    changes_applied?: string[];
    role?: string;
    prior_candidate_id?: string;
    prior_decision_id?: string;
  } | null;
};

export type ProviderValidationViewData = {
  selection_status: string;
  candidate_id: string | null;
  candidate_title: string | null;
  eligible: boolean;
  founder_action: string | null;
  blocking_reasons: string[];
  frozen_input_checksum: string | null;
  validation_id: string | null;
  mock_baseline_status: string;
  mock_baseline_id: string | null;
  readiness_state: string;
  credentials_configured: boolean;
  budgets_ok: boolean;
  authorization_status: string | null;
  missing_configuration: string[];
  comparison_dimensions_count: number;
  real_provider_request_executed: false;
  publication_allowed: false;
  source: string | null;
};

export type CompanyBrainViewData = {
  version: string;
  mode: "planning_only";
  autonomous: false;
  can_execute: false;
  can_enqueue: false;
  planning_state: string;
  current_objective: string | null;
  latest_plan_id: string | null;
  pending_approval: boolean;
  execution_status: string | null;
  priority: string | null;
  risk_level: string | null;
  departments: string[];
  blocker_count: number;
  founder_approval_required: true;
  canonical_engine: string;
  source: string | null;
  /** Mission Contract V1 (Agent #162) — read-only */
  current_mission_id: string | null;
  current_mission_name: string | null;
  current_mission_status: string | null;
  current_mission_priority: string | null;
  current_mission_progress_pct: number | null;
  current_mission_risk: string | null;
  current_mission_departments: string[];
  founder_approval_status: string | null;
  /** Agent #163 — mission approval (read-only snapshot) */
  current_mission: Record<string, unknown> | null;
  pending_mission_approval: boolean;
  latest_mission_decision: {
    decision_id: string | null;
    decision: string | null;
    mission_id: string | null;
    actor: string | null;
    created_at: string | null;
    next_safe_action: string | null;
  } | null;
  mission_approval_health: {
    pending_count: number;
    approved_count: number;
    rejected_count: number;
    changes_requested_count: number;
    status: string;
    mode: string;
    execution_allowed: false;
    queue_admission_allowed: false;
    publishing_allowed: false;
  } | null;
  /** Agent #164 — queue admission readiness (read-only) */
  queue_admission: {
    queue_status: string | null;
    overall_score: number | null;
    verdict: string | null;
    pending: boolean;
    execution_still_blocked_reason: string;
    execution_allowed: false;
    queue_enqueue_allowed: false;
    publishing_allowed: false;
  } | null;
  /** Agent #165 — execution package dry-run preview */
  execution_package: {
    package_id: string | null;
    execution_id: string | null;
    dry_run: true;
    execution_allowed: false;
    available: boolean;
  } | null;
  /** Agent #166 — package acknowledgement */
  execution_package_ack_status: string | null;
  pending_execution_package_ack: boolean;
  latest_execution_package_ack: {
    acknowledgement_id: string | null;
    decision: string | null;
    package_id: string | null;
    checksum: string | null;
    next_safe_action: string | null;
  } | null;
  execution_package_ack_health: {
    pending_count: number;
    acknowledged_count: number;
    status: string;
    mode: string;
    execution_allowed: false;
    queue_enqueue_allowed: false;
    publishing_allowed: false;
  } | null;
  /** Agent #167 — queue submission shadow contract */
  queue_submission_status: string | null;
  pending_queue_submission: boolean;
  latest_queue_submission: {
    submission_id: string | null;
    submission_checksum: string | null;
    execution_package_id: string | null;
    acknowledgement_id: string | null;
    next_safe_action: string | null;
  } | null;
  queue_submission_health: {
    pending_count: number;
    ready_count: number;
    blocked_count: number;
    status: string;
    mode: string;
    dry_run: true;
    submission_allowed: false;
    queue_insert_allowed: false;
    execution_allowed: false;
    publishing_allowed: false;
  } | null;
  /** Agent #168 — runtime shadow queue */
  shadow_queue_status: string | null;
  latest_shadow_queue: {
    shadow_queue_id: string | null;
    submission_id: string | null;
    submission_checksum: string | null;
    received_timestamp: string | null;
    next_safe_action: string | null;
  } | null;
  shadow_queue_health: {
    received_count: number;
    status: string;
    mode: string;
    shadow: true;
    dispatch_allowed: false;
    execution_allowed: false;
    publishing_allowed: false;
  } | null;
  /** Agent #169 — runtime plan */
  runtime_plan_status: string | null;
  latest_runtime_plan: {
    runtime_plan_id: string | null;
    shadow_queue_id: string | null;
    plan_checksum: string | null;
    plan_status: string | null;
    next_safe_action: string | null;
  } | null;
  runtime_plan_health: {
    plan_count: number;
    ready_count: number;
    blocked_count: number;
    status: string;
    mode: string;
    planning_only: true;
    dispatch_allowed: false;
    execution_allowed: false;
    publishing_allowed: false;
  } | null;
  /** Agent #170 — runtime release gate */
  runtime_release_status: string | null;
  pending_runtime_release: boolean;
  latest_runtime_release: {
    release_id: string | null;
    decision: string | null;
    runtime_plan_id: string | null;
    plan_checksum: string | null;
    next_safe_action: string | null;
  } | null;
  runtime_release_health: {
    pending_count: number;
    approved_count: number;
    rejected_count: number;
    status: string;
    mode: string;
    execution_allowed: false;
    dispatch_allowed: false;
    publishing_allowed: false;
  } | null;
  /** Agent #171 — system readiness freeze */
  system_readiness_status: string | null;
  latest_system_readiness: {
    certificate_id: string | null;
    certificate_status: string | null;
    readiness_score: number | null;
    architecture_version: string | null;
    governance_version: string | null;
    next_safe_action: string | null;
  } | null;
  system_readiness_health: {
    certificate_count: number;
    ready_count: number;
    blocked_count: number;
    status: string;
    mode: string;
    safety_flags: {
      execution_allowed: false;
      dispatch_allowed: false;
      scheduler_allowed: false;
      worker_execution_allowed: false;
      queue_insert_allowed: false;
      provider_allowed: false;
      publishing_allowed: false;
      live_enabled: false;
    };
  } | null;
  /** Agent #179 — execution controller scaffold */
  execution_controller_status: string | null;
  pending_execution_controller: boolean;
  latest_execution_controller: {
    controller_id: string | null;
    controller_status: string | null;
    mission_id: string | null;
    runtime_plan_id: string | null;
    runtime_release_id: string | null;
    system_readiness_id: string | null;
    plan_checksum: string | null;
    readiness_checksum: string | null;
    next_safe_action: string | null;
  } | null;
  execution_controller_health: {
    pending_count: number;
    ready_count: number;
    blocked_count: number;
    record_count: number;
    status: string;
    mode: string;
    safety_flags: {
      execution_allowed: false;
      dispatch_allowed: false;
      worker_spawn_allowed: false;
      queue_insert_allowed: false;
      provider_allowed: false;
      publishing_allowed: false;
      live_enabled: false;
      scheduler_allowed: false;
    };
  } | null;
  /** Agent #180 — department SDK registry */
  department_registry_status: string | null;
  department_registry: {
    department_count: number;
    ready_count: number;
    placeholder_count: number;
    reference_department_id: string | null;
    department_ids: string[];
    next_safe_action: string | null;
  } | null;
  department_registry_health: {
    registered_count: number;
    validated_count: number;
    ready_count: number;
    status: string;
    mode: string;
    safety_flags: {
      execution_allowed: false;
      dispatch_allowed: false;
      worker_spawn_allowed: false;
      provider_allowed: false;
      publishing_allowed: false;
      live_enabled: false;
    };
  } | null;
  /** Agent #181 — cost ledger scaffold */
  cost_ledger_status: string | null;
  cost_ledger: {
    budget_count: number;
    session_count: number;
    ready_budget_count: number;
    open_session_count: number;
    latest_session_id: string | null;
    latest_budget_id: string | null;
    next_safe_action: string | null;
  } | null;
  cost_ledger_health: {
    budget_count: number;
    session_count: number;
    status: string;
    mode: string;
    billing: false;
    safety_flags: {
      execution_allowed: false;
      billing_allowed: false;
      provider_allowed: false;
      publishing_allowed: false;
      live_enabled: false;
    };
  } | null;
  /** Agent #182 — worker runtime contract */
  worker_runtime_status: string | null;
  worker_runtime: {
    runtime_count: number;
    assignment_count: number;
    session_count: number;
    authorized_count: number;
    latest_runtime_id: string | null;
    next_safe_action: string | null;
  } | null;
  worker_runtime_health: {
    runtime_count: number;
    assignment_count: number;
    session_count: number;
    status: string;
    mode: string;
    worker_spawn: false;
    safety_flags: {
      execution_allowed: false;
      worker_spawn_allowed: false;
      child_process_allowed: false;
      provider_allowed: false;
      publishing_allowed: false;
      live_enabled: false;
    };
  } | null;
  /** Agent #183 — telemetry contract */
  telemetry_registry_status: string | null;
  telemetry_registry: {
    session_count: number;
    timeline_count: number;
    correlation_count: number;
    snapshot_count: number;
    event_catalogue_count: number;
    latest_session_id: string | null;
    next_safe_action: string | null;
  } | null;
  telemetry_registry_health: {
    session_count: number;
    timeline_count: number;
    correlation_count: number;
    status: string;
    mode: string;
    collection: false;
    emission: false;
    safety_flags: {
      execution_allowed: false;
      collection_allowed: false;
      emission_allowed: false;
      provider_allowed: false;
      publishing_allowed: false;
      live_enabled: false;
    };
  } | null;
  /** Agent #185 — activation gate eligibility */
  activation_gate_status: string | null;
  activation_gate: {
    activation_count: number;
    eligible_count: number;
    blocked_count: number;
    certificate_count: number;
    latest_activation_id: string | null;
    latest_mission_id: string | null;
    latest_status: string | null;
    overall_score: number | null;
    next_safe_action: string | null;
  } | null;
  activation_gate_health: {
    activation_count: number;
    eligible_count: number;
    blocked_count: number;
    certificate_count: number;
    status: string;
    mode: string;
    safety_flags: {
      execution_allowed: false;
      dispatch_allowed: false;
      worker_spawn_allowed: false;
      provider_allowed: false;
      publishing_allowed: false;
      live_enabled: false;
      activation_enables_execution: false;
    };
  } | null;
  /** Agent #186 — founder execution authorization intent */
  execution_authorization_status: string | null;
  execution_authorization: {
    authorization_count: number;
    waiting_count: number;
    authorized_count: number;
    rejected_count: number;
    certificate_count: number;
    latest_authorization_id: string | null;
    latest_mission_id: string | null;
    latest_status: string | null;
    next_safe_action: string | null;
  } | null;
  execution_authorization_health: {
    authorization_count: number;
    waiting_count: number;
    authorized_count: number;
    rejected_count: number;
    certificate_count: number;
    status: string;
    mode: string;
    safety_flags: {
      execution_allowed: false;
      dispatch_allowed: false;
      worker_spawn_allowed: false;
      provider_allowed: false;
      publishing_allowed: false;
      live_enabled: false;
      authorization_enables_execution: false;
      overrides_activation_gate: false;
    };
  } | null;
  /** Agent #187 — pre-dispatch simulation */
  pre_dispatch_simulation_status: string | null;
  pre_dispatch_simulation: {
    simulation_count: number;
    complete_count: number;
    blocked_count: number;
    certificate_count: number;
    latest_simulation_id: string | null;
    latest_mission_id: string | null;
    latest_status: string | null;
    overall_readiness: number | null;
    next_safe_action: string | null;
  } | null;
  pre_dispatch_simulation_health: {
    simulation_count: number;
    complete_count: number;
    blocked_count: number;
    certificate_count: number;
    status: string;
    mode: string;
    safety_flags: {
      execution_allowed: false;
      dispatch_allowed: false;
      queue_insert_allowed: false;
      worker_spawn_allowed: false;
      provider_allowed: false;
      publishing_allowed: false;
      billing_allowed: false;
      live_enabled: false;
      simulation_only: true;
    };
  } | null;
};

export type DashboardSnapshot = {
  generated_at: string;
  last_refreshed: string;
  top_bar: TopBarState;
  departments: DepartmentRow[];
  cycles: CycleItem[];
  exceptions: ExceptionItem[];
  founder_actions: FounderAction[];
  knowledge_domains: KnowledgeDomainRow[];
  knowledge_snapshot: {
    snapshot_id: string | null;
    domains: string[];
    references: string[];
    available: boolean;
  };
  skills: SkillRow[];
  skill_count: number;
  activity: ActivityEvent[];
  brain_path: BrainNode[];
  resume: ResumeDepartmentView;
  critic: CriticScoresView | null;
  production_cycle: ProductionCycleView | null;
  provider_validation: ProviderValidationViewData | null;
  company_brain: CompanyBrainViewData | null;
  review_queue: FounderReviewQueueItem[];
  system_pulse_active: boolean;
  sources: DataSourceState[];
  security: {
    read_only: true;
    secrets_redacted: true;
    telegram_unchanged: true;
    live_controls_disabled: true;
    auth_required_before_vps: true;
  };
};
