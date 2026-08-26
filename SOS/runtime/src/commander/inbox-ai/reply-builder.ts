import type { PlatformStatus } from "./status.js";
import type { InboxCommandResult } from "./types.js";

export function buildHelpReply(): string {
  return [
    "Commander Inbox — you can message me naturally:",
    "",
    "Status: \"What's happening?\" / \"Status\"",
    "Queue: \"Show queue\" / \"How many tasks left?\"",
    "Roadmap: \"Show roadmap\"",
    "Developer: \"What is Developer doing?\"",
    "QA: \"What is QA doing?\"",
    "Priority: \"Pause SEO\" / \"Finish Mobile first\" / \"Resume Constitution\"",
    "Create (planning): \"Build invoice generator\" / \"Improve SEO\"",
    "Execute now: \"Create file SOS/...\" / \"Run tests\" / \"Fix ...\" / \"Verify ...\"",
    "Control: \"Stop all runtime work\" / \"Start all\"",
    "Plan: \"What should we build next?\"",
    "",
    "Approval replies still use CCP: APPROVE A, REJECT, DEFER, etc.",
  ].join("\n");
}

export function buildStatusReply(status: PlatformStatus): string {
  const pm = status.pm as {
    loop_status?: string;
    active_task?: { title?: string; status?: string } | null;
    selection?: { selected_title?: string; launch_stage?: string };
  };
  const dev = status.developer as { state?: string; current_task_id?: string | null };
  const qa = status.qa as { state?: string; current_task_id?: string | null };
  const roadmap = status.roadmap as { completion_pct?: number; launch_stage?: string };

  const lines = [
    "Here's what's happening:",
    "",
    `PM: ${pm.loop_status ?? "unknown"}${pm.active_task ? ` — working on "${pm.active_task.title}" (${pm.active_task.status})` : ""}`,
    `Developer: ${dev.state ?? "unknown"}${dev.current_task_id ? ` (task ${dev.current_task_id})` : ""}`,
    `QA: ${qa.state ?? "unknown"}${qa.current_task_id ? ` (task ${qa.current_task_id})` : ""}`,
    `Queue: ${status.queue_count} active item(s), ${status.paused_count} paused`,
    `Roadmap: ${roadmap.completion_pct ?? 0}% complete${roadmap.launch_stage ? ` · launch stage ${roadmap.launch_stage}` : ""}`,
  ];

  if (status.eta_hours !== null) {
    lines.push(`ETA: approximately ${status.eta_hours} hours of planned work remaining`);
  }

  if (pm.selection?.selected_title) {
    lines.push(`Next ranked: ${pm.selection.selected_title}`);
  }

  return lines.join("\n");
}

export function buildDeveloperReply(status: PlatformStatus): string {
  const dev = status.developer as Record<string, unknown>;
  const pm = status.pm as { active_task?: { title?: string } | null };
  return [
    "Developer status:",
    `State: ${dev.state ?? "unknown"}`,
    `Current task: ${dev.current_task_id ?? "none"}`,
    pm.active_task ? `PM active work: ${pm.active_task.title}` : "",
    dev.claimed_brief_path ? `Brief: ${dev.claimed_brief_path}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildQaReply(status: PlatformStatus): string {
  const qa = status.qa as Record<string, unknown>;
  return [
    "QA status:",
    `State: ${qa.state ?? "unknown"}`,
    `Current task: ${qa.current_task_id ?? "none"}`,
    qa.verification_phase ? `Phase: ${qa.verification_phase}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildPmReply(status: PlatformStatus): string {
  const pm = status.pm as Record<string, unknown>;
  return [
    "PM status:",
    `Loop: ${pm.loop_status ?? "unknown"}`,
    `Current task: ${pm.current_task_id ?? "none"}`,
    `Waiting approvals: ${Array.isArray(pm.waiting_approvals) ? pm.waiting_approvals.length : 0}`,
    `Queue length: ${pm.queue_length ?? 0}`,
  ].join("\n");
}

export function buildQueueReply(
  items: Array<{ backlog_id: string; title: string; status: string; priority: string }>,
): string {
  if (items.length === 0) return "The queue is empty.";
  const lines = ["Current queue (top items):", ""];
  for (const item of items.slice(0, 10)) {
    lines.push(`• ${item.title} [${item.backlog_id}] — ${item.status} (${item.priority})`);
  }
  if (items.length > 10) lines.push(`…and ${items.length - 10} more`);
  return lines.join("\n");
}

export function buildRoadmapReply(roadmap: Record<string, unknown>): string {
  return [
    "Roadmap snapshot:",
    `Completion: ${roadmap.completion_pct ?? 0}%`,
    `Launch stage: ${roadmap.launch_stage ?? "unknown"}`,
    `Epics: ${Array.isArray(roadmap.epics) ? roadmap.epics.length : 0}`,
    `Slices ready: ${roadmap.ready_slices ?? 0}`,
    `Slices in progress: ${roadmap.in_progress_slices ?? 0}`,
  ].join("\n");
}

export function buildNextTaskReply(next: {
  title: string | null;
  backlog_id: string | null;
  reason: string | null;
  combined_score: number | null;
}): string {
  if (!next.title) return "No actionable next task found in the current roadmap.";
  return [
    "Recommended next build:",
    `"${next.title}" [${next.backlog_id}]`,
    next.combined_score !== null ? `Founder score: ${next.combined_score}` : "",
    next.reason ? `Why: ${next.reason}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildResultReply(result: InboxCommandResult, body: string): string {
  if (!result.ok) return body || result.error || "I could not complete that request.";
  return body;
}

export function buildUnknownReply(): string {
  return [
    "I didn't quite understand that.",
    "",
    "Try: \"Status\", \"Pause SEO\", \"Show roadmap\", \"What is Developer doing?\", or \"Help\".",
  ].join("\n");
}

export function buildConfirmationPrompt(action: string): string {
  return `${action}\n\nReply YES DELETE to continue, or send any other message to cancel.`;
}
