/**
 * Restart coordinator — dry-run restarts only; never modifies Runtime Loop code.
 */
import type {
  FailureFinding,
  RestartRecord,
  SupervisorConfiguration,
} from "./types.js";

export class RestartCoordinator {
  private history: RestartRecord[] = [];
  private attempts = 0;
  private lastRestartAt = 0;

  constructor(private readonly config: SupervisorConfiguration) {}

  getHistory(): RestartRecord[] {
    return [...this.history];
  }

  canRestart(): boolean {
    if (this.attempts >= this.config.max_restart_attempts) return false;
    if (Date.now() - this.lastRestartAt < this.config.restart_cooldown_ms) {
      return false;
    }
    return true;
  }

  async restartRuntimeLoop(reason: string): Promise<RestartRecord> {
    return this.record("runtime-loop", "runtime-loop", reason, true);
  }

  async restartDepartment(id: string, reason: string): Promise<RestartRecord> {
    return this.record("department", id, reason, true);
  }

  async restartScheduler(reason: string): Promise<RestartRecord> {
    return this.record("scheduler", "scheduler", reason, true);
  }

  planFromFailures(failures: FailureFinding[]): RestartRecord[] {
    const out: RestartRecord[] = [];
    if (!this.canRestart()) return out;

    if (failures.some((f) => f.id === "heartbeat-stale" || f.area === "runtime-loop")) {
      // Actual async restart happens in Watchdog; here we only note intent in dry-run path via Watchdog
    }

    for (const f of failures.filter((x) => x.area === "department" && x.severity === "critical")) {
      if (!this.canRestart()) break;
      // deferred to RecoveryCoordinator
      void f;
    }
    return out;
  }

  private async record(
    target: RestartRecord["target"],
    target_id: string,
    reason: string,
    success: boolean,
  ): Promise<RestartRecord> {
    this.attempts += 1;
    this.lastRestartAt = Date.now();
    const rec: RestartRecord = {
      at: new Date().toISOString(),
      target,
      target_id,
      success: this.config.dry_run ? true : success,
      dry_run: this.config.dry_run,
      reason,
    };
    this.history.push(rec);
    return rec;
  }
}
