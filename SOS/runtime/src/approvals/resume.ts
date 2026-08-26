import { writeFile } from "node:fs/promises";
import type { ApprovalsPaths } from "./paths.js";
import { runPmLoop } from "../pm/loop.js";

export type ResumeTrigger = {
  approval_id: string;
  task_id: string;
  correlation_id: string;
  command: string;
  triggered_at: string;
  source: "approvals_listener";
};

export async function writeResumeSignal(
  paths: ApprovalsPaths,
  trigger: ResumeTrigger,
): Promise<void> {
  await writeFile(paths.resumeSignal, JSON.stringify(trigger, null, 2), "utf8");
}

export async function triggerPmResume(
  paths: ApprovalsPaths,
  trigger: ResumeTrigger,
): Promise<void> {
  await writeResumeSignal(paths, trigger);
  await runPmLoop({ once: true });
}
