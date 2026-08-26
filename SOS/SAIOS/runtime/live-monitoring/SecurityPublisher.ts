/**
 * Publish Security Department alerts onto the Event Bus (read-only source).
 * Does not modify Security Department business logic.
 */
import type { EventBusPublisherBridge } from "./EventBusPublisherBridge.js";
import { mapSecurityLevelToEvent, readJsonSafe } from "./publisher-utils.js";
import type { PublishResult } from "./types.js";

const SOURCE = "SOS/07_LOGS/saios/security-department/security-alerts.json";

export async function publishSecurityEvents(
  bridge: EventBusPublisherBridge,
): Promise<PublishResult> {
  const file = readJsonSafe<{
    alerts?: Array<{
      id?: string;
      level?: string;
      title?: string;
      message?: string;
      area?: string;
    }>;
  }>(SOURCE);

  const result: PublishResult = {
    publisher: "security",
    source_path: file.path,
    source_available: file.ok,
    events_published: 0,
    event_types: [],
    notes: [],
  };

  if (!file.ok || !file.data) {
    result.notes.push("security-alerts.json unavailable — skipped");
    return result;
  }

  const published = new Set<string>();
  for (const alert of file.data.alerts ?? []) {
    const type = mapSecurityLevelToEvent(String(alert.level ?? ""));
    if (!type) continue;
    // Dedupe by event type for cascade (one WARNING / one CRITICAL per run)
    if (published.has(type)) continue;
    await bridge.publish(type, "security-department", {
      alert_id: alert.id,
      title: alert.title,
      message: alert.message,
      area: alert.area,
      level: alert.level,
      from_file: SOURCE,
    });
    published.add(type);
    result.events_published += 1;
    result.event_types.push(type);
  }

  if (result.events_published === 0) {
    result.notes.push("No WARNING/CRITICAL security alerts to publish");
  }
  return result;
}
