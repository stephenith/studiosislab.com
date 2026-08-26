/**
 * In-memory event history with bounded retention.
 */
import type { BusEvent } from "./types.js";

export class EventHistory {
  private events: BusEvent[] = [];

  constructor(private readonly maxHistory: number) {}

  append(event: BusEvent): void {
    this.events.push(event);
    if (this.events.length > this.maxHistory) {
      this.events = this.events.slice(-this.maxHistory);
    }
  }

  list(): BusEvent[] {
    return [...this.events];
  }

  count(): number {
    return this.events.length;
  }

  clear(): void {
    this.events = [];
  }

  toDocument(generatedAt: string) {
    return {
      generated_at: generatedAt,
      count: this.events.length,
      max_history: this.maxHistory,
      events: this.list(),
    };
  }
}
