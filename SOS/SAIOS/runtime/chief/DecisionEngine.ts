import type { Priority } from "../shared/types.js";
import type { DecisionResult, FounderCommand } from "./types.js";

function detectPriority(text: string): Priority {
  if (/\b(urgent|asap|p0|critical)\b/.test(text)) return "P0";
  if (/\b(important|p1|high)\b/.test(text)) return "P1";
  if (/\b(low|p3|minor)\b/.test(text)) return "P3";
  return "P2";
}

function detectImplementSteps(text: string): number {
  const batch = text.match(/\bbatch-(\d+)\b/);
  if (batch) {
    const total = Math.max(3, parseInt(batch[1]!, 10));
    // plan + verify consume two slots when verify is included
    const includeVerify = /\b(verify|qa|test)\b/.test(text);
    return Math.max(1, total - (includeVerify ? 2 : 1));
  }
  return 1;
}

/**
 * Deterministic decision logic — no AI, no LLM, no heuristics beyond fixed rules.
 */
export class DecisionEngine {
  analyze(command: FounderCommand): DecisionResult {
    const raw = command.raw_text.trim();
    const text = raw.toLowerCase();

    const priority = detectPriority(text);
    const includeVerify = /\b(verify|qa|test)\b/.test(text);
    const implementSteps = detectImplementSteps(text);

    const goal = raw || "Unspecified founder goal";
    const summary =
      implementSteps > 1
        ? `Batch execution: ${implementSteps} implement step(s)` +
          (includeVerify ? " with verification" : "")
        : `Single execution: implement` + (includeVerify ? " and verify" : "");

    const stepCount = 1 + implementSteps + (includeVerify ? 1 : 0);
    const minutesPerStep = priority === "P0" ? 10 : priority === "P1" ? 15 : 20;
    const estimated_duration = `${stepCount * minutesPerStep}m`;

    return {
      goal,
      summary,
      priority,
      implement_steps: implementSteps,
      include_verify: includeVerify,
      estimated_duration,
    };
  }
}
