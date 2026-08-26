export type WorkerStatus =
  | "starting"
  | "running"
  | "crashed"
  | "restarting"
  | "stopped"
  | "graceful_shutdown";

export type WorkerHealth = {
  id: string;
  name: string;
  status: WorkerStatus;
  pid: number | null;
  started_at: string | null;
  last_heartbeat: string | null;
  crash_count: number;
  restart_count: number;
  last_exit_code: number | null;
  last_error: string | null;
  last_exit_reason: string | null;
  shutdown_reason: string | null;
  expected_exit: boolean | null;
  alerted: boolean;
};

export type CommanderHealth = {
  version: string;
  supervisor_pid: number;
  started_at: string;
  updated_at: string;
  uptime_seconds: number;
  status: "running" | "stopping" | "stopped" | "dead";
  commander_alive?: boolean;
  supervisor_alive?: boolean;
  telegram_liveness?: {
    commander_alive: boolean;
    supervisor_alive: boolean;
    telegram_alive: boolean;
    poller_alive: boolean;
    last_poll: string | null;
    last_successful_update: string | null;
    last_update_id: number | null;
    pending_update_count: number | null;
    telegram_conflict: boolean;
    poller_pid: number | null;
    poller_process_count: number;
    heartbeat_age_ms: number | null;
    last_poll_error: string | null;
    polling_mode: string | null;
    status: string;
  };
  instance_health?: "healthy" | "degraded" | "unhealthy";
  pm_processes_found?: number;
  developer_processes_found?: number;
  qa_processes_found?: number;
  telegram_processes_found?: number;
  dispatcher_processes_found?: number;
  shutdown_reason?: string | null;
  health_monitor: {
    status: "running" | "stopped";
    interval_seconds: number;
    last_write: string;
  };
  workers: WorkerHealth[];
  pipeline?: import("./pipeline-status.js").PipelineStatus;
  lock_recovery?: {
    developer_removed: number;
    qa_removed: number;
    at: string;
  };
  restart_history_count?: number;
  agent_heartbeats?: import("./agent-heartbeat.js").AgentHeartbeat[];
  graceful_stop?: import("./graceful-stop.js").GracefulStopReport;
  startup_recovery?: import("./startup-recovery.js").StartupRecoveryReport;
  heartbeat_monitor?: import("./heartbeat-monitor.js").HeartbeatMonitorReport;
  runtime_freeze?: import("../runtime/version.js").RuntimeFreezeInfo;
};

export type WorkerDefinition = {
  id: string;
  name: string;
  script: string;
  args?: string[];
  env?: Record<string, string>;
  depends_on?: string[];
  stale_after_ms?: number;
};
