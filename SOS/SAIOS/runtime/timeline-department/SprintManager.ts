/**
 * Sprint calculation for AI OS Timeline.
 */
import { addDays, daysBetween } from "./TimelineClock.js";
import type { ClockState, SprintState } from "./types.js";
import type { TimelineConfig } from "./TimelineConfig.js";

export function buildSprintState(clock: ClockState, config: TimelineConfig): SprintState {
  const epoch = config.project_epoch;
  const length = config.sprint_length_days;
  const daysSinceEpoch = Math.max(0, daysBetween(epoch, clock.date));
  const sprintIndex = Math.floor(daysSinceEpoch / length) + 1;
  const sprintOffset = daysSinceEpoch % length;
  const start = addDays(epoch, (sprintIndex - 1) * length);
  const end = addDays(start, length - 1);

  return {
    id: `sprint-${String(sprintIndex).padStart(3, "0")}`,
    label: `AI OS Sprint ${sprintIndex}`,
    start_date: start,
    end_date: end,
    day_index: sprintOffset + 1,
    length_days: length,
    focus: "AI OS department foundation · Timeline / Notifications / Website",
  };
}
