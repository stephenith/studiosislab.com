/**
 * Production executor — delegates to Unified Resume Production Engine.
 * Agent #160: LEGACY bypass — guarded by runtime freeze.
 */
import { runUnifiedProduction } from "../unified-production/UnifiedProductionDirector.js";
import type { ProductionCategory, ProductionExecutor, ProductionExecutorResult } from "./types.js";
import { ENGINES, enforceEngineAccess } from "../../architecture/runtime-guard.js";

export const defaultProductionExecutor: ProductionExecutor = async (input) => {
  enforceEngineAccess(ENGINES.LEGACY_PRODUCTION_EXECUTOR);
  const result = await runUnifiedProduction({
    objective: input.objective,
    seed: input.seed ?? Date.now() % 10000,
    mcp_firecrawl_available: true,
    learning_persist: true,
  });

  return {
    pass: result.pass,
    run_id: result.run_id,
    status: result.status,
    awaiting_founder: result.awaiting_founder,
    publication_automatic: false,
  };
};

export function createMockProductionExecutor(): ProductionExecutor {
  return async (input) => ({
    pass: true,
    run_id: `mock-unified-${input.job_id}`,
    status: "waiting_founder",
    awaiting_founder: true,
    publication_automatic: false,
  });
}

export function validateFounderGate(result: ProductionExecutorResult): void {
  if (result.publication_automatic) {
    throw new Error("Founder gate violated — automatic publication detected");
  }
  if (!result.awaiting_founder && result.pass) {
    throw new Error("Founder gate violated — production did not stop at founder approval");
  }
}

export function categoryToIndustry(category: ProductionCategory): string {
  const map: Partial<Record<ProductionCategory, string>> = {
    ats: "software",
    executive: "executive",
    creative: "creative",
    student: "student",
    healthcare: "healthcare",
    marketing: "marketing",
    finance: "finance",
    engineering: "engineering",
    resume_refresh: "software",
    seo_expansion: "marketing",
  };
  return map[category] ?? "software";
}
