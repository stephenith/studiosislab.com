/**
 * Schedule planner — hourly, daily, weekly, monthly, cron.
 */
import type { ProductionGoal, ScheduleFrequency } from "./types.js";

export function isGoalDue(goal: ProductionGoal, lastRun: string | undefined, now = new Date()): boolean {
  if (!goal.enabled) return false;
  if (goal.frequency === "manual") return false;

  const last = lastRun ? new Date(lastRun) : null;

  switch (goal.frequency) {
    case "hourly":
      return !last || now.getTime() - last.getTime() >= 3_600_000;
    case "daily":
      return !last || !sameDay(last, now);
    case "weekly":
      return !last || now.getTime() - last.getTime() >= 7 * 86_400_000;
    case "monthly":
      return !last || last.getMonth() !== now.getMonth() || last.getFullYear() !== now.getFullYear();
    case "cron":
      return goal.cron_expression ? matchesCron(goal.cron_expression, now) : false;
    default:
      return false;
  }
}

function sameDay(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate();
}

/** Simple cron matcher: minute hour day month weekday */
export function matchesCron(expression: string, now = new Date()): boolean {
  const parts = expression.trim().split(/\s+/);
  if (parts.length < 5) return false;
  const [min, hour, day, month, weekday] = parts;
  return (
    matchField(min!, now.getUTCMinutes(), 0, 59) &&
    matchField(hour!, now.getUTCHours(), 0, 23) &&
    matchField(day!, now.getUTCDate(), 1, 31) &&
    matchField(month!, now.getUTCMonth() + 1, 1, 12) &&
    matchField(weekday!, now.getUTCDay(), 0, 6)
  );
}

function matchField(field: string, value: number, min: number, max: number): boolean {
  if (field === "*") return true;
  if (field.startsWith("*/")) {
    const step = Number(field.slice(2));
    return value % step === 0;
  }
  if (field.includes(",")) {
    return field.split(",").map(Number).includes(value);
  }
  return Number(field) === value;
}
