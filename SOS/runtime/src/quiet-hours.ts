import type { RuntimeConfig } from "./config.js";
import type { Priority } from "./types.js";

function parseHm(hm: string): { hour: number; minute: number } {
  const [h, m] = hm.split(":").map((x) => parseInt(x, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) {
    throw new Error(`Invalid time format: ${hm} (expected HH:MM)`);
  }
  return { hour: h, minute: m };
}

function localParts(date: Date, timeZone: string): {
  hour: number;
  minute: number;
} {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const minute = parseInt(
    parts.find((p) => p.type === "minute")?.value ?? "0",
    10,
  );
  return { hour, minute };
}

function minutesSinceMidnight(hour: number, minute: number): number {
  return hour * 60 + minute;
}

export function isQuietHours(config: RuntimeConfig, at: Date = new Date()): boolean {
  const { hour, minute } = localParts(at, config.timezone);
  const now = minutesSinceMidnight(hour, minute);

  const start = parseHm(config.quiet_hours.start);
  const end = parseHm(config.quiet_hours.end);
  const startMin = minutesSinceMidnight(start.hour, start.minute);
  const endMin = minutesSinceMidnight(end.hour, end.minute);

  if (startMin === endMin) return false;

  // Overnight window e.g. 22:00 – 07:00
  if (startMin > endMin) {
    return now >= startMin || now < endMin;
  }

  return now >= startMin && now < endMin;
}

export function shouldDeferForQuietHours(
  priority: Priority,
  config: RuntimeConfig,
  at: Date = new Date(),
): boolean {
  if (!isQuietHours(config, at)) return false;
  // P0 always delivers; P1+ defer to morning queue
  return priority !== "P0";
}

export function formatLocalTime(config: RuntimeConfig, at: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: config.timezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(at);
}
