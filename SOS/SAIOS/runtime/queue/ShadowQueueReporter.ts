/**
 * ShadowQueueReporter — markdown summary (Agent #168).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ShadowQueueRepository } from "./ShadowQueueRepository.js";

export class ShadowQueueReporter {
  writeMarkdown(repo: ShadowQueueRepository): string {
    const latest = repo.loadLatest();
    const health = repo.loadHealth();
    const records = repo.list();
    const lines = [
      "# Shadow Queue Log",
      "",
      `Updated: ${new Date().toISOString()}`,
      `Mode: shadow_receive_only · shadow=true · dispatch_allowed=false · execution_allowed=false · publishing_allowed=false`,
      "",
      `Received: ${health?.received_count ?? records.length}`,
      "",
      latest
        ? `Latest: ${latest.mission_id} · ${latest.status} · ${latest.shadow_queue_id ?? "—"}`
        : "Latest: none",
      "",
      "## Records",
      "",
    ];
    for (const r of records.slice(-20).reverse()) {
      lines.push(
        `- ${r.received_timestamp} · ${r.shadow_queue_id} · ${r.mission_id} · sub ${r.submission_id} · ${r.submission_checksum.slice(0, 12)}…${r.fixture ? " · fixture" : ""}`,
      );
    }
    lines.push("");
    mkdirSync(repo.dir, { recursive: true });
    const path = join(repo.dir, "SHADOW_QUEUE_LOG.md");
    writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
    return path;
  }
}
