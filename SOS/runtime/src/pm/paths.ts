import { join } from "node:path";
import type { RuntimeConfig } from "../config.js";

export type PmPaths = {
  root: string;
  state: string;
  queues: string;
  tasksQueue: string;
  developerQueue: string;
  qaQueue: string;
  briefs: string;
  devBriefs: string;
  devBriefsArchived: string;
  qaBriefs: string;
  reports: string;
  devReports: string;
  qaReports: string;
  approvals: string;
  approvalResponses: string;
  executionLog: string;
  decisionHistory: string;
  taskHistory: string;
  agentStatus: string;
  backlog: string;
  knowledgeDir: string;
  standupDir: string;
  events: string;
  pendingApprovals: string;
  decisions: string;
};

export function getPmPaths(config: RuntimeConfig): PmPaths {
  const root = join(config.sosRoot, "07_LOGS", "pm");
  return {
    root,
    state: join(root, "state.json"),
    queues: join(root, "queues"),
    tasksQueue: join(root, "queues", "tasks.json"),
    developerQueue: join(root, "queues", "developer.json"),
    qaQueue: join(root, "queues", "qa.json"),
    briefs: join(root, "briefs"),
    devBriefs: join(root, "briefs", "developer"),
    devBriefsArchived: join(root, "briefs", "developer", "archived"),
    qaBriefs: join(root, "briefs", "qa"),
    reports: join(root, "reports"),
    devReports: join(root, "reports", "developer"),
    qaReports: join(root, "reports", "qa"),
    approvals: join(root, "approvals"),
    approvalResponses: join(root, "approvals", "responses"),
    executionLog: join(root, "execution.log.jsonl"),
    decisionHistory: join(root, "decision-history.jsonl"),
    taskHistory: join(root, "task-history.jsonl"),
    agentStatus: join(root, "agent-status.json"),
    backlog: join(config.sosRoot, "08_ROADMAP", "MASTER_BACKLOG.md"),
    knowledgeDir: join(config.sosRoot, "01_KNOWLEDGE"),
    standupDir: join(config.sosRoot, "09_REPORTS"),
    events: config.eventsRoot,
    pendingApprovals: join(config.logsRoot, "approvals", "PENDING.md"),
    decisions: join(config.logsRoot, "decisions"),
  };
}
