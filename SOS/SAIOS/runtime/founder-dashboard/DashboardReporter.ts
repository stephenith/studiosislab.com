/**
 * Dashboard reporter — persist founder dashboard artifacts.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const SOS_ROOT = resolve(import.meta.dirname, "../../..");
export const DASHBOARD_ROOT = join(SOS_ROOT, "07_LOGS/saios/founder-dashboard");

export function persistDashboardArtifacts(input: {
  dashboard: object;
  health: object;
  queue: object;
  production: object;
  review: object;
  reports: object;
  statistics: object;
  factory_status: object;
  persist?: boolean;
}): string[] {
  const persist = input.persist !== false;
  if (persist) mkdirSync(DASHBOARD_ROOT, { recursive: true });

  const files = [
    ["dashboard.json", input.dashboard],
    ["health.json", input.health],
    ["queue.json", input.queue],
    ["production.json", input.production],
    ["review.json", input.review],
    ["reports.json", input.reports],
    ["statistics.json", input.statistics],
    ["factory-status.json", input.factory_status],
  ] as const;

  const written: string[] = [];
  for (const [name, content] of files) {
    const path = join(DASHBOARD_ROOT, name);
    if (persist) writeFileSync(path, JSON.stringify(content, null, 2));
    written.push(name);
  }
  return written;
}
