/**
 * Generate learned rule layers — never overwrites base standards.
 */
import type { DesignMemory, LearnedPattern, LearnedRule, LearnedRulesLayer } from "./types.js";

const LEARNED_RULES_PATH_SUFFIX = "learned-rules.json";

export function generateLearnedRules(
  memory: DesignMemory,
  patterns: LearnedPattern[],
): LearnedRulesLayer {
  const rules: LearnedRule[] = [];

  for (const pattern of patterns.filter((p) => p.occurrences >= 1)) {
    const priority =
      pattern.occurrences >= 3 ? "high" : pattern.occurrences >= 2 ? "medium" : "low";
    rules.push({
      id: `learned-${pattern.id}`,
      category: pattern.category,
      recommendation: buildRecommendation(pattern),
      priority,
      source: "founder_learning",
      derived_from: pattern.example_feedback.slice(0, 3),
      confidence: Math.round(pattern.confidence * 100) / 100,
    });
  }

  if (memory.preferred_spacing.min_section_gap_px > 16) {
    rules.push({
      id: "learned-spacing-section-gap",
      category: "spacing",
      recommendation: `Use minimum ${memory.preferred_spacing.min_section_gap_px}px between sections (founder preference)`,
      priority: "high",
      source: "founder_learning",
      derived_from: ["aggregated spacing feedback"],
      confidence: 0.85,
    });
  }

  if (memory.preferred_colors.avoid.length > 0) {
    rules.push({
      id: "learned-color-avoid",
      category: "color",
      recommendation: `Avoid accent colors: ${memory.preferred_colors.avoid.join(", ")}`,
      priority: "high",
      source: "founder_learning",
      derived_from: ["founder color feedback"],
      confidence: 0.9,
    });
  }

  if (memory.preferred_sections.elevate.length > 0) {
    rules.push({
      id: "learned-section-elevate",
      category: "section_ordering",
      recommendation: `Elevate sections: ${memory.preferred_sections.elevate.join(", ")}`,
      priority: "medium",
      source: "founder_learning",
      derived_from: ["founder section ordering feedback"],
      confidence: 0.8,
    });
  }

  return {
    version: "1.0.0",
    layer: "founder_learning",
    base_standards_preserved: true,
    updated_at: new Date().toISOString(),
    rules: dedupeRules(rules),
    consumption_note:
      "Resume Workers must load Base Standards → Resume Intelligence → this layer before generation",
  };
}

function buildRecommendation(pattern: LearnedPattern): string {
  const actionVerb: Record<string, string> = {
    increase: "Increase",
    decrease: "Reduce",
    prefer: "Prefer",
    avoid: "Avoid",
    reorder: "Reorder",
    improve: "Improve",
  };
  const verb = actionVerb[pattern.action] ?? "Adjust";
  return `${verb} ${pattern.pattern.replace(/_/g, " ")} (${pattern.category})`;
}

function dedupeRules(rules: LearnedRule[]): LearnedRule[] {
  const seen = new Set<string>();
  return rules.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
}

export function getLearnedRulesPath(learningRoot: string): string {
  return `${learningRoot}/${LEARNED_RULES_PATH_SUFFIX}`.replace("//", "/");
}
