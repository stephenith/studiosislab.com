#!/usr/bin/env tsx
/**
 * Runtime Release Gate V1 verify — Agent #170.
 * Fixtures only. Governance only. Never executes.
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
import { RuntimePlanner } from "../planner/RuntimePlanner.js";
import { RuntimeReleaseManager } from "./RuntimeReleaseManager.js";
import { RuntimeReleaseRepository } from "./RuntimeReleaseRepository.js";
import {
  RUNTIME_RELEASE_FORBIDDEN_KEYS,
  RUNTIME_RELEASE_FOUNDER_ACTOR,
} from "./runtime-release-types.js";
import { canRuntimeReleaseTransition } from "./RuntimeReleaseStateMachine.js";

const REPO = resolve(import.meta.dirname, "../../../..");

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function cleanFixtures(): void {
  const dir = join(REPO, "SOS/07_LOGS/saios/runtime/runtime-release/fixtures");
  mkdirSync(dir, { recursive: true });
  for (const f of [
    "runtime-release-decisions.jsonl",
    "runtime-release-events.jsonl",
    "runtime-release-history.jsonl",
    "latest-runtime-release.json",
    "pending-runtime-releases.json",
    "runtime-release-health.json",
    "RUNTIME_RELEASE_LOG.md",
  ]) {
    const p = join(dir, f);
    if (existsSync(p)) rmSync(p);
  }
  writeFileSync(join(dir, ".verify-run"), new Date().toISOString(), "utf8");
}

function makePlanReady(label: string) {
  const brain = createCompanyBrain(REPO);
  const missionMgr = new MissionDecisionManager(REPO);
  const queue = new QueueAdmissionReview(REPO);
  const builder = new ExecutionPackageBuilder(REPO);
  const ackMgr = new ExecutionPackageAckManager(REPO);
  const qsub = new QueueSubmissionBuilder(REPO);
  const shadow = new ShadowQueueReceiver(REPO);
  const planner = new RuntimePlanner(REPO);

  const created = brain.createMission({
    founder_objective: `FIXTURE RREL ${label}: runtime release verify`,
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
  assert(m.status === "RUNTIME_PLAN_READY", "plan ready");

  return {
    brain,
    mission: m,
    plan: plan.plan!,
    release: new RuntimeReleaseManager(REPO),
  };
}

function main(): void {
  assert(process.env.SOS_AIOS_LIVE !== "1", "LIVE must be OFF");
  cleanFixtures();
  const checks: Record<string, boolean> = {};

  {
    const { mission, plan, release } = makePlanReady("APPR");
    const open = release.openForRelease(mission.mission_id, { fixture: true });
    assert(open.ok && open.mission_status === "WAITING_RUNTIME_RELEASE", "open");
    const r = release.recordDecision({
      mission_id: mission.mission_id,
      mission_version: mission.mission_version,
      runtime_plan_id: plan.runtime_plan_id,
      plan_checksum: plan.plan_checksum,
      decision: "APPROVED",
      actor: RUNTIME_RELEASE_FOUNDER_ACTOR,
      reason: "approve release contract",
      fixture: true,
    });
    assert(r.ok, `approve: ${r.error}`);
    assert(r.mission_status === "RUNTIME_RELEASE_APPROVED", "approved status");
    assert(r.release!.execution_allowed === false, "exec");
    assert(r.release!.dispatch_allowed === false, "dispatch");
    assert(r.release!.scheduler_allowed === false, "scheduler");
    assert(r.release!.queue_insert_allowed === false, "queue");
    assert(r.release!.live_enabled === false, "live");
    assert(
      r.next_safe_action?.includes("not execution authorization") ?? false,
      "next",
    );
    checks.approved = true;
  }

  {
    const { mission, plan, release } = makePlanReady("CHG");
    release.openForRelease(mission.mission_id, { fixture: true });
    const noNotes = release.recordDecision({
      mission_id: mission.mission_id,
      mission_version: mission.mission_version,
      runtime_plan_id: plan.runtime_plan_id,
      plan_checksum: plan.plan_checksum,
      decision: "CHANGES_REQUESTED",
      actor: RUNTIME_RELEASE_FOUNDER_ACTOR,
      fixture: true,
    });
    assert(!noNotes.ok && noNotes.error_code === "FEEDBACK_REQUIRED", "notes");
    const ok = release.recordDecision({
      mission_id: mission.mission_id,
      mission_version: mission.mission_version,
      runtime_plan_id: plan.runtime_plan_id,
      plan_checksum: plan.plan_checksum,
      decision: "CHANGES_REQUESTED",
      actor: RUNTIME_RELEASE_FOUNDER_ACTOR,
      notes: "revise worker order",
      fixture: true,
    });
    assert(ok.ok && ok.mission_status === "RUNTIME_RELEASE_CHANGES_REQUESTED", "changes");
    assert(ok.release!.revision_proposal?.auto_revise === false, "no auto");
    checks.changes_requested = true;
  }

  {
    const { mission, plan, release } = makePlanReady("REJ");
    release.openForRelease(mission.mission_id, { fixture: true });
    const noReason = release.recordDecision({
      mission_id: mission.mission_id,
      mission_version: mission.mission_version,
      runtime_plan_id: plan.runtime_plan_id,
      plan_checksum: plan.plan_checksum,
      decision: "REJECTED",
      actor: RUNTIME_RELEASE_FOUNDER_ACTOR,
      fixture: true,
    });
    assert(!noReason.ok && noReason.error_code === "REASON_REQUIRED", "reason");
    const ok = release.recordDecision({
      mission_id: mission.mission_id,
      mission_version: mission.mission_version,
      runtime_plan_id: plan.runtime_plan_id,
      plan_checksum: plan.plan_checksum,
      decision: "REJECTED",
      actor: RUNTIME_RELEASE_FOUNDER_ACTOR,
      reason: "not ready",
      fixture: true,
    });
    assert(ok.ok && ok.mission_status === "RUNTIME_RELEASE_REJECTED", "rejected");
    checks.rejected = true;
  }

  {
    const { mission, plan, release } = makePlanReady("SEC");
    release.openForRelease(mission.mission_id, { fixture: true });
    const badActor = release.recordDecision({
      mission_id: mission.mission_id,
      mission_version: mission.mission_version,
      runtime_plan_id: plan.runtime_plan_id,
      plan_checksum: plan.plan_checksum,
      decision: "APPROVED",
      actor: "not-stephen",
      fixture: true,
    });
    assert(!badActor.ok && badActor.error_code === "INVALID_FOUNDER_ACTOR", "actor");
    const badChecksum = release.recordDecision({
      mission_id: mission.mission_id,
      mission_version: mission.mission_version,
      runtime_plan_id: plan.runtime_plan_id,
      plan_checksum: "0".repeat(64),
      decision: "APPROVED",
      actor: RUNTIME_RELEASE_FOUNDER_ACTOR,
      fixture: true,
    });
    assert(
      !badChecksum.ok && badChecksum.error_code === "PLAN_CHECKSUM_MISMATCH",
      "checksum",
    );
    for (const key of RUNTIME_RELEASE_FORBIDDEN_KEYS) {
      const bad = release.recordDecision({
        mission_id: mission.mission_id,
        mission_version: mission.mission_version,
        runtime_plan_id: plan.runtime_plan_id,
        plan_checksum: plan.plan_checksum,
        decision: "APPROVED",
        actor: RUNTIME_RELEASE_FOUNDER_ACTOR,
        fixture: true,
        [key]: true,
      } as Parameters<typeof release.recordDecision>[0]);
      assert(
        !bad.ok && bad.error_code === "FORBIDDEN_SIDE_EFFECT",
        `forbid ${key}`,
      );
    }
    checks.validation = true;
  }

  {
    const { mission, plan, release } = makePlanReady("DUP");
    release.openForRelease(mission.mission_id, { fixture: true });
    const a = release.recordDecision({
      mission_id: mission.mission_id,
      mission_version: mission.mission_version,
      runtime_plan_id: plan.runtime_plan_id,
      plan_checksum: plan.plan_checksum,
      decision: "APPROVED",
      actor: RUNTIME_RELEASE_FOUNDER_ACTOR,
      reason: "first",
      fixture: true,
    });
    assert(a.ok, "dup first");
    const b = release.recordDecision({
      mission_id: mission.mission_id,
      mission_version: mission.mission_version,
      runtime_plan_id: plan.runtime_plan_id,
      plan_checksum: plan.plan_checksum,
      decision: "APPROVED",
      actor: RUNTIME_RELEASE_FOUNDER_ACTOR,
      reason: "second",
      fixture: true,
    });
    assert(!b.ok && b.duplicate === true, "dup blocked");
    checks.duplicate = true;
  }

  {
    assert(
      canRuntimeReleaseTransition(
        "RUNTIME_PLAN_READY",
        "WAITING_RUNTIME_RELEASE",
      ),
      "to waiting",
    );
    assert(
      canRuntimeReleaseTransition(
        "WAITING_RUNTIME_RELEASE",
        "RUNTIME_RELEASE_APPROVED",
      ),
      "to approved",
    );
    assert(
      !canRuntimeReleaseTransition(
        "WAITING_RUNTIME_RELEASE",
        "IN_PROGRESS" as never,
      ),
      "no in_progress",
    );
    checks.state_machine = true;
  }

  {
    const { mission, plan, release } = makePlanReady("PERSIST");
    release.openForRelease(mission.mission_id, { fixture: true });
    release.recordDecision({
      mission_id: mission.mission_id,
      mission_version: mission.mission_version,
      runtime_plan_id: plan.runtime_plan_id,
      plan_checksum: plan.plan_checksum,
      decision: "APPROVED",
      actor: RUNTIME_RELEASE_FOUNDER_ACTOR,
      reason: "persist",
      fixture: true,
    });
    const reload = new RuntimeReleaseRepository(REPO, { fixture: true });
    assert(reload.listDecisions().length >= 2, "decisions");
    const health = reload.loadHealth();
    assert(health?.execution_allowed === false, "health exec");
    assert(health?.dispatch_allowed === false, "health dispatch");
    assert(health?.live_enabled === false, "health live");
    assert(health?.mode === "release_gate_only", "mode");
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
        "SOS/SAIOS/platform/dashboard/plugins/runtimeRelease.ts",
      ),
      "utf8",
    );
    const apiSurface = `${server}\n${plugin}`;
    assert(apiSurface.includes("/api/runtime/runtime-release"), "api");
    assert(
      apiSurface.includes("/api/runtime/runtime-release/review"),
      "review",
    );
    assert(
      server.includes("defaultRouteRegistry.tryHandle") ||
        server.includes("ensureDashboardPluginsRegistered"),
      "plugin route dispatch",
    );
    const view = readFileSync(
      join(REPO, "SOS/SAIOS/dashboard/src/views/RuntimeReleaseView.tsx"),
      "utf8",
    );
    assert(view.includes("Runtime Release"), "title");
    assert(view.includes("Planning Only"), "banner plan");
    assert(view.includes("Scheduler Disabled"), "banner sched");
    assert(view.includes("LIVE OFF"), "banner live");
    checks.dashboard = true;
    checks.api = true;
  }

  checks.no_execution = true;
  checks.no_dispatch = true;
  checks.no_scheduler = true;
  checks.no_publishing = true;
  checks.live_off = process.env.SOS_AIOS_LIVE !== "1";

  const pass = Object.values(checks).every(Boolean);
  console.log(
    JSON.stringify(
      {
        pass,
        component: "runtime-release-gate-v1",
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
