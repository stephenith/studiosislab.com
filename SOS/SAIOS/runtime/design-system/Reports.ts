/**
 * Reports — persist design system artifacts.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { DesignSystemBundle } from "./DesignSystemDirector.js";
import type { DesignValidationResult } from "./types.js";
import { DESIGN_SYSTEM_VERSION } from "./types.js";
import { validateDesignDNA, type DesignDNABundle } from "./DesignDNA.js";

const SOS_ROOT = resolve(import.meta.dirname, "../../..");
export const DESIGN_SYSTEM_OUTPUT_ROOT = join(SOS_ROOT, "07_LOGS/saios/design-system");
export const DESIGN_SYSTEM_REPORT_PATH = join(
  SOS_ROOT,
  "09_REPORTS/RESUME_DESIGN_SYSTEM_V1_REPORT.md",
);

export function persistDesignSystemReports(input: {
  bundle: DesignSystemBundle;
  designSystem: object;
  validation: DesignValidationResult;
  persist?: boolean;
}): { outputDir: string; artifacts: string[] } {
  const persist = input.persist !== false;
  const outputDir = DESIGN_SYSTEM_OUTPUT_ROOT;

  if (persist) mkdirSync(outputDir, { recursive: true });

  const files: [string, object][] = [
    ["design-system.json", input.designSystem],
    ["design-tokens.json", input.bundle.token_reference],
    ["spacing-rules.json", input.bundle.spacing],
    ["typography-rules.json", input.bundle.typography],
    ["grid-library.json", input.bundle.grid],
    ["layout-library.json", input.bundle.layout],
    ["component-library.json", input.bundle.components],
    ["ats-rules.json", input.bundle.ats],
    ["accessibility.json", input.bundle.accessibility],
    ["validation.json", input.validation],
    ["design-dna.json", input.bundle.design_dna],
  ];

  const artifacts: string[] = [];
  for (const [name, content] of files) {
    const path = join(outputDir, name);
    if (persist) writeFileSync(path, JSON.stringify(content, null, 2));
    artifacts.push(name);
  }

  const reportMd = buildDesignSystemReportMd(input.bundle, input.validation);
  const reportPath = join(outputDir, "design-system-report.md");
  if (persist) writeFileSync(reportPath, reportMd);
  artifacts.push("design-system-report.md");

  const dnaReport = buildDesignDNAReportMd(input.bundle.design_dna);
  const dnaReportPath = join(outputDir, "DesignDNAReport.md");
  if (persist) writeFileSync(dnaReportPath, dnaReport);
  artifacts.push("DesignDNAReport.md");

  const dnaValidation = validateDesignDNA(input.bundle.design_dna);
  const dnaValidationPath = join(outputDir, "DesignDNAValidation.json");
  if (persist) {
    writeFileSync(
      dnaValidationPath,
      JSON.stringify(
        {
          validated_at: new Date().toISOString(),
          dna_version: input.bundle.design_dna.version,
          concept_count: input.bundle.design_dna.concept_count,
          ...dnaValidation,
        },
        null,
        2,
      ),
    );
  }
  artifacts.push("DesignDNAValidation.json");

  const dnaLearningPath = join(outputDir, "DesignDNALearning.json");
  if (persist) {
    writeFileSync(
      dnaLearningPath,
      JSON.stringify(
        {
          updated_at: new Date().toISOString(),
          agent: "080",
          dna_version: input.bundle.design_dna.version,
          principles: input.bundle.design_dna.principles,
          brain_directives: input.bundle.design_dna.brain_directives,
          intelligence_questions: input.bundle.design_dna.intelligence_questions.slice(0, 12),
          resolved: input.bundle.design_dna.resolved,
          append_only: true,
        },
        null,
        2,
      ),
    );
  }
  artifacts.push("DesignDNALearning.json");

  if (persist) {
    writeFileSync(DESIGN_SYSTEM_REPORT_PATH, buildFounderReportMd(input.bundle, input.validation));
  }

  return { outputDir, artifacts };
}

function buildDesignSystemReportMd(
  bundle: DesignSystemBundle,
  validation: DesignValidationResult,
): string {
  const status = validation.pass ? "PASS" : "FAIL";
  return `# StudiosisLab Resume Design System v${DESIGN_SYSTEM_VERSION}

**Overall Status:** ${status}
**Generated:** ${new Date().toISOString()}

## Summary

| Area | Count |
|------|-------|
| Spacing tokens | ${bundle.spacing.scale.length} |
| Typography roles | ${bundle.typography.roles.length} |
| Grid layouts | ${bundle.grid.layouts.length} |
| Header variants | ${bundle.headers.variants.length} |
| Section variants | ${bundle.sections.variants.length} |
| Color palettes | ${bundle.colors.palettes.length} |
| Components | ${bundle.components.components.length} |
| ATS rules | ${bundle.ats.component_rules.length} |

## Validation Checks

${Object.entries(validation.checks)
  .map(([k, v]) => `- ${k}: ${v ? "✓" : "✗"}`)
  .join("\n")}

## Issues

${validation.issues.length === 0 ? "None" : validation.issues.map((i) => `- [${i.severity}] ${i.code}: ${i.message}`).join("\n")}

## Role

Single source of truth for spacing, typography, layouts, colors, and components.
Future resume engines must consume this system instead of inventing design values independently.
`;
}

function buildDesignDNAReportMd(dna: DesignDNABundle): string {
  return `# StudiosisLab Design DNA v${dna.version}

**Agent:** #080 — Permanent Creative Foundation
**Generated:** ${new Date().toISOString()}
**Concepts:** ${dna.concept_count}
**Measurable rules:** ${dna.measurable_rule_count}

## Role

Design DNA teaches the factory **why** premium resumes feel premium — not spacing, typography, or ATS alone.

## Brain Directives

${dna.brain_directives.map((d) => `- ${d}`).join("\n")}

## Principles

${dna.principles.map((p) => `- ${p}`).join("\n")}

## Inspiration (design thinking only — never copy layouts)

${dna.inspiration.map((i) => `- ${i}`).join("\n")}

## Resolved Scan Path

${dna.resolved.scan_path.map((z, i) => `${i + 1}. ${z}`).join("\n")}

## Design System Links

${dna.design_system_links.map((l) => `- ${l}`).join("\n")}

## Integration

Consumed by Design Brain, Adaptive Composer, Production Bundle, Premium Scorer, Visual Render, and Founder Critic.
`;
}

function buildFounderReportMd(
  bundle: DesignSystemBundle,
  validation: DesignValidationResult,
): string {
  return `# AGENT #076 — StudiosisLab Resume Design System

**Overall Status:** ${validation.pass ? "PASS" : "FAIL"}
**Version:** ${DESIGN_SYSTEM_VERSION}
**Date:** ${new Date().toISOString().slice(0, 10)}

## Mission

Build the foundational Design System that every future StudiosisLab resume will use.

## Deliverables

- Module: \`SOS/SAIOS/runtime/design-system/\`
- Artifacts: \`SOS/07_LOGS/saios/design-system/\`
- Verify: \`npm run design-system:verify\`

## Systems

| System | Status |
|--------|--------|
| Typography | ${validation.checks.typography_system ? "✓" : "✗"} |
| Spacing | ${validation.checks.spacing_system ? "✓" : "✗"} |
| Grid | ${validation.checks.grid_system ? "✓" : "✗"} |
| Layout library | ${validation.checks.layout_library ? "✓" : "✗"} |
| Component library | ${validation.checks.component_library ? "✓" : "✗"} |
| ATS rules | ${validation.checks.ats_rules ? "✓" : "✗"} |
| Accessibility | ${validation.checks.accessibility ? "✓" : "✗"} |
| Validator | ${validation.checks.validator ? "✓" : "✗"} |
| Reports | ${validation.checks.reports ? "✓" : "✗"} |

## Inventory

- ${bundle.headers.variants.length} header variants
- ${bundle.sections.variants.length} section variants
- ${bundle.colors.palettes.length} color palettes
- ${bundle.components.components.length} components
- ${bundle.grid.layouts.length} grid layouts

## Backward Compatibility

No existing production modules were modified. This module is additive only.
`;
}
