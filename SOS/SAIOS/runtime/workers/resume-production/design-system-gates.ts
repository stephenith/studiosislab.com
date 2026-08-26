/**
 * Design System quality gates — must pass before Fabric JSON generation.
 */
import type { ProductionDesignBundle } from "./design-bundle.js";

export type DesignSystemGatesResult = {
  pass: boolean;
  checked_at: string;
  checks: {
    typography_loaded: boolean;
    spacing_loaded: boolean;
    grid_loaded: boolean;
    component_library_loaded: boolean;
    ats_rules_loaded: boolean;
    accessibility_loaded: boolean;
  };
};

export function validateDesignSystemGates(
  bundle: ProductionDesignBundle,
): DesignSystemGatesResult {
  const ds = bundle.design_system;

  const checks = {
    typography_loaded: ds.typography.roles.length >= 7,
    spacing_loaded: ds.spacing.scale.length >= 10,
    grid_loaded: ds.grid.layouts.length >= 9,
    component_library_loaded: ds.components.components.length >= 16,
    ats_rules_loaded: ds.ats.component_rules.length >= 5,
    accessibility_loaded: ds.accessibility.minimum_contrast_ratio >= 4.5,
  };

  return {
    pass: Object.values(checks).every(Boolean),
    checked_at: new Date().toISOString(),
    checks,
  };
}
