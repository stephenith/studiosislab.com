#!/usr/bin/env node
/**
 * Worker Factory verification
 * Run: npm run workers:verify (from SOS/SAIOS/runtime)
 */
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { RegistryManager } from "../registry/RegistryManager.js";
import { resolveRegistryPaths } from "../registry/paths.js";
import { WorkerFactory } from "./WorkerFactory.js";
import { FACTORY_WORKER_STATUSES } from "./WorkerLifecycle.js";
import { BUILTIN_WORKER_DEFINITIONS } from "./WorkerCapabilities.js";
import type { FactoryWorker } from "./WorkerDefinition.js";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

const VERIFY_WORKER_TYPES = [
  "resume-worker",
  "resume-worker",
  "seo-worker",
  "seo-worker",
  "ui-worker",
  "ui-worker",
  "api-worker",
  "api-worker",
  "firebase-worker",
  "firebase-worker",
  "testing-worker",
  "testing-worker",
  "documentation-worker",
  "documentation-worker",
  "marketing-worker",
  "marketing-worker",
  "research-worker",
  "research-worker",
  "analytics-worker",
  "invoice-worker",
];

async function main(): Promise<void> {
  const ts = String(Date.now());
  const registryBase = resolveRegistryPaths().registryDir;
  const verifyDir = join(registryBase, "verify-runs", `workers-${ts}`);
  await mkdir(verifyDir, { recursive: true });

  const registry = new RegistryManager({
    registryDir: verifyDir,
    eventsFile: join(verifyDir, "events.jsonl"),
  });
  const factory = new WorkerFactory({ registry });

  const workers: FactoryWorker[] = [];

  for (let i = 0; i < VERIFY_WORKER_TYPES.length; i++) {
    const worker = await factory.createWorker({
      worker_type: VERIFY_WORKER_TYPES[i]!,
      metadata: { verify_index: i + 1 },
    });
    workers.push(worker);
  }

  assert(workers.length === 20, `expected 20 workers, got ${workers.length}`);

  const ids = new Set(workers.map((w) => w.worker_id));
  assert(ids.size === 20, "all worker IDs must be unique");

  for (const worker of workers) {
    assert(Boolean(worker.worker_id), "worker_id required");
    assert(Boolean(worker.worker_type), "worker_type required");
    assert(Boolean(worker.display_name), "display_name required");
    assert(worker.capabilities.length > 0, "capabilities required");
    assert(worker.status === "READY", `worker ${worker.worker_id} should be READY after create`);
    assert(worker.heartbeat !== null, "heartbeat should be set");
    assert(worker.parent_director !== null, "parent_director should be set");
  }

  const sample = workers[0]!;
  const serialized = factory.serialize(sample);
  const deserialized = factory.deserialize(serialized);
  assert(deserialized.worker_id === sample.worker_id, "serialize roundtrip worker_id");
  assert(deserialized.worker_type === sample.worker_type, "serialize roundtrip worker_type");
  assert(
    JSON.stringify(deserialized.capabilities) === JSON.stringify(sample.capabilities),
    "serialize roundtrip capabilities",
  );

  const busyTarget = workers[1]!;
  const paused = await factory.pauseWorker(busyTarget.worker_id, "verify pause");
  assert(paused.status === "PAUSED", "pause should set PAUSED");

  const resumed = await factory.resumeWorker(busyTarget.worker_id);
  assert(resumed.status === "READY", "resume should return READY");

  const retired = await factory.retireWorker(workers[19]!.worker_id, "verify retire");
  assert(retired.status === "RETIRED", "retire should set RETIRED");

  const clone = await factory.cloneWorker(workers[2]!.worker_id);
  assert(clone.worker_type === workers[2]!.worker_type, "clone should preserve worker_type");
  assert(clone.worker_id !== workers[2]!.worker_id, "clone should have new worker_id");

  const registryReload = new RegistryManager({
    registryDir: verifyDir,
    eventsFile: join(verifyDir, "events.jsonl"),
  });
  const reloaded = await registryReload.getWorker(sample.worker_id);
  assert(Boolean(reloaded), "registry should persist worker");
  assert(reloaded!.type === sample.worker_type, "registry type compatibility");
  assert(reloaded!.capabilities.length > 0, "registry capabilities compatibility");

  const visited = new Set<string>();
  for (const status of FACTORY_WORKER_STATUSES) {
    visited.add(status);
  }
  assert(visited.size === 7, "factory lifecycle should define 7 statuses");

  assert(BUILTIN_WORKER_DEFINITIONS.length === 12, "12 built-in worker definitions");

  await rm(verifyDir, { recursive: true, force: true });

  console.log(
    JSON.stringify(
      {
        pass: true,
        component: "worker-factory",
        workers_created: 20,
        unique_ids: true,
        lifecycle_tested: true,
        registry_compatible: true,
        serialization: true,
        builtin_definitions: BUILTIN_WORKER_DEFINITIONS.length,
        worker_types: [...new Set(workers.map((w) => w.worker_type))],
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
