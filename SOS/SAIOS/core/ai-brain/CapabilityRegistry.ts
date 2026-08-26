/**
 * Capability registry — classifies what may reach an AI provider.
 */
import type {
  BrainCapability,
  CapabilityClass,
  DeterministicCapability,
  EconomicalCapability,
  QualityTier,
  StrongCapability,
} from "./types.js";

export const STRONG_CAPABILITIES: readonly StrongCapability[] = [
  "design_planning",
  "founder_feedback_interpretation",
  "complex_visual_critique",
  "failure_diagnosis",
  "production_strategy",
  "revision_planning",
  "revision_coverage_repair",
] as const;

export const ECONOMICAL_CAPABILITIES: readonly EconomicalCapability[] = [
  "task_classification",
  "structured_json_generation",
  "report_summarization",
  "log_interpretation",
  "duplicate_explanation",
  "status_reporting",
] as const;

export const DETERMINISTIC_CAPABILITIES: readonly DeterministicCapability[] = [
  "scheduling",
  "time_tracking",
  "catalog_id_assignment",
  "checksum",
  "dimension_validation",
  "ats_rule_validation",
  "publication_gate",
  "server_monitoring",
  "cost_arithmetic",
] as const;

export function classifyCapability(
  capability: BrainCapability,
): CapabilityClass {
  if ((STRONG_CAPABILITIES as readonly string[]).includes(capability)) {
    return "strong_reasoning";
  }
  if ((ECONOMICAL_CAPABILITIES as readonly string[]).includes(capability)) {
    return "economical_intelligence";
  }
  if ((DETERMINISTIC_CAPABILITIES as readonly string[]).includes(capability)) {
    return "deterministic_only";
  }
  throw new Error(`Unknown capability: ${capability}`);
}

export function isDeterministicOnly(capability: BrainCapability): boolean {
  return classifyCapability(capability) === "deterministic_only";
}

export function defaultTierForCapability(
  capability: BrainCapability,
): QualityTier {
  const cls = classifyCapability(capability);
  if (cls === "strong_reasoning") return "strong";
  if (cls === "economical_intelligence") return "economical";
  return "deterministic";
}

export function listAllCapabilities(): BrainCapability[] {
  return [
    ...STRONG_CAPABILITIES,
    ...ECONOMICAL_CAPABILITIES,
    ...DETERMINISTIC_CAPABILITIES,
  ];
}
