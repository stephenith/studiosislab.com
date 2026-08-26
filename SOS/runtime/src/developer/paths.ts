import { join } from "node:path";
import type { RuntimeConfig } from "../config.js";

export type DeveloperPaths = {
  root: string;
  state: string;
  status: string;
  locks: string;
  plans: string;
  workPlans: string;
  implementationPlans: string;
  reports: string;
  progress: string;
  artifacts: string;
  pmBriefs: string;
  pmDevReports: string;
  events: string;
};

export function getDeveloperPaths(config: RuntimeConfig): DeveloperPaths {
  const root = join(config.sosRoot, "07_LOGS", "developer");
  return {
    root,
    state: join(root, "state.json"),
    status: join(root, "developer-status.json"),
    locks: join(root, "locks"),
    plans: join(root, "plans"),
    workPlans: join(root, "work-plans"),
    implementationPlans: join(root, "implementation-plans"),
    reports: join(root, "reports"),
    progress: join(root, "progress"),
    artifacts: join(root, "artifacts"),
    pmBriefs: join(config.sosRoot, "07_LOGS", "pm", "briefs", "developer"),
    pmDevReports: join(config.sosRoot, "07_LOGS", "pm", "reports", "developer"),
    events: config.eventsRoot,
  };
}
