/**
 * Design validator — checks tokens, systems, and libraries for conflicts.
 */
import { SPACING_SCALE } from "./DesignTokens.js";
import type { DesignValidationResult, ValidationIssue } from "./types.js";
import type { DesignSystemBundle } from "./DesignSystemDirector.js";
import { validateDesignDNA } from "./DesignDNA.js";

function hasAtsFlags(obj: Record<string, unknown>): boolean {
  const required = ["ats_safe", "machine_readable", "text_order", "contrast_safe", "print_safe"];
  return required.every((k) => typeof obj[k] !== "undefined");
}

export function validateDesignSystem(bundle: DesignSystemBundle): DesignValidationResult {
  const issues: ValidationIssue[] = [];
  const checks: Record<string, boolean> = {};

  // Typography
  const typoRoles = bundle.typography.roles.map((r) => r.role);
  const uniqueRoles = new Set(typoRoles);
  checks.typography_system =
    uniqueRoles.size === typoRoles.length && bundle.typography.roles.length >= 7;
  if (!checks.typography_system) {
    issues.push({
      code: "TYPO_DUPLICATE_ROLE",
      severity: "error",
      message: "Typography roles must be unique and complete",
    });
  }
  for (const role of bundle.typography.roles) {
    if (role.size_pt < bundle.typography.text_density.min_body_pt && role.role === "body") {
      issues.push({
        code: "TYPO_BODY_TOO_SMALL",
        severity: "error",
        message: `Body size ${role.size_pt}pt below minimum`,
        path: `typography.${role.role}`,
      });
      checks.typography_system = false;
    }
  }

  // Spacing
  const spacingValues = bundle.spacing.scale;
  const spacingSorted = [...spacingValues].sort((a, b) => a - b);
  checks.spacing_system =
    spacingValues.length === 10 &&
    spacingValues.every((v, i) => v === spacingSorted[i]) &&
    spacingValues.every((v) => SPACING_SCALE.includes(v as (typeof SPACING_SCALE)[number]));
  if (!checks.spacing_system) {
    issues.push({
      code: "SPACING_INVALID_SCALE",
      severity: "error",
      message: "Spacing scale must match approved tokens",
    });
  }

  // Grid
  checks.grid_system =
    bundle.grid.layouts.length >= 9 &&
    bundle.grid.layouts.every((g) => g.gutter_px % 4 === 0 && g.margin_px >= 40);
  if (!checks.grid_system) {
    issues.push({
      code: "GRID_INVALID",
      severity: "error",
      message: "Grid layouts have invalid gutters or margins",
    });
  }

  // Layout library
  checks.layout_library =
    bundle.layout.layouts.length === bundle.grid.layouts.length &&
    bundle.layout.layouts.every((l) => l.margins_px >= 40);
  if (!checks.layout_library) {
    issues.push({
      code: "LAYOUT_INVALID",
      severity: "error",
      message: "Layout library inconsistent with grid system",
    });
  }

  // Component library
  checks.component_library =
    bundle.components.components.length >= 16 &&
    bundle.components.components.every((c) => hasAtsFlags(c as unknown as Record<string, unknown>));
  if (!checks.component_library) {
    issues.push({
      code: "COMPONENT_MISSING_ATS_FLAGS",
      severity: "error",
      message: "All components must expose ATS flags",
    });
  }

  // ATS rules
  checks.ats_rules =
    bundle.ats.component_rules.length >= 5 &&
    bundle.ats.required_flags.length === 5;
  if (!checks.ats_rules) {
    issues.push({
      code: "ATS_RULES_INCOMPLETE",
      severity: "error",
      message: "ATS rules incomplete",
    });
  }

  // Accessibility
  checks.accessibility =
    bundle.accessibility.minimum_contrast_ratio >= 4.5 &&
    bundle.accessibility.minimum_body_pt >= 10;
  if (!checks.accessibility) {
    issues.push({
      code: "ACCESSIBILITY_WEAK",
      severity: "error",
      message: "Accessibility thresholds not met",
    });
  }

  // Header variants
  if (bundle.headers.variants.length < 10) {
    issues.push({
      code: "HEADER_INCOMPLETE",
      severity: "error",
      message: "Header library requires 10 variants",
    });
    checks.component_library = false;
  }

  // Section variants
  if (bundle.sections.variants.length < 12) {
    issues.push({
      code: "SECTION_INCOMPLETE",
      severity: "error",
      message: "Section library requires 12 variants",
    });
    checks.component_library = false;
  }

  // Color palettes
  if (bundle.colors.palettes.length < 9) {
    issues.push({
      code: "COLOR_INCOMPLETE",
      severity: "error",
      message: "Color system requires 9 palettes",
    });
    checks.ats_rules = false;
  }

  // No conflicting spacing
  if (bundle.spacing.paragraph_spacing_px > bundle.spacing.section_spacing_px) {
    issues.push({
      code: "SPACING_CONFLICT",
      severity: "warning",
      message: "Paragraph spacing exceeds section spacing",
    });
  }

  checks.validator = issues.filter((i) => i.severity === "error").length === 0;

  const dnaValidation = validateDesignDNA(bundle.design_dna);
  checks.design_dna = dnaValidation.pass;
  if (!dnaValidation.pass) {
    for (const msg of dnaValidation.issues) {
      issues.push({ code: "DESIGN_DNA_INVALID", severity: "error", message: msg });
    }
  }

  const pass = Object.values(checks).every(Boolean);

  return {
    pass,
    validated_at: new Date().toISOString(),
    issues,
    checks: {
      ...checks,
      reports: true,
    },
  };
}
