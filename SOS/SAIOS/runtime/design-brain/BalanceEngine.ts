/**
 * Balance engine — visual weight distribution score.
 */
import type { ComponentEmphasis } from "./types.js";
import type { WhitespaceDecision } from "./WhitespaceEngine.js";

export type BalanceDecision = {
  balance_score: number;
  weight_distribution: Record<string, number>;
  pass: boolean;
  notes: string[];
};

export function resolveBalance(
  emphasis: ComponentEmphasis,
  whitespace: WhitespaceDecision,
): BalanceDecision {
  const weights = {
    content: (emphasis.experience + emphasis.summary + emphasis.education) / 3,
    header: emphasis.header,
    decoration: emphasis.decorations,
    whitespace: whitespace.whitespace_score,
  };

  const contentDominant = weights.content >= 75 && weights.content <= 100;
  const decorationLow = weights.decoration <= 20;
  const balance_score = Math.round(
    (weights.content * 0.4 + weights.whitespace * 0.35 + (decorationLow ? 95 : 70) * 0.25),
  );

  return {
    balance_score,
    weight_distribution: weights,
    pass: contentDominant && decorationLow && balance_score >= 80,
    notes: [
      contentDominant ? "Content zones dominate appropriately" : "Content weight needs adjustment",
      decorationLow ? "Decoration within budget" : "Reduce decorative elements",
      `Whitespace contribution: ${whitespace.whitespace_score}/100`,
    ],
  };
}
