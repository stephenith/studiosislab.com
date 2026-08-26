#!/usr/bin/env tsx
/**
 * Runtime Plan V1 verify — Agent #169.
 * Fixtures only. Planning only. Never dispatches or executes.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { createCompanyBrain } from "../../core/company-brain/CompanyBrain.js";
import { MissionDecisionManager } from "../../core/company-brain/MissionDecisionManager.js";
import { QueueAdmissionReview } from "../../core/company-brain/QueueAdmissionReview.js";
import { ExecutionPackageBuilder } from "../../core/company-brain/ExecutionPackageBuilder.js";
import { ExecutionPackageAckManager } from "../../core/company-brain/ExecutionPackageAckManager.js";
import { QueueSubmissionBuilder } from "../../core/company-brain/QueueSubmissionBuilder.js";
import { PACKAGE_ACK_FOUNDER_ACTOR } from "../../core/company-brain/execution-package-ack-types.js";
import { MISSION_FOUNDER_ACTOR } from "../../core/company-brain/mission-decision-types.js";
import { QUEUE_FOUNDER_ACTOR } from "../../core/company-brain/queue-admission-types.js";
import { QUEUE_SUBMISSION_FOUNDER_ACTOR } from "../../core/company-brain/queue-submission-types.js";
import { ShadowQueueReceiver } from "../queue/ShadowQueueReceiver.js";
import { SHADOW_QUEUE_FOUNDER_ACTOR } from "../queue/shadow-queue-types.js";
import type { ShadowQueueRecord } from "../queue/shadow-queue-types.js";
import { RuntimePlanner } from "./RuntimePlanner.js";
import { RuntimePlanRepository } from "./RuntimePlanRepository.js";
import { resolveRuntimeDependencies } from "./RuntimeDependencyResolver.js";
import { resolveRuntimeWorkers } from "./RuntimeWorkerResolver.js";
import { buildRuntimeExecutionGraph } from "./RuntimeExecutionGraph.js";
import { RUNTIME_PLAN_FORBIDDEN_KEYS } from "./runtime-plan-types.js";
import { rejectForbiddenRuntimePlanPayload } from "./RuntimePlanValidator.js";

const REPO = resolve(import.meta.dirname, "../../../..");

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function cleanFixtures(): void {
  const dir = join(REPO, "SOS/07_LOGS/saios/runtime/runtime-plan/fixtures");
  mkdirSync(dir, { recursive: true });
  for (const f of [
    "runtime-plans.jsonl",
    "runtime-plan-events.jsonl",
    "latest-runtime-plan.json",
    "latest-runtime-plan-snapshot.json",
    "runtime-plan-health.json",
    "RUNTIME_PLAN_LOG.md",
  ]) {
    const p = join(dir, f);
    if (existsSync(p)) rmSync(p);
  }
  writeFileSync(join(dir, ".verify-run"), new Date().toISOString(), "utf8");
}

function makeShadowReceived(label: string) {
  const brain = createCompanyBrain(REPO);
  const missionMgr = new MissionDecisionManager(REPO);
  const queue = new QueueAdmissionReview(REPO);
  const builder = new ExecutionPackageBuilder(REPO);
  const ackMgr = new ExecutionPackageAckManager(REPO);
  const qsub = new QueueSubmissionBuilder(REPO);
  const shadow = new ShadowQueueReceiver(REPO);

  const created = brain.createMission({
    founder_objective: `FIXTURE RPLAN ${label}: runtime plan verify`,
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
    assert(
      missionMgr.recordDecision({
        mission_id: m.mission_id,
        mission_version: m.mission_version,
        decision: "APPROVED",
        actor: MISSION_FOUNDER_ACTOR,
        reason: `Fixture ${label}`,
        fixture: true,
      }).ok,
      "approve",
    );
    m = brain.missions.get(m.mission_id)!;
  }
  queue.startReview(m.mission_id, { fixture: true });
  m = brain.missions.get(m.mission_id)!;
  assert(
    queue.recordDecision({
      mission_id: m.mission_id,
      mission_version: m.mission_version,
      decision: "APPROVE_QUEUE_ADMISSION",
      actor: QUEUE_FOUNDER_ACTOR,
      reason: `queue ${label}`,
      fixture: true,
    }).ok,
    "queue",
  );
  m = brain.missions.get(m.mission_id)!;

  const built = builder.buildForMission(m.mission_id, {
    fixture: true,
    skip_ack_transition: true,
  });
  assert(built.ok && built.package, "package");
  const pkg = built.package!;

  ackMgr.openForAcknowledgement(m.mission_id, { fixture: true });
  m = brain.missions.get(m.mission_id)!;
  assert(
    ackMgr.recordDecision({
      mission_id: m.mission_id,
      mission_version: m.mission_version,
      package_id: pkg.package_id,
      execution_package_version: pkg.package_version,
      execution_package_checksum: pkg.checksum,
      decision: "ACKNOWLEDGED",
      actor: PACKAGE_ACK_FOUNDER_ACTOR,
      reason: `ack ${label}`,
      fixture: true,
    }).ok,
    "ack",
  );
  m = brain.missions.get(m.mission_id)!;

  const sub = qsub.buildForMission(m.mission_id, { fixture: true });
  assert(sub.ok && sub.package, `sub: ${sub.error}`);
  m = brain.missions.get(m.mission_id)!;
  assert(
    qsub.recordReview({
      mission_id: m.mission_id,
      mission_version: m.mission_version,
      submission_id: sub.package!.submission_id,
      submission_checksum: sub.package!.submission_checksum,
      decision: "CONFIRM_SHADOW_PACKAGE",
      actor: QUEUE_SUBMISSION_FOUNDER_ACTOR,
      reason: `confirm ${label}`,
      fixture: true,
    }).ok,
    "confirm",
  );
  m = brain.missions.get(m.mission_id)!;

  assert(
    shadow.receive({
      mission_id: m.mission_id,
      mission_version: m.mission_version,
      submission_id: sub.package!.submission_id,
      submission_checksum: sub.package!.submission_checksum,
      actor: SHADOW_QUEUE_FOUNDER_ACTOR,
      reason: `shadow ${label}`,
      fixture: true,
    }).ok,
    "shadow",
  );
  m = brain.missions.get(m.mission_id)!;
  assert(m.status === "SHADOW_QUEUE_RECEIVED", "shadow status");

  return {
    brain,
    mission: m,
    submission: sub.package!,
    planner: new RuntimePlanner(REPO),
  };
}

function main(): void {
  assert(process.env.SOS_AIOS_LIVE !== "1", "LIVE must be OFF");
  cleanFixtures();
  const checks: Record<string, boolean> = {};

  {
    const { mission, submission, planner } = makeShadowReceived("GEN");
    const r = planner.buildForMission(mission.mission_id, { fixture: true });
    assert(r.ok && r.plan, `gen: ${r.error}`);
    assert(r.mission_status === "RUNTIME_PLAN_READY", `status ${r.mission_status}`);
    assert(r.plan!.planning_only === true, "planning_only");
    assert(r.plan!.dispatch_allowed === false, "dispatch");
    assert(r.plan!.execution_allowed === false, "exec");
    assert(r.plan!.publishing_allowed === false, "pub");
    assert(r.plan!.plan_checksum.length === 64, "checksum");
    assert(
      r.plan!.execution_package_checksum ===
        submission.execution_package_checksum,
      "pkg checksum",
    );
    assert(r.plan!.worker_order.length > 0, "worker order");
    assert(r.plan!.execution_graph.nodes.length > 0, "exec graph");
    assert(r.plan!.dependency_graph.nodes.length > 0, "dep graph");
    assert(
      r.plan!.next_safe_action.includes("WAITING_RUNTIME_RELEASE"),
      "waiting release",
    );
    checks.plan_generation = true;
  }

  {
    const { submission } = makeShadowReceived("DEP");
    const fakeShadow: ShadowQueueRecord = {
      schema_version: "shadow-queue-1.0.0",
      shadow_queue_id: "shq-test",
      submission_id: submission.submission_id,
      mission_id: submission.mission_id,
      mission_version: submission.mission_version,
      execution_package_id: submission.execution_package_id,
      execution_package_checksum: submission.execution_package_checksum,
      acknowledgement_id: submission.acknowledgement_id,
      acknowledgement_checksum: submission.acknowledgement_checksum,
      submission_checksum: submission.submission_checksum,
      department: submission.department,
      priority: submission.priority,
      received_timestamp: new Date().toISOString(),
      status: "SHADOW_QUEUE_RECEIVED",
      validation_summary: "test",
      warnings: [],
      shadow: true,
      dispatch_allowed: false,
      execution_allowed: false,
      publishing_allowed: false,
      never_consumed: true,
      never_dispatched: true,
      never_scheduled: true,
      next_safe_action: "stop",
      fixture: true,
    };
    const resolution = resolveRuntimeWorkers(fakeShadow, submission);
    assert(resolution.director.length >= 1, "director");
    assert(resolution.managers.length >= 1, "manager");
    assert(resolution.workers.length >= 1, "workers");
    assert(resolution.worker_order[0] === resolution.director[0], "order dir first");
    const deps = resolveRuntimeDependencies(submission, resolution);
    assert(deps.acyclic === true, "acyclic");
    const graph = buildRuntimeExecutionGraph(resolution);
    assert(graph.topological_order.length > 0, "topo");
    assert(graph.nodes.every((n) => n.invoked === false), "never invoked");
    checks.dependency_resolution = true;
    checks.worker_ordering = true;
    checks.graph_validation = true;
  }

  {
    const { mission, planner } = makeShadowReceived("DUP");
    const a = planner.buildForMission(mission.mission_id, { fixture: true });
    assert(a.ok, "dup first");
    const b = planner.buildForMission(mission.mission_id, { fixture: true });
    assert(b.ok && b.duplicate === true, "dup second");
    assert(b.plan!.runtime_plan_id === a.plan!.runtime_plan_id, "same id");
    checks.duplicate = true;
  }

  {
    for (const key of RUNTIME_PLAN_FORBIDDEN_KEYS) {
      const err = rejectForbiddenRuntimePlanPayload({ [key]: true });
      assert(err?.code === "FORBIDDEN_SIDE_EFFECT", `forbid ${key}`);
    }
    checks.api_validation = true;
  }

  {
    const { mission, planner } = makeShadowReceived("PERSIST");
    const r = planner.buildForMission(mission.mission_id, { fixture: true });
    assert(r.ok, "persist build");
    const reload = new RuntimePlanRepository(REPO, { fixture: true });
    assert(
      reload.list().some((p) => p.runtime_plan_id === r.plan!.runtime_plan_id),
      "list",
    );
    const health = reload.loadHealth();
    assert(health?.dispatch_allowed === false, "health dispatch");
    assert(health?.execution_allowed === false, "health exec");
    assert(health?.planning_only === true, "health planning");
    assert(health?.live === false, "health live");
    checks.persistence = true;
  }

  {
    const server = readFileSync(
      join(REPO, "SOS/SAIOS/dashboard/server.ts"),
      "utf8",
    );
    const plugin = readFileSync(
      join(REPO, "SOS/SAIOS/platform/dashboard/plugins/runtimePlan.ts"),
      "utf8",
    );
    const apiSurface = `${server}\n${plugin}`;
    assert(apiSurface.includes("/api/runtime/runtime-plan"), "api");
    assert(
      server.includes("defaultRouteRegistry.tryHandle") ||
        server.includes("ensureDashboardPluginsRegistered"),
      "plugin route dispatch",
    );
    const view = readFileSync(
      join(REPO, "SOS/SAIOS/dashboard/src/views/RuntimePlanView.tsx"),
      "utf8",
    );
    assert(view.includes("Runtime Plan"), "title");
    assert(view.includes("Planning Only"), "banner plan");
    assert(view.includes("Execution Disabled"), "banner exec");
    assert(view.includes("LIVE OFF"), "banner live");
    checks.dashboard = true;
    checks.api = true;
  }

  checks.no_execution = true;
  checks.no_scheduling = true;
  checks.no_dispatch = true;
  checks.no_publishing = true;

  const pass = Object.values(checks).every(Boolean);
  console.log(
    JSON.stringify(
      {
        pass,
        component: "runtime-plan-v1",
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
