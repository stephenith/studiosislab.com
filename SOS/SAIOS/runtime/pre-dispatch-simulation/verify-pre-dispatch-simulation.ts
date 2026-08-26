#!/usr/bin/env tsx
/**
 * Pre-Dispatch Simulation V1 verify — Agent #187.
 * Simulation only. Never executes. LIVE OFF.
 */
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import {
  createPreDispatchSimulation,
  createPreDispatchSimulationRecord,
} from "./PreDispatchSimulation.js";
import {
  computeSimulationChecksum,
  rejectForbiddenSimulationPayload,
  scoreSimulation,
  validateSimulation,
  validateSimulationCertificate,
} from "./SimulationValidator.js";
import { assertGraphIntegrity } from "./SimulationGraph.js";
import { assertTimelineIntegrity } from "./SimulationTimeline.js";
import { assertWorkerIntegrity } from "./SimulationWorkers.js";
import { assertDepartmentIntegrity } from "./SimulationDepartments.js";
import { assertCostIntegrity } from "./SimulationCost.js";
import { assertTelemetryIntegrity } from "./SimulationTelemetry.js";
import { assertLearningIntegrity } from "./SimulationLearning.js";
import {
  PRE_DISPATCH_SIMULATION_SAFETY_FLAGS,
  PRE_DISPATCH_SIMULATION_SCHEMA_VERSION,
} from "./SimulationTypes.js";

const REPO = resolve(import.meta.dirname, "../../../..");

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function cleanFixtures(): void {
  const dir = join(
    REPO,
    "SOS/07_LOGS/saios/runtime/pre-dispatch-simulation/fixtures",
  );
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, ".verify-run"), new Date().toISOString(), "utf8");
}

function main(): void {
  assert(process.env.SOS_AIOS_LIVE !== "1", "LIVE must be OFF");
  cleanFixtures();
  const checks: Record<string, boolean> = {};

  {
    assert(
      PRE_DISPATCH_SIMULATION_SCHEMA_VERSION ===
        "pre-dispatch-simulation-1.0.0",
      "schema",
    );
    assert(PRE_DISPATCH_SIMULATION_SAFETY_FLAGS.simulation_only === true);
    assert(PRE_DISPATCH_SIMULATION_SAFETY_FLAGS.execution_allowed === false);
    assert(PRE_DISPATCH_SIMULATION_SAFETY_FLAGS.live_enabled === false);
    assert(PRE_DISPATCH_SIMULATION_SAFETY_FLAGS.dispatch_allowed === false);
    assert(PRE_DISPATCH_SIMULATION_SAFETY_FLAGS.queue_insert_allowed === false);
    assert(PRE_DISPATCH_SIMULATION_SAFETY_FLAGS.worker_spawn_allowed === false);
    assert(PRE_DISPATCH_SIMULATION_SAFETY_FLAGS.provider_allowed === false);
    assert(PRE_DISPATCH_SIMULATION_SAFETY_FLAGS.billing_allowed === false);
    assert(
      PRE_DISPATCH_SIMULATION_SAFETY_FLAGS.telemetry_collection_enabled ===
        false,
    );
    assert(
      PRE_DISPATCH_SIMULATION_SAFETY_FLAGS.learning_write_enabled === false,
    );
    checks.schema = true;
  }

  {
    const sim = createPreDispatchSimulationRecord({
      mission_id: "m-verify",
      fixture: true,
    });
    assert(sim.execution_enabled === false);
    assert(sim.graph_nodes.every((n) => n.executed === false));
    assert(assertGraphIntegrity(sim.graph_nodes));
    assert(assertTimelineIntegrity(sim.timeline));
    assert(assertWorkerIntegrity(sim.worker_allocations));
    assert(assertDepartmentIntegrity(sim.department_allocations));
    assert(assertCostIntegrity(sim.estimated_cost));
    assert(assertTelemetryIntegrity(sim.telemetry_refs));
    assert(assertLearningIntegrity(sim.learning_ref));
    const expected = computeSimulationChecksum({
      ...sim,
      simulation_checksum: "",
      checksums: { ...sim.checksums, simulation_checksum: "" },
    });
    assert(sim.simulation_checksum === expected, "checksum");
    assert(validateSimulation(sim).ok, "valid");
    const scores = scoreSimulation(sim);
    assert(scores.overall_readiness === 100, "readiness");
    checks.checksums = true;
    checks.timeline = true;
    checks.graph = true;
    checks.worker_allocation = true;
    checks.department_allocation = true;
    checks.cost_estimates = true;
    checks.telemetry_references = true;
    checks.learning_references = true;
  }

  {
    assert(rejectForbiddenSimulationPayload({ execute: true }) !== null);
    checks.forbidden = true;
  }

  {
    const engine = createPreDispatchSimulation(REPO, { fixture: true });
    const result = engine.simulate({
      mission_id: "mission-sim-verify",
      fixture: true,
    });
    assert(result.ok, "simulate ok");
    assert(result.simulation?.status === "SIMULATION_COMPLETE");
    assert(result.certificate?.execution_permissions === false);
    assert(validateSimulationCertificate(result.certificate!).ok);
    assert(existsSync(join(engine.repository.dir, "latest.json")));
    assert(existsSync(join(engine.repository.dir, "health.json")));
    assert(existsSync(join(engine.repository.dir, "history")));
    assert(existsSync(join(engine.repository.dir, "events")));
    engine.reporter.writeMarkdown(engine.repository);
    assert(
      existsSync(join(engine.repository.dir, "PRE_DISPATCH_SIMULATION_LOG.md")),
    );
    checks.persistence = true;
    checks.execution_impossible = true;
  }

  {
    const plugin = readFileSync(
      join(
        REPO,
        "SOS/SAIOS/platform/dashboard/plugins/preDispatchSimulation.ts",
      ),
      "utf8",
    );
    assert(plugin.includes("/api/runtime/pre-dispatch-simulation"), "api");
    assert(!plugin.includes('method: "POST"'), "no post");
    const view = readFileSync(
      join(
        REPO,
        "SOS/SAIOS/dashboard/src/views/PreDispatchSimulationView.tsx",
      ),
      "utf8",
    );
    assert(view.includes("SIMULATION ONLY"), "banner");
    assert(view.includes("EXECUTION DISABLED"), "banner2");
    assert(view.includes("LIVE OFF"), "banner3");
    checks.dashboard_plugin = true;
    checks.api = true;
  }

  {
    const env = { ...process.env, SOS_AIOS_LIVE: "0" };
    for (const script of [
      "activation-gate:verify",
      "execution-authorization:verify",
    ]) {
      const r = spawnSync("npm", ["run", script], {
        cwd: REPO,
        env,
        encoding: "utf8",
        shell: process.platform === "win32",
      });
      assert(r.status === 0, `${script} failed`);
    }
    checks.prerequisites = true;
  }

  checks.live_off = true;

  console.log(
    JSON.stringify(
      {
        pass: true,
        component: "pre-dispatch-simulation-v1",
        checks: {
          schema: true,
          checksums: true,
          timeline: true,
          graph: true,
          worker_allocation: true,
          department_allocation: true,
          cost_estimates: true,
          telemetry_references: true,
          learning_references: true,
          dashboard_plugin: true,
          api: true,
          persistence: true,
          execution_impossible: true,
          live_off: true,
          ...checks,
        },
        overall: "PASS",
      },
      null,
      2,
    ),
  );
}

main();
