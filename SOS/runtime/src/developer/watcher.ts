import { readFile, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { DeveloperPaths } from "./paths.js";
import type { DeveloperRuntimeState, ParsedBrief } from "./types.js";
import { parseBriefMarkdown } from "./queue.js";

export type BriefWatcherSnapshot = {
  watched_dir: string;
  total_briefs: number;
  unprocessed: number;
  processed: number;
  latest_detected: string | null;
};

function isBriefProcessed(
  paths: DeveloperPaths,
  state: DeveloperRuntimeState,
  taskId: string,
): boolean {
  if (state.processed_brief_ids.includes(taskId)) return true;
  if (state.completed_task_ids.includes(taskId)) return true;
  if (state.blocked_task_ids.includes(taskId)) return true;
  if (existsSync(join(paths.locks, `${taskId}.json`))) return true;
  if (existsSync(join(paths.workPlans, `${taskId}.json`))) return true;
  if (existsSync(join(paths.pmDevReports, `${taskId}.json`))) return true;
  return false;
}

export async function listBriefFiles(paths: DeveloperPaths): Promise<string[]> {
  if (!existsSync(paths.pmBriefs)) return [];
  return (await readdir(paths.pmBriefs))
    .filter((f) => f.endsWith(".md"))
    .map((f) => join(paths.pmBriefs, f));
}

export async function watchForNewBrief(
  paths: DeveloperPaths,
  state: DeveloperRuntimeState,
): Promise<ParsedBrief | null> {
  if (state.state !== "idle" || state.current_task_id !== null) {
    return null;
  }

  const files = await listBriefFiles(paths);
  const candidates: Array<{ brief: ParsedBrief; mtime: number }> = [];

  for (const briefPath of files) {
    const fileName = briefPath.split("/").pop() ?? "";
    const taskId = fileName.replace(/\.md$/, "");
    if (isBriefProcessed(paths, state, taskId)) continue;

    try {
      const content = await readFile(briefPath, "utf8");
      const brief = parseBriefMarkdown(content, briefPath);
      const fileStat = await stat(briefPath);
      candidates.push({ brief, mtime: fileStat.mtimeMs });
    } catch {
      // skip invalid briefs
    }
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => a.mtime - b.mtime);
  return candidates[0].brief;
}

export async function getWatcherSnapshot(
  paths: DeveloperPaths,
  state: DeveloperRuntimeState,
): Promise<BriefWatcherSnapshot> {
  const files = await listBriefFiles(paths);
  let unprocessed = 0;

  for (const briefPath of files) {
    const taskId = briefPath.split("/").pop()!.replace(/\.md$/, "");
    if (!isBriefProcessed(paths, state, taskId)) unprocessed += 1;
  }

  return {
    watched_dir: paths.pmBriefs,
    total_briefs: files.length,
    unprocessed,
    processed: files.length - unprocessed,
    latest_detected: state.current_task_id,
  };
}
