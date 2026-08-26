/**
 * Resume Learning Engine — orchestrates feedback → memory → rules → confidence.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseFeedbackBatch } from "./feedback-parser.js";
import { extractPatterns } from "./pattern-extractor.js";
import {
  applyFeedbackBatch,
  loadDesignMemory,
  saveDesignMemory,
  LEARNING_ROOT,
} from "./design-memory.js";
import { generateLearnedRules } from "./rule-updater.js";
import {
  createDefaultQualityHistory,
  updateQualityHistory,
} from "./quality-tracker.js";
import { computeConfidence, computeConfidenceBatch } from "./confidence-engine.js";
import { writeLearningReports } from "./reports.js";
import type { ConfidenceInput, LearningRunResult, StructuredFeedback } from "./types.js";

const QUALITY_HISTORY_PATH = join(LEARNING_ROOT, "quality-history.json");

export type LearningEngineInput = {
  feedback: { raw: string; template_id: string; founder_decision?: StructuredFeedback["founder_decision"] }[];
  confidence_targets?: ConfidenceInput[];
  templates_generated_delta?: number;
  persist?: boolean;
};

export function loadQualityHistory() {
  if (!existsSync(QUALITY_HISTORY_PATH)) return createDefaultQualityHistory();
  try {
    return JSON.parse(readFileSync(QUALITY_HISTORY_PATH, "utf8"));
  } catch {
    return createDefaultQualityHistory();
  }
}

export function saveQualityHistory(history: ReturnType<typeof createDefaultQualityHistory>): void {
  writeFileSync(QUALITY_HISTORY_PATH, JSON.stringify(history, null, 2));
}

export function runLearningEngine(input: LearningEngineInput): LearningRunResult & {
  structured_feedback: StructuredFeedback[];
  patterns: ReturnType<typeof extractPatterns>;
  learned_rules: ReturnType<typeof generateLearnedRules>;
  memory: ReturnType<typeof loadDesignMemory>;
  quality: ReturnType<typeof createDefaultQualityHistory>;
  confidence_scores: ReturnType<typeof computeConfidenceBatch>;
} {
  const structured = parseFeedbackBatch(input.feedback);
  const patterns = extractPatterns(structured);

  let memory = loadDesignMemory();
  memory = applyFeedbackBatch(memory, structured);

  let quality = loadQualityHistory();
  quality = updateQualityHistory(
    quality,
    structured,
    input.templates_generated_delta ?? structured.length,
  );

  const learned_rules = generateLearnedRules(memory, patterns);

  const confidence_targets: ConfidenceInput[] =
    input.confidence_targets ??
    structured.map((s) => ({
      template_id: s.template_id,
      qa_pass: s.founder_decision === "approved",
      ats_tier: "ats_safe" as const,
      family_id: "corporate-modern",
    }));

  const confidence_scores = computeConfidenceBatch(confidence_scoresDedup(confidence_targets), memory, quality);

  const persist = input.persist !== false;
  if (persist) {
    saveDesignMemory(memory);
    saveQualityHistory(quality);
    writeFileSync(
      join(LEARNING_ROOT, "learned-rules.json"),
      JSON.stringify(learned_rules, null, 2),
    );
  }

  const output_dir = writeLearningReports({
    structured_feedback: structured,
    patterns,
    learned_rules,
    memory,
    quality,
    confidence_scores,
  });

  return {
    pass: structured.length > 0 && patterns.length > 0 && learned_rules.rules.length > 0,
    feedback_processed: structured.length,
    patterns_extracted: patterns.length,
    rules_generated: learned_rules.rules.length,
    memory_updated: persist,
    output_dir,
    structured_feedback: structured,
    patterns,
    learned_rules,
    memory,
    quality,
    confidence_scores,
  };
}

function confidence_scoresDedup(targets: ConfidenceInput[]): ConfidenceInput[] {
  const seen = new Set<string>();
  return targets.filter((t) => {
    if (seen.has(t.template_id)) return false;
    seen.add(t.template_id);
    return true;
  });
}

export { computeConfidence };
