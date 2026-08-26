import { readFile, readdir, writeFile, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { QaPaths } from "./paths.js";
import type { ParsedQaBrief, QaTaskLock } from "./types.js";
import { extractFounderInstructionFromMarkdown } from "../founder-instruction.js";

const TASK_ID_RE = /^TASK-[A-Z0-9-]+$/i;

export class QaBriefValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QaBriefValidationError";
  }
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

export function parseQaBriefMarkdown(content: string, briefPath: string): ParsedQaBrief {
  const taskId = content.match(/\*\*Task ID:\*\*\s*(\S+)/)?.[1];
  const correlationId = content.match(/\*\*Correlation ID:\*\*\s*(\S+)/)?.[1];
  const priority = content.match(/\*\*Priority:\*\*\s*([^\n]+)/)?.[1]?.trim() ?? "P2";
  const objective = content.match(/## Objective\s*\n+([^\n#]+)/)?.[1]?.trim() ?? "";
  const pmRequirements = content.match(/## PM requirements\s*\n+([\s\S]*?)(?=\n## |\n---|$)/i)?.[1]?.trim() ?? "";

  if (!taskId || !TASK_ID_RE.test(taskId)) {
    throw new QaBriefValidationError(`Invalid task_id in ${briefPath}`);
  }
  if (!correlationId) {
    throw new QaBriefValidationError(`Missing correlation_id in ${briefPath}`);
  }

  const devReportPath =
    content.match(/\*\*Developer report:\*\*\s*`?([^`\n]+)`?/i)?.[1]?.trim()
    ?? `SOS/07_LOGS/pm/reports/developer/${taskId}.json`;

  return {
    task_id: taskId,
    correlation_id: correlationId,
    priority,
    title: objective || taskId,
    objective,
    brief_path: briefPath,
    acceptance_criteria: extractListSection(content, "Acceptance criteria"),
    files_in_scope: extractBacktickPaths(content, "Files in scope"),
    dev_report_path: devReportPath,
    pm_requirements: pmRequirements,
    qa_checklist: extractListSection(content, "Validation steps"),
    founder_instruction: extractFounderInstructionFromMarkdown(content),
  };
}

export async function listUnclaimedQaBriefs(
  paths: QaPaths,
  completedIds: string[],
  processedKeys: string[],
): Promise<ParsedQaBrief[]> {
  if (!existsSync(paths.pmBriefs)) return [];

  const files = (await readdir(paths.pmBriefs)).filter((f) => f.endsWith(".md"));
  const briefs: ParsedQaBrief[] = [];

  for (const file of files) {
    const taskId = file.replace(/\.md$/, "");
    if (completedIds.includes(taskId)) continue;
    if (existsSync(join(paths.pmQaReports, `${taskId}.json`))) continue;
    if (existsSync(join(paths.locks, `${taskId}.json`))) continue;

    const briefPath = join(paths.pmBriefs, file);
    try {
      const content = await readFile(briefPath, "utf8");
      const brief = parseQaBriefMarkdown(content, briefPath);

      const devReportPath = join(paths.pmDevReports, `${taskId}.json`);
      if (!existsSync(devReportPath)) continue;

      const devReport = JSON.parse(await readFile(devReportPath, "utf8")) as { completed_at?: string };
      const key = `${taskId}:${devReport.completed_at ?? "unknown"}`;
      if (processedKeys.includes(key)) continue;

      briefs.push(brief);
    } catch {
      // skip invalid
    }
  }

  return briefs.sort((a, b) => a.brief_path.localeCompare(b.brief_path));
}

export async function claimQaTask(
  paths: QaPaths,
  brief: ParsedQaBrief,
): Promise<QaTaskLock> {
  const lockPath = join(paths.locks, `${brief.task_id}.json`);
  if (existsSync(lockPath)) {
    throw new Error(`QA task ${brief.task_id} already locked`);
  }

  const lock: QaTaskLock = {
    task_id: brief.task_id,
    correlation_id: brief.correlation_id,
    pid: process.pid,
    claimed_at: new Date().toISOString(),
    brief_path: brief.brief_path,
  };

  await writeFile(lockPath, JSON.stringify(lock, null, 2), "utf8");
  return lock;
}

export async function releaseQaLock(paths: QaPaths, taskId: string): Promise<void> {
  const lockPath = join(paths.locks, `${taskId}.json`);
  if (existsSync(lockPath)) await unlink(lockPath);
}
