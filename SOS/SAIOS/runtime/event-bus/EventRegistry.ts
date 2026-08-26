/**
 * Canonical event type registry.
 */
import type { EventType } from "./types.js";

export const REGISTERED_EVENTS: EventType[] = [
  "SYSTEM_START",
  "SYSTEM_STOP",
  "SYSTEM_HEALTHY",
  "SYSTEM_WARNING",
  "SYSTEM_CRITICAL",
  "WEBSITE_WARNING",
  "WEBSITE_HEALTHY",
  "TIMELINE_REMINDER",
  "SECURITY_WARNING",
  "SECURITY_CRITICAL",
  "RUNTIME_RESTART",
  "FOUNDER_REVIEW_PENDING",
  "PUBLICATION_READY",
  "PUBLICATION_RELEASED",
  "BATCH_COMPLETED",
  "NOTIFICATION_READY",
  "CUSTOM_EVENT",
];

export function isRegisteredEvent(type: string): type is EventType {
  return (REGISTERED_EVENTS as string[]).includes(type);
}

export function listRegisteredEvents(): EventType[] {
  return [...REGISTERED_EVENTS];
}

export function eventRegistryDocument(generatedAt: string) {
  return {
    generated_at: generatedAt,
    version: "1.0.0",
    count: REGISTERED_EVENTS.length,
    events: REGISTERED_EVENTS.map((type) => ({
      type,
      category: type.startsWith("SYSTEM_")
        ? "system"
        : type.startsWith("SECURITY_")
          ? "security"
          : type.startsWith("WEBSITE_")
            ? "website"
            : type.startsWith("PUBLICATION_") || type === "BATCH_COMPLETED"
              ? "publication"
              : type === "CUSTOM_EVENT"
                ? "custom"
                : "department",
    })),
  };
}
