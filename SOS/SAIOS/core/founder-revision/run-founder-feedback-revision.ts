/**
 * CLI: create + run Founder-feedback OpenAI canvas revisions.
 * Usage:
 *   npx tsx .../run-founder-feedback-revision.ts --decision fd-...
 *   npx tsx .../run-founder-feedback-revision.ts --task revtask-...
 *   npx tsx .../run-founder-feedback-revision.ts --three
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { createRevisionTaskFromDecision } from "./createRevisionTaskFromDecision.js";
import { runFounderFeedbackRevision } from "./FounderRevisionPipeline.js";
import { findTaskByDecisionId, listRevisionTasks } from "./RevisionTaskStore.js";

const REPO = resolve(import.meta.dirname, "../../../..");

function loadEnvLocal(): void {
  const p = join(REPO, ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

function loadDecision(decisionId: string): Record<string, unknown> | null {
  const path = join(REPO, "SOS/07_LOGS/saios/founder-decisions/decisions.jsonl");
  if (!existsSync(path)) return null;
  let latest: Record<string, unknown> | null = null;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.trim()) continue;
    const d = JSON.parse(line) as Record<string, unknown>;
    if (d.decision_id === decisionId) latest = d;
  }
  return latest;
}

const THREE = [
  "fd-53437052-eb8", // Software Engineer
  "fd-f73b3042-504", // Graphic Designer
  "fd-a7cd4477-a0f", // HR Manager
];

async function runDecision(decisionId: string): Promise<Record<string, unknown>> {
  const d = loadDecision(decisionId);
  if (!d) return { decision_id: decisionId, ok: false, error: "decision not found" };
  const created = createRevisionTaskFromDecision({
    decision_id: String(d.decision_id),
    review_id: String(d.review_id),
    decision: String(d.decision),
    reason: String(d.reason ?? ""),
    requested_changes: Array.isArray(d.requested_changes)
      ? (d.requested_changes as string[])
      : [],
    structured_feedback: d.structured_feedback as
      | { candidate_id?: string }
      | undefined,
    task_id: String(d.task_id ?? ""),
    cycle_id: String(d.cycle_id ?? ""),
  });
  if (!created.ok || !created.task) {
    return {
      decision_id: decisionId,
      ok: false,
      error: created.error,
    };
  }
  const result = await runFounderFeedbackRevision({
    task_id: created.task.task_id,
  });
  return {
    decision_id: decisionId,
    task_id: created.task.task_id,
    task_created: created.created,
    ...result,
    task_status: result.task.status,
  };
}

async function main(): Promise<void> {
  loadEnvLocal();
  process.env.SOS_AIOS_LIVE = "0";
  if (!process.env.SOS_AI_FOUNDER_OPENAI_ONE_TEST) {
    process.env.SOS_AI_FOUNDER_OPENAI_ONE_TEST = "1";
  }

  const args = process.argv.slice(2);
  if (args.includes("--three")) {
    const results = [];
    for (const id of THREE) {
      console.error(`Running revision for ${id}…`);
      results.push(await runDecision(id));
    }
    console.log(JSON.stringify({ ok: results.every((r) => r.ok), results }, null, 2));
    process.exit(results.every((r) => r.ok) ? 0 : 1);
  }

  const decisionIdx = args.indexOf("--decision");
  if (decisionIdx >= 0 && args[decisionIdx + 1]) {
    const out = await runDecision(args[decisionIdx + 1]!);
    console.log(JSON.stringify(out, null, 2));
    process.exit(out.ok ? 0 : 1);
  }

  const taskIdx = args.indexOf("--task");
  if (taskIdx >= 0 && args[taskIdx + 1]) {
    const out = await runFounderFeedbackRevision({ task_id: args[taskIdx + 1]! });
    console.log(JSON.stringify(out, null, 2));
    process.exit(out.ok ? 0 : 1);
  }

  console.log(
    JSON.stringify(
      {
        usage:
          "--three | --decision <fd-…> | --task <revtask-…>",
        pending_tasks: listRevisionTasks().map((t) => ({
          task_id: t.task_id,
          decision_id: t.decision_id,
          status: t.status,
        })),
        known: THREE.map((id) => ({
          decision_id: id,
          existing_task: findTaskByDecisionId(id)?.task_id ?? null,
        })),
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
