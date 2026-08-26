/**
 * AI Brain event contract — for later Event Bus wiring (not live in #117).
 */
import type { BrainEventType, ProviderId } from "./types.js";

export type BrainEvent = {
  event_type: BrainEventType;
  at: string;
  request_id?: string;
  task_id?: string;
  department?: string;
  provider?: ProviderId;
  detail?: Record<string, unknown>;
};

export const BRAIN_EVENT_TYPES: readonly BrainEventType[] = [
  "BRAIN_REQUEST_CREATED",
  "BRAIN_REQUEST_ROUTED",
  "BRAIN_REQUEST_STARTED",
  "BRAIN_REQUEST_RETRIED",
  "BRAIN_FALLBACK_USED",
  "BRAIN_REQUEST_COMPLETED",
  "BRAIN_REQUEST_FAILED",
  "BRAIN_BUDGET_WARNING",
  "BRAIN_BUDGET_PAUSED",
  "BRAIN_PROVIDER_UNHEALTHY",
] as const;

export function createBrainEvent(
  event_type: BrainEventType,
  fields: Omit<BrainEvent, "event_type" | "at"> = {},
): BrainEvent {
  return {
    event_type,
    at: new Date().toISOString(),
    ...fields,
  };
}
