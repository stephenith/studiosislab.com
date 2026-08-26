/**
 * Shared snapshot display helpers — Agent #156
 * Standardize NA / formatting across ops dashboards (no fabricated values).
 */
import type { BadgeTone } from "../design-system/components/Badge";

export const NA = "No runtime data available";

export function display(
  value: string | number | boolean | null | undefined,
): string {
  if (value == null || value === "") return NA;
  return String(value);
}

export function formatWhen(iso: string | null | undefined): string {
  if (!iso) return NA;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return NA;
  return new Date(t).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function isToday(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return false;
  const d = new Date(t);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function scoreOrNa(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return NA;
  return String(Math.round(n));
}

export function yesNo(value: boolean | null | undefined): string {
  if (value == null) return NA;
  return value ? "YES" : "NO";
}

export function healthTone(health: string): BadgeTone {
  const h = health.toLowerCase();
  if (
    h === "healthy" ||
    h === "enabled" ||
    h === "ok" ||
    h === "completed" ||
    h === "approved" ||
    h === "true"
  ) {
    return "approved";
  }
  if (
    h === "disabled" ||
    h === "blocked" ||
    h === "fail" ||
    h === "failed" ||
    h === "rejected" ||
    h === "false"
  ) {
    return "blocked";
  }
  if (h === "degraded" || h === "waiting" || h === "waiting_founder") {
    return "waiting";
  }
  return "processing";
}
