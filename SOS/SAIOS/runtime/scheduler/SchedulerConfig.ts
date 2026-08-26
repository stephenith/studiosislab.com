/**
 * Scheduler configuration — defaults and persistence.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { ProductionGoal, SchedulerConfig } from "./types.js";

const SOS_ROOT = resolve(import.meta.dirname, "../../..");
export const SCHEDULER_ROOT = join(SOS_ROOT, "07_LOGS/saios/scheduler");
export const CONFIG_PATH = join(SCHEDULER_ROOT, "scheduler-config.json");

export const DEFAULT_GOALS: ProductionGoal[] = [
  {
    id: "daily-ats",
    name: "Daily ATS Templates",
    category: "ats",
    enabled: true,
    frequency: "daily",
    objective_template: "Premium ATS-optimized {category} resume for {industry} professional",
    priority: "P1",
    max_per_run: 1,
  },
  {
    id: "daily-executive",
    name: "Daily Executive Templates",
    category: "executive",
    enabled: true,
    frequency: "daily",
    objective_template: "Executive {category} resume with premium hierarchy for senior leader",
    priority: "P1",
    max_per_run: 1,
  },
  {
    id: "daily-creative",
    name: "Daily Creative Templates",
    category: "creative",
    enabled: true,
    frequency: "daily",
    objective_template: "Creative {category} resume with modern visual hierarchy",
    priority: "P2",
    max_per_run: 1,
  },
  {
    id: "daily-student",
    name: "Daily Student Templates",
    category: "student",
    enabled: true,
    frequency: "daily",
    objective_template: "Student {category} resume optimized for entry-level hiring",
    priority: "P2",
    max_per_run: 1,
  },
  {
    id: "daily-healthcare",
    name: "Daily Healthcare Templates",
    category: "healthcare",
    enabled: true,
    frequency: "daily",
    objective_template: "Healthcare {category} resume with ATS compliance",
    priority: "P2",
    max_per_run: 1,
  },
  {
    id: "daily-marketing",
    name: "Daily Marketing Templates",
    category: "marketing",
    enabled: true,
    frequency: "daily",
    objective_template: "Marketing {category} resume with campaign metrics focus",
    priority: "P2",
    max_per_run: 1,
  },
  {
    id: "daily-finance",
    name: "Daily Finance Templates",
    category: "finance",
    enabled: true,
    frequency: "daily",
    objective_template: "Finance {category} resume with conservative premium layout",
    priority: "P2",
    max_per_run: 1,
  },
  {
    id: "daily-engineering",
    name: "Daily Engineering Templates",
    category: "engineering",
    enabled: true,
    frequency: "daily",
    objective_template: "Engineering {category} resume with technical project emphasis",
    priority: "P1",
    max_per_run: 1,
  },
  {
    id: "daily-refresh",
    name: "Daily Resume Refresh",
    category: "resume_refresh",
    enabled: true,
    frequency: "daily",
    objective_template: "Refresh premium {category} resume with updated composition blocks",
    priority: "P3",
    max_per_run: 1,
  },
  {
    id: "daily-seo",
    name: "Daily SEO Expansion",
    category: "seo_expansion",
    enabled: true,
    frequency: "daily",
    objective_template: "SEO-optimized {category} resume landing metadata expansion",
    priority: "P3",
    max_per_run: 1,
  },
];

export function defaultConfig(): SchedulerConfig {
  return {
    version: "1.0.0",
    updated_at: new Date().toISOString(),
    enabled: true,
    server_mode: {
      headless: true,
      persistent: true,
      auto_restart: true,
      platform: "auto",
    },
    workload: {
      max_resumes_per_hour: 4,
      max_resumes_per_day: 24,
      max_concurrent_runs: 2,
      max_retry_count: 2,
      sleep_interval_ms: 5000,
      min_disk_space_mb: 500,
    },
    goals: DEFAULT_GOALS,
    founder_rules: {
      never_publish_automatically: true,
      never_bypass_founder_approval: true,
      never_modify_src: true,
      never_modify_production_artifacts: true,
    },
  };
}

export function loadConfig(): SchedulerConfig {
  if (!existsSync(CONFIG_PATH)) return defaultConfig();
  try {
    return { ...defaultConfig(), ...JSON.parse(readFileSync(CONFIG_PATH, "utf8")) };
  } catch {
    return defaultConfig();
  }
}

export function saveConfig(config: SchedulerConfig, persist = true): SchedulerConfig {
  config.updated_at = new Date().toISOString();
  if (persist) {
    mkdirSync(SCHEDULER_ROOT, { recursive: true });
    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  }
  return config;
}

export function buildObjective(goal: ProductionGoal, industry = "software"): string {
  return goal.objective_template
    .replace(/\{category\}/g, goal.category)
    .replace(/\{industry\}/g, industry);
}
