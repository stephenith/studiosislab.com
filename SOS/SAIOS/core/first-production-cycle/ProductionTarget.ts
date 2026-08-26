/**
 * Canonical Resume Production Target — Agent #205.
 * Resume Factory intake ownership: what to build next (deterministic).
 * Design style remains DesignBriefEngine responsibility.
 */
export type ProductionCategory =
  | "ats"
  | "executive"
  | "creative"
  | "student"
  | "healthcare"
  | "marketing"
  | "finance"
  | "engineering"
  | "resume_refresh"
  | "seo_expansion";

export type ProductionSeniority =
  | "entry"
  | "mid"
  | "senior"
  | "executive"
  | "student";

/** Traceability when target was derived from Production Strategy Engine (#217). */
export type ProductionTargetStrategyMeta = {
  goal_id: string;
  strategy_version: number;
  priority: number;
  strategy_reason: string;
  strategy_source: string;
};

export type ProductionTarget = {
  category: ProductionCategory;
  title: string;
  industry: string;
  seniority: ProductionSeniority;
  objective: string;
  /** Snake-case role hint for SkillRequest input (not a design decision). */
  role_family: string;
  /** Present when Intake consumed a strategy recommendation (Agent #217). */
  goal_id?: string;
  strategy_version?: number;
  priority?: number;
  strategy_reason?: string;
  strategy_source?: string;
};

/** Backward-compatible default — matches pre-#205 hardcoded Marketing Manager cycle. */
export const DEFAULT_PRODUCTION_TARGET: ProductionTarget = {
  category: "marketing",
  title: "Marketing Manager",
  industry: "marketing",
  seniority: "mid",
  objective:
    "Produce an ATS-friendly Marketing Manager resume construction cycle (dry-run)",
  role_family: "marketing_manager",
};

export type CategoryCoverage = {
  category: ProductionCategory;
  catalog_count: number;
  draft_count: number;
  waiting_founder: number;
  recent_jobs: number;
  saturation_score: number;
  priority_boost: number;
};

export type ProductionGoalSeed = {
  id: string;
  category: ProductionCategory;
  enabled: boolean;
  priority: "P0" | "P1" | "P2" | "P3";
  objective_template: string;
};
