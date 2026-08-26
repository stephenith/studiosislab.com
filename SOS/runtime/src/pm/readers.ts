import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { PmPaths } from "./paths.js";
import type { BacklogItem, PmState } from "./types.js";

const SECTION_MAP: Record<string, BacklogItem["section"]> = {
  "2": "in_progress",
  "3": "blocked",
  "4": "planned",
  "5": "future",
};


function parsePriority(raw: string): BacklogItem["priority"] {
  const p = raw.trim();
  if (/critical|^p0$/i.test(p)) return "Critical";
  if (/^high$|^p1$/i.test(p)) return "High";
  if (/^low$|^p3$/i.test(p)) return "Low";
  if (/^medium$|^p2$/i.test(p)) return "Medium";
  return "Medium";
}

function extractField(block: string, label: string): string {
  const re = new RegExp(`\\*\\*${label}\\*\\*\\s*\\|\\s*([^\\n|]+)`, "i");
  const m = block.match(re);
  return m ? m[1].trim() : "";
}

function extractEvidence(block: string): string[] {
  const section = block.match(/\*\*Repository evidence\*\*[\s\S]*?(?=\n\*\*|$)/i);
  if (!section) return [];
  const paths = section[0].match(/`([^`]+)`/g) ?? [];
  return [...new Set(paths.map((p) => p.replace(/`/g, "")))].filter((p) => {
    if (p.length < 4) return false;
    if (/^router\.|^Git:|^\d+$/.test(p)) return false;
    return p.includes("/") || /\.(tsx?|jsx?|json|md|rules)$/i.test(p);
  });
}

function extractBlockers(block: string, dependencies: string[]): string[] {
  const blockers: string[] = [];
  const deps = dependencies.filter((d) => d && !/^none$/i.test(d));
  blockers.push(...deps);
  const nv = extractField(block, "Needs Verification");
  if (nv && !/^none$/i.test(nv)) blockers.push(`Needs Verification: ${nv}`);
  return blockers;
}

function deriveBacklogStatus(section: BacklogItem["section"], completionPct: number): BacklogItem["status"] {
  if (completionPct >= 100) return "completed";
  if (section === "in_progress") return "in_progress";
  if (section === "blocked") return "blocked";
  return "actionable";
}

export function isVagueTask(item: BacklogItem): boolean {
  const hasFileEvidence = item.evidence.some((e) => e.includes("/") || /\.(tsx?|json|rules)$/i.test(e));
  return (
    item.priority === "Low"
    && item.needsVerification
    && item.completionPct === 0
    && !hasFileEvidence
  );
}

