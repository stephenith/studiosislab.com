#!/usr/bin/env tsx
/**
 * Design Brain verification — all engines and integration.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { DESIGN_BRAIN, runDesignBrain, BRAIN_OUTPUT_ROOT } from "./DesignBrain.js";
import { integrateResearch } from "./ResearchIntegration.js";
import { createMockCursorResearchExecutor } from "../research/ResearchCoordinator.js";
import { runDesignDecisionEngine } from "./DesignDecisionEngine.js";
import { loadBrainMemory } from "./DesignMemory.js";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

async function main(): Promise<void> {
  assert(DESIGN_BRAIN.module === "resume-design-brain", "module id");
  assert(DESIGN_BRAIN.role === "design_authority_only", "role");

  const objective =
    "Generate a premium modern ATS resume for a senior finance executive.";

  const executor = createMockCursorResearchExecutor({ failure_rate: 0, base_ms: 5 });
  const research = await integrateResearch({
    objective,
    executor,
    mcp_available: true,
  });
  assert(research.principles.length > 0, "research integration");
  assert(research.copyright_safe, "copyright safe");

  const engine = runDesignDecisionEngine(objective, research);
  assert(engine.decisions.typography_system.primary_font.length > 0, "typography engine");
  assert(engine.decisions.color_system.primary_accent.startsWith("#"), "color engine");
  assert(engine.decisions.grid_system.base_unit_px === 8, "grid engine");
  assert(engine.decisions.spacing_system.section_gap_px > 0, "spacing engine");
  assert(engine.decisions.visual_hierarchy.name_weight === 100, "visual hierarchy");
  assert(engine.decisions.originality_score > 0, "originality engine");
  assert(engine.quality.overall_quality >= 95, "quality scoring");
  assert(engine.confidence.overall >= 95, "confidence engine");

  const memory = loadBrainMemory();
  assert(memory.version, "founder memory loaded");

  const result = await runDesignBrain({
    objective,
    mcp_firecrawl_available: true,
    persist: false,
  });

  assert(result.pass, "brain pass");
  assert(result.decisions.confidence >= 95, "decision confidence");
  assert(existsSync(join(result.session_dir, "design-brain.json")), "design-brain.json");
  assert(existsSync(join(result.session_dir, "design-decisions.json")), "design-decisions.json");
  assert(existsSync(join(result.session_dir, "design-quality.json")), "design-quality.json");
  assert(existsSync(join(result.session_dir, "design-confidence.json")), "design-confidence.json");
  assert(existsSync(join(result.session_dir, "research-summary.md")), "research-summary.md");
  assert(existsSync(join(result.session_dir, "visual-analysis.md")), "visual-analysis.md");
  assert(existsSync(join(result.session_dir, "brain-report.md")), "brain-report.md");
  assert(existsSync(join(BRAIN_OUTPUT_ROOT, "design-brain.json")), "root mirror");

  console.log(
    JSON.stringify(
      {
        pass: true,
        component: "resume-design-brain",
        session_id: result.session_id,
        design_language: result.decisions.design_language,
        layout_family: result.decisions.layout_family,
        overall_quality: result.quality.overall_quality,
        confidence: result.confidence.overall,
        originality_score: result.decisions.originality_score,
        checks: {
          research_integration: true,
          design_decision_engine: true,
          typography_engine: true,
          color_engine: true,
          grid_engine: true,
          spacing_engine: true,
          visual_hierarchy: true,
          originality_engine: true,
          quality_scoring: true,
          founder_memory: true,
          confidence_engine: true,
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
