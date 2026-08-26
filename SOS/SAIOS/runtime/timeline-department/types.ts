/**
 * Timeline Department — shared types.
 * AGENT #102 — AI OS system clock / time-awareness service.
 */

export type ReminderKind = "TODAY" | "THIS_WEEK" | "OVERDUE" | "UPCOMING" | "CRITICAL";

export type TimelineEvent = {
  id: string;
  at: string;
  date: string;
  type: string;
  title: string;
  summary: string;
  ref?: string | null;
  source: string;
};

export type Milestone = {
  id: string;
  title: string;
  status: "completed" | "upcoming" | "blocked";
  target_date: string | null;
  completed_at: string | null;
  evidence?: string;
};

export type Deadline = {
  id: string;
  title: string;
  due_date: string;
  status: "upcoming" | "due_today" | "overdue" | "blocked";
  days_until: number;
  source: string;
};

export type PendingWorkItem = {
  id: string;
  title: string;
  category: "founder_review" | "publication" | "release" | "integrity" | "other";
  status: "pending" | "blocked" | "overdue";
  since: string | null;
  source: string;
};

export type SprintState = {
  id: string;
  label: string;
  start_date: string;
  end_date: string;
  day_index: number;
  length_days: number;
  focus: string;
};

export type ClockState = {
  now_iso: string;
  date: string;
  time: string;
  timezone: string;
  week: number;
  month: number;
  year: number;
  weekday: string;
};

export type TimelineReminder = {
  id: string;
  kind: ReminderKind;
  title: string;
  message: string;
  related_ref?: string;
  created_at: string;
};

export type TimelineState = {
  generated_at: string;
  clock: ClockState;
  sprint: SprintState;
  project_age_days: number;
  latest_agent: string;
  next_agent: string;
  latest_founder_review: string;
  latest_release: string;
  latest_publication: string;
  templates_generated: number | null;
  templates_published: number | null;
  templates_ready: number | null;
  pending_founder_reviews: string[];
  pending_publication: number;
  milestones: Milestone[];
  deadlines: Deadline[];
  pending_work: PendingWorkItem[];
  overdue_tasks: Deadline[];
  blocked_tasks: PendingWorkItem[];
  sources: Array<{ id: string; status: "available" | "unavailable"; path: string }>;
};

export type TimelineDepartmentResult = {
  generated_at: string;
  status: "READY" | "DEGRADED" | "BLOCKED";
  state: TimelineState;
  events: TimelineEvent[];
  reminders: TimelineReminder[];
  output_dir: string;
  checks: Record<string, boolean>;
};
