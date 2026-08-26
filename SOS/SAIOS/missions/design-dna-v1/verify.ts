#!/usr/bin/env tsx
/**
 * AGENT #080 — Design DNA integration verification.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  buildDesignDNASystem,
  validateDesignDNA,
  DESIGN_DNA_PRINCIPLES,
} from "../../runtime/design-system/DesignDNA.js";
import { loadDesignMemoryContext } from "../../runtime/design-system/DesignMemoryBridge.js";
import { buildDesignSystemBundle, runDesignSystem } from "../../runtime/design-system/DesignSystemDirector.js";
import { appendDesignDNACalibration } from "../../runtime/workers/resume-production/founder-calibration.js";
import { runDesignBrain } from "../../runtime/design-brain/DesignBrain.js";
import { createMockCursorResearchExecutor } from "../../runtime/research/ResearchCoordinator.js";

const SOS_ROOT = resolve(import.meta.dirname, "../../..");
const DNA_ROOT = join(SOS_ROOT, "07_LOGS/saios/design-system");

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

async function main(): Promise<void> {
  appendDesignDNACalibration();

  const systemResult = await runDesignSystem({ persist: true });
  assert(systemResult.pass, "design system pass with dna");

  const ctx = loadDesignMemoryContext(true);
  const dna = buildDesignDNASystem(ctx);
  const validation = validateDesignDNA(dna);

  assert(dna.concept_count >= 30, "concept count >= 30");
  assert(DESIGN_DNA_PRINCIPLES.length >= 8, "principles defined");
  assert(validation.pass, "dna validation pass");
  assert(ctx.effective_design_dna.enabled === true, "calibration dna enabled");

  const bundle = buildDesignSystemBundle(true);
  assert(bundle.design_dna.concept_count >= 30, "bundle includes design_dna");
  assert(bundle.design_dna.brain_directives.length >= 5, "brain directives");

  const brain = await runDesignBrain({
    objective: "Premium software engineer resume — StudiosisLab Design DNA",
    mcp_firecrawl_available: true,
    persist: false,
  });
  assert(
    brain.decisions.reasoning.some((r) => r.toLowerCase().includes("eye") || r.toLowerCase().includes("dna")),
    "brain uses dna reasoning",
  );

  for (const file of [
    "DesignDNAReport.md",
    "DesignDNALearning.json",
    "DesignDNAValidation.json",
    "design-dna.json",
  ]) {
    assert(existsSync(join(DNA_ROOT, file)), `artifact: ${file}`);
  }

  const dnaLearning = JSON.parse(
    readFileSync(join(DNA_ROOT, "DesignDNALearning.json"), "utf8"),
  ) as { append_only: boolean; brain_directives: string[] };
  assert(dnaLearning.append_only === true, "learning append only");
  assert(dnaLearning.brain_directives.length >= 5, "learning brain directives");

  console.log(
    JSON.stringify(
      {
        pass: true,
        agent: "080",
        component: "studiosislab-design-dna",
        dna_version: dna.version,
        concept_count: dna.concept_count,
        measurable_rules: dna.measurable_rule_count,
        checks: {
          design_system_integration: true,
          design_brain_integration: true,
          calibration_appended: true,
          artifacts_present: true,
          validation_pass: validation.pass,
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
