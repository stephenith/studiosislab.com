/**
 * Resume Learning Engine — shared types
 */

export const LEARNING_CATEGORIES = [
  "spacing",
  "alignment",
  "typography",
  "ats",
  "color",
  "layout",
  "hierarchy",
  "section_ordering",
  "readability",
  "whitespace",
  "branding",
  "visual_balance",
] as const;

export type LearningCategory = (typeof LEARNING_CATEGORIES)[number];

export type FeedbackSentiment = "negative" | "positive" | "neutral";
export type FeedbackAction = "increase" | "decrease" | "prefer" | "avoid" | "reorder" | "improve";

export type StructuredFeedback = {
  id: string;
  raw: string;
  template_id: string;
  founder_decision: "approved" | "rejected" | "revision";
  categories: LearningCategory[];
  sentiment: FeedbackSentiment;
  action: FeedbackAction;
  signals: string[];
  parsed_at: string;
};

export type LearnedPattern = {
  id: string;
  category: LearningCategory;
  pattern: string;
  action: FeedbackAction;
  occurrences: number;
  confidence: number;
  first_seen: string;
  last_seen: string;
  example_feedback: string[];
};

export type DesignMemory = {
  version: string;
  updated_at: string;
  accepted_layouts: string[];
  rejected_layouts: string[];
  preferred_spacing: { min_section_gap_px: number; min_paragraph_gap_px: number; margin_px: number };
  preferred_typography: { font_families: string[]; min_body_pt: number; heading_scale: number };
  preferred_colors: { accent: string[]; avoid: string[]; body_text: string };
  preferred_sections: { order: string[]; elevate: string[] };
  preferred_visual_density: "compact" | "balanced" | "spacious";
  preferred_ats_score: number;
  preferred_visual_score: number;
  feedback_count: number;
};

export type LearnedRule = {
  id: string;
  category: LearningCategory;
  recommendation: string;
  priority: "high" | "medium" | "low";
  source: "founder_learning";
  derived_from: string[];
  confidence: number;
};

export type LearnedRulesLayer = {
  version: string;
  layer: "founder_learning";
  base_standards_preserved: true;
  updated_at: string;
  rules: LearnedRule[];
  consumption_note: "Resume Workers must load Base Standards → Intelligence → this layer before generation";
};

export type QualityHistory = {
  templates_generated: number;
  founder_approvals: number;
  founder_rejections: number;
  founder_revisions: number;
  approval_percentage: number;
  most_common_corrections: { category: LearningCategory; count: number }[];
  recurring_mistakes: string[];
  design_trends: string[];
  reviews: {
    template_id: string;
    decision: string;
    feedback: string;
    at: string;
  }[];
};

export type ConfidenceScore = {
  template_id: string;
  overall_confidence: number;
  components: {
    ats: number;
    design_quality: number;
    historical_approval: number;
    similarity_to_approved: number;
  };
  computed_at: string;
};

export type LearningRunResult = {
  pass: boolean;
  feedback_processed: number;
  patterns_extracted: number;
  rules_generated: number;
  memory_updated: boolean;
  output_dir: string;
};
