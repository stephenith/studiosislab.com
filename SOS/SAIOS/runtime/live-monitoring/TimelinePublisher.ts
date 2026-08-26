/**
 * Publish Timeline reminders onto the Event Bus (read-only source).
 */
import type { EventBusPublisherBridge } from "./EventBusPublisherBridge.js";
import { readJsonSafe } from "./publisher-utils.js";
import type { PublishResult } from "./types.js";

const SOURCE = "SOS/07_LOGS/saios/timeline-department/timeline-reminders.json";

export async function publishTimelineEvents(
  bridge: EventBusPublisherBridge,
): Promise<PublishResult> {
  const file = readJsonSafe<{
    reminders?: Array<{
      id?: string;
      kind?: string;
      title?: string;
      message?: string;
      related_ref?: string;
    }>;
  }>(SOURCE);

  const result: PublishResult = {
    publisher: "timeline",
    source_path: file.path,
    source_available: file.ok,
    events_published: 0,
    event_types: [],
    notes: [],
  };

  if (!file.ok || !file.data) {
    result.notes.push("timeline-reminders.json unavailable — skipped");
    return result;
  }

  const reminders = file.data.reminders ?? [];
  const critical = reminders.filter(
    (r) =>
      String(r.kind).toUpperCase() === "CRITICAL" ||
      String(r.kind).toUpperCase() === "OVERDUE",
  );
  const founder = reminders.filter((r) =>
    /founder/i.test(`${r.title ?? ""} ${r.related_ref ?? ""} ${r.message ?? ""}`),
  );

  if (reminders.length > 0) {
    await bridge.publish("TIMELINE_REMINDER", "timeline-department", {
      reminder_count: reminders.length,
      critical_count: critical.length,
      sample: reminders[0],
      from_file: SOURCE,
    });
    result.events_published += 1;
    result.event_types.push("TIMELINE_REMINDER");
  }

  if (founder.length > 0) {
    await bridge.publish("FOUNDER_REVIEW_PENDING", "timeline-department", {
      count: founder.length,
      sample: founder[0],
      from_file: SOURCE,
    });
    result.events_published += 1;
    result.event_types.push("FOUNDER_REVIEW_PENDING");
  }

  if (result.events_published === 0) {
    result.notes.push("No timeline reminders to publish");
  }
  return result;
}
