/**
 * CriticDecisionEventBuilder — gate events (no Telegram).
 */
import { appendFileSync, mkdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import type { CriticGateResult, GateEventType } from "./types.js";

export type GateEvent = {
  event_type: GateEventType;
  timestamp: string;
  summary: string;
  gate_id: string;
  task_id: string;
  candidate_id: string;
  ready: boolean;
  dry_run: true;
};

export function buildGateEvent(
  type: GateEventType,
  gate: CriticGateResult,
  summary: string,
): GateEvent {
  return {
    event_type: type,
    timestamp: new Date().toISOString(),
    summary,
    gate_id: gate.gate_id,
    task_id: gate.task_id,
    candidate_id: gate.candidate_id,
    ready: gate.ready,
    dry_run: true,
  };
}

export function eventsForGate(gate: CriticGateResult): GateEvent[] {
  const events: GateEvent[] = [
    buildGateEvent(
      "CRITIC_EVALUATION_COMPLETED",
      gate,
      `Critic evaluation completed for ${gate.candidate_id} overall=${gate.overall_score}`,
    ),
  ];
  if (gate.ready) {
    events.push(
      buildGateEvent(
        "CRITIC_GATE_PASSED",
        gate,
        `Gate passed overall=${gate.overall_score} ats=${gate.ats_score}`,
      ),
      buildGateEvent(
        "FOUNDER_REVIEW_ALLOWED",
        gate,
        `Founder review allowed for ${gate.candidate_id}`,
      ),
    );
  } else {
    events.push(
      buildGateEvent(
        "CRITIC_GATE_BLOCKED",
        gate,
        `Gate blocked: ${gate.blocking_reasons.join("; ")}`,
      ),
      buildGateEvent(
        "FOUNDER_REVIEW_BLOCKED",
        gate,
        `Founder review blocked for ${gate.candidate_id}`,
      ),
      buildGateEvent(
        "REMEDIATION_PROPOSED",
        gate,
        `Remediation proposed for ${gate.candidate_id}`,
      ),
    );
  }
  return events;
}

export function appendGateEvents(
  events: GateEvent[],
  repoRoot = resolve(import.meta.dirname, "../../../.."),
): void {
  const dir = join(repoRoot, "SOS/07_LOGS/saios/critic-gate");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "gate-events.jsonl");
  for (const e of events) {
    appendFileSync(path, `${JSON.stringify(e)}\n`, "utf8");
  }

  // Also append to founder-decisions events if present (safe shared history)
  const shared = join(
    repoRoot,
    "SOS/07_LOGS/saios/founder-decisions/events.jsonl",
  );
  if (existsSync(join(repoRoot, "SOS/07_LOGS/saios/founder-decisions"))) {
    for (const e of events) {
      appendFileSync(
        shared,
        `${JSON.stringify({
          event_type: e.event_type,
          timestamp: e.timestamp,
          summary: e.summary,
          payload: {
            gate_id: e.gate_id,
            task_id: e.task_id,
            candidate_id: e.candidate_id,
            ready: e.ready,
          },
          dry_run: true,
        })}\n`,
        "utf8",
      );
    }
  }
}
