#!/usr/bin/env tsx
/**
 * Execution Controller Scaffold V1 verify — Agent #179.
 * Fixtures only. Scaffold only. Never executes.
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
import { RuntimePlanner } from "../planner/RuntimePlanner.js";
import { RuntimeReleaseManager } from "../runtime-release/RuntimeReleaseManager.js";
import { RUNTIME_RELEASE_FOUNDER_ACTOR } from "../runtime-release/runtime-release-types.js";
import { SystemReadinessManager } from "../system-readiness/SystemReadinessManager.js";
import { ExecutionController } from "./ExecutionController.js";
import { ExecutionControllerRepository } from "./ExecutionControllerRepository.js";
import {
  canExecutionControllerTransition,
} from "./ExecutionControllerStateMachine.js";
import {
  EXECUTION_CONTROLLER_FOUNDER_ACTOR,
  EXECUTION_CONTROLLER_SCHEMA_VERSION,
} from "./ExecutionControllerTypes.js";
import { rejectForbiddenControllerPayload } from "./ExecutionLifecycleValidator.js";
import { computeControllerChecksum } from "./ExecutionAuthorization.js";

const REPO = resolve(import.meta.dirname, "../../../..");

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function cleanFixtures(): void {
  const dir = join(
    REPO,
    "SOS/07_LOGS/saios/runtime/execution-controller/fixtures",
  );
  mkdirSync(dir, { recursive: true });
  for (const f of [
    "execution-controller-records.jsonl",
    "execution-controller-events.jsonl",
    "execution-controller-history.jsonl",
    "latest-execution-controller.json",
    "latest-execution-controller-snapshot.json",
    "execution-controller-health.json",
    "EXECUTION_CONTROLLER_LOG.md",
  ]) {
    const p = join(dir, f);
    if (existsSync(p)) rmSync(p);
  }
  writeFileSync(join(dir, ".verify-run"), new Date().toISOString(), "utf8");
}

function runPriorVerify(script: string): boolean {
  const r = spawnSync("npm", ["run", script], {
    cwd: REPO,
    encoding: "utf8",
    env: { ...process.env, SOS_AIOS_LIVE: "0" },
  });
  if (r.status !== 0) {
    console.error(`Prior verify failed: ${script}`);
    console.error(r.stdout);
    console.error(r.stderr);
    return false;
  }
  return true;
}

function makeSystemReady(label: string) {
  const brain = createCompanyBrain(REPO);
  const missionMgr = new MissionDecisionManager(REPO);
  const queue = new QueueAdmissionReview(REPO);
  const builder = new ExecutionPackageBuilder(REPO);
  const ackMgr = new ExecutionPackageAckManager(REPO);
  const qsub = new QueueSubmissionBuilder(REPO);
  const shadow = new ShadowQueueReceiver(REPO);
  const planner = new RuntimePlanner(REPO);
  const release = new RuntimeReleaseManager(REPO);
  const readiness = new SystemReadinessManager(REPO);
  const controller = new ExecutionController(REPO);

  const created = brain.createMission({
    founder_objective: `FIXTURE XCTRL ${label}: execution controller verify`,
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

  const plan = planner.buildForMission(m.mission_id, { fixture: true });
  assert(plan.ok && plan.plan, `plan: ${plan.error}`);
  m = brain.missions.get(m.mission_id)!;

  release.openForRelease(m.mission_id, { fixture: true });
  m = brain.missions.get(m.mission_id)!;
  const r = release.recordDecision({
    mission_id: m.mission_id,
    mission_version: m.mission_version,
    runtime_plan_id: plan.plan!.runtime_plan_id,
    plan_checksum: plan.plan!.plan_checksum,
    decision: "APPROVED",
    actor: RUNTIME_RELEASE_FOUNDER_ACTOR,
    reason: `release ${label}`,
    fixture: true,
  });
  assert(r.ok, `release: ${r.error}`);
  m = brain.missions.get(m.mission_id)!;

  const cert = readiness.certify(m.mission_id, { fixture: true });
  assert(cert.ok, `certify: ${cert.error}`);
  m = brain.missions.get(m.mission_id)!;
  assert(m.status === "SYSTEM_READY", "system ready");

  return { brain, mission: m, plan: plan.plan!, controller, readiness };
}

function main(): void {
  assert(process.env.SOS_AIOS_LIVE !== "1", "LIVE must be OFF");
  cleanFixtures();
  const checks: Record<string, boolean> = {};

  const priorScripts = ["system-readiness:verify", "dashboard-platform:verify"];
  for (const s of priorScripts) {
    assert(runPriorVerify(s), `prior ${s}`);
  }
  checks.prior_suite = true;

  {
    const { mission, controller } = makeSystemReady("OPEN");
    const opened = controller.openForAuthorization(mission.mission_id, {
      fixture: true,
    });
    assert(opened.ok && opened.record, `open: ${opened.error}`);
    assert(
      opened.record!.schema_version === EXECUTION_CONTROLLER_SCHEMA_VERSION,
      "schema",
    );
    assert(
      opened.record!.controller_status === "WAITING_EXECUTION_AUTHORIZATION",
      "waiting auth",
    );
    assert(opened.mission_status === "SYSTEM_READY", "mission unchanged");
    assert(opened.record!.safety_flags.execution_allowed === false, "exec");
    assert(opened.record!.safety_flags.dispatch_allowed === false, "dispatch");
    assert(
      opened.record!.safety_flags.worker_spawn_allowed === false,
      "spawn",
    );
    assert(opened.record!.safety_flags.provider_allowed === false, "provider");
    assert(
      opened.record!.safety_flags.publishing_allowed === false,
      "publish",
    );
    assert(opened.record!.safety_flags.live_enabled === false, "live");
    assert(opened.record!.telemetry.enabled === false, "telemetry");
    assert(opened.record!.rollback.implemented === false, "rollback");
    assert(opened.record!.retry.implemented === false, "retry");
    assert(
      opened.record!.worker_inventory.invoked === false,
      "inventory not invoked",
    );
    const expected = computeControllerChecksum({
      ...opened.record!,
      checksum_chain: {
        ...opened.record!.checksum_chain,
        controller_checksum: "",
      },
    });
    assert(
      opened.record!.checksum_chain.controller_checksum === expected,
      "checksum",
    );
    checks.artifact_schema = true;
    checks.checksums = true;
    checks.safety_flags = true;
  }

  {
    assert(
      canExecutionControllerTransition(
        "WAITING_EXECUTION_AUTHORIZATION",
        "EXECUTION_AUTHORIZED",
      ),
      "auth",
    );
    assert(
      canExecutionControllerTransition(
        "EXECUTION_AUTHORIZED",
        "WAITING_EXECUTION_CONTROLLER",
      ),
      "wait ctrl",
    );
    assert(
      canExecutionControllerTransition(
        "WAITING_EXECUTION_CONTROLLER",
        "EXECUTION_CONTROLLER_READY",
      ),
      "ready",
    );
    assert(
      !canExecutionControllerTransition(
        "EXECUTION_CONTROLLER_READY",
        "WAITING_EXECUTION_AUTHORIZATION",
      ),
      "no reverse from ready",
    );
    assert(
      !canExecutionControllerTransition(
        "WAITING_EXECUTION_AUTHORIZATION",
        "IN_PROGRESS" as never,
      ),
      "no in_progress",
    );
    assert(
      !canExecutionControllerTransition(
        "EXECUTION_CONTROLLER_READY",
        "QUEUED" as never,
      ),
      "no queued",
    );
    checks.state_machine = true;
  }

  {
    const { mission, controller } = makeSystemReady("AUTHORIZE");
    const opened = controller.openForAuthorization(mission.mission_id, {
      fixture: true,
    });
    assert(opened.ok && opened.record, "open");
    const authorized = controller.recordReview({
      mission_id: mission.mission_id,
      mission_version: mission.mission_version,
      controller_id: opened.record!.controller_id,
      decision: "APPROVE_CONTROLLER_SCAFFOLD",
      actor: EXECUTION_CONTROLLER_FOUNDER_ACTOR,
      reason: "scaffold authorize",
      fixture: true,
    });
    assert(authorized.ok && authorized.record, `auth: ${authorized.error}`);
    assert(
      authorized.record!.controller_status === "EXECUTION_CONTROLLER_READY",
      "ready",
    );
    assert(authorized.mission_status === "SYSTEM_READY", "mission still ready");
    assert(
      authorized.record!.next_safe_action.includes("STOP"),
      "stop action",
    );

    const dup = controller.recordReview({
      mission_id: mission.mission_id,
      mission_version: mission.mission_version,
      decision: "APPROVE_CONTROLLER_SCAFFOLD",
      actor: EXECUTION_CONTROLLER_FOUNDER_ACTOR,
      fixture: true,
    });
    assert(!dup.ok && dup.duplicate === true, "dup rejected");
    checks.duplicate = true;
    checks.repository = true;
  }

  {
    const { mission, controller } = makeSystemReady("STALE");
    controller.openForAuthorization(mission.mission_id, { fixture: true });
    const stale = controller.recordReview({
      mission_id: mission.mission_id,
      mission_version: mission.mission_version + 99,
      decision: "APPROVE_CONTROLLER_SCAFFOLD",
      actor: EXECUTION_CONTROLLER_FOUNDER_ACTOR,
      fixture: true,
    });
    assert(!stale.ok && stale.error_code === "STALE_MISSION_VERSION", "stale");
    checks.stale = true;
  }

  {
    const forbidden = rejectForbiddenControllerPayload({ execute: true });
    assert(forbidden?.code === "FORBIDDEN_SIDE_EFFECT", "forbidden");
    checks.forbidden_side_effects = true;
  }

  {
    const { mission, controller } = makeSystemReady("PERSIST");
    controller.openForAuthorization(mission.mission_id, { fixture: true });
    controller.recordReview({
      mission_id: mission.mission_id,
      mission_version: mission.mission_version,
      decision: "APPROVE_CONTROLLER_SCAFFOLD",
      actor: EXECUTION_CONTROLLER_FOUNDER_ACTOR,
      fixture: true,
    });
    const reload = new ExecutionControllerRepository(REPO, { fixture: true });
    assert(reload.list().length >= 1, "records");
    assert(reload.listEvents().length >= 1, "events");
    assert(reload.listHistory().length >= 1, "history");
    const health = reload.loadHealth();
    assert(health?.live === false, "health live");
    assert(health?.mode === "controller_scaffold_only", "mode");
    assert(health?.safety_flags.execution_allowed === false, "health exec");
    assert(health?.safety_flags.worker_spawn_allowed === false, "health spawn");
    assert(existsSync(join(reload.dir, "EXECUTION_CONTROLLER_LOG.md")), "log");
    checks.persistence = true;
    checks.restart_persistence = true;
  }

  {
    const plugin = readFileSync(
      join(
        REPO,
        "SOS/SAIOS/platform/dashboard/plugins/executionController.ts",
      ),
      "utf8",
    );
    assert(plugin.includes("/api/runtime/execution-controller"), "api list");
    assert(
      plugin.includes("/api/runtime/execution-controller/:mission_id") ||
        plugin.includes('"/api/runtime/execution-controller"'),
      "api mission",
    );
    assert(
      plugin.includes("/api/runtime/execution-controller/review"),
      "api review",
    );
    const view = readFileSync(
      join(REPO, "SOS/SAIOS/dashboard/src/views/ExecutionControllerView.tsx"),
      "utf8",
    );
    assert(view.includes("EXECUTION DISABLED"), "banner exec");
    assert(view.includes("QUEUE DISABLED"), "banner queue");
    assert(view.includes("PROVIDERS DISABLED"), "banner providers");
    assert(view.includes("LIVE OFF"), "banner live");
    checks.dashboard = true;
    checks.api = true;
  }

  {
    const src = [
      readFileSync(
        join(REPO, "SOS/SAIOS/runtime/execution-controller/ExecutionController.ts"),
        "utf8",
      ),
      readFileSync(
        join(REPO, "SOS/SAIOS/runtime/execution-controller/ExecutionLifecycle.ts"),
        "utf8",
      ),
    ].join("\n");
    assert(!src.includes("QueueManager"), "no QueueManager");
    assert(!/\.spawn\(/.test(src), "no spawn");
    assert(!src.includes("enable_live"), "no enable live");
    assert(!src.includes("BrainRouter"), "no brain router");
    checks.execution_impossible = true;
    checks.no_queue = true;
    checks.no_workers = true;
  }

  checks.live_off = process.env.SOS_AIOS_LIVE !== "1";

  const pass = Object.values(checks).every(Boolean);
  console.log(
    JSON.stringify(
      {
        pass,
        component: "execution-controller-scaffold-v1",
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
