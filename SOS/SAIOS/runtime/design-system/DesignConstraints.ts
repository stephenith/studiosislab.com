/**
 * Design constraints — global limits and invariants.
 */
import { DESIGN_STANDARDS } from "../../domain/studiosislab/resume/DesignStandards.js";
import { RESUME_GENERATION_SPECIFICATION } from "../../domain/studiosislab/resume/ResumeGenerationSpecification.js";
import { DESIGN_SYSTEM_VERSION } from "./types.js";

export function buildDesignConstraints() {
  return {
    version: DESIGN_SYSTEM_VERSION,
    canvas: RESUME_GENERATION_SPECIFICATION.canvas,
    domain_standards: [...DESIGN_STANDARDS],
    invariants: [
      "Single source of truth for spacing, typography, layouts, colors",
      "All spacing values from approved scale",
      "No negative coordinates on content objects",
      "Maximum 2 font families per template",
      "Publication requires founder approval — never auto-publish",
    ],
    forbidden: [
      "Inventing spacing outside the scale",
      "Custom typography not mapped to roles",
      "Multi-column layouts in ATS tier without QA",
      "Duplicating domain logic — import from domain layer",
    ],
    generated_at: new Date().toISOString(),
  };
}
