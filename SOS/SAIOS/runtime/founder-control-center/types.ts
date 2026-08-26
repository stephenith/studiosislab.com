/**
 * Founder Control Center — shared types.
 * AGENT #108 — single operational headquarters (aggregate only)
 */

export type HealthTone = "HEALTHY" | "READY" | "RUNNING" | "DEGRADED" | "WARNING" | "CRITICAL" | "UNKNOWN" | "MISSING";

export type DiscoveredDepartment = {
  id: string;
  label: string;
  module_path: string;
  log_dir: string | null;
  available: boolean;
  status: string;
};

export type ActionPriority = "P0" | "P1" | "P2" | "P3";

export type FounderAction = {
  id: string;
  priority: ActionPriority;
  title: string;
  detail: string;
  source: string;
  category: string;
};

export type AiOsStatusSection = {
  runtime: string;
  security: string;
  website: string;
  notifications: string;
  timeline: string;
  event_bus: string;
  deployment: string;
  overall_health: HealthTone;
};

export type TodaysWorkSection = {
  templates_generated_today: number | string;
  templates_reviewed_today: number | string;
  templates_published_today: number | string;
  pending_founder_approvals: string[];
  pending_releases: number | string;
  pending_notifications: number | string;
};

export type ResumeFactorySection = {
  current_batch: string;
  templates_generated: number | string;
  templates_published: number | string;
  templates_ready: number | string;
  average_quality: number | string;
  competitive_score: number | string;
  latest_production: string;
};

export type WebsiteSection = {
  website_health: string;
  runtime_catalog: string;
  gallery: string;
  seo: string;
  editor: string;
  download_flow: string;
  latest_deployment: string;
};

export type SecuritySection = {
  security_level: string;
  current_risks: string[];
  disk: string;
  environment: string;
  runtime_protection: string;
  backup_status: string;
};

export type TimelineSection = {
  current_sprint: string;
  current_day: string;
  todays_reminders: string[];
  upcoming_milestones: string[];
  overdue_items: string[];
};

export type NotificationSection = {
  unread_alerts: number | string;
  critical_alerts: number | string;
  warnings: number | string;
  morning_digest: string;
  evening_digest: string;
};

export type ReleaseSection = {
  latest_release: string;
  next_release_candidate: string;
  rollback_availability: string;
  catalog_integrity: string;
};

export type PerformanceSection = {
  templates_tracked: number | string;
  published: number | string;
  ready: number | string;
  runtime_uptime: string;
  heartbeat: string;
  department_count: number | string;
};

export type FounderDashboard = {
  generated_at: string;
  ai_os_status: AiOsStatusSection;
  todays_work: TodaysWorkSection;
  resume_factory: ResumeFactorySection;
  website: WebsiteSection;
  security: SecuritySection;
  timeline: TimelineSection;
  notifications: NotificationSection;
  releases: ReleaseSection;
  performance: PerformanceSection;
  action_queue: FounderAction[];
  recommended_next_action: string;
};

export type FounderControlCenterResult = {
  generated_at: string;
  status: "READY" | "DEGRADED" | "BLOCKED";
  departments: DiscoveredDepartment[];
  dashboard: FounderDashboard;
  checks: Record<string, boolean>;
  output_dir: string;
};
