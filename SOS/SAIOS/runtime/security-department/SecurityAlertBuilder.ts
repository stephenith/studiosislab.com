/**
 * Build structured alerts (do not send).
 */
import type { SecurityAlert, SecurityFinding, SecurityLevel } from "./types.js";

const ALERT_THRESHOLD: Record<SecurityLevel, boolean> = {
  GREEN: false,
  YELLOW: true,
  ORANGE: true,
  RED: true,
  CRITICAL: true,
};

export function buildSecurityAlerts(
  findings: SecurityFinding[],
  generatedAt: string,
): SecurityAlert[] {
  return findings
    .filter((f) => ALERT_THRESHOLD[f.level])
    .map((f, i) => ({
      id: `sec-alert-${f.id}-${i}`,
      level: f.level,
      title: f.title,
      message: f.detail,
      area: f.area,
      created_at: generatedAt,
      channel_ready: false as const,
      payload: {
        finding_id: f.id,
        source: f.source,
        pass: f.pass,
        for_notification_department: true,
        send: false,
      },
    }));
}
