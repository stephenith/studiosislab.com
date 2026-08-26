/**
 * Notification Department subscriber — listens on Event Bus, forwards via bridge.
 * Does not modify Notification Department business logic modules.
 */
import type { EventBus } from "../event-bus/EventBus.js";
import type { BusEvent, EventType, Subscription } from "../event-bus/types.js";
import type { NotificationLiveBridge } from "./NotificationLiveBridge.js";
import {
  NOTIFICATION_SUBSCRIBE_EVENTS,
  type BridgeCallResult,
  type SubscriberDelivery,
} from "./types.js";

export class NotificationSubscriber {
  readonly subscriptions: Subscription[] = [];
  readonly deliveries: SubscriberDelivery[] = [];
  readonly bridgeCalls: BridgeCallResult[] = [];

  constructor(
    private readonly bus: EventBus,
    private readonly bridge: NotificationLiveBridge,
  ) {}

  register(): Subscription[] {
    for (const eventType of NOTIFICATION_SUBSCRIBE_EVENTS) {
      const sub = this.bus.subscribe(
        "notification-department",
        eventType,
        async (event: BusEvent) => {
          await this.handle(event);
        },
        "live-monitoring:notification-subscriber",
      );
      this.subscriptions.push(sub);
    }
    return this.subscriptions;
  }

  private async handle(event: BusEvent): Promise<void> {
    const call = await this.bridge.forward(event);
    this.bridgeCalls.push(call);
    this.deliveries.push({
      event_id: event.id,
      event_type: event.type,
      at: new Date().toISOString(),
      bridged: true,
      mode: call.mode,
      delivery_status: call.delivery_status,
      note: call.dry_run
        ? "Dry-run — Commander pipeline not invoked"
        : call.commander_pipeline_used
          ? "Forwarded via sendLifecycleNotification"
          : call.error ?? "bridge result",
    });
  }

  subscribedTypes(): EventType[] {
    return [...NOTIFICATION_SUBSCRIBE_EVENTS];
  }
}
