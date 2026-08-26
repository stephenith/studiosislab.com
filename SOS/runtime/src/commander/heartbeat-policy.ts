/** Heartbeat escalation thresholds — never kill for busy workers below frozen. */
export const HEARTBEAT_POLICY = {
  /** Worker write interval (independent of task loop). */
  interval_ms: parseInt(process.env.SOS_WORKER_HEARTBEAT_MS ?? "30000", 10),
  /** Age before marking late (informational). */
  late_ms: parseInt(process.env.SOS_HEARTBEAT_LATE_MS ?? "90000", 10),
  /** Age before warning (logged + surfaced in health). */
  warning_ms: parseInt(process.env.SOS_HEARTBEAT_WARNING_MS ?? "180000", 10),
  /** Age before critical (alert-worthy, still no kill). */
  critical_ms: parseInt(process.env.SOS_HEARTBEAT_CRITICAL_MS ?? "300000", 10),
  /** Age before frozen — only level that may trigger restart. */
  frozen_ms: parseInt(process.env.SOS_HEARTBEAT_FROZEN_MS ?? "1800000", 10),
  /** Commander health check interval. */
  monitor_interval_ms: parseInt(process.env.SOS_COMMANDER_HEALTH_MS ?? "10000", 10),
} as const;

export type HeartbeatLevel = "healthy" | "late" | "warning" | "critical" | "frozen";

export function classifyHeartbeatAge(ageMs: number | null): HeartbeatLevel {
  if (ageMs === null || ageMs < 0) return "critical";
  if (ageMs >= HEARTBEAT_POLICY.frozen_ms) return "frozen";
  if (ageMs >= HEARTBEAT_POLICY.critical_ms) return "critical";
  if (ageMs >= HEARTBEAT_POLICY.warning_ms) return "warning";
  if (ageMs >= HEARTBEAT_POLICY.late_ms) return "late";
  return "healthy";
}

export function shouldRestartWorker(level: HeartbeatLevel): boolean {
  return level === "frozen";
}
