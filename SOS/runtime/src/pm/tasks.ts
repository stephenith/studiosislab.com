import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { BacklogItem, Task } from "./types.js";
import { detectHardGates, evaluateTaskForApproval, loadCdeConfig } from "./cde.js";
import {
  formatFounderInstructionSection,
  founderInstructionFromTaskMetadata,
} from "../founder-instruction.js";

export function backlogItemToTask(item: BacklogItem): Task {
  const config = loadCdeConfig();
  const text = `${item.title} ${item.description} ${item.evidence.join(" ")}`;
  const hardGates = detectHardGates(text, config);
  const now = new Date().toISOString();

  const task: Task = {
    task_id: `TASK-${item.id}-${Date.now()}`,
    correlation_id: randomUUID(),
    backlog_id: item.id,
    title: item.title,
    description: item.description,
    priority:
      item.priority === "Critical" ? "P0"
      : item.priority === "High" ? "P1"
      : item.priority === "Medium" ? "P2"
      : "P3",
    backlog_priority: item.priority,
    status: "queued",
    created_at: now,
    updated_at: now,
    evidence: item.evidence,
    requires_commander_approval: hardGates.length > 0 || item.section === "blocked",
    hard_gate_ids: hardGates,
    confidence: item.needsVerification ? 55 : 80,
    qa_required: false,
    metadata: { section: item.section, sectionRef: item.sectionRef },
  };

  const evalPre = evaluateTaskForApproval(task, config);
  task.requires_commander_approval = evalPre.commander_required;
  task.hard_gate_ids = evalPre.hard_gate_ids;
  task.qa_required = evalPre.qa_required;

  return task;
}

export function buildDeveloperBrief(task: Task): string {
  const reportPath = `SOS/07_LOGS/pm/reports/developer/${task.task_id}.json`;
  const filesInScope = task.evidence.filter((e) => e.includes("/") || /\.(tsx?|json|rules)$/i.test(e));
  const founderInstruction = founderInstructionFromTaskMetadata(task.metadata);
  const founderSection = founderInstruction
    ? `\n${formatFounderInstructionSection(founderInstruction)}\n`
    : "";
  const qaChecklist = [
    "Verify build passes (`npm run build`)",
    "Verify lint passes (`npm run lint`)",
    "Confirm changes stay within files in scope",
    "Validate launch-path impact (resume, mobile, e-sign, auth) if applicable",
    "Capture repro steps for any failure",
  ];

  const pmRecommendation =
    task.priority === "P0" || task.priority === "P1"
      ? "Treat as launch-critical. Minimize scope; cite repository evidence in the completion report."
    : task.hard_gate_ids.length > 0
      ? "Hard gates detected — implement only what the brief allows; flag anything requiring Commander approval."
      : "Proceed autonomously; keep changes focused on the stated objective.";

  return `# Developer Task Brief

## Task ID
${task.task_id}

## Correlation ID
${task.correlation_id}

## Priority
${task.priority} (${task.backlog_priority})

## Title
${task.title}

## Objective
${task.title}

## Description
${task.description}
${founderSection}
## Evidence files
${filesInScope.map((e) => `- \`${e}\``).join("\n") || "- See backlog repository evidence"}

## Acceptance criteria
1. Changes meet the objective above with repository evidence cited.
2. \`npm run build\` passes.
3. \`npm run lint\` passes.
4. No changes outside scope without PM approval.
5. Write completion report to \`${reportPath}\`.

## Files in scope
${filesInScope.map((e) => `- \`${e}\``).join("\n") || "- PM will refine after Commander approval if needed"}

## Out of scope
- Unrelated refactors
- \`package.json\` dependency changes without approval
- \`firestore.rules\` / \`storage.rules\` without approval
- Merge to \`main\`

## Hard gates
${task.hard_gate_ids.length ? task.hard_gate_ids.join(", ") : "None — implementation may proceed per brief"}

## QA checklist
${qaChecklist.map((item, i) => `${i + 1}. ${item}`).join("\n")}

## PM recommendation
${pmRecommendation}

## Next expected report path
\`${reportPath}\`

---

**Backlog reference:** ${task.backlog_id}
`;
}

