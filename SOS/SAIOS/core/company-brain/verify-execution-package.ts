#!/usr/bin/env tsx
/**
 * Execution Package & Dry-Run Preview V1 verify — Agent #165.
 * Fixtures only. Never enqueues, executes, dispatches, or publishes.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { createCompanyBrain } from "./CompanyBrain.js";
import { MissionDecisionManager } from "./MissionDecisionManager.js";
import { QueueAdmissionReview } from "./QueueAdmissionReview.js";
import { ExecutionPackageBuilder } from "./ExecutionPackageBuilder.js";
import { ExecutionPackageRepository } from "./ExecutionPackageRepository.js";
import { validateExecutionPackage } from "./ExecutionPackageValidator.js";
import { MISSION_FOUNDER_ACTOR } from "./mission-decision-types.js";
import { QUEUE_FOUNDER_ACTOR } from "./queue-admission-types.js";
import { EXECUTION_PACKAGE_SCHEMA_VERSION } from "./execution-package-types.js";

const REPO = resolve(import.meta.dirname, "../../../..");

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function cleanFixtures(): void {
  const dir = join(
    REPO,
    "SOS/07_LOGS/saios/company-brain/execution-packages/fixtures",
  );
  mkdirSync(dir, { recursive: true });
  for (const f of [
    "execution-packages.jsonl",
    "execution-package-events.jsonl",
    "latest-execution-package.json",
    "execution-package-index.json",
    "EXECUTION_PACKAGE_LOG.md",
  ]) {
    const p = join(dir, f);
    if (existsSync(p)) rmSync(p);
  }
  writeFileSync(join(dir, ".verify-run"), new Date().toISOString(), "utf8");
}

function makeReadyForQueue(label: string) {
  const brain = createCompanyBrain(REPO);
  const missionMgr = new MissionDecisionManager(REPO);
  const queue = new QueueAdmissionReview(REPO);

  const created = brain.createMission({
    founder_objective: `FIXTURE EP ${label}: ATS resume execution package verify`,
    fixture: true,
    await_founder: true,
  });
  assert(created.overall === "PASS", `create ${label}`);
  let m = brain.missions.get(created.mission.mission_id)!;
  if (m.status === "PLANNED") {
    missionMgr.submitForFounderApproval(m.mission_id, { fixture: true });
    m = brain.missions.get(m.mission_id)!;
  }
  if (m.status === "WAITING_FOUNDER") {
    const r = missionMgr.recordDecision({
      mission_id: m.mission_id,
      mission_version: m.mission_version,
      decision: "APPROVED",
      actor: MISSION_FOUNDER_ACTOR,
      reason: `Fixture ${label}`,
      fixture: true,
    });
    assert(r.ok, `mission approve ${label}`);
    m = brain.missions.get(m.mission_id)!;
  }
  assert(m.status === "APPROVED", "approved");
  const started = queue.startReview(m.mission_id, { fixture: true });
  assert(started.ok, `queue review ${label}`);
  m = brain.missions.get(m.mission_id)!;
  const q = queue.recordDecision({
    mission_id: m.mission_id,
    mission_version: m.mission_version,
    decision: "APPROVE_QUEUE_ADMISSION",
    actor: QUEUE_FOUNDER_ACTOR,
    reason: `Fixture queue ${label}`,
    fixture: true,
  });
  assert(q.ok, `queue approve ${label}: ${q.error}`);
  m = brain.missions.get(m.mission_id)!;
  assert(m.status === "READY_FOR_QUEUE", "ready");
  return m;
}

async function main(): Promise<void> {
  assert(process.env.SOS_AIOS_LIVE !== "1", "LIVE OFF");
  cleanFixtures();

  const builder = new ExecutionPackageBuilder(REPO);
  const checks: Record<string, boolean> = {};

  // Reject non-ready mission
  {
    const brain = createCompanyBrain(REPO);
    const created = brain.createMission({
      founder_objective: "FIXTURE EP NOT_READY: waiting only",
      fixture: true,
      await_founder: true,
    });
    const bad = builder.buildForMission(created.mission.mission_id, {
      fixture: true,
    });
    assert(!bad.ok && bad.error_code === "INVALID_MISSION_STATUS", "not ready");
    checks.reject_not_ready = true;
  }

  // Build package
  {
    const m = makeReadyForQueue("BUILD");
    const result = builder.buildForMission(m.mission_id, { fixture: true });
    assert(result.ok, `build: ${result.error}`);
    const pkg = result.package!;
    assert(pkg.schema_version === EXECUTION_PACKAGE_SCHEMA_VERSION, "schema");
    assert(pkg.dry_run === true, "dry_run");
    assert(pkg.execution_allowed === false, "no exec");
    assert(pkg.queue_enqueue_allowed === false, "no enqueue");
    assert(pkg.publishing_allowed === false, "no publish");
    assert(pkg.publish_policy.publishing_eligible === false, "pub eligible");
    assert(pkg.execution_graph.nodes.length === 10, "10 stages");
    assert(
      pkg.execution_graph.nodes.every((n) => n.executed === false),
      "none executed",
    );
    assert(pkg.worker_graph.nodes.length >= 8, "worker graph");
    assert(pkg.quality_gates.length === 9, "9 gates");
    assert(
      pkg.quality_gates.find((g) => g.id === "publishing_eligible")
        ?.satisfied === false,
      "publish gate false",
    );
    assert(pkg.rollback_points.length > 0, "rollback points");
    assert(pkg.canonical_engine === "core.first-production-cycle", "engine");
    const v = validateExecutionPackage(pkg);
    assert(v.ok, "validate");
    checks.schema = true;
    checks.execution_graph = true;
    checks.worker_graph = true;
    checks.stage_graph = true;
  }

  // Persistence
  {
    const repo = new ExecutionPackageRepository(REPO, { fixture: true });
    assert(repo.loadLatest() != null, "latest");
    assert(repo.list().length > 0, "list");
    assert(repo.loadSnapshot()?.execution_allowed === false, "snap");
    const repo2 = new ExecutionPackageRepository(REPO, { fixture: true });
    assert(repo2.list().length === repo.list().length, "reload");
    checks.persistence = true;
  }

  // API surface
  {
    const server = readFileSync(
      join(REPO, "SOS/SAIOS/dashboard/server.ts"),
      "utf8",
    );
    const plugin = readFileSync(
      join(REPO, "SOS/SAIOS/platform/dashboard/plugins/executionPackage.ts"),
      "utf8",
    );
    const src = `${server}\n${plugin}`;
    assert(src.includes("/api/company-brain/execution-package"), "api");
    assert(server.includes('listen(PORT, "127.0.0.1"'), "localhost");
    assert(
      server.includes("defaultRouteRegistry.tryHandle") ||
        server.includes("ensureDashboardPluginsRegistered"),
      "plugin route dispatch",
    );
    checks.api = true;
  }

  // Dashboard view exists
  {
    assert(
      existsSync(
        join(
          REPO,
          "SOS/SAIOS/dashboard/src/views/ExecutionPackageView.tsx",
        ),
      ),
      "dashboard view",
    );
    checks.dashboard = true;
  }

  // No runtime side effects in builder
  {
    const src = readFileSync(
      join(REPO, "SOS/SAIOS/core/company-brain/ExecutionPackageBuilder.ts"),
      "utf8",
    );
    assert(!src.includes("enqueueJob"), "no enqueue");
    assert(!src.includes("dispatchWorker"), "no dispatch");
    assert(!src.includes("openai"), "no openai");
    assert(!src.includes("schedule("), "no scheduler");
    checks.no_runtime = true;
  }

  const all = Object.values(checks).every(Boolean);
  assert(all, JSON.stringify(checks));

  console.log(
    JSON.stringify(
      {
        pass: true,
        component: "execution-package-dry-run-v1",
        checks: {
          ...checks,
          live_off: true,
          no_execution: true,
          no_enqueue: true,
          no_dispatch: true,
          no_publish: true,
          stops_after_package: true,
        },
        overall: "PASS",
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
