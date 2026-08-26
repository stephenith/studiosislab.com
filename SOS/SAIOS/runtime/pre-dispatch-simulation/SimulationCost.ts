/**
 * SimulationCost — Agent #187.
 * Estimate only. No billing / provider / API / spend.
 */
import type { SimulationCostEstimate } from "./SimulationTypes.js";

export function buildCostEstimate(input?: {
  worker_count?: number;
  step_count?: number;
}): SimulationCostEstimate {
  const workers = input?.worker_count ?? 1;
  const steps = input?.step_count ?? 17;
  const estimated_tokens = workers * steps * 100;
  return {
    currency: "USD",
    estimated_tokens,
    estimated_usd: Number((estimated_tokens * 0.000002).toFixed(6)),
    billing: false,
    provider_usage: false,
    api_usage: false,
    spend: false,
  };
}

export function assertCostIntegrity(cost: SimulationCostEstimate): boolean {
  return (
    cost.billing === false &&
    cost.provider_usage === false &&
    cost.api_usage === false &&
    cost.spend === false &&
    cost.estimated_usd >= 0
  );
}
