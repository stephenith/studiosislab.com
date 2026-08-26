/**
 * Recovery coordinator — dry-run recovery actions + history.
 */
import type {
  FailureFinding,
  RecoveryRecord,
  RestartRecord,
  SupervisorConfiguration,
} from "./types.js";
import type { RestartCoordinator } from "./RestartCoordinator.js";

export class RecoveryCoordinator {
  private history: RecoveryRecord[] = [];
  private attempts = 0;

  constructor(
    private readonly config: SupervisorConfiguration,
    private readonly restarts: RestartCoordinator,
  ) {}

  getHistory(): RecoveryRecord[] {
    return [...this.history];
  }

  private push(
    action: RecoveryRecord["action"],
    detail: string,
    success = true,
  ): RecoveryRecord {
    this.attempts += 1;
    const rec: RecoveryRecord = {
      at: new Date().toISOString(),
      action,
      success: this.config.dry_run ? true : success,
      dry_run: this.config.dry_run,
      detail,
    };
    this.history.push(rec);
    return rec;
  }

  async recoverFromFailures(
    failures: FailureFinding[],
  ): Promise<{ recoveries: RecoveryRecord[]; restarts: RestartRecord[] }> {
    const recoveries: RecoveryRecord[] = [];
    const restartRecords: RestartRecord[] = [];

    if (this.attempts >= this.config.max_recovery_attempts) {
      recoveries.push(
        this.push(
          "reset_health_cache",
          "max recovery attempts reached — no further recovery",
          false,
        ),
      );
      return { recoveries, restarts: restartRecords };
    }

    if (failures.some((f) => f.id === "heartbeat-stale")) {
      recoveries.push(
        this.push(
          "clear_stale_heartbeat",
          "clear stale heartbeat cache (dry-run marker)",
        ),
      );
      if (this.restarts.canRestart()) {
        const r = await this.restarts.restartRuntimeLoop("stale heartbeat");
        restartRecords.push(r);
        recoveries.push(
          this.push(
            "restart_runtime_loop",
            `restart runtime loop · success=${r.success}`,
            r.success,
          ),
        );
      }
    }

    for (const f of failures.filter(
      (x) => x.area === "department" && x.severity === "critical",
    )) {
      if (this.attempts >= this.config.max_recovery_attempts) break;
      const id = f.id.replace(/^dept-failed-/, "");
      if (this.restarts.canRestart()) {
        const r = await this.restarts.restartDepartment(id, f.detail);
        restartRecords.push(r);
        recoveries.push(
          this.push(
            "restart_department",
            `restart ${id} · ${f.detail}`,
            r.success,
          ),
        );
      }
    }

    if (failures.some((f) => f.id === "scheduler-unhealthy")) {
      if (this.restarts.canRestart()) {
        const r = await this.restarts.restartScheduler("scheduler unhealthy");
        restartRecords.push(r);
        recoveries.push(
          this.push(
            "restart_scheduler",
            `scheduler restart · success=${r.success}`,
            r.success,
          ),
        );
      }
    }

    if (failures.length > 0) {
      recoveries.push(
        this.push("reset_health_cache", "reset supervisor health cache marker"),
      );
    }

    return { recoveries, restarts: restartRecords };
  }
}
