/**
 * Publish Runtime Manager health onto the Event Bus (read-only source).
 */
import type { EventBusPublisherBridge } from "./EventBusPublisherBridge.js";
import { readJsonSafe } from "./publisher-utils.js";
import type { PublishResult } from "./types.js";

const SOURCE = "SOS/07_LOGS/saios/runtime-manager/runtime-health.json";

export async function publishRuntimeEvents(
  bridge: EventBusPublisherBridge,
): Promise<PublishResult> {
  const file = readJsonSafe<{
    overall?: string;
    departments?: Array<{ id?: string; health?: string; available?: boolean }>;
  }>(SOURCE);

  const result: PublishResult = {
    publisher: "runtime-manager",
    source_path: file.path,
    source_available: file.ok,
    events_published: 0,
    event_types: [],
    notes: [],
  };

  if (!file.ok || !file.data) {
    result.notes.push("runtime-health.json unavailable — skipped");
    return result;
  }

  const overall = String(file.data.overall ?? "unknown").toUpperCase();
  let type: "SYSTEM_HEALTHY" | "SYSTEM_WARNING" | "SYSTEM_CRITICAL" =
    "SYSTEM_HEALTHY";
  if (overall === "CRITICAL" || overall === "FAILED" || overall === "DOWN") {
    type = "SYSTEM_CRITICAL";
  } else if (overall === "DEGRADED" || overall === "WARNING") {
    type = "SYSTEM_WARNING";
  }

  await bridge.publish(type, "runtime-manager", {
    overall,
    department_count: file.data.departments?.length ?? 0,
    from_file: SOURCE,
  });
  result.events_published = 1;
  result.event_types.push(type);
  return result;
}
