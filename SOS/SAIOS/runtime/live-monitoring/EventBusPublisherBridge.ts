/**
 * Event Bus publisher helper — thin wrapper; does not modify Event Bus internals.
 */
import { EventBus } from "../event-bus/EventBus.js";
import type { BusEvent, EventPayload, EventType } from "../event-bus/types.js";

export class EventBusPublisherBridge {
  constructor(readonly bus: EventBus) {}

  static create(): EventBusPublisherBridge {
    return new EventBusPublisherBridge(new EventBus());
  }

  async publish(
    type: EventType | string,
    source: string,
    payload: EventPayload = {},
  ): Promise<BusEvent> {
    return this.bus.publish(type, source, payload);
  }

  getBus(): EventBus {
    return this.bus;
  }
}
