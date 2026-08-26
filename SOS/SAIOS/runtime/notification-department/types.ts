/**
 * Notification Department — shared types.
 * AGENT #101 — AI OS Notification Department V1
 */

export type NotificationPriority = "CRITICAL" | "WARNING" | "INFO";

export type NotificationType =
  | "CRITICAL"
  | "WARNING"
  | "INFO"
  | "DAILY_DIGEST"
  | "MORNING_REVIEW"
  | "EVENING_REVIEW"
  | "RELEASE_EVENT"
  | "WEBSITE_ALERT"
  | "FACTORY_ALERT"
  | "TIMELINE_REMINDER";

export type NotificationChannel = "telegram" | "email" | "console";

export type SourceStatus = "available" | "unavailable";

export type CollectedSource = {
  id: string;
  path: string;
  status: SourceStatus;
  summary: string;
  alerts: NormalizedAlert[];
  metrics?: Record<string, unknown>;
};

export type NormalizedAlert = {
  id: string;
  source: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  created_at: string;
  evidence?: Record<string, unknown>;
};

export type DigestBundle = {
  generated_at: string;
  morning: string;
  evening: string;
  daily: string;
  structured: {
    website_status: string;
    factory_status: string;
    pending_founder_reviews: string[];
    templates_ready_to_publish: number;
    published_templates: number | string;
    alerts: NormalizedAlert[];
    recommended_next_action: string;
  };
};

export type ChannelSendResult = {
  channel: NotificationChannel;
  ok: boolean;
  dry_run: boolean;
  message_id?: string | number | null;
  error?: string | null;
};

export type LedgerEntry = {
  at: string;
  type: NotificationType;
  priority: NotificationPriority;
  channel: NotificationChannel;
  status: "dry_run" | "sent" | "skipped" | "failed";
  reason: string;
  source: string;
  title: string;
};

export type NotificationDepartmentOptions = {
  force_dry_run?: boolean;
  persist?: boolean;
  send_critical?: boolean;
};

export type NotificationDepartmentResult = {
  generated_at: string;
  status: "READY" | "DEGRADED" | "BLOCKED";
  dry_run: boolean;
  live_credentials_configured: boolean;
  sources: CollectedSource[];
  alerts: NormalizedAlert[];
  digest: DigestBundle;
  channels: Record<NotificationChannel, { configured: boolean; dry_run: boolean }>;
  ledger_entries: LedgerEntry[];
  output_dir: string;
  checks: Record<string, boolean>;
};
