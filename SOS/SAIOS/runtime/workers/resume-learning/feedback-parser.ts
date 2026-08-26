/**
 * Parse natural-language founder feedback into structured learning signals.
 */
import { randomUUID } from "node:crypto";
import type {
  FeedbackAction,
  FeedbackSentiment,
  LearningCategory,
  StructuredFeedback,
} from "./types.js";

type FeedbackRule = {
  patterns: RegExp[];
  categories: LearningCategory[];
  sentiment: FeedbackSentiment;
  action: FeedbackAction;
  signals: string[];
};

const RULES: FeedbackRule[] = [
  {
    patterns: [/spacing.*tight/i, /too tight/i, /cramped/i],
    categories: ["spacing", "whitespace"],
    sentiment: "negative",
    action: "increase",
    signals: ["increase_section_gap", "increase_paragraph_gap"],
  },
  {
    patterns: [/header.*crowd/i, /crowded.*header/i, /header feels/i],
    categories: ["layout", "hierarchy", "whitespace"],
    sentiment: "negative",
    action: "increase",
    signals: ["increase_header_breathing", "reduce_header_density"],
  },
  {
    patterns: [/less blue/i, /too much blue/i, /reduce blue/i],
    categories: ["color", "branding"],
    sentiment: "negative",
    action: "decrease",
    signals: ["reduce_accent_blue", "limit_accent_usage"],
  },
  {
    patterns: [/better typography/i, /improve typography/i, /typography/i],
    categories: ["typography", "readability"],
    sentiment: "negative",
    action: "improve",
    signals: ["refine_font_scale", "improve_hierarchy"],
  },
  {
    patterns: [/improve ats/i, /better ats/i, /ats/i],
    categories: ["ats", "readability"],
    sentiment: "negative",
    action: "improve",
    signals: ["simplify_layout", "ats_safe_fonts", "standard_headings"],
  },
  {
    patterns: [/outdated/i, /dated/i, /old.?fashioned/i],
    categories: ["visual_balance", "branding", "typography"],
    sentiment: "negative",
    action: "improve",
    signals: ["modernize_layout", "refresh_typography"],
  },
  {
    patterns: [/more whitespace/i, /needs more whitespace/i, /more white space/i],
    categories: ["whitespace", "spacing"],
    sentiment: "negative",
    action: "increase",
    signals: ["increase_margins", "increase_vertical_rhythm"],
  },
  {
    patterns: [/move skills higher/i, /skills higher/i, /skills.*earlier/i],
    categories: ["section_ordering", "layout"],
    sentiment: "neutral",
    action: "reorder",
    signals: ["elevate_skills_section"],
  },
  {
    patterns: [/too many icons/i, /fewer icons/i, /less icons/i],
    categories: ["visual_balance", "ats", "branding"],
    sentiment: "negative",
    action: "decrease",
    signals: ["remove_decorative_icons", "text_over_icons"],
  },
  {
    patterns: [/too plain/i, /looks plain/i, /needs more visual/i],
    categories: ["visual_balance", "branding", "color"],
    sentiment: "negative",
    action: "increase",
    signals: ["add_subtle_accent", "improve_visual_interest"],
  },
  {
    patterns: [/align/i, /alignment/i, /misalign/i],
    categories: ["alignment", "layout"],
    sentiment: "negative",
    action: "improve",
    signals: ["tighten_gutter_alignment"],
  },
  {
    patterns: [/approve/i, /looks good/i, /great/i, /love it/i],
    categories: ["visual_balance"],
    sentiment: "positive",
    action: "prefer",
    signals: ["reinforce_current_direction"],
  },
];

export function parseFeedback(input: {
  raw: string;
  template_id: string;
  founder_decision?: "approved" | "rejected" | "revision";
}): StructuredFeedback {
  const raw = input.raw.trim();
  const categories = new Set<LearningCategory>();
  const signals = new Set<string>();
  let sentiment: FeedbackSentiment = "neutral";
  let action: FeedbackAction = "improve";

  for (const rule of RULES) {
    if (rule.patterns.some((p) => p.test(raw))) {
      rule.categories.forEach((c) => categories.add(c));
      rule.signals.forEach((s) => signals.add(s));
      if (rule.sentiment === "negative") sentiment = "negative";
      else if (rule.sentiment === "positive" && sentiment !== "negative") sentiment = "positive";
      action = rule.action;
    }
  }

  if (categories.size === 0) {
    categories.add("visual_balance");
    signals.add("general_founder_note");
  }

  const decision =
    input.founder_decision ??
    (sentiment === "positive" ? "approved" : sentiment === "negative" ? "revision" : "revision");

  return {
    id: randomUUID(),
    raw,
    template_id: input.template_id,
    founder_decision: decision,
    categories: [...categories],
    sentiment,
    action,
    signals: [...signals],
    parsed_at: new Date().toISOString(),
  };
}

export function parseFeedbackBatch(
  items: { raw: string; template_id: string; founder_decision?: StructuredFeedback["founder_decision"] }[],
): StructuredFeedback[] {
  return items.map((item) => parseFeedback(item));
}