export function buildQaBrief(task: Task, devReportPath?: string): string {
  const reportPath = devReportPath ?? `SOS/07_LOGS/pm/reports/developer/${task.task_id}.json`;
  const qaReportPath = `SOS/07_LOGS/pm/reports/qa/${task.task_id}.json`;
  const filesInScope = task.evidence.filter((e) => e.includes("/") || /\.(tsx?|json|rules)$/i.test(e));
  const founderInstruction = founderInstructionFromTaskMetadata(task.metadata);
  const founderSection = founderInstruction
    ? `\n${formatFounderInstructionSection(founderInstruction)}\n`
    : "";
  const validationSteps = [
    "Independent `npm run build` verification",
    "Scoped eslint on changed source files",
    "Automated tests if configured",
    "Acceptance criteria from Developer brief",
    "Strategy checks for launch-path impact",
    "Changed files exist at repository paths",
  ];

  return `# QA Task Brief

**Task ID:** ${task.task_id}  
**Correlation ID:** ${task.correlation_id}  
**Priority:** ${task.priority}  
**Developer report:** \`${reportPath}\`

## Objective

Verify Developer work for: ${task.title}

## PM requirements

${task.description}
${founderSection}
## Acceptance criteria

1. Developer report exists and correlation_id matches.
2. Independent build verification passes.
3. Scoped lint passes on changed files.
4. All acceptance criteria from Developer brief are met.
5. Changes stay within files in scope.
6. No developer blocker reported.

## Files in scope

${filesInScope.map((e) => `- \`${e}\``).join("\n") || "- See developer report files_changed"}

## Validation steps

${validationSteps.map((s, i) => `${i + 1}. ${s}`).join("\n")}

## Focus

- Launch path impact (resume, mobile, e-sign, auth)
- Repro steps for any failure
- Build/lint/test confirmation (QA runs independently)

## On completion

Create report file: \`${qaReportPath}\`

\`\`\`json
{
  "task_id": "${task.task_id}",
  "correlation_id": "${task.correlation_id}",
  "completed_at": "<ISO8601>",
  "verdict": "pass",
  "summary": "...",
  "recommendation": "...",
  "evidence": [],
  "failed_checks": []
}
\`\`\`
`;
}

export function buildBugFixBrief(
  task: Task,
  qaSummary: string,
  failedChecks: string[],
  recommendedFixes: string[],
): string {
  const reportPath = `SOS/07_LOGS/pm/reports/developer/${task.task_id}.json`;
  const filesInScope = task.evidence.filter((e) => e.includes("/") || /\.(tsx?|json|rules)$/i.test(e));
  const founderInstruction = founderInstructionFromTaskMetadata(task.metadata);
  const founderSection = founderInstruction
    ? `\n${formatFounderInstructionSection(founderInstruction)}\n`
    : "";

  return `# Developer Task Brief — QA Bug Fix

## Task ID
${task.task_id}

## Correlation ID
${task.correlation_id}

## Priority
${task.priority} (${task.backlog_priority})

## Title
${task.title} — QA bug fix

## Objective
Fix QA failures and re-submit for verification.

## Description
QA rejected the previous implementation.

**QA summary:** ${qaSummary}

**Failed checks:**
${failedChecks.map((c) => `- ${c}`).join("\n") || "- See QA report"}

**Recommended fixes:**
${recommendedFixes.map((f) => `- ${f}`).join("\n") || "- Address all QA failed checks"}
${founderSection}
## Evidence files
${filesInScope.map((e) => `- \`${e}\``).join("\n") || "- See original brief"}

## Acceptance criteria
1. Resolve every failed QA check listed above.
2. \`npm run build\` passes.
3. Scoped lint passes on changed files.
4. Write updated completion report to \`${reportPath}\`.
5. Do not mark task complete — QA will re-verify.

## Files in scope
${filesInScope.map((e) => `- \`${e}\``).join("\n") || "- Same as original task"}

## QA checklist
1. Verify build passes (\`npm run build\`)
2. Verify lint passes on changed files
3. Confirm all prior QA failures are resolved
4. Capture repro steps for any remaining issue

## PM recommendation
QA failed — fix only the reported issues. Preserve prior good changes where possible.

## Next expected report path
\`${reportPath}\`

---

**Backlog reference:** ${task.backlog_id}  
**Retry:** true
`;
}

export async function writeBrief(
  dir: string,
  taskId: string,
  content: string,
): Promise<string> {
  const path = join(dir, `${taskId}.md`);
  await writeFile(path, content, "utf8");
  return path;
}
