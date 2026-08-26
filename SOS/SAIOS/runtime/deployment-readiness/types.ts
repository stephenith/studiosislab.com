/**
 * Deployment Readiness Audit — types.
 * AGENT #113 — read-only validation before first VPS deploy
 */

export type CheckResult = {
  id: string;
  category: string;
  label: string;
  pass: boolean;
  weight: number;
  detail: string;
};

export type RiskItem = {
  id: string;
  level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  title: string;
  detail: string;
  mitigation: string;
};

export type VpsRecommendation = {
  minimum: {
    label: string;
    cpu: string;
    ram: string;
    disk: string;
    bandwidth: string;
    estimated_monthly_usd: [number, number];
  };
  recommended: {
    label: string;
    cpu: string;
    ram: string;
    disk: string;
    bandwidth: string;
    estimated_monthly_usd: [number, number];
  };
  node_version: string;
  ubuntu_version: string;
  estimated_capacity: string;
  notes: string[];
};

export type ScoreBreakdown = {
  category: string;
  score: number;
  max: number;
  pass_count: number;
  fail_count: number;
};

export type DeploymentReadinessResult = {
  generated_at: string;
  status: "READY" | "DEGRADED" | "BLOCKED";
  score: number;
  max_score: number;
  score_pct: number;
  checks: CheckResult[];
  risks: RiskItem[];
  breakdown: ScoreBreakdown[];
  vps: VpsRecommendation;
  checks_summary: Record<string, boolean>;
  output_dir: string;
};
