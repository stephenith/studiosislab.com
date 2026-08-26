#!/usr/bin/env tsx
/**
 * Resume Design System verification.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  RESUME_DESIGN_SYSTEM,
  runDesignSystem,
} from "./DesignSystemDirector.js";
import { DESIGN_SYSTEM_OUTPUT_ROOT } from "./Reports.js";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

const REQUIRED_ARTIFACTS = [
  "design-system.json",
  "design-tokens.json",
  "spacing-rules.json",
  "typography-rules.json",
  "grid-library.json",
  "layout-library.json",
  "component-library.json",
  "ats-rules.json",
  "accessibility.json",
  "validation.json",
  "design-system-report.md",
  "DesignDNAReport.md",
  "DesignDNALearning.json",
  "DesignDNAValidation.json",
  "design-dna.json",
];

async function main(): Promise<void> {
  assert(RESUME_DESIGN_SYSTEM.module === "resume-design-system", "module id");
  assert(RESUME_DESIGN_SYSTEM.role === "single_source_of_truth", "role");

  const result = await runDesignSystem({ persist: true });
  assert(result.pass, "design system validation");

  for (const file of REQUIRED_ARTIFACTS) {
    assert(existsSync(join(DESIGN_SYSTEM_OUTPUT_ROOT, file)), `artifact: ${file}`);
  }

  const validation = JSON.parse(
    readFileSync(join(DESIGN_SYSTEM_OUTPUT_ROOT, "validation.json"), "utf8"),
  ) as { pass: boolean; checks: Record<string, boolean> };

  assert(validation.pass, "validation.json pass");
  assert(validation.checks.typography_system === true, "typography system");
  assert(validation.checks.spacing_system === true, "spacing system");
  assert(validation.checks.grid_system === true, "grid system");
  assert(validation.checks.layout_library === true, "layout library");
  assert(validation.checks.component_library === true, "component library");
  assert(validation.checks.ats_rules === true, "ATS rules");
  assert(validation.checks.accessibility === true, "accessibility");
  assert(validation.checks.validator === true, "validator");
  assert(validation.checks.design_dna === true, "design dna system");

  const dnaValidation = JSON.parse(
    readFileSync(join(DESIGN_SYSTEM_OUTPUT_ROOT, "DesignDNAValidation.json"), "utf8"),
  ) as { pass: boolean; checks: Record<string, boolean> };
  assert(dnaValidation.pass, "DesignDNAValidation.json pass");
  assert(dnaValidation.checks.concept_count_min_30 === true, "dna concept count");

  const components = JSON.parse(
    readFileSync(join(DESIGN_SYSTEM_OUTPUT_ROOT, "component-library.json"), "utf8"),
  ) as { components: Array<Record<string, unknown>> };

  for (const c of components.components) {
    assert(typeof c.ats_safe === "boolean", `component ${c.id} ats_safe`);
    assert(typeof c.machine_readable === "boolean", `component ${c.id} machine_readable`);
    assert(typeof c.text_order === "string", `component ${c.id} text_order`);
    assert(typeof c.contrast_safe === "boolean", `component ${c.id} contrast_safe`);
    assert(typeof c.print_safe === "boolean", `component ${c.id} print_safe`);
  }

  console.log(
    JSON.stringify(
      {
        pass: true,
        component: "resume-design-system",
        version: result.version,
        output_dir: result.output_dir,
        summary: result.summary,
        checks: {
          typography_system: true,
          spacing_system: true,
          grid_system: true,
          layout_library: true,
          component_library: true,
          ats_rules: true,
          accessibility: true,
          validator: true,
          design_dna: true,
          reports: true,
        },
        overall: "PASS",
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(JSON.stringify({ pass: false, error: String(err) }, null, 2));
  process.exit(1);
});
