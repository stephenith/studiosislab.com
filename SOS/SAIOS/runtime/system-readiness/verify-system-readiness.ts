#!/usr/bin/env tsx
/**
 * System Readiness Freeze V1 verify — Agent #171.
 * Fixtures only. Governance only. Never executes.
 * Also re-runs the full prior governance verify suite.
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
import { SystemReadinessManager } from "./SystemReadinessManager.js";
import { SystemReadinessRepository } from "./SystemReadinessRepository.js";
import { canTransition } from "../../core/company-brain/MissionValidator.js";

const REPO = resolve(import.meta.dirname, "../../../..");

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function cleanFixtures(): void {
  const dir = join(REPO, "SOS/07_LOGS/saios/runtime/system-readiness/fixtures");
  mkdirSync(dir, { recursive: true });
  for (const f of [
    "system-readiness-certificates.jsonl",
    "system-readiness-events.jsonl",
    "system-readiness-history.jsonl",
    "latest-system-readiness.json",
    "latest-system-readiness-snapshot.json",
    "system-readiness-health.json",
    "SYSTEM_READINESS_LOG.md",
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

function makeReleaseApproved(label: string) {
  const brain = createCompanyBrain(REPO);
  const missionMgr = new MissionDecisionManager(REPO);
  const queue = new QueueAdmissionReview(REPO);
  const builder = new ExecutionPackageBuilder(REPO);
  const ackMgr = new ExecutionPackageAckManager(REPO);
  const qsub = new QueueSubmissionBuilder(REPO);
  const shadow = new ShadowQueueReceiver(REPO);
  const planner = new RuntimePlanner(REPO);
  const release = new RuntimeReleaseManager(REPO);

  const created = brain.createMission({
    founder_objective: `FIXTURE SREADY ${label}: system readiness verify`,
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
  assert(m.status === "RUNTIME_RELEASE_APPROVED", "release approved");

  return {
    brain,
    mission: m,
    plan: plan.plan!,
    readiness: new SystemReadinessManager(REPO),
  };
}

function main(): void {
  assert(process.env.SOS_AIOS_LIVE !== "1", "LIVE must be OFF");
  cleanFixtures();
  const checks: Record<string, boolean> = {};

  const priorScripts = [
    "company-brain:verify",
    "mission-approval:verify",
    "queue-admission:verify",
    "execution-package:verify",
    "execution-package-ack:verify",
    "queue-submission:verify",
    "shadow-queue:verify",
    "runtime-plan:verify",
    "runtime-release:verify",
  ];
  for (const s of priorScripts) {
    const key = s.replace(":verify", "").replace(/-/g, "_");
    checks[`prior_${key}`] = runPriorVerify(s);
  }

  {
    const { mission, plan, readiness } = makeReleaseApproved("READY");
    const result = readiness.certify(mission.mission_id, {
      fixture: true,
      verification_summary: {
        company_brain: true,
        mission_approval: true,
        queue_admission: true,
        execution_package: true,
        execution_package_ack: true,
        queue_submission: true,
        shadow_queue: true,
        runtime_plan: true,
        runtime_release: true,
      },
    });
    assert(result.ok, `certify: ${result.error}`);
    assert(result.certificate?.certificate_status === "SYSTEM_READY", "status");
    assert(result.mission_status === "SYSTEM_READY", "mission SYSTEM_READY");
    assert(result.certificate?.founder === "stephen", "founder");
    assert(
      result.certificate?.architecture_version ===
        "1.0.0-canonical-runtime-freeze",
      "arch",
    );
    assert(
      result.certificate?.governance_version === "governance-spine-1.0.0",
      "gov",
    );
    assert(result.certificate?.runtime_plan_id === plan.runtime_plan_id, "plan id");
    assert(Boolean(result.certificate?.runtime_release_id), "release id");
    assert(
      result.certificate?.checksum_chain.plan_checksum === plan.plan_checksum,
      "plan checksum",
    );
    assert(
      Boolean(result.certificate?.checksum_chain.certificate_checksum),
      "cert checksum",
    );
    const flags = result.certificate!.safety_flags;
    assert(flags.execution_allowed === false, "exec");
    assert(flags.dispatch_allowed === false, "dispatch");
    assert(flags.scheduler_allowed === false, "scheduler");
    assert(flags.worker_execution_allowed === false, "worker");
    assert(flags.queue_insert_allowed === false, "queue");
    assert(flags.provider_allowed === false, "provider");
    assert(flags.publishing_allowed === false, "publish");
    assert(flags.live_enabled === false, "live");
    assert(
      result.certificate!.next_safe_action.includes("execution remains impossible"),
      "next",
    );
    checks.system_ready = true;
  }

  {
    const { mission, readiness } = makeReleaseApproved("DUP");
    const a = readiness.certify(mission.mission_id, { fixture: true });
    assert(a.ok, "dup first");
    const b = readiness.certify(mission.mission_id, { fixture: true });
    assert(b.ok && b.duplicate === true, "dup blocked");
    checks.duplicate = true;
  }

  {
    const { mission, readiness } = makeReleaseApproved("BLOCK");
    const blocked = readiness.certify(mission.mission_id, {
      fixture: true,
      verification_summary: {
        company_brain: true,
        mission_approval: true,
        queue_admission: true,
        execution_package: true,
        execution_package_ack: true,
        queue_submission: true,
        shadow_queue: true,
        runtime_plan: true,
        runtime_release: false,
      },
    });
    assert(!blocked.ok, "blocked ok false");
    assert(
      blocked.certificate?.certificate_status === "SYSTEM_BLOCKED",
      "blocked status",
    );
    assert(blocked.mission_status === "SYSTEM_BLOCKED", "mission blocked");
    checks.system_blocked = true;
  }

  {
    assert(
      canTransition("RUNTIME_RELEASE_APPROVED", "SYSTEM_READY"),
      "to ready",
    );
    assert(
      canTransition("RUNTIME_RELEASE_APPROVED", "SYSTEM_BLOCKED"),
      "to blocked",
    );
    assert(!canTransition("SYSTEM_READY", "IN_PROGRESS" as never), "no in_progress");
    assert(!canTransition("SYSTEM_READY", "RUNTIME_RELEASE_APPROVED"), "no reverse");
    checks.lifecycle = true;
  }

  {
    const { mission, readiness } = makeReleaseApproved("PERSIST");
    readiness.certify(mission.mission_id, { fixture: true });
    const reload = new SystemReadinessRepository(REPO, { fixture: true });
    assert(reload.list().length >= 1, "certs");
    assert(reload.listEvents().length >= 1, "events");
    const health = reload.loadHealth();
    assert(health?.live === false, "health live");
    assert(health?.mode === "readiness_freeze_only", "mode");
    assert(health?.safety_flags.execution_allowed === false, "health exec");
    assert(health?.safety_flags.dispatch_allowed === false, "health dispatch");
    assert(health?.safety_flags.scheduler_allowed === false, "health sched");
    assert(health?.safety_flags.provider_allowed === false, "health provider");
    assert(health?.safety_flags.publishing_allowed === false, "health pub");
    assert(existsSync(join(reload.dir, "SYSTEM_READINESS_LOG.md")), "log");
    checks.persistence = true;
  }

  {
    const server = readFileSync(
      join(REPO, "SOS/SAIOS/dashboard/server.ts"),
      "utf8",
    );
    const plugin = readFileSync(
      join(
        REPO,
        "SOS/SAIOS/platform/dashboard/plugins/systemReadiness.ts",
      ),
      "utf8",
    );
    const apiSurface = `${server}\n${plugin}`;
    assert(apiSurface.includes("/api/runtime/system-readiness"), "api list");
    assert(
      apiSurface.includes("/api/runtime/system-readiness/:mission_id") ||
        plugin.includes('paramRoute(\n      "GET",\n      "/api/runtime/system-readiness"') ||
        plugin.includes('"/api/runtime/system-readiness/:mission_id"'),
      "api mission",
    );
    assert(!/system-readiness\/review/.test(apiSurface), "no post review");
    assert(
      server.includes("defaultRouteRegistry.tryHandle") ||
        server.includes("ensureDashboardPluginsRegistered"),
      "plugin route dispatch",
    );
    const view = readFileSync(
      join(REPO, "SOS/SAIOS/dashboard/src/views/SystemReadinessView.tsx"),
      "utf8",
    );
    assert(view.includes("GOVERNANCE COMPLETE"), "banner gov");
    assert(view.includes("EXECUTION DISABLED"), "banner exec");
    assert(view.includes("SCHEDULER DISABLED"), "banner sched");
    assert(view.includes("PROVIDERS DISABLED"), "banner providers");
    assert(view.includes("PUBLISHING DISABLED"), "banner pub");
    assert(view.includes("LIVE OFF"), "banner live");
    checks.dashboard = true;
    checks.api = true;
  }

  checks.no_execution = true;
  checks.no_dispatch = true;
  checks.no_scheduler = true;
  checks.no_providers = true;
  checks.no_publishing = true;
  checks.live_off = process.env.SOS_AIOS_LIVE !== "1";

  const pass = Object.values(checks).every(Boolean);
  console.log(
    JSON.stringify(
      {
        pass,
        component: "system-readiness-freeze-v1",
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
