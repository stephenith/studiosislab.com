import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { RuntimeConfig } from "./config.js";
import type { EventEnvelope } from "./types.js";

export class QuietHoursQueue {
  private path: string;

  constructor(config: RuntimeConfig) {
    this.path = join(config.dispatchRoot, "queued.jsonl");
  }

  async enqueue(event: EventEnvelope, reason: string): Promise<void> {
    await mkdir(join(this.path, ".."), { recursive: true });
    await appendFile(
      this.path,
      `${JSON.stringify({
        queued_at: new Date().toISOString(),
        reason,
        event,
      })}\n`,
      "utf8",
    );
  }
}
