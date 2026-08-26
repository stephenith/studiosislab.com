/**
 * Aggregate department publisher adapters — read logs, publish events only.
 */
import type { EventBusPublisherBridge } from "./EventBusPublisherBridge.js";
import { publishRuntimeEvents } from "./RuntimePublisher.js";
import { publishSecurityEvents } from "./SecurityPublisher.js";
import { publishTimelineEvents } from "./TimelinePublisher.js";
import { publishWebsiteEvents } from "./WebsitePublisher.js";
import type { PublishResult } from "./types.js";

export async function runDepartmentPublishers(
  bridge: EventBusPublisherBridge,
): Promise<PublishResult[]> {
  const results: PublishResult[] = [];
  results.push(await publishSecurityEvents(bridge));
  results.push(await publishWebsiteEvents(bridge));
  results.push(await publishTimelineEvents(bridge));
  results.push(await publishRuntimeEvents(bridge));
  return results;
}
