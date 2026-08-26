/**
 * Duplicate detection v3 — corpus, benchmark memory, learning memory, production batch.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { analyzeExistingTemplates } from "../../research/ExistingTemplateAnalyzer.js";
import type { IndustryId } from "../../research/types.js";
import { loadBenchmarkMemory } from "../../benchmark/BenchmarkMemory.js";
import { DUPLICATE_THRESHOLD, type DuplicateCheckResult } from "./duplicate-detector.js";

const SOS_ROOT = resolve(import.meta.dirname, "../../../..");
const LEARNING_APPEND = join(SOS_ROOT, "07_LOGS/saios/learning/worker-v2-append.json");
const V3_APPEND = join(SOS_ROOT, "07_LOGS/saios/learning/worker-v3-append.json");

export type DuplicateCheckResultV3 = DuplicateCheckResult & {
  benchmark_memory_clear: boolean;
  learning_memory_clear: boolean;
  batch_clear: boolean;
  memory_similarity: number;
  batch_similarity: number;
};

export function checkDuplicateRiskV3(input: {
  objective: string;
  industry: IndustryId;
  family_id: string;
}): DuplicateCheckResultV3 {
  const base = checkCorpusDuplicate(input);
  const benchmark_memory_clear = !benchmarkConflicts(input.family_id);
  const learning_memory_clear = !learningConflicts(input.family_id);
  const batch_similarity = batchSimilarity(input.family_id);
  const batch_clear = batch_similarity <= DUPLICATE_THRESHOLD;

  let memory_similarity = batch_similarity;
  if (!benchmark_memory_clear) memory_similarity = Math.max(memory_similarity, 0.62);
  if (!learning_memory_clear) memory_similarity = Math.max(memory_similarity, 0.61);

  const max_similarity = Math.max(base.max_similarity, memory_similarity);
  const exceeds_threshold = max_similarity > DUPLICATE_THRESHOLD;
  const redesign_required = exceeds_threshold;

  return {
    ...base,
    max_similarity,
    exceeds_threshold,
    redesign_required,
    benchmark_memory_clear,
    learning_memory_clear,
    batch_clear,
    memory_similarity,
    batch_similarity,
    uniqueness_score: Math.round((1 - max_similarity) * 100),
  };
}

function checkCorpusDuplicate(input: {
  objective: string;
  industry: IndustryId;
  family_id: string;
}): DuplicateCheckResult {
  const comparison = analyzeExistingTemplates({
    objective: input.objective,
    industry: input.industry,
    preferred_family: input.family_id,
  });
  const max_similarity = comparison.most_similar_templates[0]?.similarity_score ?? 0;
  const exceeds_threshold = max_similarity > DUPLICATE_THRESHOLD;
  return {
    max_similarity,
    exceeds_threshold,
    most_similar_template_id: comparison.most_similar_templates[0]?.template_id ?? null,
    uniqueness_score: comparison.uniqueness_score,
    comparison,
    redesign_required: exceeds_threshold,
  };
}

function benchmarkConflicts(family_id: string): boolean {
  const memory = loadBenchmarkMemory();
  const needle = family_id.toLowerCase();
  return memory.entries.slice(-8).some((e) => e.note.toLowerCase().includes(needle));
}

function learningConflicts(family_id: string): boolean {
  for (const path of [LEARNING_APPEND, V3_APPEND]) {
    if (!existsSync(path)) continue;
    try {
      const entries = JSON.parse(readFileSync(path, "utf8")) as Array<{
        family_id?: string;
        layout_selection_reason?: string;
      }>;
      const recent = entries.slice(-5);
      if (recent.some((e) => e.family_id === family_id)) return true;
    } catch {
      /* ignore */
    }
  }
  return false;
}

function batchSimilarity(family_id: string): number {
  const families: string[] = [];
  for (const path of [LEARNING_APPEND, V3_APPEND]) {
    if (!existsSync(path)) continue;
    try {
      const entries = JSON.parse(readFileSync(path, "utf8")) as Array<{ family_id?: string }>;
      for (const e of entries.slice(-5)) {
        if (e.family_id) families.push(e.family_id);
      }
    } catch {
      /* ignore */
    }
  }
  if (families.length === 0) return 0;
  const matches = families.filter((f) => f === family_id).length;
  return matches / families.length;
}
