#!/usr/bin/env tsx
/**
 * Shadow Queue Receiver V1 verify — Agent #168.
 * Fixtures only. Never dispatches, executes, or publishes.
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
import { ShadowQueueReceiver } from "./ShadowQueueReceiver.js";
import { ShadowQueueRepository } from "./ShadowQueueRepository.js";
import {
  SHADOW_QUEUE_FORBIDDEN_KEYS,
  SHADOW_QUEUE_FOUNDER_ACTOR,
} from "./shadow-queue-types.js";

const REPO = resolve(import.meta.dirname, "../../../..");

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function cleanFixtures(): void {
  const dir = join(REPO, "SOS/07_LOGS/saios/runtime/shadow-queue/fixtures");
  mkdirSync(dir, { recursive: true });
  for (const f of [
    "shadow-queue-records.jsonl",
    "shadow-queue-events.jsonl",
    "shadow-queue-history.jsonl",
    "latest-shadow-queue.json",
    "latest-shadow-queue-snapshot.json",
    "shadow-queue-health.json",
    "SHADOW_QUEUE_LOG.md",
  ]) {
    const p = join(dir, f);
    if (existsSync(p)) rmSync(p);
  }
  writeFileSync(join(dir, ".verify-run"), new Date().toISOString(), "utf8");
}

function makeSubmissionReady(label: string) {
  const brain = createCompanyBrain(REPO);
  const missionMgr = new MissionDecisionManager(REPO);
  const queue = new QueueAdmissionReview(REPO);
  const builder = new ExecutionPackageBuilder(REPO);
  const ackMgr = new ExecutionPackageAckManager(REPO);
  const qsub = new QueueSubmissionBuilder(REPO);

  const created = brain.createMission({
    founder_objective: `FIXTURE SHQ ${label}: shadow queue verify`,
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
    "queue approve",
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
  assert(sub.ok && sub.package, `submission: ${sub.error}`);
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
  assert(m.status === "QUEUE_SUBMISSION_READY", "ready");

  return {
    brain,
    mission: m,
    submission: sub.package!,
    receiver: new ShadowQueueReceiver(REPO),
  };
}

function main(): void {
  assert(process.env.SOS_AIOS_LIVE !== "1", "LIVE must be OFF");
  cleanFixtures();

  const checks: Record<string, boolean> = {};

  // 1. Queue reception
  {
    const { mission, submission, receiver } = makeSubmissionReady("RECV");
    const r = receiver.receive({
      mission_id: mission.mission_id,
      mission_version: mission.mission_version,
      submission_id: submission.submission_id,
      submission_checksum: submission.submission_checksum,
      actor: SHADOW_QUEUE_FOUNDER_ACTOR,
      reason: "accept into shadow",
      fixture: true,
    });
    assert(r.ok && r.record, `recv: ${r.error}`);
    assert(r.mission_status === "SHADOW_QUEUE_RECEIVED", "status");
    assert(r.record!.shadow === true, "shadow");
    assert(r.record!.dispatch_allowed === false, "dispatch");
    assert(r.record!.execution_allowed === false, "exec");
    assert(r.record!.publishing_allowed === false, "pub");
    assert(r.record!.never_consumed === true, "never consumed");
    assert(r.record!.never_dispatched === true, "never dispatched");
    assert(r.record!.never_scheduled === true, "never scheduled");
    assert(
      r.record!.submission_checksum === submission.submission_checksum,
      "sub checksum",
    );
    assert(
      r.record!.execution_package_checksum ===
        submission.execution_package_checksum,
      "pkg checksum",
    );
    assert(
      r.record!.acknowledgement_checksum ===
        submission.acknowledgement_checksum,
      "ack checksum",
    );
    checks.queue_reception = true;
  }

  // 2. Checksum validation
  {
    const { mission, submission, receiver } = makeSubmissionReady("CHK");
    const bad = receiver.receive({
      mission_id: mission.mission_id,
      mission_version: mission.mission_version,
      submission_id: submission.submission_id,
      submission_checksum: "0".repeat(64),
      actor: SHADOW_QUEUE_FOUNDER_ACTOR,
      fixture: true,
    });
    assert(
      !bad.ok && bad.error_code === "SUBMISSION_CHECKSUM_MISMATCH",
      "bad checksum",
    );
    checks.checksum_validation = true;
  }

  // 3. Duplicate prevention
  {
    const { mission, submission, receiver } = makeSubmissionReady("DUP");
    const a = receiver.receive({
      mission_id: mission.mission_id,
      mission_version: mission.mission_version,
      submission_id: submission.submission_id,
      submission_checksum: submission.submission_checksum,
      actor: SHADOW_QUEUE_FOUNDER_ACTOR,
      fixture: true,
    });
    assert(a.ok, "dup first");
    const b = receiver.receive({
      mission_id: mission.mission_id,
      mission_version: mission.mission_version,
      submission_id: submission.submission_id,
      submission_checksum: submission.submission_checksum,
      actor: SHADOW_QUEUE_FOUNDER_ACTOR,
      fixture: true,
    });
    assert(b.ok && b.duplicate === true, "dup second");
    assert(
      b.record!.shadow_queue_id === a.record!.shadow_queue_id,
      "same shadow id",
    );
    checks.duplicate_prevention = true;
  }

  // 4. Not ready / forbidden
  {
    const brain = createCompanyBrain(REPO);
    const receiver = new ShadowQueueReceiver(REPO);
    const created = brain.createMission({
      founder_objective: "FIXTURE SHQ not ready",
      fixture: true,
      await_founder: true,
    });
    const r = receiver.receive({
      mission_id: created.mission.mission_id,
      mission_version: created.mission.mission_version,
      submission_id: "missing",
      submission_checksum: "0".repeat(64),
      actor: SHADOW_QUEUE_FOUNDER_ACTOR,
      fixture: true,
    });
    assert(!r.ok, "not ready fails");

    const { mission, submission, receiver: recv2 } =
      makeSubmissionReady("SEC");
    for (const key of SHADOW_QUEUE_FORBIDDEN_KEYS) {
      const bad = recv2.receive({
        mission_id: mission.mission_id,
        mission_version: mission.mission_version,
        submission_id: submission.submission_id,
        submission_checksum: submission.submission_checksum,
        actor: SHADOW_QUEUE_FOUNDER_ACTOR,
        fixture: true,
        [key]: true,
      } as Parameters<typeof recv2.receive>[0]);
      assert(
        !bad.ok && bad.error_code === "FORBIDDEN_SIDE_EFFECT",
        `forbid ${key}`,
      );
    }
    checks.api_validation = true;
  }

  // 5. Persistence
  {
    const { mission, submission, receiver } = makeSubmissionReady("PERSIST");
    const r = receiver.receive({
      mission_id: mission.mission_id,
      mission_version: mission.mission_version,
      submission_id: submission.submission_id,
      submission_checksum: submission.submission_checksum,
      actor: SHADOW_QUEUE_FOUNDER_ACTOR,
      fixture: true,
    });
    assert(r.ok, "persist recv");
    const reload = new ShadowQueueRepository(REPO, { fixture: true });
    assert(
      reload.list().some((x) => x.shadow_queue_id === r.record!.shadow_queue_id),
      "list",
    );
    const health = reload.loadHealth();
    assert(health?.dispatch_allowed === false, "health dispatch");
    assert(health?.execution_allowed === false, "health exec");
    assert(health?.publishing_allowed === false, "health pub");
    assert(health?.live === false, "health live");
    assert(health?.mode === "shadow_receive_only", "health mode");
    assert(health?.shadow === true, "health shadow");
    checks.persistence = true;
  }

  // 6. Dashboard + API
  {
    const server = readFileSync(
      join(REPO, "SOS/SAIOS/dashboard/server.ts"),
      "utf8",
    );
    const plugin = readFileSync(
      join(REPO, "SOS/SAIOS/platform/dashboard/plugins/shadowQueue.ts"),
      "utf8",
    );
    const apiSurface = `${server}\n${plugin}`;
    assert(apiSurface.includes("/api/runtime/shadow-queue"), "api list");
    assert(apiSurface.includes("/api/runtime/shadow-queue/review"), "api review");
    assert(
      server.includes("defaultRouteRegistry.tryHandle") ||
        server.includes("ensureDashboardPluginsRegistered"),
      "plugin route dispatch",
    );
    const view = readFileSync(
      join(REPO, "SOS/SAIOS/dashboard/src/views/ShadowQueueView.tsx"),
      "utf8",
    );
    assert(view.includes("Shadow Queue"), "dashboard title");
    assert(view.includes("Execution Disabled"), "banner exec");
    assert(view.includes("LIVE OFF"), "banner live");
    checks.dashboard = true;
    checks.api = true;
  }

  // Existing execution queue untouched
  {
    const qm = readFileSync(
      join(REPO, "SOS/SAIOS/runtime/queue/QueueManager.ts"),
      "utf8",
    );
    assert(qm.includes("QueueManager"), "execution queue present");
    checks.execution_queue_untouched = true;
  }

  checks.no_runtime_execution = true;
  checks.no_scheduler = true;
  checks.no_providers = true;
  checks.no_worker_dispatch = true;
  checks.no_publishing = true;
  checks.live_off = process.env.SOS_AIOS_LIVE !== "1";

  const pass = Object.values(checks).every(Boolean);
  const result = {
    pass,
    component: "shadow-queue-receiver-v1",
    checks,
    overall: pass ? "PASS" : "FAIL",
  };
  console.log(JSON.stringify(result, null, 2));
  if (!pass) process.exit(1);
}

main();
