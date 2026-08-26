/**
 * Append-only founder decision persistence — Agent #125.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
  renameSync,
} from "node:fs";
import { join, resolve } from "node:path";
import type { FounderDecision } from "./types.js";

export function decisionsDir(repoRoot?: string): string {
  const repo = repoRoot ?? resolve(import.meta.dirname, "../../../..");
  return join(repo, "SOS/07_LOGS/saios/founder-decisions");
}

export function fixturesDir(repoRoot?: string): string {
  return join(decisionsDir(repoRoot), "fixtures");
}

function atomicWriteJson(path: string, data: unknown): void {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`);
  renameSync(tmp, path);
}

export class FounderReviewRepository {
  constructor(private readonly root?: string) {
    mkdirSync(decisionsDir(this.root), { recursive: true });
    mkdirSync(fixturesDir(this.root), { recursive: true });
  }

  private jsonlPath(fixture: boolean): string {
    return join(
      fixture ? fixturesDir(this.root) : decisionsDir(this.root),
      "decisions.jsonl",
    );
  }

  private indexPath(fixture: boolean): string {
    return join(
      fixture ? fixturesDir(this.root) : decisionsDir(this.root),
      "decision-index.json",
    );
  }

  private supersessionPath(fixture: boolean): string {
    return join(
      fixture ? fixturesDir(this.root) : decisionsDir(this.root),
      "supersession-map.json",
    );
  }

  list(fixture = false): FounderDecision[] {
    const p = this.jsonlPath(fixture);
    if (!existsSync(p)) return [];
    return readFileSync(p, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as FounderDecision);
  }

  hasDecisionForReview(reviewId: string, fixture = false): boolean {
    return this.list(fixture).some(
      (d) => d.review_id === reviewId && !d.supersedes,
    );
  }

  /** Latest non-superseded decision for a review, if any. */
  latestForReview(reviewId: string, fixture = false): FounderDecision | null {
    const all = this.list(fixture).filter((d) => d.review_id === reviewId);
    if (!all.length) return null;
    const superseded = new Set(
      all.map((d) => d.supersedes).filter(Boolean) as string[],
    );
    const active = all.filter((d) => !superseded.has(d.decision_id));
    // Prefer ones that are not themselves superseded ids referenced later
    const supersededIds = new Set(
      all.map((d) => d.supersedes).filter(Boolean) as string[],
    );
    const tip = all.filter((d) => !supersededIds.has(d.decision_id));
    return tip[tip.length - 1] ?? active[active.length - 1] ?? null;
  }

  append(decision: FounderDecision): void {
    const fixture = Boolean(decision.fixture);
    if (
      !decision.supersedes &&
      this.hasDecisionForReview(decision.review_id, fixture)
    ) {
      // Allow only if superseding — duplicate primary decisions blocked
      const latest = this.latestForReview(decision.review_id, fixture);
      if (latest && !decision.supersedes) {
        throw new Error(
          `Duplicate decision blocked for review ${decision.review_id}; supersede ${latest.decision_id}`,
        );
      }
    }

    appendFileSync(this.jsonlPath(fixture), `${JSON.stringify(decision)}\n`);
    this.rebuildIndexes(fixture);
  }

  rebuildIndexes(fixture = false): void {
    const all = this.list(fixture);
    const index = {
      generated_at: new Date().toISOString(),
      count: all.length,
      by_review: {} as Record<string, string[]>,
      by_decision: all.map((d) => d.decision_id),
    };
    for (const d of all) {
      index.by_review[d.review_id] = [
        ...(index.by_review[d.review_id] ?? []),
        d.decision_id,
      ];
    }
    const supersession: Record<string, string> = {};
    for (const d of all) {
      if (d.supersedes) supersession[d.supersedes] = d.decision_id;
    }
    atomicWriteJson(this.indexPath(fixture), index);
    atomicWriteJson(this.supersessionPath(fixture), {
      generated_at: new Date().toISOString(),
      map: supersession,
    });
  }
}
