/**
 * Section priority engine — order and weight per industry.
 */
import type { IndustryId } from "../research/types.js";

export function resolveSectionPriority(industry: IndustryId): {
  section_order: string[];
  section_priority: Record<string, number>;
} {
  const defaults = ["summary", "experience", "education", "skills", "certifications"];

  const orders: Partial<Record<IndustryId, string[]>> = {
    student: ["summary", "education", "experience", "skills", "projects"],
    academic: ["summary", "education", "publications", "experience", "skills"],
    healthcare: ["summary", "licenses", "experience", "education", "skills"],
    executive: ["summary", "experience", "leadership", "education", "skills"],
    creative: ["summary", "experience", "skills", "education", "portfolio"],
  };

  const section_order = orders[industry] ?? defaults;
  const section_priority: Record<string, number> = {};
  section_order.forEach((s, i) => {
    section_priority[s] = 100 - i * 12;
  });

  return { section_order, section_priority };
}
