#!/usr/bin/env node
/**
 * SAIOS Agent Registry verification
 * Run: npm run registry:verify (from SOS/SAIOS/runtime)
 */
import { mkdir, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { RegistryManager } from "./RegistryManager.js";
import { resolveRegistryPaths } from "./paths.js";
import type { RegistryWorkerStatus } from "./worker-status.js";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

const ALL_STATUSES: RegistryWorkerStatus[] = [
  "REGISTERED",
  "IDLE",
  "BUSY",
  "PAUSED",
  "OFFLINE",
  "ERROR",
  "RETIRED",
];

async function main(): Promise<void> {
  const base = resolveRegistryPaths().registryDir;
  const verifyDir = join(base, "verify-runs", String(Date.now()));
  await mkdir(verifyDir, { recursive: true });
  const eventsFile = join(verifyDir, "events.jsonl");

  const reg = new RegistryManager({ registryDir: verifyDir, eventsFile });
  const workerIds: string[] = [];
  const visitedStatuses = new Set<RegistryWorkerStatus>();

  const track = (status: RegistryWorkerStatus) => visitedStatuses.add(status);

  // 1 — parent cursor-dev pool
  const parent = await reg.registerWorker({
    id: "WRK-VFY-parent-pool",
    name: "Cursor Dev Pool Parent",
    type: "cursor-dev-pool",
    version: "1.0.0",
    capabilities: ["implement", "orchestrate"],
    host: "vps-1",
    runtime: "saios-v1",
    metadata: { verify: true },
  });
  workerIds.push(parent.id);
  track(parent.status);

  // 2–4 — children
  for (let i = 1; i <= 3; i++) {
    const child = await reg.registerWorker({
      id: `WRK-VFY-child-dev-${i}`,
      name: `Cursor Dev Child ${i}`,
      type: "cursor-dev",
      version: "1.0.0",
      capabilities: ["implement"],
      parent_worker: parent.id,
      host: `vps-1-slot-${i}`,
      metadata: { verify: true, slot: i },
    });
    workerIds.push(child.id);
    track(child.status);
    const afterHb = await reg.heartbeat(child.id, { slot: i });
    track(afterHb.status);
  }

  // 5–6 — standalone cursor-dev
  for (let i = 1; i <= 2; i++) {
    const w = await reg.registerWorker({
      id: `WRK-VFY-dev-${i}`,
      name: `Standalone Dev ${i}`,
      type: "cursor-dev",
      version: "1.0.0",
      capabilities: ["implement"],
      host: "vps-2",
      metadata: { verify: true },
    });
    workerIds.push(w.id);
    await reg.heartbeat(w.id);
    track((await reg.getWorker(w.id))!.status);
  }

  // 8 — cursor-qa
  const qa = await reg.registerWorker({
    id: "WRK-VFY-qa-1",
    name: "Cursor QA",
    type: "cursor-qa",
    version: "1.0.0",
    capabilities: ["verify"],
    host: "vps-2",
  });
  workerIds.push(qa.id);
  await reg.heartbeat(qa.id);
  track((await reg.getWorker(qa.id))!.status);

  // 9 — script-qa
  const scriptQa = await reg.registerWorker({
    id: "WRK-VFY-script-qa",
    name: "Script QA",
    type: "script-qa",
    version: "1.0.0",
    capabilities: ["verify", "build"],
    host: "vps-2",
  });
  workerIds.push(scriptQa.id);
  await reg.heartbeat(scriptQa.id);

  // 10 — offline then recover
  const offline = await reg.registerWorker({
    id: "WRK-VFY-offline",
    name: "Offline Worker",
    type: "cursor-dev",
    version: "1.0.0",
    capabilities: ["implement"],
    host: "vps-3",
    status: "OFFLINE",
  });
  workerIds.push(offline.id);
  track(offline.status);
  const recovered = await reg.resumeWorker(offline.id, "back online");
  track(recovered.status);

  // 10 — error then recover via heartbeat
  const errWorker = await reg.registerWorker({
    id: "WRK-VFY-error",
    name: "Error Worker",
    type: "cursor-dev",
    version: "1.0.0",
    capabilities: ["implement"],
    host: "vps-3",
    status: "ERROR",
  });
  workerIds.push(errWorker.id);
  track(errWorker.status);
  const errFixed = await reg.heartbeat(errWorker.id);
  track(errFixed.status);

  assert(workerIds.length === 10, `expected 10 workers, got ${workerIds.length}`);

  const parentReload = await reg.getWorker(parent.id);
  assert(parentReload?.child_workers.length === 3, "parent has 3 children");

  // Assign jobs to 3 workers
  const assignTargets = ["WRK-VFY-child-dev-1", "WRK-VFY-child-dev-2", "WRK-VFY-qa-1"];
  const jobIds = ["JOB-VFY-REG-001", "JOB-VFY-REG-002", "JOB-VFY-REG-003"];
  for (let i = 0; i < assignTargets.length; i++) {
    const assigned = await reg.assignJob(assignTargets[i], jobIds[i]);
    assert(assigned.status === "BUSY", `${assignTargets[i]} BUSY`);
    assert(assigned.current_job === jobIds[i], `${assignTargets[i]} job set`);
    track("BUSY");
  }

  assert((await reg.listBusyWorkers()).length >= 3, "listBusyWorkers");

  // Heartbeat all 10
  for (const id of workerIds) {
    const w = await reg.getWorker(id);
    if (w && w.status !== "RETIRED" && w.status !== "BUSY") {
      await reg.heartbeat(id);
    }
  }

  // Pause 2, resume 2
  const paused1 = await reg.pauseWorker("WRK-VFY-dev-1", "maintenance");
  track(paused1.status);
  const paused2 = await reg.pauseWorker("WRK-VFY-dev-2", "maintenance");
  track(paused2.status);

  const resumed1 = await reg.resumeWorker("WRK-VFY-dev-1");
  track(resumed1.status);
  const resumed2 = await reg.resumeWorker("WRK-VFY-dev-2");
  track(resumed2.status);

  // Release assigned jobs before retire
  const released = await reg.releaseJob("WRK-VFY-child-dev-1");
  assert(released.status === "IDLE" && released.current_job === null, "release clears job");
  track("IDLE");
  await reg.releaseJob("WRK-VFY-child-dev-2");
  await reg.releaseJob("WRK-VFY-qa-1");
  const retired1 = await reg.retireWorker("WRK-VFY-script-qa", "decommissioned");
  track(retired1.status);
  const retired2 = await reg.retireWorker("WRK-VFY-error", "decommissioned");
  track(retired2.status);

  // Reload from disk with fresh manager
  const reg2 = new RegistryManager({ registryDir: verifyDir, eventsFile });
  for (const id of workerIds) {
    const w = await reg2.getWorker(id);
    assert(w !== null, `reload missing ${id}`);
    if (id === parent.id) {
      assert(w!.child_workers.length === 3, "parent child_workers persisted");
    }
    if (id === "WRK-VFY-child-dev-1") {
      assert(w!.parent_worker === parent.id, "child parent_worker persisted");
    }
  }

  const implementers = await reg2.listByCapability("implement");
  assert(implementers.length >= 5, "listByCapability implement");

  const idle = await reg2.listIdleWorkers();
  assert(idle.length >= 1, "listIdleWorkers after operations");

  for (const status of ALL_STATUSES) {
    assert(visitedStatuses.has(status), `status not exercised: ${status}`);
  }

  assert(existsSync(eventsFile), "events.jsonl exists");
  const eventsRaw = await readFile(eventsFile, "utf8");
  const eventLines = eventsRaw.trim().split("\n").filter(Boolean);
  assert(eventLines.length >= 15, `expected events, got ${eventLines.length}`);

  let threw = false;
  try {
    await reg2.assignJob("WRK-VFY-script-qa", "JOB-NOPE");
  } catch {
    threw = true;
  }
  assert(threw, "assign to retired worker rejected");

  const report = {
    verified_at: new Date().toISOString(),
    verify_dir: verifyDir,
    workers_registered: workerIds.length,
    worker_ids: workerIds,
    statuses_exercised: [...visitedStatuses].sort(),
    event_count: eventLines.length,
    tests: {
      register_10: true,
      parent_child: true,
      assign_jobs: true,
      heartbeat: true,
      pause_resume: true,
      retire: true,
      disk_reload: true,
      list_by_capability: true,
      event_log: true,
      retired_guard: true,
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
