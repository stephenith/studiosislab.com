import { join } from "node:path";
import type { RuntimeConfig } from "../config.js";

export type ApprovalsPaths = {
  root: string;
  inbox: string;
  processed: string;
  invalid: string;
  records: string;
  state: string;
  status: string;
  resumeSignal: string;
  pmResponses: string;
  pmState: string;
  events: string;
  decisions: string;
};

export function getApprovalsPaths(config: RuntimeConfig): ApprovalsPaths {
  const root = join(config.logsRoot, "approvals");
  const pmRoot = join(config.sosRoot, "07_LOGS", "pm");
  return {
    root,
    inbox: join(root, "inbox"),
    processed: join(root, "processed"),
    invalid: join(root, "invalid"),
    records: join(root, "records"),
    state: join(root, "state.json"),
    status: join(root, "approvals-status.json"),
    resumeSignal: join(pmRoot, "resume-pending.json"),
    pmResponses: join(pmRoot, "approvals", "responses"),
    pmState: join(pmRoot, "state.json"),
    events: config.eventsRoot,
    decisions: join(config.logsRoot, "decisions"),
  };
}
