/**
 * Publish Website Department alerts onto the Event Bus (read-only source).
 */
import type { EventBusPublisherBridge } from "./EventBusPublisherBridge.js";
import { readJsonSafe } from "./publisher-utils.js";
import type { PublishResult } from "./types.js";

const SOURCE = "SOS/07_LOGS/saios/website-department/website-alerts.json";
const HEALTH = "SOS/07_LOGS/saios/website-department/website-health.json";

export async function publishWebsiteEvents(
  bridge: EventBusPublisherBridge,
): Promise<PublishResult> {
  const file = readJsonSafe<{
    alerts?: Array<{
      id?: string;
      severity?: string;
      title?: string;
      message?: string;
    }>;
  }>(SOURCE);
  const health = readJsonSafe<{ status?: string }>(HEALTH);

  const result: PublishResult = {
    publisher: "website",
    source_path: file.path,
    source_available: file.ok,
    events_published: 0,
    event_types: [],
    notes: [],
  };

  const alerts = file.data?.alerts ?? [];
  const warnings = alerts.filter((a) => {
    const s = String(a.severity ?? "").toLowerCase();
    return s === "warning" || s === "critical" || s === "error";
  });

  if (warnings.length > 0) {
    await bridge.publish("WEBSITE_WARNING", "website-department", {
      alert_count: warnings.length,
      sample: warnings[0],
      from_file: SOURCE,
    });
    result.events_published += 1;
    result.event_types.push("WEBSITE_WARNING");
  } else {
    const status = health.data?.status ?? "HEALTHY";
    await bridge.publish("WEBSITE_HEALTHY", "website-department", {
      status,
      alert_count: alerts.length,
      from_file: HEALTH,
    });
    result.events_published += 1;
    result.event_types.push("WEBSITE_HEALTHY");
    result.notes.push("No website warnings — published WEBSITE_HEALTHY");
  }

  return result;
}
