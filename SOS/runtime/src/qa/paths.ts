import { join } from "node:path";
import type { RuntimeConfig } from "../config.js";

export type QaPaths = {
  root: string;
  state: string;
  status: string;
  locks: string;
  reports: string;
  progress: string;
  checklists: string;
  pmBriefs: string;
  pmQaReports: string;
  pmDevReports: string;
  devWorkPlans: string;
  devImplPlans: string;
  devExecutionReports: string;
  events: string;
};

export function getQaPaths(config: RuntimeConfig): QaPaths {
  const root = join(config.sosRoot, "07_LOGS", "qa");
  const devRoot = join(config.sosRoot, "07_LOGS", "developer");
  return {
    root,
    state: join(root, "state.json"),
    status: join(root, "qa-status.json"),
    locks: join(root, "locks"),
    reports: join(root, "reports"),
    progress: join(root, "progress"),
    checklists: join(root, "checklists"),
    pmBriefs: join(config.sosRoot, "07_LOGS", "pm", "briefs", "qa"),
    pmQaReports: join(config.sosRoot, "07_LOGS", "pm", "reports", "qa"),
    pmDevReports: join(config.sosRoot, "07_LOGS", "pm", "reports", "developer"),
    devWorkPlans: join(devRoot, "work-plans"),
    devImplPlans: join(devRoot, "implementation-plans"),
    devExecutionReports: join(devRoot, "reports"),
    events: config.eventsRoot,
  };
}
