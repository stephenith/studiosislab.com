/**
 * Critic Gate contracts — Agent #131.
 * Hard gate between Resume Critic and Founder Review.
 */

export type CriticGateResult = {
  gate_id: string;
  task_id: string;
  cycle_id: string;
  candidate_id: string;
  candidate_title: string;
  critic_report_reference: string;
  overall_score: number;
  ats_score: number;
  visual_score: number;
  typography_score: number;
  layout_score: number;
  technical_score: number;
  consistency_score: number;
  section_score: number;
  ready: boolean;
  blocking_reasons: string[];
  warnings: string[];
  evaluated_at: string;
  dry_run: true;
  founder_review_allowed: boolean;
  publication_allowed: false;
  fixture?: boolean;
};

export type BlockedCandidate = {
  candidate_id: string;
  task_id: string;
  cycle_id: string;
  candidate_title: string;
  gate_id: string;
  overall_score: number;
  ats_score: number;
  technical_score: number;
  critic_scores: {
    overall: number;
    ats: number;
    visual: number;
    typography: number;
    layout: number;
    technical: number;
    consistency: number;
    sections: number;
  };
  blocking_reasons: string[];
  failed_rules: string[];
  remediation_recommendation: string;
  created_at: string;
  status: "BLOCKED_BY_CRITIC";
  dry_run: true;
  fixture?: boolean;
};

export type RemediationProposal = {
  proposal_id: string;
  candidate_id: string;
  task_id: string;
  title: string;
  detail: string;
  blocking_reasons: string[];
  created_at: string;
  status: "proposed";
  auto_execute: false;
  fixture?: boolean;
};

export type CriticScoresSnapshot = {
  overall: number;
  ats: number;
  visual: number;
  typography: number;
  layout: number;
  technical: number;
  consistency: number;
  sections: number;
  ready: boolean;
  blocked_reasons?: string[];
  generated_at?: string;
};

export type CriticGateInput = {
  task_id: string;
  cycle_id: string;
  candidate_id: string;
  candidate_title: string;
  critic_report_reference?: string;
  scores: CriticScoresSnapshot;
  fixture?: boolean;
};

export type GateEventType =
  | "CRITIC_EVALUATION_COMPLETED"
  | "CRITIC_GATE_PASSED"
  | "CRITIC_GATE_BLOCKED"
  | "FOUNDER_REVIEW_ALLOWED"
  | "FOUNDER_REVIEW_BLOCKED"
  | "REMEDIATION_PROPOSED";

export const GATE_THRESHOLDS = {
  overall_min: 90,
  ats_min: 95,
  technical_required: 100,
} as const;
