/**
 * Hierarchy intelligence — section order, emphasis, typography ladder.
 */
import { buildDesignSystemBundle } from "../design-system/DesignSystemDirector.js";
import type { CompositionMode, HierarchyStrategy } from "./types.js";
import type { IndustryId } from "../research/types.js";
import { DEFAULT_SECTION_ORDER } from "./ComponentLibrary.js";

export function buildHierarchyStrategy(input: {
  industry: IndustryId;
  mode: CompositionMode;
  seed: number;
}): HierarchyStrategy {
  const system = buildDesignSystemBundle(true);
  const ladder = system.hierarchy.ladder;

  const base = [...DEFAULT_SECTION_ORDER];
  let section_order: string[];

  if (input.industry === "software" || input.industry === "engineering") {
    section_order = rotateOrder(base, input.seed, ["projects", "skills"]);
  } else if (input.industry === "student") {
    section_order = [
      "header",
      "education",
      "projects",
      "skills",
      "experience",
      "certification",
      "contact",
      "footer",
    ];
  } else if (input.mode === "executive") {
    section_order = [
      "header",
      "professional_summary",
      "experience",
      "achievements",
      "education",
      "skills",
      "contact",
      "footer",
    ];
  } else {
    section_order = rotateOrder(base, input.seed);
  }

  const emphasis: Record<string, number> = {};
  const focal = system.visual_language.focal_weights;
  for (const section of section_order) {
    emphasis[section] =
      section === "header"
        ? focal.header
        : section === "experience"
          ? focal.experience
          : section === "professional_summary"
            ? focal.summary
            : focal.supporting;
  }

  const nameLevel = ladder.find((l) => l.level === "name");
  const sectionLevel = ladder.find((l) => l.level === "section_heading");

  return {
    section_order,
    emphasis_weights: emphasis,
    header_prominence:
      (nameLevel?.size_pt ?? 32) >= 36 ? "high" : input.mode === "executive" ? "high" : "medium",
    footer_prominence: "low",
    justification: [
      `Section order optimized for ${input.industry} recruiter scan path`,
      `Name ${nameLevel?.size_pt ?? "?"}pt / section ${sectionLevel?.size_pt ?? "?"}pt from design-system hierarchy`,
      `Design DNA scan path: ${system.design_dna.resolved.scan_path.slice(0, 4).join(" → ")}`,
      input.mode === "ats"
        ? "ATS mode: experience before decorative sections"
        : "Premium mode: summary elevated",
    ],
  };
}

function rotateOrder(base: string[], seed: number, swapSections?: string[]): string[] {
  const order = [...base];
  if (swapSections && swapSections.length >= 2) {
    const a = order.indexOf(swapSections[0]!);
    const b = order.indexOf(swapSections[1]!);
    if (a >= 0 && b >= 0) {
      [order[a], order[b]] = [order[b]!, order[a]!];
    }
  }
  const shift = seed % Math.max(1, order.length - 4);
  if (shift > 0) {
    const mid = order.splice(2, 3);
    order.splice(2 + shift, 0, ...mid);
  }
  return order;
}
