/**
 * Visual Benchmark Intelligence Engine — shared types.
 */

export const BENCHMARK_SOURCES = [
  "Resume.io",
  "Novoresume",
  "Enhancv",
  "Kickresume",
  "FlowCV",
  "Reactive Resume",
  "Canva",
  "Adobe Express",
  "Behance",
  "Dribbble",
  "Figma Community",
  "Awwwards",
  "CSS Design Awards",
  "Google Fonts",
  "Material Design",
  "Apple HIG",
  "Microsoft Fluent",
  "ATS recommendations",
  "Accessibility standards",
  "Hiring trends",
  "Recruiter preferences",
] as const;

export type BenchmarkSource = (typeof BENCHMARK_SOURCES)[number];

export type PrincipleCategory =
  | "layout"
  | "typography"
  | "spacing"
  | "color"
  | "hierarchy"
  | "industry"
  | "ats"
  | "accessibility"
  | "trend";

export type QualityMetrics = {
  popularity: number;
  professionalism: number;
  visual_appeal: number;
  modernity: number;
  ats_compatibility: number;
  accessibility: number;
  readability: number;
  premium_perception: number;
  originality: number;
  industry_fit: number;
  longevity: number;
  confidence: number;
  composite_score: number;
};

export type DesignPrinciple = {
  id: string;
  category: PrincipleCategory;
  principle: string;
  source: string;
  extracted_at: string;
  validated: boolean;
  metrics: QualityMetrics;
  tags: string[];
};

export type BenchmarkDatabase = {
  version: string;
  updated_at: string;
  run_id: string;
  principle_count: number;
  sources_studied: string[];
  principles: DesignPrinciple[];
};

export type TrendAnalysis = {
  analyzed_at: string;
  emerging_patterns: string[];
  declining_patterns: string[];
  ats_innovations: string[];
  premium_patterns: string[];
  industry_expectations: Record<string, string[]>;
};

export type QualityRanking = {
  ranked_at: string;
  top_principles: Array<{ id: string; principle: string; composite_score: number; category: PrincipleCategory }>;
  category_leaders: Record<PrincipleCategory, string | null>;
};

export type BenchmarkRunResult = {
  pass: boolean;
  run_id: string;
  run_dir: string;
  database: BenchmarkDatabase;
  trend_analysis: TrendAnalysis;
  quality_rankings: QualityRanking;
  principle_count: number;
  validation: BenchmarkValidation;
};

export type BenchmarkValidation = {
  pass: boolean;
  checks: Record<string, boolean>;
  errors: string[];
};

export type BenchmarkRunOptions = {
  focus_industry?: string;
  mcp_firecrawl_available?: boolean;
  persist?: boolean;
};
