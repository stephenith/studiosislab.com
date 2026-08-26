/**
 * CriticScore — clamp and aggregate helpers (deterministic).
 */
import type { CriticFinding, CriticScores } from "./types.js";

export function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function applyFindings(base: number, findings: CriticFinding[]): number {
  const deducted = findings.reduce((s, f) => s + f.points_deducted, 0);
  return clampScore(base - deducted);
}

export function weightedOverall(scores: Omit<CriticScores, "overall">): number {
  // Fixed weights — never change at runtime
  const w = {
    ats: 0.25,
    visual: 0.12,
    typography: 0.12,
    layout: 0.15,
    technical: 0.18,
    consistency: 0.08,
    sections: 0.1,
  };
  const raw =
    scores.ats * w.ats +
    scores.visual * w.visual +
    scores.typography * w.typography +
    scores.layout * w.layout +
    scores.technical * w.technical +
    scores.consistency * w.consistency +
    scores.sections * w.sections;
  return clampScore(raw);
}
