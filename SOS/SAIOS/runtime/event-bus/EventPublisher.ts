/**
 * Publish events onto the bus.
 */
import { isRegisteredEvent } from "./EventRegistry.js";
import type { BusEvent, EventPayload, EventType } from "./types.js";

let eventSeq = 0;

export function createBusEvent(
  type: EventType | string,
  source: string,
  payload: EventPayload = {},
  correlationId?: string,
): BusEvent {
  const resolvedType: EventType = isRegisteredEvent(type) ? type : "CUSTOM_EVENT";
  return {
    id: `evt-${Date.now()}-${++eventSeq}`,
    type: resolvedType,
    source,
    payload:
      resolvedType === "CUSTOM_EVENT" && type !== "CUSTOM_EVENT"
        ? { ...payload, original_type: type }
        : payload,
    created_at: new Date().toISOString(),
    correlation_id: correlationId,
  };
}

export class EventPublisher {
  constructor(
    private readonly publishFn: (event: BusEvent) => Promise<BusEvent>,
  ) {}

  async publish(
    type: EventType | string,
    source: string,
    payload: EventPayload = {},
    correlationId?: string,
  ): Promise<BusEvent> {
    const event = createBusEvent(type, source, payload, correlationId);
    return this.publishFn(event);
  }
}
