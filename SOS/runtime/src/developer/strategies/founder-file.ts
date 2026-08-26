import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { existsSync } from "node:fs";
import type { RuntimeConfig } from "../../config.js";
import type { ParsedBrief, WorkPlan } from "../types.js";
import type { StrategyOutput } from "./types.js";

export const FOUNDER_FILE_ALLOWLIST_PREFIXES = [
  "SOS/07_LOGS/",
  "SOS/09_REPORTS/",
  "SOS/01_KNOWLEDGE/",
] as const;

export type FounderFileInstruction =
  | { type: "file"; path: string; content: string }
  | { type: "folder"; path: string };

function normalizePath(raw: string): string {
  return raw.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\.\//, "");
}

export function isFounderFileAllowlisted(path: string): boolean {
  const normalized = normalizePath(path);
  if (normalized.startsWith("src/")) return false;
  return FOUNDER_FILE_ALLOWLIST_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function matchesFounderFileTask(brief: ParsedBrief): boolean {
  if (brief.backlog_id === "INBOX-EXEC") return true;
  if (brief.task_id.startsWith("TASK-INBOX-EXEC-")) return true;
  return Boolean(brief.founder_instruction);
}

/** Parse file path/content from the canonical founder_instruction string only. */
export function parseFounderFileInstruction(text: string): FounderFileInstruction | null {
  const raw = text.replace(/\r\n/g, "\n").trim();

  const folderMatch = raw.match(/\bcreate\s+folder\s+((?:SOS|src)\/[\w./_-]+)/i);
  if (folderMatch) {
    return { type: "folder", path: normalizePath(folderMatch[1]) };
  }

  const writeWith = raw.match(/\bwrite\s+file\s+((?:SOS|src)\/[\w./_-]+)\s+with\s+(.+)/i);
  if (writeWith) {
    return {
      type: "file",
      path: normalizePath(writeWith[1]),
      content: writeWith[2].trim(),
    };
  }

  const createContaining = raw.match(
    /\b(?:create|write)\s+file\s+((?:SOS|src)\/[\w./_-]+)\s+containing\s+(.+)/i,
  );
  if (createContaining) {
    return {
      type: "file",
      path: normalizePath(createContaining[1]),
      content: createContaining[2].trim(),
    };
  }

  const createContents = raw.match(
    /\bcreate\s+file\s+((?:SOS|src)\/[\w./_-]+)[\s\S]*?\bContents:\s*\n+([\s\S]+?)(?:\n\s*After\s|\n\s*\d+\.\s|$)/i,
  );
  if (createContents) {
    return {
      type: "file",
      path: normalizePath(createContents[1]),
      content: createContents[2].trim(),
    };
  }

  return null;
}

function requireFounderInstruction(brief: ParsedBrief): string {
  const instruction = brief.founder_instruction?.trim();
  if (!instruction) {
    throw new Error(
      `Missing metadata.founder_instruction for founder file task ${brief.task_id}. `
      + `Brief must carry ## Founder instruction unchanged from EXECUTE_NOW.`,
    );
  }
  return instruction;
}

export async function executeFounderFileStrategy(
  config: RuntimeConfig,
  brief: ParsedBrief,
  _workPlan: WorkPlan,
): Promise<StrategyOutput> {
  const text = requireFounderInstruction(brief);
  const instruction = parseFounderFileInstruction(text);
  if (!instruction) {
    throw new Error(
      `Could not parse founder_instruction for ${brief.task_id}: ${JSON.stringify(text)}`,
    );
  }

  if (instruction.type === "folder") {
    if (!isFounderFileAllowlisted(instruction.path)) {
      throw new Error(`Founder folder path not allowlisted: ${instruction.path}`);
    }
    const full = `${config.repoRoot}/${instruction.path}`;
    await mkdir(full, { recursive: true });
    return {
      files_changed: [instruction.path],
      diff_summary: `Created folder ${instruction.path}`,
      implementation_summary: `Created folder at ${instruction.path}`,
    };
  }

  if (!isFounderFileAllowlisted(instruction.path)) {
    throw new Error(
      `Founder file path not allowlisted: ${instruction.path}. Allowed: ${FOUNDER_FILE_ALLOWLIST_PREFIXES.join(", ")}`,
    );
  }

  const rel = instruction.path;
  const full = `${config.repoRoot}/${rel}`;
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, instruction.content, "utf8");

  if (!existsSync(full)) {
    throw new Error(`Failed to create file at ${rel}`);
  }

  return {
    files_changed: [rel],
    diff_summary: `Wrote ${instruction.content.length} bytes to ${rel}`,
    implementation_summary: `Created file ${rel} with founder-requested content`,
  };
}
