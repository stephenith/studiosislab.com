import type { Task } from "./types.js";

/** Founder EXECUTE_NOW tasks must not be paused or replaced by reprioritization. */
export function isFounderExecuteNowTask(task: Task): boolean {
  if (task.backlog_id === "INBOX-EXEC") return true;
  const meta = task.metadata ?? {};
  if (meta.bypass_roadmap === true) return true;
  if (meta.source === "telegram_execute_now") return true;
  if (meta.command_class === "EXECUTE_NOW") return true;
  if (meta.inbox_execute === true) return true;
  return false;
}