function parseBacklogSection(
  content: string,
  sectionNum: "2" | "3" | "4",
): BacklogItem[] {
  const sectionHeader = `## ${sectionNum}.`;
  const start = content.indexOf(sectionHeader);
  if (start === -1) return [];

  const nextMajor = content.indexOf("\n## ", start + sectionHeader.length);
  const sectionBody = nextMajor === -1 ? content.slice(start) : content.slice(start, nextMajor);

  const blocks = sectionBody.split(/\n### /).slice(1);
  const items: BacklogItem[] = [];

  for (const block of blocks) {
    const headerLine = block.split("\n")[0];
    const refMatch = headerLine.match(/^(\d+\.\d+)\s+(.+)$/);
    if (!refMatch) continue;

    const sectionRef = refMatch[1];
    const defaultTitle = refMatch[2].trim();
    const title = extractField(block, "Title") || defaultTitle;
    const description = extractField(block, "Description");
    const priorityRaw = extractField(block, "Priority");
    const priority = priorityRaw && priorityRaw !== "—" ? parsePriority(priorityRaw) : "Medium";
    const completionRaw = extractField(block, "Estimated Completion (%)");
    const completionPct = parseInt(completionRaw.replace(/[^\d]/g, ""), 10) || 0;
    const depsRaw = extractField(block, "Dependencies");
    const dependencies = depsRaw ? depsRaw.split(";").map((d) => d.trim()) : [];
    const nv = /\*\*Needs Verification\*\*/i.test(block) && /Needs Verification/i.test(extractField(block, "Needs Verification"));

    const section = SECTION_MAP[sectionNum];
    items.push({
      id: `BL-${sectionRef.replace(".", "-")}`,
      section,
      sectionRef,
      title,
      description,
      priority,
      completionPct,
      evidence: extractEvidence(block),
      needsVerification: nv,
      dependencies,
      blockers: extractBlockers(block, dependencies),
      status: deriveBacklogStatus(section, completionPct),
    });
  }

  return items;
}

export async function readMasterBacklog(paths: PmPaths): Promise<BacklogItem[]> {
  const raw = await readFile(paths.backlog, "utf8");
  const blocked = parseBacklogSection(raw, "3");
  const planned = parseBacklogSection(raw, "4");
  return [...blocked, ...planned];
}

export type BacklogProgress = {
  completed_items: number;
  remaining_items: number;
  total_items: number;
  in_progress_items: number;
};

function countSectionItems(content: string, sectionNum: string): number {
  const sectionHeader = `## ${sectionNum}.`;
  const start = content.indexOf(sectionHeader);
  if (start === -1) return 0;
  const nextMajor = content.indexOf("\n## ", start + sectionHeader.length);
  const sectionBody = nextMajor === -1 ? content.slice(start) : content.slice(start, nextMajor);
  return (sectionBody.match(/^### /gm) ?? []).length;
}

export async function readFullBacklogProgress(paths: PmPaths): Promise<BacklogProgress> {
  const raw = await readFile(paths.backlog, "utf8");
  const completed = countSectionItems(raw, "1");
  const inProgress = countSectionItems(raw, "2");
  const blocked = countSectionItems(raw, "3");
  const planned = countSectionItems(raw, "4");
  const future = countSectionItems(raw, "5");
  const remaining = blocked + planned + future + inProgress;
  const total = completed + remaining;
  return {
    completed_items: completed,
    remaining_items: remaining,
    in_progress_items: inProgress,
    total_items: total,
  };
}

export function isBacklogIdConsumed(state: PmState, backlogId: string): boolean {
  const reserved = new Set([
    "assigned_developer",
    "developer_working",
    "awaiting_dev_report",
    "reviewing_dev",
    "assigned_qa",
    "qa_working",
    "awaiting_qa_report",
    "reviewing_qa",
    "awaiting_approval",
    "blocked",
    "completed",
    "cancelled",
  ]);

  if (state.completed_task_ids.some((id) => id.includes(backlogId))) return true;
  if (state.blocked_task_ids.some((id) => id.includes(backlogId))) return true;
  return state.task_queue.some(
    (t) => t.backlog_id === backlogId && reserved.has(t.status),
  );
}

export function filterActionableBacklogItems(
  items: BacklogItem[],
  state: PmState,
): BacklogItem[] {
  return items.filter((item) => {
    if (item.status === "completed" || item.completionPct >= 100) return false;
    if (item.section === "in_progress") return false;
    if (isBacklogIdConsumed(state, item.id)) return false;
    if (isVagueTask(item)) {
      const hasBetter = items.some(
        (other) =>
          other.id !== item.id
          && !isVagueTask(other)
          && !isBacklogIdConsumed(state, other.id)
          && other.status !== "completed"
          && other.section !== "in_progress",
      );
      if (hasBetter) return false;
    }
    return true;
  });
}

export async function readKnowledgeSummary(paths: PmPaths): Promise<string[]> {
  if (!existsSync(paths.knowledgeDir)) return [];
  const files = await readdir(paths.knowledgeDir);
  const summaries: string[] = [];
  for (const f of files.filter((x) => x.endsWith(".md"))) {
    const raw = await readFile(join(paths.knowledgeDir, f), "utf8");
    const isTodo = /^#\s+.+\n\nTODO\s*$/m.test(raw.trim()) || raw.includes("TODO") && raw.length < 80;
    summaries.push(`${f}: ${isTodo ? "TODO" : "populated"} (${raw.length} bytes)`);
  }
  return summaries;
}

export async function readLatestStandup(paths: PmPaths): Promise<string | null> {
  if (!existsSync(paths.standupDir)) return null;
  const files = (await readdir(paths.standupDir))
    .filter((f) => f.startsWith("DAILY_STANDUP_") && f.endsWith(".md"))
    .sort()
    .reverse();
  if (files.length === 0) return null;
  return readFile(join(paths.standupDir, files[0]), "utf8");
}
