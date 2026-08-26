/**
 * AI Brain — shared types (provider-neutral).
 * Agent #117 — contracts only; no SDK; no API calls.
 */

export type QualityTier =
  | "strong"
  | "economical"
  | "deterministic"
  | "local_preferred"
  | "provider_fallback";

export type CapabilityClass =
  | "strong_reasoning"
  | "economical_intelligence"
  | "deterministic_only";

export type PrivacyClassification =
  | "PUBLIC"
  | "INTERNAL"
  | "CONFIDENTIAL"
  | "HIGHLY_RESTRICTED";

export type ProviderId = "mock" | "openai" | "local" | "future_provider";

export type ReasoningStatus =
  | "COMPLETED"
  | "FAILED"
  | "REJECTED"
  | "BUDGET_PAUSED"
  | "VALIDATION_FAILED";

export type BrainEventType =
  | "BRAIN_REQUEST_CREATED"
  | "BRAIN_REQUEST_ROUTED"
  | "BRAIN_REQUEST_STARTED"
  | "BRAIN_REQUEST_RETRIED"
  | "BRAIN_FALLBACK_USED"
  | "BRAIN_REQUEST_COMPLETED"
  | "BRAIN_REQUEST_FAILED"
  | "BRAIN_BUDGET_WARNING"
  | "BRAIN_BUDGET_PAUSED"
  | "BRAIN_PROVIDER_UNHEALTHY";

export type NormalizedFailureCode =
  | "provider_unavailable"
  | "timeout"
  | "rate_limit"
  | "invalid_response"
  | "schema_validation_failure"
  | "budget_exceeded"
  | "safety_refusal"
  | "authentication_failure"
  | "local_endpoint_unavailable"
  | "deterministic_capability_rejected"
  | "privacy_policy_blocked"
  | "provider_disabled"
  | "unknown";

export type StrongCapability =
  | "design_planning"
  | "founder_feedback_interpretation"
  | "complex_visual_critique"
  | "failure_diagnosis"
  | "production_strategy"
  | "revision_planning"
  | "revision_coverage_repair";

export type EconomicalCapability =
  | "task_classification"
  | "structured_json_generation"
  | "report_summarization"
  | "log_interpretation"
  | "duplicate_explanation"
  | "status_reporting";

export type DeterministicCapability =
  | "scheduling"
  | "time_tracking"
  | "catalog_id_assignment"
  | "checksum"
  | "dimension_validation"
  | "ats_rule_validation"
  | "publication_gate"
  | "server_monitoring"
  | "cost_arithmetic";

export type BrainCapability =
  | StrongCapability
  | EconomicalCapability
  | DeterministicCapability;

export type Priority = "low" | "normal" | "high" | "critical";
