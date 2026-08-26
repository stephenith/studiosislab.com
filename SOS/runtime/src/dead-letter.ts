import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { RuntimeConfig } from "./config.js";
import type { DeadLetterEntry, DeliveryChannel, EventEnvelope } from "./types.js";

export class DeadLetterQueue {
  private path: string;

  constructor(config: RuntimeConfig) {
    this.path = join(config.dispatchRoot, "dead-letter.jsonl");
  }

  async enqueue(
    event: EventEnvelope,
    channel: DeliveryChannel,
    attempts: number,
    finalError: string,
  ): Promise<DeadLetterEntry> {
    await mkdir(join(this.path, ".."), { recursive: true });
    const entry: DeadLetterEntry = {
      event,
      channel,
      attempts,
      final_error: finalError,
      dead_lettered_at: new Date().toISOString(),
    };
    await appendFile(this.path, `${JSON.stringify(entry)}\n`, "utf8");
    return entry;
  }
}
