/**
 * Milestone tracker derived from factory/history progress.
 */
import type { Milestone, TimelineEvent } from "./types.js";

export function buildMilestones(input: {
  events: TimelineEvent[];
  factoryStable: boolean;
  websiteReady: boolean;
  notificationReady: boolean;
  latestRelease: string | null;
}): Milestone[] {
  const find = (pred: (e: TimelineEvent) => boolean) =>
    input.events.find(pred)?.at?.slice(0, 10) ?? null;

  return [
    {
      id: "ms-factory-v1",
      title: "Resume Factory V1 freeze",
      status: input.factoryStable ? "completed" : "upcoming",
      target_date: null,
      completed_at: find((e) => e.type === "factory_finalization") ?? (input.factoryStable ? "2026-07-07" : null),
      evidence: "factory_v1 STABLE",
    },
    {
      id: "ms-t094-live",
      title: "First factory release live (t094)",
      status: input.latestRelease ? "completed" : "upcoming",
      target_date: null,
      completed_at: find((e) => e.type === "release") ?? null,
      evidence: input.latestRelease,
    },
    {
      id: "ms-website-dept",
      title: "Website Department V1",
      status: input.websiteReady ? "completed" : "upcoming",
      target_date: null,
      completed_at: find((e) => e.type === "website_department") ?? null,
      evidence: "operations.website_department",
    },
    {
      id: "ms-notification-dept",
      title: "Notification Department V1",
      status: input.notificationReady ? "completed" : "upcoming",
      target_date: null,
      completed_at: find((e) => e.type === "notification_department") ?? null,
      evidence: "operations.notification_department",
    },
    {
      id: "ms-timeline-dept",
      title: "Timeline Department V1",
      status: "upcoming",
      target_date: null,
      completed_at: null,
      evidence: "this agent",
    },
    {
      id: "ms-vps-os",
      title: "AI OS VPS always-on packaging",
      status: "upcoming",
      target_date: null,
      completed_at: null,
      evidence: "future",
    },
  ];
}
