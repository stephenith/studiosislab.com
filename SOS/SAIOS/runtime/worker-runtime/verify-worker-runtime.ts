#!/usr/bin/env tsx
/**
 * Worker Runtime Contract V1 verify — Agent #182.
 * Fixtures only. Never spawns. Never executes.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import {
  createWorkerRuntime,
  createWorkerRuntimeSystem,
  computeWorkerRuntimeChecksum,
} from "./WorkerRuntime.js";
import {
  canWorkerRuntimeTransition,
  isWorkerExecutionPossible,
  isWorkerSpawnPossible,
} from "./WorkerLifecycle.js";
import {
  rejectForbiddenWorkerRuntimePayload,
  validateWorkerRuntime,
} from "./WorkerRuntimeValidator.js";
import { createWorkerDependencyResolver } from "./WorkerDependencyResolver.js";
import { createWorkerCapabilityMap } from "./WorkerCapabilityMap.js";
import { WORKER_RUNTIME_SCHEMA_VERSION } from "./WorkerRuntimeTypes.js";

const REPO = resolve(import.meta.dirname, "../../../..");

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function cleanFixtures(): void {
  const dir = join(REPO, "SOS/07_LOGS/saios/runtime/worker-runtime/fixtures");
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, ".verify-run"), new Date().toISOString(), "utf8");
}

function main(): void {
  assert(process.env.SOS_AIOS_LIVE !== "1", "LIVE must be OFF");
  cleanFixtures();
  const checks: Record<string, boolean> = {};

  {
    assert(WORKER_RUNTIME_SCHEMA_VERSION === "worker-runtime-1.0.0", "schema");
    const runtime = createWorkerRuntime({
      worker_id: "w1",
      department_id: "resume",
      mission_id: "m1",
      execution_controller_id: "xc-ref",
      capabilities: ["render"],
      cost_session_reference: "cs-ref",
      telemetry_reference: "tel-ref",
      fixture: true,
    });
    assert(runtime.schema_version === "worker-runtime-1.0.0", "contract");
    const expected = computeWorkerRuntimeChecksum({
      ...runtime,
      checksums: { ...runtime.checksums, runtime_checksum: "" },
    });
    assert(runtime.checksums.runtime_checksum === expected, "checksum");
    assert(validateWorkerRuntime(runtime).ok, "valid");
    assert(runtime.safety_flags.worker_spawn_allowed === false, "no spawn");
    checks.contracts = true;
    checks.checksums = true;
  }

  {
    assert(canWorkerRuntimeTransition("REGISTERED", "ASSIGNED"), "reg→asg");
    assert(canWorkerRuntimeTransition("ASSIGNED", "READY"), "asg→ready");
    assert(
      canWorkerRuntimeTransition("READY", "WAITING_CONTROLLER"),
      "ready→wait",
    );
    assert(
      canWorkerRuntimeTransition("WAITING_CONTROLLER", "CONTROLLER_AUTHORIZED"),
      "wait→auth",
    );
    assert(
      canWorkerRuntimeTransition("CONTROLLER_AUTHORIZED", "STOPPED"),
      "auth→stop",
    );
    assert(!canWorkerRuntimeTransition("REGISTERED", "CONTROLLER_AUTHORIZED"), "no skip");
    assert(isWorkerSpawnPossible("CONTROLLER_AUTHORIZED") === false, "spawn impossible");
    assert(isWorkerExecutionPossible("CONTROLLER_AUTHORIZED") === false, "exec impossible");
    checks.lifecycle = true;
  }

  {
    const deps = createWorkerDependencyResolver().resolve([
      { kind: "parent", worker_id: "a", note: "" },
      { kind: "child", worker_id: "b", note: "" },
      { kind: "blocking", worker_id: "c", note: "" },
      { kind: "parallel", worker_id: "d", note: "" },
      { kind: "optional", worker_id: "e", note: "" },
    ]);
    assert(deps.parent_workers.length === 1, "parent");
    assert(deps.scheduled === false, "not scheduled");
    assert(createWorkerDependencyResolver().canSchedule() === false, "no schedule");
    checks.dependency_model = true;
  }

  {
    const map = createWorkerCapabilityMap();
    assert(map.list().length >= 7, "caps");
    assert(map.mayInvoke("render") === false, "no invoke");
    checks.capabilities = true;
  }

  {
    const sys = createWorkerRuntimeSystem(REPO, { fixture: true });
    const boot = sys.bootstrapCatalog();
    assert(boot.ok, `boot: ${boot.errors.join(";")}`);
    assert(sys.repository.listRuntimes().length >= 2, "runtimes");
    assert(sys.repository.listAssignments().length >= 1, "assignments");
    assert(sys.repository.listSessions().length >= 1, "sessions");
    const session = sys.repository.listSessions()[0]!;
    assert(session.activated === false, "not activated");
    assert(session.execution_controller_id != null, "xc ref");

    const id = sys.repository.listRuntimes()[0]!.worker_runtime_id;
    assert(sys.repository.advanceRuntime(id, "ASSIGNED").ok, "assign");
    assert(sys.repository.advanceRuntime(id, "READY").ok, "ready");
    assert(sys.repository.advanceRuntime(id, "WAITING_CONTROLLER").ok, "wait");
    assert(
      sys.repository.advanceRuntime(id, "CONTROLLER_AUTHORIZED").ok,
      "auth",
    );
    assert(sys.repository.advanceRuntime(id, "STOPPED").ok, "stop");
    checks.repository = true;
  }

  {
    const forbidden = rejectForbiddenWorkerRuntimePayload({ spawn: true });
    assert(forbidden?.code === "FORBIDDEN_SIDE_EFFECT", "forbidden");
    checks.forbidden = true;
  }

  {
    const sys = createWorkerRuntimeSystem(REPO, { fixture: true });
    sys.bootstrapCatalog();
    assert(
      existsSync(
        join(
          REPO,
          "SOS/07_LOGS/saios/runtime/worker-runtime/fixtures/worker-runtimes.json",
        ),
      ),
      "persisted",
    );
    assert(
      existsSync(
        join(
          REPO,
          "SOS/07_LOGS/saios/runtime/worker-runtime/fixtures/WORKER_RUNTIME_LOG.md",
        ),
      ),
      "log",
    );
    checks.persistence = true;
  }

  {
    const plugin = readFileSync(
      join(REPO, "SOS/SAIOS/platform/dashboard/plugins/workerRuntime.ts"),
      "utf8",
    );
    assert(plugin.includes("/api/runtime/worker-runtime"), "api list");
    assert(plugin.includes("/api/runtime/worker-runtime/assignments"), "api asg");
    assert(!plugin.includes('method: "POST"'), "no post");
    const view = readFileSync(
      join(REPO, "SOS/SAIOS/dashboard/src/views/WorkerRuntimeView.tsx"),
      "utf8",
    );
    assert(view.includes("WORKER SPAWN DISABLED"), "banner spawn");
    assert(view.includes("EXECUTION DISABLED"), "banner exec");
    assert(view.includes("LIVE OFF"), "banner live");
    checks.dashboard = true;
    checks.api = true;
  }

  {
    const src = readFileSync(
      join(REPO, "SOS/SAIOS/runtime/worker-runtime/WorkerRuntime.ts"),
      "utf8",
    );
    assert(!src.includes("child_process"), "no child_process");
    assert(!src.includes("QueueManager"), "no queue");
    assert(!/\.spawn\(/.test(src), "no spawn call");
    assert(!src.includes("execution-controller/"), "no xc write");
    checks.execution_impossible = true;
    checks.worker_spawn_impossible = true;
  }

  checks.live_off = process.env.SOS_AIOS_LIVE !== "1";

  const pass = Object.values(checks).every(Boolean);
  console.log(
    JSON.stringify(
      {
        pass,
        component: "worker-runtime-contract-v1",
        checks,
        overall: pass ? "PASS" : "FAIL",
      },
      null,
      2,
    ),
  );
  if (!pass) process.exit(1);
}

main();
