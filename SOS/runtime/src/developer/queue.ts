import { readFile, readdir, writeFile, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { DeveloperPaths } from "./paths.js";
import type { ParsedBrief, TaskLock } from "./types.js";
import { extractFounderInstructionFromMarkdown } from "../founder-instruction.js";

const TASK_ID_RE = /^TASK-[A-Z0-9-]+$/i;

export class BriefValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BriefValidationError";
  }
}

function extractSection(content: string, heading: string): string {
  const block = content.match(new RegExp(`## ${heading}\\s*\\n+([\\s\\S]*?)(?=\\n## |\\n---|$)`, "i"));
  if (block) return block[1].trim().split("\n")[0].trim();
  const inline = content.match(new RegExp(`\\*\\*${heading}:\\*\\*\\s*(.+)$`, "im"));
  return inline?.[1]?.trim() ?? "";
}

function extractListSection(content: string, heading: string): string[] {
  const block = content.match(new RegExp(`## ${heading}\\s*\\n+([\\s\\S]*?)(?=\\n## |\\n---|$)`, "i"));
  if (!block) return [];
  const items: string[] = [];
  for (const line of block[1].split("\n")) {
    const numbered = line.match(/^\d+\.\s+(.+)/);
    const bulleted = line.match(/^[-*]\s+`?([^`]+)`?/);
    if (numbered) items.push(numbered[1].trim());
    else if (bulleted) items.push(bulleted[1].trim());
  }
  return items;
}

function extractBacktickPaths(content: string, heading: string): string[] {
  const block = content.match(new RegExp(`## ${heading}\\s*\\n+([\\s\\S]*?)(?=\\n## |\\n---|$)`, "i"));
  if (!block) return [];
  const paths = block[1].match(/`([^`]+)`/g);
  return paths ? [...new Set(paths.map((p) => p.replace(/`/g, "")))] : [];
}

export function parseBriefMarkdown(content: string, briefPath: string): ParsedBrief {
  const taskId = extractSection(content, "Task ID") || content.match(/\*\*Task ID:\*\*\s*(\S+)/)?.[1];
  const correlationId =
    extractSection(content, "Correlation ID") || content.match(/\*\*Correlation ID:\*\*\s*(\S+)/)?.[1];
  const backlogId =
    content.match(/\*\*Backlog reference:\*\*\s*(\S+)/i)?.[1]?.trim()
    || extractSection(content, "Backlog")
    || content.match(/\*\*Backlog:\*\*\s*(\S+)/)?.[1]
    || "unknown";
  const priority =
    (extractSection(content, "Priority") || content.match(/\*\*Priority:\*\*\s*([^\n]+)/)?.[1]?.trim()) ?? "P2";

  if (!taskId || !TASK_ID_RE.test(taskId)) {
    throw new BriefValidationError(`Invalid or missing task_id in ${briefPath}`);
  }
  if (!correlationId) {
    throw new BriefValidationError(`Missing correlation_id in ${briefPath}`);
  }

  const title = extractSection(content, "Title") || extractSection(content, "Objective");
  const objective = extractSection(content, "Objective") || title;
  const description = extractSection(content, "Description") || objective;

  const evidence = [
    ...extractBacktickPaths(content, "Evidence files"),
    ...extractBacktickPaths(content, "Files in scope"),
  ].filter((p, i, arr) => arr.indexOf(p) === i && p.includes("/"));

  const acceptance_criteria = extractListSection(content, "Acceptance criteria");
  const qa_checklist = extractListSection(content, "QA checklist");
  const pm_recommendation = extractSection(content, "PM recommendation");

  const reportRaw = extractSection(content, "Next expected report path")
    || content.match(/reports\/developer\/([^\s`]+\.json)/)?.[0];
  const report_path = reportRaw?.replace(/`/g, "") ?? `SOS/07_LOGS/pm/reports/developer/${taskId}.json`;

  const hardGates: string[] = [];
  const gatesSection =
    content.match(/## Hard gates\s*\n+([^\n#]+)/i)
    ?? content.match(/## Hard gates detected\s*\n+([^\n#]+)/);
  if (gatesSection && !gatesSection[1].includes("None")) {
    const ids = gatesSection[1].match(/H\d+/g);
    if (ids) hardGates.push(...ids);
  }

  return {
    task_id: taskId,
    correlation_id: correlationId,
    backlog_id: backlogId,
    priority,
    title: title || taskId,
    description,
    objective: objective || title || taskId,
    evidence,
    acceptance_criteria,
    hard_gate_ids: hardGates,
    qa_checklist,
    pm_recommendation,
    report_path,
    brief_path: briefPath,
    claimed: false,
    founder_instruction: extractFounderInstructionFromMarkdown(content),
  };
}

export async function listUnclaimedBriefs(
  paths: DeveloperPaths,
  completedIds: string[],
  blockedIds: string[],
  processedIds: string[] = [],
): Promise<ParsedBrief[]> {
  if (!existsSync(paths.pmBriefs)) return [];

  const files = (await readdir(paths.pmBriefs)).filter((f) => f.endsWith(".md"));
  const briefs: ParsedBrief[] = [];

  for (const file of files) {
    const taskId = file.replace(/\.md$/, "");
    if (completedIds.includes(taskId) || blockedIds.includes(taskId) || processedIds.includes(taskId)) {
      continue;
    }
    if (existsSync(join(paths.pmDevReports, `${taskId}.json`))) continue;
    if (existsSync(join(paths.locks, `${taskId}.json`))) continue;
    if (existsSync(join(paths.workPlans, `${taskId}.json`))) continue;

    const briefPath = join(paths.pmBriefs, file);
    try {
      const content = await readFile(briefPath, "utf8");
      briefs.push(parseBriefMarkdown(content, briefPath));
    } catch {
      // skip invalid
    }
  }

  return briefs.sort((a, b) => a.brief_path.localeCompare(b.brief_path));
}

export async function claimTask(
  paths: DeveloperPaths,
  brief: ParsedBrief,
): Promise<TaskLock> {
  const lockPath = join(paths.locks, `${brief.task_id}.json`);
  if (existsSync(lockPath)) {
    throw new Error(`Task ${brief.task_id} already locked`);
  }

  const lock: TaskLock = {
    task_id: brief.task_id,
    correlation_id: brief.correlation_id,
    pid: process.pid,
    claimed_at: new Date().toISOString(),
    brief_path: brief.brief_path,
  };

  await writeFile(lockPath, JSON.stringify(lock, null, 2), "utf8");
  brief.claimed = true;
  return lock;
}

export async function releaseLock(paths: DeveloperPaths, taskId: string): Promise<void> {
  const lockPath = join(paths.locks, `${taskId}.json`);
  if (existsSync(lockPath)) await unlink(lockPath);
}

export async function readLock(
  paths: DeveloperPaths,
  taskId: string,
): Promise<TaskLock | null> {
  const lockPath = join(paths.locks, `${taskId}.json`);
  if (!existsSync(lockPath)) return null;
  return JSON.parse(await readFile(lockPath, "utf8")) as TaskLock;
}
