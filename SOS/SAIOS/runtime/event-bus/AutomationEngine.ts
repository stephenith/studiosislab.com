/**
 * Automation engine — executes rule intents as bus deliveries / follow-up emits.
 * Never calls department business logic directly.
 */
import type { AutomationRuleEngine } from "./AutomationRuleEngine.js";
import type { EventPublisher } from "./EventPublisher.js";
import type {
  AutomationTrace,
  BusEvent,
  RoutedDelivery,
} from "./types.js";

export class AutomationEngine {
  private traces: AutomationTrace[] = [];
  private deliveries: RoutedDelivery[] = [];

  constructor(
    private readonly rules: AutomationRuleEngine,
    private readonly publisher: EventPublisher,
  ) {}

  async process(event: BusEvent): Promise<{
    traces: AutomationTrace[];
    deliveries: RoutedDelivery[];
  }> {
    const traces = this.rules.apply(event);
    const deliveries: RoutedDelivery[] = [];

    for (const trace of traces) {
      for (const action of trace.actions_taken) {
        deliveries.push({
          event_id: event.id,
          event_type: event.type,
          target_department: action.target_department,
          status: "queued",
          at: new Date().toISOString(),
          note: action.intent,
        });

        if (action.emit) {
          const followUp = await this.publisher.publish(
            action.emit,
            `automation:${trace.rule_id}`,
            {
              from_event: event.id,
              from_type: event.type,
              target_department: action.target_department,
              intent: action.intent,
              automation: true,
            },
            event.correlation_id ?? event.id,
          );
          deliveries.push({
            event_id: followUp.id,
            event_type: followUp.type,
            target_department: action.target_department,
            status: "delivered",
            at: followUp.created_at,
            note: `Emitted ${action.emit} via automation (no direct department call)`,
          });
        }
      }
    }

    this.traces.push(...traces);
    this.deliveries.push(...deliveries);
    return { traces, deliveries };
  }

  getTraces(): AutomationTrace[] {
    return [...this.traces];
  }

  getDeliveries(): RoutedDelivery[] {
    return [...this.deliveries];
  }

  clear(): void {
    this.traces = [];
    this.deliveries = [];
  }
}
