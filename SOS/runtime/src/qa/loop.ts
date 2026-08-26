import { writeFile } from "node:fs/promises";
import type { RuntimeConfig } from "../config.js";
import { loadConfig } from "../config.js";
import { getQaPaths } from "./paths.js";
import { loadQaState, saveQaState, resetQaState, ensureQaDirs } from "./state.js";
import type { QaRuntimeState, QaState, QaStatus } from "./types.js";
import { listUnclaimedQaBriefs, claimQaTask, releaseQaLock } from "./queue.js";
import {
  buildChecklist,
  loadDeveloperReport,
  loadDeveloperPlan,
  loadImplementationPlan,
  saveChecklist,
  verificationKey,
} from "./checklist.js";
import { runVerification } from "./verifier.js";
import { reviewVerification } from "./review.js";
import { emitQaProgress } from "./progress.js";
import { toFullReport, writeQaReports, emitQaEvents } from "./reports.js";
import { isShutdownRequested } from "../runtime/shutdown.js";
import { startWorkerHeartbeat } from "../runtime/worker-heartbeat.js";

export type QaLoopOptions = {
  once?: boolean;
  pollMs?: number;
};

const loopStartedAt = Date.now();

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function writeHeartbeat(
  paths: ReturnType<typeof getQaPaths>,
  state: QaRuntimeState,
): Promise<void> {
  const status: QaStatus = {
    state: state.state,
    current_task_id: state.current_task_id,
    current_correlation_id: state.current_correlation_id,
    uptime_seconds: Math.floor((Date.now() - loopStartedAt) / 1000),
    last_heartbeat: new Date().toISOString(),
    started_at: state.started_at,
  };
  await writeFile(paths.status, JSON.stringify(status, null, 2), "utf8");
}

async function runQaPipeline(
  config: RuntimeConfig,
  paths: ReturnType<typeof getQaPaths>,
  state: QaRuntimeState,
  heartbeat?: ReturnType<typeof startWorkerHeartbeat>,
): Promise<void> {
  const briefs = await listUnclaimedQaBriefs(
    paths,
    state.completed_task_ids,
    state.processed_verification_keys,
  );

  if (briefs.length === 0) {
    state.state = "idle";
    return;
  }

  const brief = briefs[0];
  const devReport = await loadDeveloperReport(paths, brief.task_id);
  const vKey = verificationKey(brief.task_id, devReport);

  if (state.processed_verification_keys.includes(vKey)) {
    return;
  }

  state.state = "waiting_brief";
  state.current_task_id = brief.task_id;
  state.current_correlation_id = brief.correlation_id;

  await claimQaTask(paths, brief);
  state.state = "claimed";
  state.claimed_brief_path = brief.brief_path;

  const plan = await loadDeveloperPlan(paths, brief.task_id);
  const implPlan = await loadImplementationPlan(paths, brief.task_id);

  state.state = "prepare_checklist";
  const checklist = buildChecklist(brief, devReport, plan, implPlan);
  await saveChecklist(paths, brief.task_id, checklist);
  await emitQaProgress(
    paths,
    brief.task_id,
    brief.correlation_id,
    "checklist_prepared",
    `${checklist.length} checklist items`,
  );

  state.state = "verification";
  await emitQaProgress(
    paths,
    brief.task_id,
    brief.correlation_id,
    "verification_started",
    "Automated verification running (build, lint, tests, acceptance criteria)",
  );

  heartbeat?.setBusy("verification", { task_id: brief.task_id });
  let verification = await runVerification(
    config,
    brief,
    devReport,
    Boolean(plan || implPlan),
    checklist,
  );
  heartbeat?.clearBusy();
  const review = reviewVerification(verification);
  if (!review.accept && verification.verdict === "pass") {
    verification = {
      ...verification,
      verdict: "fail",
      summary: `${verification.summary}; downgraded — ${review.message}`,
      recommendation: `Reject — ${review.message}`,
    };
  }

  state.state = verification.verdict === "pass" ? "pass" : "fail";
  if (verification.verdict === "blocked") state.state = "fail";

  const full = toFullReport(brief, devReport, verification);
  await writeQaReports(paths, full);
  await emitQaEvents(paths, brief, verification, full);

  await emitQaProgress(
    paths,
    brief.task_id,
    brief.correlation_id,
    "verification_complete",
    verification.summary,
    { verdict: verification.verdict, recommendation: verification.recommendation },
  );

  await emitQaProgress(
    paths,
    brief.task_id,
    brief.correlation_id,
    "report_written",
    "PM QA report written",
  );

  state.processed_verification_keys.push(vKey);
  if (verification.verdict === "pass") {
    if (!state.completed_task_ids.includes(brief.task_id)) {
      state.completed_task_ids.push(brief.task_id);
    }
  } else if (!state.failed_task_ids.includes(brief.task_id)) {
    state.failed_task_ids.push(brief.task_id);
  }

  await releaseQaLock(paths, brief.task_id);
  state.current_task_id = null;
  state.current_correlation_id = null;
  state.claimed_brief_path = null;
  state.state = "idle";
}

export async function runQaLoop(options: QaLoopOptions = {}): Promise<void> {
  const config = loadConfig();
  const paths = getQaPaths(config);
  const state = await loadQaState(paths);
  const pollMs = options.pollMs ?? parseInt(process.env.SOS_QA_POLL_MS ?? "5000", 10);
  const heartbeat = startWorkerHeartbeat(config, "qa", { initialPhase: state.state });

  try {
    for (;;) {
      if (isShutdownRequested(config.logsRoot)) {
        await saveQaState(paths, state);
        await writeHeartbeat(paths, state);
        break;
      }

      heartbeat.setPhase(state.state);

      try {
        if (state.state === "idle" && state.current_task_id === null) {
          heartbeat.setBusy("qa_pipeline");
          await runQaPipeline(config, paths, state, heartbeat);
          heartbeat.clearBusy();
        }
      } catch (e) {
        heartbeat.clearBusy();
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[qa] pipeline error: ${msg}`);
        state.state = "idle";
        if (options.once) throw e;
        await sleep(Math.min(pollMs * 2, 30_000));
      }

      await saveQaState(paths, state);
      await writeHeartbeat(paths, state);

      if (options.once) break;
      await sleep(pollMs);
    }

    await saveQaState(paths, state);
    await writeHeartbeat(paths, state);
  } finally {
    await heartbeat.stop();
  }
}

export async function getQaStatus(): Promise<
  QaStatus & {
    runtime_state: QaState;
    completed_count: number;
    failed_count: number;
    processed_verification_keys: string[];
  }
> {
  const config = loadConfig();
  const paths = getQaPaths(config);
  const state = await loadQaState(paths);

  return {
    state: state.state,
    current_task_id: state.current_task_id,
    current_correlation_id: state.current_correlation_id,
    uptime_seconds: Math.floor((Date.now() - Date.parse(state.started_at)) / 1000),
    last_heartbeat: state.updated_at,
    started_at: state.started_at,
    runtime_state: state.state,
    completed_count: state.completed_task_ids.length,
    failed_count: state.failed_task_ids.length,
    processed_verification_keys: state.processed_verification_keys,
  };
}

export async function resetQaRuntime(): Promise<void> {
  const config = loadConfig();
  const paths = getQaPaths(config);
  await ensureQaDirs(paths);
  await resetQaState(paths);
  await writeFile(
    paths.status,
    JSON.stringify({ state: "idle", reset_at: new Date().toISOString() }, null, 2),
    "utf8",
  );
}
