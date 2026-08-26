import { appendFile, readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { RuntimeConfig } from "./config.js";
import type { DeliveryChannel, EventEnvelope, RetryEntry } from "./types.js";

export class RetryQueue {
  private path: string;

  constructor(config: RuntimeConfig) {
    this.path = join(config.dispatchRoot, "retry.jsonl");
  }

  async ensure(): Promise<void> {
    await mkdir(join(this.path, ".."), { recursive: true });
  }

  computeDelayMs(attempt: number, config: RuntimeConfig): number {
    const base = config.retry.base_delay_ms;
    const max = config.retry.max_delay_ms;
    const delay = base * Math.pow(2, Math.max(0, attempt - 1));
    return Math.min(delay, max);
  }

  async enqueue(
    event: EventEnvelope,
    channel: DeliveryChannel,
    attempt: number,
    error: string,
    config: RuntimeConfig,
  ): Promise<RetryEntry> {
    await this.ensure();
    const delayMs = this.computeDelayMs(attempt, config);
    const entry: RetryEntry = {
      event,
      channel,
      attempt,
      next_attempt_at: new Date(Date.now() + delayMs).toISOString(),
      last_error: error,
      created_at: new Date().toISOString(),
    };
    await appendFile(this.path, `${JSON.stringify(entry)}\n`, "utf8");
    return entry;
  }

  async loadDue(now = new Date()): Promise<RetryEntry[]> {
    if (!existsSync(this.path)) return [];
    const raw = await readFile(this.path, "utf8");
    const due: RetryEntry[] = [];
    const remaining: RetryEntry[] = [];

    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line) as RetryEntry;
        if (Date.parse(entry.next_attempt_at) <= now.getTime()) {
          due.push(entry);
        } else {
          remaining.push(entry);
        }
      } catch {
        // drop malformed
      }
    }

    await writeFile(
      this.path,
      remaining.map((e) => JSON.stringify(e)).join("\n") +
        (remaining.length ? "\n" : ""),
      "utf8",
    );

    return due;
  }

  async clear(): Promise<void> {
    if (existsSync(this.path)) {
      await writeFile(this.path, "", "utf8");
    }
  }
}
