import { appendFile, mkdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { RuntimeConfig } from "./config.js";
import type { DeliveryChannel, DeliveryRecord } from "./types.js";

function todayFile(): string {
  return new Date().toISOString().slice(0, 10);
}

export class DeliveryLog {
  constructor(private config: RuntimeConfig) {}

  private deliveryPath(date = todayFile()): string {
    return join(this.config.dispatchRoot, `delivery-${date}.jsonl`);
  }

  private sentPath(): string {
    return join(this.config.dispatchRoot, "_sent.jsonl");
  }

  async ensureDirs(): Promise<void> {
    await mkdir(this.config.dispatchRoot, { recursive: true });
  }

  async append(record: Omit<DeliveryRecord, "delivery_id" | "timestamp">): Promise<DeliveryRecord> {
    await this.ensureDirs();
    const full: DeliveryRecord = {
      delivery_id: randomUUID(),
      timestamp: new Date().toISOString(),
      ...record,
    };
    const line = `${JSON.stringify(full)}\n`;
    await appendFile(this.deliveryPath(), line, "utf8");
    if (full.status === "sent" || full.status === "dry_run") {
      await appendFile(
        this.sentPath(),
        `${JSON.stringify({
          event_id: full.event_id,
          channel: full.channel,
          timestamp: full.timestamp,
          delivery_id: full.delivery_id,
          ...(full.approval_id ? { approval_id: full.approval_id } : {}),
        })}\n`,
        "utf8",
      );
    }
    return full;
  }

  async wasDelivered(eventId: string, channel: DeliveryChannel): Promise<boolean> {
    const path = this.sentPath();
    if (!existsSync(path)) return false;
    const raw = await readFile(path, "utf8");
    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      try {
        const row = JSON.parse(line) as { event_id?: string; channel?: string };
        if (row.event_id === eventId && row.channel === channel) return true;
      } catch {
        // skip malformed
      }
    }
    return false;
  }
}
