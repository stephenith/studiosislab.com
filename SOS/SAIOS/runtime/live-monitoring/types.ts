/**
 * Live Monitoring — shared types.
 * AGENT #107 — AI OS Live Monitoring & Commander Bridge V1
 */

import type { EventType } from "../event-bus/types.js";

export type BridgeMode = "dry_run" | "live";

export type PublisherId =
  | "security"
  | "website"
  | "timeline"
  | "runtime-manager";

export type PublishResult = {
  publisher: PublisherId;
  source_path: string;
  source_available: boolean;
  events_published: number;
  event_types: EventType[];
  notes: string[];
};

export type SubscriberDelivery = {
  event_id: string;
  event_type: EventType;
  at: string;
  bridged: boolean;
  mode: BridgeMode;
  delivery_status: string;
  note: string;
};

export type BridgeCallResult = {
  mode: BridgeMode;
  ok: boolean;
  dry_run: boolean;
  event_type: EventType;
  title: string;
  delivery_status: string;
  message_id: number | null;
  error: string | null;
  commander_pipeline_used: boolean;
  api_called: boolean;
};

export type CommanderBridgeStatus = {
  detected: boolean;
  pipeline_path: string;
  telegram_path: string;
  email_path: string;
  transport_path: string;
  duplicate_telegram_stack: boolean;
  live_flag: string;
  live_enabled: boolean;
  verify_forces_dry_run: true;
};

export type LiveMonitoringResult = {
  generated_at: string;
  status: "READY" | "DEGRADED" | "BLOCKED";
  mode: BridgeMode;
  publishers: PublishResult[];
  subscriptions: Array<{ event_type: EventType | string; department: string }>;
  deliveries: SubscriberDelivery[];
  bridge_calls: BridgeCallResult[];
  commander: CommanderBridgeStatus;
  flow: Array<{ step: number; from: string; to: string; via: string }>;
  checks: Record<string, boolean>;
  output_dir: string;
};

export const NOTIFICATION_SUBSCRIBE_EVENTS: EventType[] = [
  "SECURITY_WARNING",
  "SECURITY_CRITICAL",
  "WEBSITE_WARNING",
  "TIMELINE_REMINDER",
  "SYSTEM_CRITICAL",
  "SYSTEM_WARNING",
  "FOUNDER_REVIEW_PENDING",
  "PUBLICATION_READY",
  "PUBLICATION_RELEASED",
  "BATCH_COMPLETED",
];
