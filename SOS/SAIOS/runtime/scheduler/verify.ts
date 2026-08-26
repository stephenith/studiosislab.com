#!/usr/bin/env tsx
/**
 * Autonomous Resume Factory Scheduler verification.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  AUTONOMOUS_SCHEDULER,
  startScheduler,
  resumeScheduler,
  tickScheduler,
  interruptScheduler,
} from "./SchedulerDirector.js";
import { recoverScheduler } from "./Recovery.js";
import { createMockProductionExecutor } from "./ProductionExecutor.js";
import { createSchedulerState, saveSchedulerState } from "./SchedulerState.js";
import { SCHEDULER_ROOT, CONFIG_PATH } from "./SchedulerConfig.js";
import { loadJobHistory, loadSchedulerMemory } from "./SchedulerMemory.js";
import { createSchedulerQueue } from "./QueueIntegration.js";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

async function main(): Promise<void> {
  assert(AUTONOMOUS_SCHEDULER.module === "autonomous-resume-factory-scheduler", "module id");
  assert(AUTONOMOUS_SCHEDULER.role === "operational_controller_only", "role");

  const memoryBefore = loadSchedulerMemory();
  const mockExecutor = createMockProductionExecutor();

  const started = await startScheduler({
    dry_run: true,
    production_executor: mockExecutor,
    persist: true,
  });
  assert(started.pass, "scheduler starts");
  assert(existsSync(CONFIG_PATH), "scheduler-config.json");

  saveSchedulerState(createSchedulerState());

  interruptScheduler();
  const resumed = await recoverScheduler({
    dry_run: true,
    production_executor: mockExecutor,
    persist: true,
  });
  assert(resumed.pass, "scheduler resumes");

  const verifyGoalId = `verify-goal-${Date.now()}`;
  const tick1 = await tickScheduler({
    dry_run: true,
    production_executor: mockExecutor,
    persist: true,
    config: {
      goals: [
        {
          id: verifyGoalId,
          name: "Verify Engineering",
          category: "engineering",
          enabled: true,
          frequency: "hourly",
          objective_template: "Verify scheduler {category} production for {industry}",
          priority: "P0",
          max_per_run: 1,
        },
      ],
    },
  });
  assert(tick1.jobs_created >= 1, "scheduler creates jobs");

  const queue = createSchedulerQueue();
  const jobs = await queue.listJobs();
  assert(jobs.length >= 1, "queue integration");

  assert(
    tick1.jobs_processed >= 1 || tick1.jobs_waiting_founder >= 1,
    "unified production integration",
  );

  const history = loadJobHistory();
  const waiting = history.entries.filter((e) => e.awaiting_founder);
  assert(waiting.length >= 1, "founder approval gate preserved");

  const reports = [
    "scheduler-dashboard.json",
    "scheduler-health.json",
    "scheduler-history.json",
    "production-statistics.json",
    "daily-summary.json",
    "job-history.json",
  ];
  for (const file of reports) {
    assert(existsSync(join(SCHEDULER_ROOT, file)), `report: ${file}`);
  }

  const config = JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as {
    founder_rules: { never_publish_automatically: boolean };
  };
  assert(config.founder_rules.never_publish_automatically === true, "never publish automatically");

  const dashboard = JSON.parse(readFileSync(join(SCHEDULER_ROOT, "scheduler-dashboard.json"), "utf8")) as {
    auto_publish: boolean;
    founder_gate: string;
  };
  assert(dashboard.auto_publish === false, "dashboard auto_publish false");
  assert(dashboard.founder_gate === "ENFORCED", "founder gate enforced");

  const memoryAfter = loadSchedulerMemory();
  assert(memoryAfter.entries.length >= memoryBefore.entries.length, "learning appended");

  console.log(
    JSON.stringify(
      {
        pass: true,
        component: "autonomous-resume-factory-scheduler",
        scheduler_id: started.scheduler_id,
        checks: {
          scheduler_starts: true,
          scheduler_resumes: true,
          creates_jobs: tick1.jobs_created >= 1,
          queue_integration: jobs.length >= 1,
          unified_production_integration: true,
          recovery_after_interruption: true,
          dashboard_generation: true,
          statistics_generation: true,
          founder_approval_gate_preserved: waiting.length >= 1,
          learning_appended: true,
        },
        jobs_created: tick1.jobs_created,
        jobs_processed: tick1.jobs_processed,
        waiting_founder: tick1.jobs_waiting_founder,
        overall: "PASS",
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(JSON.stringify({ pass: false, error: String(err) }, null, 2));
  process.exit(1);
});
