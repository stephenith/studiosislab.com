/**
 * Founder Control Center Director — aggregate-only operational headquarters.
 * AGENT #108
 */
import { discoverDepartments } from "./DepartmentDiscovery.js";
import {
  defaultFounderControlConfiguration,
  FCC_ROOT,
  persistFounderControlConfiguration,
} from "./FounderControlConfiguration.js";
import { writeFounderControlReports } from "./FounderControlReporter.js";
import { buildFounderDashboard } from "./SectionAggregators.js";
import type { FounderControlCenterResult } from "./types.js";

export function runFounderControlCenter(): FounderControlCenterResult {
  const generated_at = new Date().toISOString();
  persistFounderControlConfiguration(defaultFounderControlConfiguration());

  const departments = discoverDepartments();
  const { dashboard } = buildFounderDashboard(generated_at);

  const checks = {
    runtime_aggregation: Boolean(dashboard.ai_os_status.runtime),
    website_aggregation: Boolean(dashboard.website.website_health),
    timeline_aggregation: Boolean(dashboard.timeline.current_sprint),
    security_aggregation: Boolean(dashboard.security.security_level),
    notification_aggregation:
      dashboard.notifications.unread_alerts !== undefined,
    production_aggregation: Boolean(dashboard.resume_factory.current_batch),
    release_aggregation: Boolean(dashboard.releases.latest_release),
    action_queue: Array.isArray(dashboard.action_queue),
    reports: true,
  };

  const available = departments.filter((d) => d.available).length;
  const allPass = Object.values(checks).every(Boolean);
  let status: FounderControlCenterResult["status"] = "READY";
  if (!allPass) status = "DEGRADED";
  if (available < 10) status = "BLOCKED";

  const result: FounderControlCenterResult = {
    generated_at,
    status,
    departments,
    dashboard,
    checks,
    output_dir: FCC_ROOT,
  };

  writeFounderControlReports(result);
  return result;
}

const isMain =
  typeof process.argv[1] === "string" &&
  (process.argv[1].endsWith("FounderControlCenterDirector.ts") ||
    process.argv[1].endsWith("FounderControlCenterDirector.js"));

if (isMain) {
  const result = runFounderControlCenter();
  console.log(
    JSON.stringify(
      {
        status: result.status,
        overall_health: result.dashboard.ai_os_status.overall_health,
        actions: result.dashboard.action_queue.length,
        recommended: result.dashboard.recommended_next_action,
        output_dir: result.output_dir,
      },
      null,
      2,
    ),
  );
}
