#!/usr/bin/env tsx
/**
 * Adaptive Resume Composer verification.
 * Generates multiple compositions for the same profession and verifies uniqueness.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { ADAPTIVE_COMPOSER, runAdaptiveComposition } from "./AdaptiveComposerDirector.js";
import { loadComposerMemory } from "./ComposerMemory.js";
import { compositionSimilarity } from "./OriginalityGuard.js";
import { COMPOSER_DUPLICATE_THRESHOLD } from "./types.js";

const OBJECTIVE = "Premium software engineer resume with modern ATS layout";
const BASE_SEED = Date.now() % 10000;
const SEEDS = [BASE_SEED + 11, BASE_SEED + 22, BASE_SEED + 33, BASE_SEED + 44];
const REQUIRED_ARTIFACTS = [
  "composition-plan.json",
  "layout-composition.json",
  "component-selection.json",
  "spacing-strategy.json",
  "hierarchy-strategy.json",
  "typography-strategy.json",
  "visual-composition.md",
  "design-rationale.md",
  "composition-confidence.json",
];

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

async function main(): Promise<void> {
  assert(ADAPTIVE_COMPOSER.module === "adaptive-resume-composer", "module id");
  assert(ADAPTIVE_COMPOSER.role === "fabric_composition_only", "role");

  const memoryBefore = loadComposerMemory();
  const results = [];
  const fingerprints: string[] = [];

  for (const seed of SEEDS) {
    const result = await runAdaptiveComposition({
      objective: OBJECTIVE,
      mode: "premium",
      seed,
      mcp_firecrawl_available: true,
      persist: true,
      prior_fingerprints: fingerprints,
    });
    results.push(result);
    fingerprints.push(result.plan.fingerprint);

    for (const file of REQUIRED_ARTIFACTS) {
      assert(existsSync(join(result.output_dir, file)), `artifact: ${file} for seed ${seed}`);
    }

    assert(result.confidence.premium_score >= 98, `premium score seed ${seed}: ${result.confidence.premium_score}`);
    assert(result.confidence.ats_score >= 100, `ats score seed ${seed}: ${result.confidence.ats_score}`);
    assert(result.confidence.visual_render_prediction >= 98, `visual render seed ${seed}`);
    assert(
      result.confidence.founder_prediction === "LIKELY APPROVE",
      `founder prediction seed ${seed}: ${result.confidence.founder_prediction}`,
    );
    assert(
      result.originality.max_similarity <= COMPOSER_DUPLICATE_THRESHOLD,
      `duplicate threshold seed ${seed}: ${result.originality.max_similarity}`,
    );
  }

  const layouts = new Set(results.map((r) => r.plan.layout.layout_mode));
  const typographies = new Set(
    results.map((r) => `${r.plan.typography.primary_font}+${r.plan.typography.secondary_font}`),
  );
  const spacings = new Set(results.map((r) => r.plan.spacing.section_spacing_px));
  const hierarchies = new Set(results.map((r) => r.plan.hierarchy.section_order.join("|")));

  assert(layouts.size >= 2, `different layouts: ${layouts.size}`);
  assert(typographies.size >= 2, `different typography: ${typographies.size}`);
  assert(spacings.size >= 2, `different spacing: ${spacings.size}`);
  assert(hierarchies.size >= 2, `different hierarchy: ${hierarchies.size}`);

  for (let i = 0; i < fingerprints.length; i++) {
    for (let j = i + 1; j < fingerprints.length; j++) {
      const sim = compositionSimilarity(fingerprints[i]!, fingerprints[j]!);
      assert(sim < 0.85, `fingerprints too similar ${i}/${j}: ${sim}`);
      assert(fingerprints[i] !== fingerprints[j]!, "duplicate fingerprint");
    }
  }

  const memoryAfter = loadComposerMemory();
  assert(memoryAfter.entries.length >= memoryBefore.entries.length + SEEDS.length, "learning appended");

  console.log(
    JSON.stringify(
      {
        pass: true,
        component: "adaptive-resume-composer",
        compositions_generated: results.length,
        unique_layouts: layouts.size,
        unique_typography: typographies.size,
        unique_spacing: spacings.size,
        unique_hierarchies: hierarchies.size,
        checks: {
          different_layouts: layouts.size >= 2,
          different_hierarchy: hierarchies.size >= 2,
          different_spacing: spacings.size >= 2,
          different_typography: typographies.size >= 2,
          ats_safe: results.every((r) => r.confidence.ats_score >= 100),
          premium_quality: results.every((r) => r.confidence.premium_score >= 98),
          duplicate_detection: results.every(
            (r) => r.originality.max_similarity <= COMPOSER_DUPLICATE_THRESHOLD,
          ),
          composition_confidence: results.every((r) => r.confidence.composition_confidence >= 97),
          learning_appended: true,
        },
        sample_scores: results.map((r) => ({
          seed: r.plan.redesign_count,
          premium: r.confidence.premium_score,
          ats: r.confidence.ats_score,
          visual: r.confidence.visual_render_prediction,
          founder: r.confidence.founder_prediction,
          layout: r.plan.layout.layout_mode,
        })),
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
