import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { ChecklistResult, DeveloperReportInput, ParsedQaBrief } from "../types.js";
import {
  FOUNDER_FILE_ALLOWLIST_PREFIXES,
  isFounderFileAllowlisted,
  parseFounderFileInstruction,
} from "../../developer/strategies/founder-file.js";

function isFounderFileQaTask(brief: ParsedQaBrief, devReport: DeveloperReportInput): boolean {
  return (
    brief.task_id.startsWith("TASK-INBOX-EXEC-")
    || devReport.task_id.startsWith("TASK-INBOX-EXEC-")
    || Boolean(brief.founder_instruction)
  );
}

export function runFounderFileChecks(
  repoRoot: string,
  brief: ParsedQaBrief,
  devReport: DeveloperReportInput,
): ChecklistResult[] {
  const results: ChecklistResult[] = [];

  results.push({
    item_id: "CHK-FOUNDER-DEV-REPORT",
    passed: devReport !== null && !devReport.blocker,
    notes: devReport ? "Developer report present for founder file task" : "Missing developer report",
  });

  const instructionText = brief.founder_instruction?.trim();
  if (!instructionText) {
    results.push({
      item_id: "CHK-FOUNDER-INSTRUCTION",
      passed: false,
      notes: "Missing metadata.founder_instruction on QA brief",
    });
    return results;
  }

  results.push({
    item_id: "CHK-FOUNDER-INSTRUCTION",
    passed: true,
    notes: `Canonical founder_instruction present (${instructionText.length} chars)`,
  });

  const instruction = parseFounderFileInstruction(instructionText);

  if (!instruction) {
    results.push({
      item_id: "CHK-FOUNDER-PARSE",
      passed: false,
      notes: "Could not parse founder_instruction",
    });
    return results;
  }

  results.push({
    item_id: "CHK-FOUNDER-PARSE",
    passed: true,
    notes: `Parsed founder instruction: ${instruction.type}`,
  });

  if (instruction.type === "folder") {
    const full = join(repoRoot, instruction.path);
    results.push({
      item_id: "CHK-FOUNDER-PATH",
      passed: isFounderFileAllowlisted(instruction.path),
      notes: isFounderFileAllowlisted(instruction.path)
        ? `${instruction.path} within allowlist`
        : `${instruction.path} outside allowlist`,
    });
    results.push({
      item_id: "CHK-FOUNDER-EXISTS",
      passed: existsSync(full),
      notes: existsSync(full) ? `Folder exists: ${instruction.path}` : `Folder missing: ${instruction.path}`,
    });
    return results;
  }

  results.push({
    item_id: "CHK-FOUNDER-PATH",
    passed: isFounderFileAllowlisted(instruction.path),
    notes: isFounderFileAllowlisted(instruction.path)
      ? `${instruction.path} within allowlist (${FOUNDER_FILE_ALLOWLIST_PREFIXES.join(", ")})`
      : `${instruction.path} rejected — not in allowlist`,
  });

  const full = join(repoRoot, instruction.path);
  const exists = existsSync(full);
  results.push({
    item_id: "CHK-FOUNDER-EXISTS",
    passed: exists,
    notes: exists ? `File exists: ${instruction.path}` : `File missing: ${instruction.path}`,
  });

  if (exists) {
    const actual = readFileSync(full, "utf8");
    const contentMatch = actual === instruction.content;
    results.push({
      item_id: "CHK-FOUNDER-CONTENT",
      passed: contentMatch,
      notes: contentMatch
        ? "File content matches founder_instruction"
        : `Content mismatch — expected ${instruction.content.length} chars, got ${actual.length}`,
    });
  } else {
    results.push({
      item_id: "CHK-FOUNDER-CONTENT",
      passed: false,
      notes: "Cannot verify content — file missing",
    });
  }

  const inDevReport = devReport.files_changed.includes(instruction.path);
  results.push({
    item_id: "CHK-FOUNDER-REPORT-FILES",
    passed: inDevReport,
    notes: inDevReport
      ? `${instruction.path} listed in developer report`
      : `Developer report missing ${instruction.path} in files_changed`,
  });

  return results;
}

export function isFounderFileQaBrief(brief: ParsedQaBrief, devReport: DeveloperReportInput): boolean {
  return isFounderFileQaTask(brief, devReport);
}
