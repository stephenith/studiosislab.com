/**
 * Learning view — founder preferences and successful patterns.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PATHS, loadDesignMemory } from "./DataAggregator.js";

export function buildLearningView() {
  const memory = loadDesignMemory();
  const patterns = readJsonSafe(join(PATHS.learning, "learned-patterns.json"));
  const feedback = readJsonSafe(join(PATHS.learning, "feedback.json"));
  const quality = readJsonSafe(join(PATHS.learning, "quality-history.json"));

  const approved = (feedback as { entries?: Array<{ decision?: string; layout?: string }> })?.entries?.filter(
    (e) => e.decision === "approved",
  ) ?? [];
  const rejected = (feedback as { entries?: Array<{ decision?: string; layout?: string }> })?.entries?.filter(
    (e) => e.decision === "rejected",
  ) ?? [];

  return {
    updated_at: new Date().toISOString(),
    most_approved_layouts: topLayouts(approved),
    most_rejected_layouts: topLayouts(rejected),
    founder_preferences: {
      spacing_margin_px: (memory as { preferred_spacing?: { margin_px?: number } })?.preferred_spacing?.margin_px,
      typography_body_pt: (memory as { preferred_typography?: { min_body_pt?: number } })?.preferred_typography
        ?.min_body_pt,
      section_order: (memory as { preferred_sections?: { order?: string[] } })?.preferred_sections?.order,
      accent_colors: (memory as { preferred_colors?: { accent?: string[] } })?.preferred_colors?.accent,
    },
    successful_components: extractPatterns(patterns, "component"),
    successful_typography: extractPatterns(patterns, "typography"),
    successful_spacing: extractPatterns(patterns, "spacing"),
    successful_hierarchy: extractPatterns(patterns, "hierarchy"),
    learning_growth: {
      total_patterns: ((patterns as { patterns?: unknown[] })?.patterns ?? []).length,
      founder_approvals: (quality as { founder_approvals?: number })?.founder_approvals ?? 0,
      founder_rejections: (quality as { founder_rejections?: number })?.founder_rejections ?? 0,
    },
  };
}

function readJsonSafe(path: string): unknown {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function topLayouts(entries: Array<{ layout?: string }>): string[] {
  const counts: Record<string, number> = {};
  for (const e of entries) {
    const k = e.layout ?? "unknown";
    counts[k] = (counts[k] ?? 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k]) => k);
}

function extractPatterns(data: unknown, type: string): string[] {
  const patterns = (data as { patterns?: Array<{ type?: string; description?: string }> })?.patterns ?? [];
  return patterns.filter((p) => p.type === type).map((p) => p.description ?? type).slice(0, 5);
}
