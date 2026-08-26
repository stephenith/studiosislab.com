/**
 * Load Resume Critic artifacts (read-only).
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { CriticScoresSnapshot } from "./types.js";

export class CriticResultLoader {
  constructor(
    private readonly repoRoot = resolve(import.meta.dirname, "../../../.."),
  ) {}

  defaultReportReference(): string {
    return "SOS/07_LOGS/saios/resume-critic/readiness.json";
  }

  loadScores(reportRef?: string): CriticScoresSnapshot | null {
    const rel = reportRef ?? this.defaultReportReference();
    const path = join(this.repoRoot, rel);
    if (!existsSync(path)) return null;
    const raw = JSON.parse(readFileSync(path, "utf8")) as {
      ready?: boolean;
      blocked_reasons?: string[];
      scores?: Record<string, number>;
      overall?: number;
      ats?: number;
      visual?: number;
      typography?: number;
      layout?: number;
      technical?: number;
      consistency?: number;
      sections?: number;
      generated_at?: string;
      evaluated_at?: string;
    };

    const scores = raw.scores ?? {
      overall: raw.overall,
      ats: raw.ats,
      visual: raw.visual,
      typography: raw.typography,
      layout: raw.layout,
      technical: raw.technical,
      consistency: raw.consistency,
      sections: raw.sections,
    };

    if (
      scores.overall == null ||
      scores.ats == null ||
      scores.technical == null
    ) {
      return null;
    }

    return {
      overall: Number(scores.overall),
      ats: Number(scores.ats),
      visual: Number(scores.visual ?? 0),
      typography: Number(scores.typography ?? 0),
      layout: Number(scores.layout ?? 0),
      technical: Number(scores.technical),
      consistency: Number(scores.consistency ?? 0),
      sections: Number(scores.sections ?? 0),
      ready: Boolean(raw.ready ?? false),
      blocked_reasons: raw.blocked_reasons ?? [],
      generated_at: raw.generated_at ?? raw.evaluated_at,
    };
  }
}
