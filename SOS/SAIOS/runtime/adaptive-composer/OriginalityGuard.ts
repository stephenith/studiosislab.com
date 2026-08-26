/**
 * Originality guard — compare against collection, benchmark, learning, catalog.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { checkDuplicateRiskV3 } from "../workers/resume-production/duplicate-detector-v3.js";
import { loadComposerMemory } from "./ComposerMemory.js";
import type { CompositionPlan } from "./types.js";
import { COMPOSER_DUPLICATE_THRESHOLD } from "./types.js";
import type { IndustryId } from "../research/types.js";

const SOS_ROOT = resolve(import.meta.dirname, "../../..");
const COMPOSITIONS_ROOT = join(SOS_ROOT, "07_LOGS/saios/adaptive-composer/compositions");
const PUBLICATION_ROOT = join(SOS_ROOT, "07_LOGS/saios/publication/packages");

export function computeCompositionFingerprint(plan: Omit<CompositionPlan, "fingerprint">): string {
  const payload = JSON.stringify({
    layout: plan.layout.layout_mode,
    columns: plan.layout.column_count,
    section_order: plan.hierarchy.section_order,
    components: plan.components.map((c) => `${c.category}:${c.variant}`),
    typography: `${plan.typography.primary_font}+${plan.typography.secondary_font}`,
    spacing: plan.spacing.section_spacing_px,
  });
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

export function compositionSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  let matches = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] === b[i]) matches++;
  }
  return matches / Math.max(a.length, b.length);
}

export function checkCompositionOriginality(input: {
  plan: CompositionPlan;
  objective: string;
  industry: IndustryId;
  family_id: string;
  prior_fingerprints?: string[];
}): {
  max_similarity: number;
  redesign_required: boolean;
  corpus_check: ReturnType<typeof checkDuplicateRiskV3>;
  memory_similarity: number;
  catalog_similarity: number;
} {
  const corpus_check = checkDuplicateRiskV3({
    objective: input.objective,
    industry: input.industry,
    family_id: input.family_id,
  });

  const memory = loadComposerMemory();
  const memory_fps = memory.entries.map((e) => e.fingerprint);
  const prior = [...memory_fps, ...(input.prior_fingerprints ?? [])];
  const existing_fps = [...prior, ...loadExistingCompositionFingerprints()];

  let memory_similarity = 0;
  for (const fp of existing_fps) {
    if (fp === input.plan.fingerprint) continue;
    memory_similarity = Math.max(memory_similarity, compositionSimilarity(input.plan.fingerprint, fp));
  }

  const catalog_similarity = catalogFingerprintSimilarity(input.plan.fingerprint);

  const composition_similarity = Math.max(memory_similarity, catalog_similarity);
  const corpus_similarity = corpus_check.max_similarity;

  const max_similarity = composition_similarity;
  const redesign_required = composition_similarity > COMPOSER_DUPLICATE_THRESHOLD;

  return {
    max_similarity,
    redesign_required,
    corpus_check,
    corpus_similarity,
    memory_similarity,
    catalog_similarity,
  };
}

function loadExistingCompositionFingerprints(): string[] {
  if (!existsSync(COMPOSITIONS_ROOT)) return [];
  const fps: string[] = [];
  for (const dir of readdirSync(COMPOSITIONS_ROOT)) {
    const path = join(COMPOSITIONS_ROOT, dir, "composition-plan.json");
    if (!existsSync(path)) continue;
    try {
      const plan = JSON.parse(readFileSync(path, "utf8")) as CompositionPlan;
      if (plan.fingerprint) fps.push(plan.fingerprint);
    } catch {
      /* ignore */
    }
  }
  return fps;
}

function catalogFingerprintSimilarity(fingerprint: string): number {
  if (!existsSync(PUBLICATION_ROOT)) return 0;
  let max = 0;
  for (const dir of readdirSync(PUBLICATION_ROOT)) {
    const path = join(PUBLICATION_ROOT, dir, "catalog-entry.json");
    if (!existsSync(path)) continue;
    try {
      const entry = JSON.parse(readFileSync(path, "utf8")) as { catalog_id?: string };
      if (entry.catalog_id) {
        const pseudo = createHash("sha256").update(entry.catalog_id).digest("hex").slice(0, 16);
        max = Math.max(max, compositionSimilarity(fingerprint, pseudo) * 0.3);
      }
    } catch {
      /* ignore */
    }
  }
  return max;
}
