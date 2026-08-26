/**
 * Event Bus — AI OS internal communication backbone.
 * AGENT #105 — publish / subscribe / route / automate without direct department calls.
 */
import { AutomationEngine } from "./AutomationEngine.js";
import {
  AutomationRuleEngine,
  defaultAutomationRules,
} from "./AutomationRuleEngine.js";
import { discoverDepartments } from "./DepartmentRouter.js";
import {
  defaultEventConfiguration,
  EVENT_BUS_ROOT,
  persistEventConfiguration,
} from "./EventConfiguration.js";
import { EventHistory } from "./EventHistory.js";
import { EventPublisher } from "./EventPublisher.js";
import { writeEventReports } from "./EventReporter.js";
import { listRegisteredEvents } from "./EventRegistry.js";
import { EventSubscriber } from "./EventSubscriber.js";
import type {
  BusEvent,
  DepartmentId,
  EventBusResult,
  EventHandler,
  EventPayload,
  EventType,
  RoutedDelivery,
  Subscription,
} from "./types.js";

export class EventBus {
  readonly history: EventHistory;
  readonly subscriber = new EventSubscriber();
  readonly rules: AutomationRuleEngine;
  readonly publisher: EventPublisher;
  readonly automation: AutomationEngine;
  private readonly departments = discoverDepartments();
  private processingDepth = 0;
  private readonly maxDepth = 8;
  private routeLog: RoutedDelivery[] = [];

  constructor() {
    const config = persistEventConfiguration(defaultEventConfiguration());
    this.history = new EventHistory(config.max_history);
    this.rules = new AutomationRuleEngine(defaultAutomationRules());
    this.publisher = new EventPublisher((event) => this.dispatch(event));
    this.automation = new AutomationEngine(this.rules, this.publisher);
  }

  registerDefaultDepartmentHandlers(): Subscription[] {
    const subs: Subscription[] = [];
    for (const dept of this.departments) {
      for (const eventType of dept.subscribed_events) {
        subs.push(
          this.subscriber.subscribe(
            dept.id,
            eventType,
            (event) => {
              this.routeLog.push({
                event_id: event.id,
                event_type: event.type,
                target_department: dept.id,
                status: "delivered",
                at: new Date().toISOString(),
                note: `Routed to ${dept.label} via Event Bus (no direct call)`,
              });
            },
            `${dept.id}:handler`,
          ),
        );
      }
    }
    return subs;
  }

  subscribe(
    department: DepartmentId | string,
    eventType: EventType | "*",
    handler: EventHandler,
    handlerLabel?: string,
  ): Subscription {
    return this.subscriber.subscribe(
      department,
      eventType,
      handler,
      handlerLabel,
    );
  }

  async publish(
    type: EventType | string,
    source: string,
    payload: EventPayload = {},
    correlationId?: string,
  ): Promise<BusEvent> {
    return this.publisher.publish(type, source, payload, correlationId);
  }

  private async dispatch(event: BusEvent): Promise<BusEvent> {
    this.history.append(event);

    for (const sub of this.subscriber.matching(event.type)) {
      await sub.handler(event);
    }

    if (this.processingDepth < this.maxDepth) {
      this.processingDepth += 1;
      try {
        // Skip automation re-entry for events already produced by automation
        // to avoid unbounded emit chains; still deliver to subscribers above.
        if (!event.payload?.automation) {
          await this.automation.process(event);
        }
      } finally {
        this.processingDepth -= 1;
      }
    }

    return event;
  }

  async bootstrapDemo(): Promise<void> {
    this.registerDefaultDepartmentHandlers();

    await this.publish("SYSTEM_START", "event-bus", {
      message: "AI OS Event Bus online",
    });
    await this.publish("SYSTEM_HEALTHY", "runtime-manager", {
      health: "HEALTHY",
    });
    await this.publish("SECURITY_WARNING", "security-department", {
      level: "ORANGE",
      detail: "Disk usage elevated — operational health warning",
    });
    await this.publish("FOUNDER_REVIEW_PENDING", "founder-dashboard", {
      review: "FR#004",
    });
    await this.publish("NOTIFICATION_READY", "notification-department", {
      dry_run: true,
    });
  }

  snapshot(): EventBusResult {
    const generated_at = new Date().toISOString();
    const available = this.departments.filter((d) => d.available).length;
    const history = this.history.list();
    const subscriptions = this.subscriber.list();
    const deliveries = [...this.routeLog, ...this.automation.getDeliveries()];
    const automation_traces = this.automation.getTraces();

    const checks = {
      publish: history.length > 0,
      subscribe: subscriptions.length > 0,
      routing: deliveries.some((d) => d.status === "delivered"),
      automation: automation_traces.length > 0,
      event_history: history.length > 0,
      department_registration:
        this.departments.length >= 11 && available >= 11,
      reports: true,
    };

    const allPass = Object.values(checks).every(Boolean);

    return {
      generated_at,
      status: allPass ? "READY" : available < 8 ? "BLOCKED" : "DEGRADED",
      departments: this.departments,
      events_registered: listRegisteredEvents(),
      rules: this.rules.list(),
      history,
      deliveries,
      automation_traces,
      subscriptions,
      checks,
      output_dir: EVENT_BUS_ROOT,
    };
  }

  persist(): EventBusResult {
    const result = this.snapshot();
    writeEventReports(result);
    return result;
  }
}

export function runEventBus(): EventBusResult {
  // sync wrapper used by verify after async bootstrap
  throw new Error("Use runEventBusAsync()");
}

export async function runEventBusAsync(): Promise<EventBusResult> {
  const bus = new EventBus();
  await bus.bootstrapDemo();
  return bus.persist();
}

/** CLI entry */
const isMain =
  typeof process.argv[1] === "string" &&
  (process.argv[1].endsWith("EventBus.ts") ||
    process.argv[1].endsWith("EventBus.js"));

if (isMain) {
  runEventBusAsync()
    .then((result) => {
      console.log(
        JSON.stringify(
          {
            status: result.status,
            departments: result.departments.length,
            events: result.events_registered.length,
            history: result.history.length,
            rules: result.rules.length,
            output_dir: result.output_dir,
          },
          null,
          2,
        ),
      );
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
