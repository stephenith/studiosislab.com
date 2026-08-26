#!/usr/bin/env node
/**
 * SAIOS Job Queue verification
 * Run: npm run queue:verify (from SOS/SAIOS/runtime)
 */
import { mkdir, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { QueueManager } from "./QueueManager.js";
import { resolveQueuePaths } from "./paths.js";
import type { QueueJobStatus } from "./job-status.js";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

const ALL_STATUSES: QueueJobStatus[] = [
  "QUEUED",
  "PLANNING",
  "RUNNING",
  "WAITING_QA",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
];

async function main(): Promise<void> {
  const base = resolveQueuePaths().jobsDir;
  const verifyDir = join(base, "verify-runs", String(Date.now()));
  await mkdir(verifyDir, { recursive: true });
  const eventsFile = join(verifyDir, "events.jsonl");

  const q1 = new QueueManager({ jobsDir: verifyDir, eventsFile });
  const createdIds: string[] = [];
  const visitedStatuses = new Set<QueueJobStatus>();

  const track = (status: QueueJobStatus) => visitedStatuses.add(status);

  // Job 1 — full happy path
  const j1 = await q1.createJob({
    id: "JOB-VFY-001-happy",
    title: "Verify happy path",
    description: "QUEUED → PLANNING → RUNNING → WAITING_QA → COMPLETED",
    priority: "P1",
    creator: "verify",
    metadata: { verify: true },
  });
  createdIds.push(j1.id);
  track(j1.status);

  let j1reload = await q1.loadJob(j1.id);
  assert(j1reload?.status === "QUEUED", "job1 initial QUEUED");

  j1reload = await q1.updateStatus(j1.id, { status: "PLANNING", note: "planning" });
  track(j1reload.status);
  j1reload = await q1.updateStatus(j1.id, { status: "RUNNING", note: "running" });
  track(j1reload.status);
  assert(j1reload.started_at !== null, "job1 started_at set on RUNNING");
  j1reload = await q1.assignWorker(j1.id, "WRK-cursor-dev-verify");
  assert(j1reload.assigned_worker === "WRK-cursor-dev-verify", "job1 worker assigned");
  j1reload = await q1.updateStatus(j1.id, { status: "WAITING_QA" });
  track(j1reload.status);
  j1reload = await q1.completeJob(j1.id, "SOS/07_LOGS/saios/reports/JOB-VFY-001.json");
  track(j1reload.status);
  assert(j1reload.status === "COMPLETED", "job1 COMPLETED");
  assert(j1reload.completed_at !== null, "job1 completed_at set");

  // Job 2 — cancelled from QUEUED
  const j2 = await q1.createJob({
    id: "JOB-VFY-002-cancel",
    title: "Verify cancel",
    description: "QUEUED → CANCELLED",
    creator: "verify",
    metadata: { verify: true },
  });
  createdIds.push(j2.id);
  track(j2.status);
  const j2c = await q1.cancelJob(j2.id, "founder cancelled");
  track(j2c.status);
  assert(j2c.status === "CANCELLED", "job2 CANCELLED");

  // Job 3 — failed from RUNNING
  const j3 = await q1.createJob({
    id: "JOB-VFY-003-fail",
    title: "Verify fail",
    description: "QUEUED → PLANNING → RUNNING → FAILED",
    creator: "verify",
    metadata: { verify: true },
  });
  createdIds.push(j3.id);
  track(j3.status);
  await q1.updateStatus(j3.id, { status: "PLANNING" });
  track("PLANNING");
  await q1.updateStatus(j3.id, { status: "RUNNING" });
  track("RUNNING");
  const j3f = await q1.failJob(j3.id, "build failed");
  track(j3f.status);
  assert(j3f.status === "FAILED", "job3 FAILED");

  // Jobs 4–5 — parent / child + disk reload via second manager
  const parent = await q1.createJob({
    id: "JOB-VFY-004-parent",
    title: "Verify parent",
    description: "parent job",
    creator: "verify",
    metadata: { verify: true },
  });
  createdIds.push(parent.id);
  const child = await q1.createJob({
    id: "JOB-VFY-005-child",
    title: "Verify child",
    description: "child job",
    parent_job: parent.id,
    dependencies: [parent.id],
    creator: "verify",
    metadata: { verify: true },
  });
  createdIds.push(child.id);

  const parentReload = await q1.loadJob(parent.id);
  assert(parentReload?.child_jobs.includes(child.id), "parent lists child");
  const childReload = await q1.loadJob(child.id);
  assert(childReload?.parent_job === parent.id, "child references parent");
  assert(childReload?.dependencies.includes(parent.id), "child dependency");

  const q2 = new QueueManager({ jobsDir: verifyDir, eventsFile });
  const j1disk = await q2.loadJob(j1.id);
  assert(j1disk?.status === "COMPLETED", "job1 reloaded completed from disk");
  assert(j1disk?.assigned_worker === "WRK-cursor-dev-verify", "job1 worker persisted");
  assert(j1disk?.report_path?.includes("JOB-VFY-001"), "job1 report_path persisted");

  const listed = await q2.listJobs();
  assert(listed.length === 5, `expected 5 jobs on disk, got ${listed.length}`);

  const queued = await q2.listQueuedJobs();
  assert(queued.length >= 2, "listQueuedJobs includes open jobs");

  const running = await q2.listRunningJobs();
  assert(Array.isArray(running), "listRunningJobs returns array");

  for (const status of ALL_STATUSES) {
    assert(visitedStatuses.has(status), `lifecycle status not exercised: ${status}`);
  }

  assert(existsSync(eventsFile), "events.jsonl exists");
  const eventsRaw = await readFile(eventsFile, "utf8");
  const eventLines = eventsRaw.trim().split("\n").filter(Boolean);
  assert(eventLines.length >= 8, `expected event log entries, got ${eventLines.length}`);

  // invalid transition guard
  let threw = false;
  try {
    await q2.updateStatus(j1.id, { status: "RUNNING" });
  } catch {
    threw = true;
  }
  assert(threw, "terminal job transition rejected");

  const report = {
    verified_at: new Date().toISOString(),
    verify_dir: verifyDir,
    jobs_created: createdIds.length,
    job_ids: createdIds,
    statuses_exercised: [...visitedStatuses].sort(),
    event_count: eventLines.length,
    tests: {
      happy_path: true,
      cancel: true,
      fail: true,
      parent_child: true,
      disk_reload: true,
      event_log: true,
      invalid_transition: true,
      all_lifecycle_states: true,
    },
    pass: true,
  };

  console.log(JSON.stringify(report, null, 2));

  await rm(verifyDir, { recursive: true, force: true });
  process.exit(0);
}

main().catch((e) => {
  const msg = e instanceof Error ? e.message : String(e);
  console.log(JSON.stringify({ pass: false, error: msg }, null, 2));
  process.exit(1);
});
