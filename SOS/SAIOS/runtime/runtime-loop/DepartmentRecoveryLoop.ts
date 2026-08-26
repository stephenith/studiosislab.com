/**
 * Recovery loop — restart attempt only (simulated in dry-run).
 * Publishes SYSTEM_WARNING / SYSTEM_CRITICAL via Event Bus; never rewrites department state.
 */
import { EventBus } from "../event-bus/EventBus.js";
import type {
  DepartmentHealth,
  LoopConfiguration,
  RecoveryAttempt,
} from "./types.js";

export class DepartmentRecoveryLoop {
  private attempts: RecoveryAttempt[] = [];

  constructor(
    private readonly config: LoopConfiguration,
    private readonly bus: EventBus | null,
  ) {}

  getAttempts(): RecoveryAttempt[] {
    return [...this.attempts];
  }

  async recoverUnhealthy(health: DepartmentHealth[]): Promise<RecoveryAttempt[]> {
    const now = new Date().toISOString();
    const batch: RecoveryAttempt[] = [];

    for (const row of health) {
      if (row.health === "ok" || row.health === "unknown") continue;

      const critical = row.health === "failed";
      const attempt: RecoveryAttempt = {
        at: now,
        department_id: row.id,
        action: "restart",
        success: this.config.dry_run ? true : row.available,
        dry_run: this.config.dry_run,
        reason: row.detail,
      };

      if (!attempt.success) {
        attempt.action = "escalate";
        const eventType = critical ? "SYSTEM_CRITICAL" : "SYSTEM_WARNING";
        if (this.bus) {
          await this.bus.publish(eventType, "runtime-loop:recovery", {
            department_id: row.id,
            reason: row.detail,
            recovery: true,
          });
          attempt.event_published = eventType;
        }
      } else if (row.health === "degraded" && this.bus) {
        // Degraded but restart simulated OK — still warn once
        await this.bus.publish("SYSTEM_WARNING", "runtime-loop:recovery", {
          department_id: row.id,
          reason: row.detail,
          recovery_simulated: this.config.dry_run,
        });
        attempt.event_published = "SYSTEM_WARNING";
      }

      batch.push(attempt);
      this.attempts.push(attempt);
    }

    return batch;
  }
}
