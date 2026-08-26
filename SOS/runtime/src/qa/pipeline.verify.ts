/**
 * Read-only Phase 6 pipeline verification — no state mutation.
 */
import { existsSync } from "node:fs";
import { loadConfig } from "../config.js";
import { loadPipelineStatus } from "../commander/pipeline-status.js";
import { getQaPaths } from "./paths.js";
import { loadQaState } from "./state.js";
import { listUnclaimedQaBriefs, parseQaBriefMarkdown } from "./queue.js";
import { classifyTier } from "../pm/scoring.js";
import { readMasterBacklog } from "../pm/readers.js";
import { getPmPaths } from "../pm/paths.js";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERT: ${message}`);
}

async function main(): Promise<void> {
  const config = loadConfig();
  const qaPaths = getQaPaths(config);
  const pmPaths = getPmPaths(config);
  const qaState = await loadQaState(qaPaths);
  const pipeline = await loadPipelineStatus(config);

  assert(existsSync("src/qa/verifier.ts"), "QA verifier exists");
  assert(existsSync("src/qa/strategies/index.ts"), "QA strategies exist");
  assert(existsSync("src/pm/qa-handoff.ts"), "PM QA handoff exists");
  assert(existsSync("src/developer/retry.ts"), "Developer retry exists");
  assert(existsSync("src/commander/pipeline-status.ts"), "Pipeline status exists");

  const sampleBrief = `# QA Task Brief

**Task ID:** TASK-SAMPLE-1
**Correlation ID:** sample-corr
**Priority:** P2
**Developer report:** \`SOS/07_LOGS/pm/reports/developer/TASK-SAMPLE-1.json\`

## Objective
Verify sample work

## Acceptance criteria
1. Build passes

## Files in scope
- \`src/app/faq/page.tsx\`

## Validation steps
1. Independent build verification
`;

  const parsed = parseQaBriefMarkdown(sampleBrief, "/tmp/sample.md");
  assert(parsed.acceptance_criteria.length > 0, "QA brief parser extracts acceptance criteria");
  assert(parsed.files_in_scope.includes("src/app/faq/page.tsx"), "QA brief parser extracts files in scope");

  const pending = await listUnclaimedQaBriefs(
    qaPaths,
    qaState.completed_task_ids,
    qaState.processed_verification_keys,
  );

  const backlog = await readMasterBacklog(pmPaths);
  const constitution = backlog.find((i) => i.id === "BL-4-4");
  if (constitution) {
    assert(classifyTier(constitution) === 5, "Constitution remains Tier 5 (PM scoring intact)");
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        qa_runtime: {
          state: qaState.state,
          completed: qaState.completed_task_ids.length,
          processed_keys: qaState.processed_verification_keys.length,
          pending_briefs: pending.length,
        },
        pipeline,
        checks: [
          "QA verifier + strategies present",
          "PM QA handoff + developer retry present",
          "Commander pipeline status loads",
          "QA brief parser enriched",
          "No state mutation performed",
        ],
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
