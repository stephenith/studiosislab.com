/**
 * Official AI OS clock.
 */
import type { ClockState } from "./types.js";

export function readTimelineClock(now = new Date(), timezone = "Asia/Kolkata"): ClockState {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    weekday: "long",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(now).map((p) => [p.type, p.value]),
  ) as Record<string, string>;

  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const time = `${parts.hour}:${parts.minute}:${parts.second}`;

  return {
    now_iso: now.toISOString(),
    date,
    time,
    timezone,
    week: isoWeekNumber(now, timezone),
    month,
    year,
    weekday: parts.weekday ?? "Unknown",
  };
}

function isoWeekNumber(date: Date, timezone: string): number {
  const local = new Date(
    date.toLocaleString("en-US", { timeZone: timezone }),
  );
  const target = new Date(Date.UTC(local.getFullYear(), local.getMonth(), local.getDate()));
  const dayNum = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function daysBetween(aIsoDate: string, bIsoDate: string): number {
  const a = Date.parse(`${aIsoDate}T00:00:00.000Z`);
  const b = Date.parse(`${bIsoDate}T00:00:00.000Z`);
  return Math.floor((b - a) / 86_400_000);
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
