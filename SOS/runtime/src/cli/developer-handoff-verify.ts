#!/usr/bin/env node
/**
 * PM → Developer handoff smoke test (TEST-DEVELOPER-HANDOFF).
 * Saves PM assignment snapshot, assigns test task, verifies propagation, restores.
 */
import { randomUUID } from "node:crypto";
import { writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "../config.js";
import { getPmPaths } from "../pm/paths.js";
import { loadState, saveState } from "../pm/state.js";
import { assignDeveloper } from "../pm/agents.js";
import { buildDeveloperBrief, writeBrief } from "../pm/tasks.js";
import { getDeveloperPaths } from "../developer/paths.js";
import { loadDeveloperState } from "../developer/state.js";
import { reconcileDeveloperWithPm, propagateDeveloperAssignment } from "../developer/handoff.js";
import { getQaPaths } from "../qa/paths.js";
import { loadQaState } from "../qa/state.js";
import type { PmState, Task } from "../pm/types.js";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main(): Promise<void> {
  const config = loadConfig();
  const pmPaths = getPmPaths(config);
  const devPaths = getDeveloperPaths(config);
  const qaPaths = getQaPaths(config);

  const snapshotPath = join(pmPaths.root, "handoff-verify-snapshot.json");
  const state = await loadState(pmPaths);
  const snapshot = {
    current_task_id: state.current_task_id,
    developer_assignment: state.developer_assignment,
    task_queue: state.task_queue,
    developer_state: existsSync(devPaths.state)
      ? JSON.parse(await readFile(devPaths.state, "utf8"))
      : null,
  };
  await writeFile(snapshotPath, JSON.stringify(snapshot, null, 2), "utf8");

  const testTaskId = `TASK-TEST-DEVELOPER-HANDOFF-${Date.now()}`;
  const testTask: Task = {
    task_id: testTaskId,
    correlation_id: randomUUID(),
    backlog_id: "TEST-HANDOFF",
    title: "TEST-DEVELOPER-HANDOFF",
    description: "Smoke test — PM assigns, Developer adopts, QA stays idle.",
    priority: "P3",
    backlog_priority: "Low",
    status: "queued",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    evidence: ["SOS/09_REPORTS/COMMANDER_TELEGRAM_RECOVERY_REPORT.md"],
    requires_commander_approval: false,
    hard_gate_ids: [],
    confidence: 100,
    qa_required: false,
    metadata: { smoke_test: true },
  };

  state.task_queue.push(testTask);
  await writeBrief(pmPaths.devBriefs, testTaskId, buildDeveloperBrief(testTask));
  await assignDeveloper(pmPaths, state, testTask);

  let matched = false;
  for (let attempt = 0; attempt < 15; attempt++) {
    const pm = await loadState(pmPaths);
    const dev = await loadDeveloperState(devPaths);
    const qa = await loadQaState(qaPaths);

    if (
      pm.current_task_id === testTaskId
      && pm.developer_assignment?.task_id === testTaskId
      && dev.current_task_id === testTaskId
      && (dev.state === "working" || dev.state === "prepared")
      && dev.work_plan_path
      && qa.state === "idle"
      && !qa.current_task_id
    ) {
      matched = true;
      break;
    }

    const devState = await loadDeveloperState(devPaths);
    await reconcileDeveloperWithPm(config, devPaths, devState);
    await sleep(2000);
  }

  const pmFinal = await loadState(pmPaths);
  const devFinal = await loadDeveloperState(devPaths);
  const qaFinal = await loadQaState(qaPaths);

  const report = {
    pass: matched,
    test_task_id: testTaskId,
    pm: {
      current_task_id: pmFinal.current_task_id,
      assignment_task_id: pmFinal.developer_assignment?.task_id,
      task_status: pmFinal.task_queue.find((t) => t.task_id === testTaskId)?.status,
    },
    developer: {
      state: devFinal.state,
      current_task_id: devFinal.current_task_id,
      work_plan_path: devFinal.work_plan_path,
      execution_submitted: devFinal.execution_submitted,
    },
    qa: {
      state: qaFinal.state,
      current_task_id: qaFinal.current_task_id,
    },
    all_agree: pmFinal.current_task_id === devFinal.current_task_id
      && pmFinal.developer_assignment?.task_id === devFinal.current_task_id,
    developer_not_paused: devFinal.state !== "paused",
  };

  console.log(JSON.stringify(report, null, 2));

  const restore = JSON.parse(await readFile(snapshotPath, "utf8")) as {
    current_task_id: string | null;
    developer_assignment: PmState["developer_assignment"];
    task_queue: PmState["task_queue"];
    developer_state: Record<string, unknown> | null;
  };

  const restoreState = await loadState(pmPaths);
  restoreState.current_task_id = restore.current_task_id;
  restoreState.developer_assignment = restore.developer_assignment;
  restoreState.task_queue = restore.task_queue;
  await saveState(pmPaths, restoreState);

  const originalTask = restore.task_queue.find((t) => t.task_id === restore.current_task_id);
  if (originalTask && restore.current_task_id && restore.developer_assignment) {
    const afterSave = await loadState(pmPaths);
    await propagateDeveloperAssignment(
      config,
      originalTask,
      restore.developer_assignment.brief_path,
    );
  } else if (restore.developer_state) {
    await writeFile(devPaths.state, JSON.stringify(restore.developer_state, null, 2), "utf8");
  }

  process.exit(matched ? 0 : 1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
