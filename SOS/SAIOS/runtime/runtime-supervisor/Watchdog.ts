/**
 * Watchdog — stale heartbeat → restart Runtime Loop → publish system events.
 * Never modifies Runtime Loop logic.
 */
import { EventBus } from "../event-bus/EventBus.js";
import type { RestartCoordinator } from "./RestartCoordinator.js";
import type {
  FailureFinding,
  HeartbeatStatus,
  RestartRecord,
  SupervisorConfiguration,
} from "./types.js";

export type WatchdogResult = {
  triggered: boolean;
  heartbeat: HeartbeatStatus;
  restart: RestartRecord | null;
  events_published: string[];
  detail: string;
};

export class Watchdog {
  private consecutiveFailures = 0;

  constructor(
    private readonly config: SupervisorConfiguration,
    private readonly restarts: RestartCoordinator,
    private readonly bus: EventBus,
  ) {}

  async evaluate(input: {
    heartbeat: HeartbeatStatus;
    failures: FailureFinding[];
  }): Promise<WatchdogResult> {
    const events_published: string[] = [];
    const stale =
      input.heartbeat.stale ||
      input.failures.some((f) => f.id === "heartbeat-stale");

    if (!stale) {
      this.consecutiveFailures = 0;
      await this.bus.publish("SYSTEM_HEALTHY", "runtime-supervisor:watchdog", {
        heartbeat_at: input.heartbeat.heartbeat_at,
        dry_run: this.config.dry_run,
      });
      events_published.push("SYSTEM_HEALTHY");
      return {
        triggered: false,
        heartbeat: input.heartbeat,
        restart: null,
        events_published,
        detail: "heartbeat fresh — no restart",
      };
    }

    this.consecutiveFailures += 1;
    let restart: RestartRecord | null = null;

    if (this.restarts.canRestart()) {
      restart = await this.restarts.restartRuntimeLoop(
        `watchdog stale heartbeat (failures=${this.consecutiveFailures})`,
      );
      restart.event_published = restart.success
        ? "SYSTEM_HEALTHY"
        : "SYSTEM_WARNING";

      if (restart.success) {
        await this.bus.publish("SYSTEM_HEALTHY", "runtime-supervisor:watchdog", {
          recovery: true,
          dry_run: this.config.dry_run,
        });
        events_published.push("SYSTEM_HEALTHY");
      } else {
        await this.bus.publish("SYSTEM_WARNING", "runtime-supervisor:watchdog", {
          recovery_failed: true,
          dry_run: this.config.dry_run,
        });
        events_published.push("SYSTEM_WARNING");
      }
    } else {
      await this.bus.publish("SYSTEM_WARNING", "runtime-supervisor:watchdog", {
        restart_blocked: true,
        dry_run: this.config.dry_run,
      });
      events_published.push("SYSTEM_WARNING");
    }

    if (this.consecutiveFailures >= 2 || input.failures.filter((f) => f.severity === "critical").length >= 2) {
      await this.bus.publish("SYSTEM_CRITICAL", "runtime-supervisor:watchdog", {
        consecutive_failures: this.consecutiveFailures,
        dry_run: this.config.dry_run,
      });
      events_published.push("SYSTEM_CRITICAL");
    }

    return {
      triggered: true,
      heartbeat: input.heartbeat,
      restart,
      events_published,
      detail: `watchdog triggered · restart=${restart?.success ?? false} · consecutive=${this.consecutiveFailures}`,
    };
  }
}
