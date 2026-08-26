/**
 * Subscription registry — departments listen via the bus, not direct calls.
 */
import type {
  DepartmentId,
  EventHandler,
  EventType,
  Subscription,
} from "./types.js";

type InternalSubscription = Subscription & { handler: EventHandler };

export class EventSubscriber {
  private subscriptions: InternalSubscription[] = [];
  private seq = 0;

  subscribe(
    department: DepartmentId | string,
    eventType: EventType | "*",
    handler: EventHandler,
    handlerLabel = "default",
  ): Subscription {
    const sub: InternalSubscription = {
      id: `sub-${++this.seq}-${department}`,
      department,
      event_type: eventType,
      handler_label: handlerLabel,
      created_at: new Date().toISOString(),
      handler,
    };
    this.subscriptions.push(sub);
    const { handler: _h, ...publicSub } = sub;
    return publicSub;
  }

  unsubscribe(subscriptionId: string): boolean {
    const before = this.subscriptions.length;
    this.subscriptions = this.subscriptions.filter((s) => s.id !== subscriptionId);
    return this.subscriptions.length < before;
  }

  matching(eventType: EventType): InternalSubscription[] {
    return this.subscriptions.filter(
      (s) => s.event_type === "*" || s.event_type === eventType,
    );
  }

  list(): Subscription[] {
    return this.subscriptions.map(({ handler: _h, ...rest }) => rest);
  }

  clear(): void {
    this.subscriptions = [];
  }
}
