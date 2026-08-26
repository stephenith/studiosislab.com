/**
 * Append-only learning repository — Agent #125.
 */
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
} from "node:fs";
import { join, resolve } from "node:path";
import type { LearningEntry } from "./types.js";
import { validateLearningEntry } from "./LearningValidator.js";

export function learningDir(repoRoot?: string): string {
  const repo = repoRoot ?? resolve(import.meta.dirname, "../../../..");
  return join(repo, "SOS/07_LOGS/saios/knowledge/learning");
}

function atomicWrite(path: string, data: unknown): void {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`);
  renameSync(tmp, path);
}

export class LearningRepository {
  constructor(private readonly root?: string) {
    mkdirSync(learningDir(this.root), { recursive: true });
  }

  private jsonl(): string {
    return join(learningDir(this.root), "learning-entries.jsonl");
  }

  list(): LearningEntry[] {
    const p = this.jsonl();
    if (!existsSync(p)) return [];
    return readFileSync(p, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as LearningEntry)
      .filter((e) => !e.fixture);
  }

  append(entry: LearningEntry): void {
    const v = validateLearningEntry(entry);
    if (!v.ok) throw new Error(v.errors.join("; "));
    appendFileSync(this.jsonl(), `${JSON.stringify(entry)}\n`);
    this.rebuildIndexes();
  }

  appendMany(entries: LearningEntry[]): void {
    for (const e of entries) this.append(e);
  }

  rebuildIndexes(): void {
    const all = this.list();
    const index = {
      generated_at: new Date().toISOString(),
      count: all.length,
      by_category: {} as Record<string, number>,
      ids: all.map((e) => e.learning_id),
    };
    for (const e of all) {
      index.by_category[e.category] = (index.by_category[e.category] ?? 0) + 1;
    }
    atomicWrite(join(learningDir(this.root), "learning-index.json"), index);
  }
}
