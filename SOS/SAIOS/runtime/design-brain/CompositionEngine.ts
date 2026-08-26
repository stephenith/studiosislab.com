/**
 * Composition engine — layout family and structural composition.
 */
import { selectDesignFamily } from "../workers/resume-production/family-selector.js";
import { loadResumeIntelligenceEngine } from "../../domain/studiosislab/resume/intelligence/ResumeIntelligenceEngine.js";
import type { IndustryStyleDecision } from "./IndustryStyleEngine.js";
import type { GridSystem } from "./types.js";

export type CompositionDecision = {
  layout_family: string;
  layout_family_display: string;
  structure: string;
  column_strategy: string;
  reasoning: string[];
};

export function resolveComposition(
  objective: string,
  style: IndustryStyleDecision,
  grid: GridSystem,
): CompositionDecision {
  const intelligence = loadResumeIntelligenceEngine();
  const family = selectDesignFamily(objective, intelligence.database.design_families);

  const structure =
    grid.columns === 1 ? "single-column-vertical" : "sidebar-accent-dual";

  return {
    layout_family: family.selected_family_id,
    layout_family_display: family.display_name,
    structure,
    column_strategy: grid.columns === 1 ? "ATS-safe single column" : "Hybrid with sidebar accent",
    reasoning: [
      ...family.rationale.slice(0, 3),
      `Grid: ${grid.columns} column(s), ${grid.base_unit_px}px base unit`,
      style.ats_mode === "ats_first"
        ? "Composition favors parse reliability over decoration"
        : "Composition allows moderate visual expression",
    ],
  };
}
