import type { WorkOrder } from "./types.js";
import type { CommanderStatusSummary } from "./status.js";
import { suggestedNextAction } from "./classifier.js";

const STUDIOSIS_CONTEXT = `StudiosisLab is the product codebase under \`src/\` (Next.js resume builder, templates, tools hub).
SOS/ is the operations system (runtime, logs, reports, roadmap). Commander supervises PM, Developer, QA workers.
Founder operates remotely via Telegram; Cursor agents on the laptop execute substantial work from queued prompts.`;

export function buildCursorPromptMarkdown(
  order: WorkOrder,
  status: CommanderStatusSummary,
): string {
  const nextAction = suggestedNextAction(order.classification);

  return `# Cursor Agent Prompt — ${order.work_order_id}

## Work order
- **ID:** ${order.work_order_id}
- **Received:** ${order.received_at}
- **Classification:** ${order.classification}
- **Priority:** ${order.priority}
- **Source:** ${order.source}

## Founder message
${order.raw_message}

## StudiosisLab context
${STUDIOSIS_CONTEXT}

## Commander status (snapshot)
${formatStatusBlock(status)}

## Your mission
Execute the founder message above. Produce a concrete, reviewable outcome.

## Expected output format
1. Short summary of what you did (2–5 sentences).
2. Files changed (paths only, or "none" for research).
3. Verification performed (commands run + result).
4. Report written to \`SOS/09_REPORTS/\` or \`SOS/07_LOGS/\` when appropriate.
5. Remaining risks or follow-ups (if any).

## Safety rules
- Do **not** touch unrelated files.
- Do **not** modify \`src/\` unless the founder message explicitly requires product work.
- Prefer minimal diffs; match existing code style.
- Do **not** commit unless the founder explicitly asks.
- Do **not** change secrets, \`.env\`, or production credentials.
- Runtime changes belong in \`SOS/runtime/\` only when the task is SOS/Commander work.

## Report format
Create or update a markdown report under \`SOS/09_REPORTS/\` named for the task, including:
- What was requested
- What was done
- Verification evidence
- Limitations

## Completion checklist
- [ ] Founder intent addressed
- [ ] Scope limited to relevant paths
- [ ] Build/lint run if \`src/\` changed
- [ ] Report file created
- [ ] No unrelated refactors

## Suggested next action (for founder)
${nextAction}
`;
}

function formatStatusBlock(status: CommanderStatusSummary): string {
  return [
    `- Commander: ${status.commander_status}`,
    `- PM loop: ${status.pm_loop}`,
    `- Current task: ${status.current_task ?? "none"}`,
    `- Developer: ${status.developer_state}`,
    `- QA: ${status.qa_state}`,
    `- PM queue: ${status.queue_count}`,
  ].join("\n");
}
