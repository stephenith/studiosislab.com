/**
 * Learning snapshot for Knowledge System retrieval — Agent #125.
 */
import { writeFileSync, renameSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { LearningEntry } from "./types.js";
import { learningDir } from "./LearningRepository.js";

export function buildLearningSnapshot(entries: LearningEntry[]): {
  generated_at: string;
  domain: "learning";
  entry_count: number;
  categories: Record<string, number>;
  entries: LearningEntry[];
  retrieval_hints: string[];
} {
  const categories: Record<string, number> = {};
  for (const e of entries) {
    categories[e.category] = (categories[e.category] ?? 0) + 1;
  }
  return {
    generated_at: new Date().toISOString(),
    domain: "learning",
    entry_count: entries.length,
    categories,
    entries,
    retrieval_hints: [
      "approved_pattern",
      "rejected_pattern",
      "revision_instruction",
      "quality_observation",
      "founder_preference_signal",
    ],
  };
}

export function persistLearningSnapshot(
  entries: LearningEntry[],
  root?: string,
): string {
  const dir = learningDir(root);
  mkdirSync(dir, { recursive: true });
  const snap = buildLearningSnapshot(entries);
  const path = join(dir, "learning-snapshot.json");
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(snap, null, 2)}\n`);
  renameSync(tmp, path);

  const report = join(dir, "learning-report.md");
  writeFileSync(
    report,
    `# Learning Knowledge Report

**Generated:** ${snap.generated_at}  
**Entries:** ${snap.entry_count}

## Categories

${Object.entries(snap.categories)
  .map(([k, v]) => `- ${k}: ${v}`)
  .join("\n") || "_empty_"}

## Retrieval

Future Resume Knowledge Snapshots may retrieve founder-approved learning from this store.
`,
  );
  return path;
}
