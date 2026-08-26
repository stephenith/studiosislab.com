/**
 * Timeline config and output paths.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dirname, "../../../..");
export const TIMELINE_DEPARTMENT_ROOT = join(
  REPO_ROOT,
  "SOS/07_LOGS/saios/timeline-department",
);

export type TimelineConfig = {
  version: string;
  timezone: string;
  sprint_length_days: number;
  project_epoch: string;
  founder_review_sla_days: number;
  publication_ready_sla_days: string;
};

export function defaultTimelineConfig(): TimelineConfig {
  return {
    version: "1.0.0",
    timezone: "Asia/Kolkata",
    sprint_length_days: 7,
    project_epoch: "2026-06-01",
    founder_review_sla_days: 3,
    publication_ready_sla_days: "7",
  };
}

export function persistTimelineConfig(config = defaultTimelineConfig()): TimelineConfig {
  mkdirSync(TIMELINE_DEPARTMENT_ROOT, { recursive: true });
  writeFileSync(
    join(TIMELINE_DEPARTMENT_ROOT, "timeline-config.json"),
    JSON.stringify(config, null, 2),
  );
  return config;
}

export { REPO_ROOT };
