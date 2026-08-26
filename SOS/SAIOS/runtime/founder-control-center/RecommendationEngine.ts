/**
 * Exactly ONE recommended next action — highest business value.
 */
import type { FounderAction } from "./types.js";

export function recommendNextAction(queue: FounderAction[]): string {
  if (queue.length === 0) {
    return "No urgent founder actions — continue production batch / monitor AI OS health.";
  }
  const top = queue[0];
  return `${top.title}: ${top.detail}`;
}
