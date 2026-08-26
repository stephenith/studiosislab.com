import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { RuntimeConfig } from "./config.js";

type FailureRecord = { timestamp: string };

export class CircuitBreaker {
  private failures: FailureRecord[] = [];
  private statePath: string;

  constructor(private config: RuntimeConfig) {
    this.statePath = join(config.dispatchRoot, "circuit-breaker.json");
  }

  async load(): Promise<void> {
    if (!existsSync(this.statePath)) return;
    try {
      const raw = await readFile(this.statePath, "utf8");
      const parsed = JSON.parse(raw) as { failures?: FailureRecord[] };
      this.failures = parsed.failures ?? [];
      this.prune();
    } catch {
      this.failures = [];
    }
  }

  private prune(now = Date.now()): void {
    const windowMs = this.config.circuit_breaker.window_ms;
    this.failures = this.failures.filter(
      (f) => now - Date.parse(f.timestamp) < windowMs,
    );
  }

  async recordFailure(): Promise<void> {
    this.prune();
    this.failures.push({ timestamp: new Date().toISOString() });
    await this.persist();
  }

  async recordSuccess(): Promise<void> {
    this.prune();
    if (this.failures.length > 0) {
      this.failures = [];
      await this.persist();
    }
  }

  isOpen(now = Date.now()): boolean {
    this.prune(now);
    return (
      this.failures.length >= this.config.circuit_breaker.failure_threshold
    );
  }

  allowsPriority(priority: string): boolean {
    if (!this.isOpen()) return true;
    return priority === "P0";
  }

  private async persist(): Promise<void> {
    await mkdir(this.config.dispatchRoot, { recursive: true });
    await writeFile(
      this.statePath,
      JSON.stringify({ failures: this.failures }, null, 2),
      "utf8",
    );
  }
}
