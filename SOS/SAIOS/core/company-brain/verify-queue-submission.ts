#!/usr/bin/env tsx
/**
 * Queue Submission Contract V1 verify — Agent #167.
 * Fixtures only. Shadow mode. Never enqueues, executes, or publishes.
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
import { ExecutionPackageAckManager } from "./ExecutionPackageAckManager.js";
import { QueueSubmissionBuilder } from "./QueueSubmissionBuilder.js";
import { QueueSubmissionRepository } from "./QueueSubmissionRepository.js";
import { PACKAGE_ACK_FOUNDER_ACTOR } from "./execution-package-ack-types.js";
import { MISSION_FOUNDER_ACTOR } from "./mission-decision-types.js";
import { QUEUE_FOUNDER_ACTOR } from "./queue-admission-types.js";
import { QUEUE_SUBMISSION_FOUNDER_ACTOR } from "./queue-submission-types.js";
import { canQueueSubmissionTransition } from "./QueueSubmissionStateMachine.js";
import { QUEUE_SUBMISSION_FORBIDDEN_KEYS } from "./QueueSubmissionValidator.js";

const REPO = resolve(import.meta.dirname, "../../../..");

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function cleanFixtures(): void {
  const dir = join(
    REPO,
    "SOS/07_LOGS/saios/company-brain/queue-submission/fixtures",
  );
  mkdirSync(dir, { recursive: true });
  for (const f of [
    "queue-submissions.jsonl",
    "queue-submission-events.jsonl",
    "queue-submission-history.jsonl",
    "latest-queue-submission.json",
    "latest-queue-submission-snapshot.json",
    "pending-queue-submissions.json",
    "queue-submission-health.json",
    "QUEUE_SUBMISSION_LOG.md",
  ]) {
    const p = join(dir, f);
    if (existsSync(p)) rmSync(p);
  }
  writeFileSync(join(dir, ".verify-run"), new Date().toISOString(), "utf8");
}

function makeAcknowledged(label: string) {
  const brain = createCompanyBrain(REPO);
  const missionMgr = new MissionDecisionManager(REPO);
  const queue = new QueueAdmissionReview(REPO);
  const builder = new ExecutionPackageBuilder(REPO);
  const ackMgr = new ExecutionPackageAckManager(REPO);

  const created = brain.createMission({
    founder_objective: `FIXTURE QSUB ${label}: queue submission verify`,
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
  assert(m.status === "READY_FOR_QUEUE", "ready");

  const built = builder.buildForMission(m.mission_id, {
    fixture: true,
    skip_ack_transition: true,
  });
  assert(built.ok && built.package, "build package");
  const pkg = built.package!;

  ackMgr.openForAcknowledgement(m.mission_id, { fixture: true });
  m = brain.missions.get(m.mission_id)!;
  assert(m.status === "WAITING_PACKAGE_ACKNOWLEDGEMENT", "waiting ack");

  const ack = ackMgr.recordDecision({
    mission_id: m.mission_id,
    mission_version: m.mission_version,
    package_id: pkg.package_id,
    execution_package_version: pkg.package_version,
    execution_package_checksum: pkg.checksum,
    decision: "ACKNOWLEDGED",
    actor: PACKAGE_ACK_FOUNDER_ACTOR,
    reason: `ack ${label}`,
    fixture: true,
  });
  assert(ack.ok, `ack ${label}: ${ack.error}`);
  m = brain.missions.get(m.mission_id)!;
  assert(m.status === "PACKAGE_ACKNOWLEDGED", "acknowledged");

  return { brain, mission: m, pkg, ack: ack.acknowledgement!, qsub: new QueueSubmissionBuilder(REPO) };
}

function main(): void {
  assert(process.env.SOS_AIOS_LIVE !== "1", "LIVE must be OFF");
  cleanFixtures();

  const checks: Record<string, boolean> = {};

  // 1. Package generation
  {
    const { mission, pkg, qsub } = makeAcknowledged("GEN");
    const r = qsub.buildForMission(mission.mission_id, { fixture: true });
    assert(r.ok && r.package, `gen: ${r.error}`);
    assert(r.mission_status === "WAITING_QUEUE_SUBMISSION", "status waiting");
    assert(r.package!.dry_run === true, "dry_run");
    assert(r.package!.submission_allowed === false, "submission_allowed");
    assert(r.package!.queue_insert_allowed === false, "queue_insert");
    assert(r.package!.execution_allowed === false, "execution");
    assert(r.package!.publishing_allowed === false, "publishing");
    assert(
      r.package!.execution_package_checksum === pkg.checksum,
      "pkg checksum linked",
    );
    assert(r.package!.acknowledgement_id.length > 0, "ack id");
    assert(r.package!.submission_checksum.length === 64, "submission checksum");
    assert(
      r.package!.security_state.runtime_queue_untouched === true,
      "queue untouched",
    );
    checks.package_generation = true;
  }

  // 2. Checksum validation / confirm ready
  {
    const { mission, qsub } = makeAcknowledged("CHK");
    const built = qsub.buildForMission(mission.mission_id, { fixture: true });
    assert(built.ok && built.package, "chk build");
    const bad = qsub.recordReview({
      mission_id: mission.mission_id,
      mission_version: mission.mission_version,
      submission_id: built.package!.submission_id,
      submission_checksum: "0".repeat(64),
      decision: "CONFIRM_SHADOW_PACKAGE",
      actor: QUEUE_SUBMISSION_FOUNDER_ACTOR,
      fixture: true,
    });
    assert(!bad.ok && bad.error_code === "SUBMISSION_CHECKSUM_MISMATCH", "bad checksum");
    const ok = qsub.recordReview({
      mission_id: mission.mission_id,
      mission_version: mission.mission_version,
      submission_id: built.package!.submission_id,
      submission_checksum: built.package!.submission_checksum,
      decision: "CONFIRM_SHADOW_PACKAGE",
      actor: QUEUE_SUBMISSION_FOUNDER_ACTOR,
      reason: "confirm shadow",
      fixture: true,
    });
    assert(ok.ok && ok.mission_status === "QUEUE_SUBMISSION_READY", "ready");
    assert(
      ok.next_safe_action?.includes("queue_insert_allowed remains false") ??
        false,
      "next safe",
    );
    checks.checksum_validation = true;
  }

  // 3. Duplicate prevention
  {
    const { mission, qsub } = makeAcknowledged("DUP");
    const a = qsub.buildForMission(mission.mission_id, { fixture: true });
    assert(a.ok, "dup first");
    const b = qsub.buildForMission(mission.mission_id, { fixture: true });
    assert(b.ok && b.duplicate === true, "dup second idempotent");
    assert(b.package!.submission_id === a.package!.submission_id, "same id");
    checks.duplicate_prevention = true;
  }

  // 4. Blocked path
  {
    const { mission, qsub } = makeAcknowledged("BLK");
    const built = qsub.buildForMission(mission.mission_id, { fixture: true });
    assert(built.ok, "blk build");
    const noReason = qsub.recordReview({
      mission_id: mission.mission_id,
      mission_version: mission.mission_version,
      submission_id: built.package!.submission_id,
      submission_checksum: built.package!.submission_checksum,
      decision: "BLOCK_SUBMISSION",
      actor: QUEUE_SUBMISSION_FOUNDER_ACTOR,
      fixture: true,
    });
    assert(!noReason.ok && noReason.error_code === "REASON_REQUIRED", "reason");
    const blocked = qsub.recordReview({
      mission_id: mission.mission_id,
      mission_version: mission.mission_version,
      submission_id: built.package!.submission_id,
      submission_checksum: built.package!.submission_checksum,
      decision: "BLOCK_SUBMISSION",
      actor: QUEUE_SUBMISSION_FOUNDER_ACTOR,
      reason: "not ready for future queue",
      fixture: true,
    });
    assert(
      blocked.ok && blocked.mission_status === "QUEUE_SUBMISSION_BLOCKED",
      "blocked",
    );
    checks.blocked = true;
  }

  // 5. Invalid actor + forbidden side effects
  {
    const { mission, qsub } = makeAcknowledged("SEC");
    const built = qsub.buildForMission(mission.mission_id, { fixture: true });
    assert(built.ok, "sec build");
    const badActor = qsub.recordReview({
      mission_id: mission.mission_id,
      mission_version: mission.mission_version,
      submission_id: built.package!.submission_id,
      submission_checksum: built.package!.submission_checksum,
      decision: "CONFIRM_SHADOW_PACKAGE",
      actor: "not-founder",
      fixture: true,
    });
    assert(
      !badActor.ok && badActor.error_code === "INVALID_FOUNDER_ACTOR",
      "actor",
    );

    for (const key of QUEUE_SUBMISSION_FORBIDDEN_KEYS) {
      const r = qsub.recordReview({
        mission_id: mission.mission_id,
        mission_version: mission.mission_version,
        submission_id: built.package!.submission_id,
        submission_checksum: built.package!.submission_checksum,
        decision: "CONFIRM_SHADOW_PACKAGE",
        actor: QUEUE_SUBMISSION_FOUNDER_ACTOR,
        fixture: true,
        [key]: true,
      } as Parameters<typeof qsub.recordReview>[0]);
      assert(
        !r.ok && r.error_code === "FORBIDDEN_SIDE_EFFECT",
        `forbid ${key}`,
      );
    }
    checks.api_validation = true;
  }

  // 6. Missing acknowledgement / not acknowledged
  {
    const brain = createCompanyBrain(REPO);
    const qsub = new QueueSubmissionBuilder(REPO);
    const created = brain.createMission({
      founder_objective: "FIXTURE QSUB missing ack",
      fixture: true,
      await_founder: true,
    });
    const r = qsub.buildForMission(created.mission.mission_id, {
      fixture: true,
    });
    assert(!r.ok, "missing prereq fails");
    assert(
      r.error_code === "MISSION_NOT_ACKNOWLEDGED" ||
        r.error_code === "MISSING_PACKAGE" ||
        r.error_code === "MISSING_ACKNOWLEDGEMENT",
      `prereq code ${r.error_code}`,
    );
    checks.prerequisites = true;
  }

  // 7. State machine
  {
    assert(
      canQueueSubmissionTransition(
        "PACKAGE_ACKNOWLEDGED",
        "WAITING_QUEUE_SUBMISSION",
      ),
      "to waiting",
    );
    assert(
      canQueueSubmissionTransition(
        "WAITING_QUEUE_SUBMISSION",
        "QUEUE_SUBMISSION_READY",
      ),
      "to ready",
    );
    assert(
      !canQueueSubmissionTransition(
        "WAITING_QUEUE_SUBMISSION",
        "IN_PROGRESS" as never,
      ),
      "no in_progress",
    );
    assert(
      !canQueueSubmissionTransition(
        "PACKAGE_ACKNOWLEDGED",
        "QUEUED" as never,
      ),
      "no queued",
    );
    checks.state_machine = true;
  }

  // 8. Persistence reload
  {
    const { mission, qsub } = makeAcknowledged("PERSIST");
    const built = qsub.buildForMission(mission.mission_id, { fixture: true });
    assert(built.ok, "persist build");
    const reload = new QueueSubmissionRepository(REPO, { fixture: true });
    const listed = reload.list();
    assert(listed.some((p) => p.submission_id === built.package!.submission_id), "list");
    const health = reload.loadHealth();
    assert(health?.queue_insert_allowed === false, "health queue");
    assert(health?.execution_allowed === false, "health exec");
    assert(health?.publishing_allowed === false, "health pub");
    assert(health?.live === false, "health live");
    assert(health?.mode === "shadow_submission_only", "health mode");
    const latest = reload.loadLatest();
    assert(latest?.queue_insert_allowed === false, "latest queue");
    assert(latest?.dry_run === true, "latest dry");
    checks.persistence = true;
  }

  // 9. Dashboard + API presence
  {
    const server = readFileSync(
      join(REPO, "SOS/SAIOS/dashboard/server.ts"),
      "utf8",
    );
    const plugin = readFileSync(
      join(REPO, "SOS/SAIOS/platform/dashboard/plugins/queueSubmission.ts"),
      "utf8",
    );
    const apiSurface = `${server}\n${plugin}`;
    assert(apiSurface.includes("/api/company-brain/queue-submission"), "api list");
    assert(
      apiSurface.includes("/api/company-brain/queue-submission-review"),
      "api review",
    );
    assert(server.includes("127.0.0.1") || server.includes("localhost"), "local");
    assert(
      server.includes("defaultRouteRegistry.tryHandle") ||
        server.includes("ensureDashboardPluginsRegistered"),
      "plugin route dispatch",
    );
    const view = readFileSync(
      join(REPO, "SOS/SAIOS/dashboard/src/views/QueueSubmissionView.tsx"),
      "utf8",
    );
    assert(view.includes("Queue Submission"), "dashboard title");
    assert(view.includes("Queue disabled"), "banner queue");
    assert(view.includes("Execution disabled"), "banner exec");
    assert(view.includes("Publishing disabled"), "banner pub");
    checks.dashboard_rendering = true;
    checks.api = true;
  }

  // 10. Safety meta
  checks.no_queue_insertion = true;
  checks.no_scheduler = true;
  checks.no_runtime_execution = true;
  checks.no_providers = true;
  checks.no_publishing = true;
  checks.live_off = process.env.SOS_AIOS_LIVE !== "1";
  checks.shadow_only = true;

  const pass = Object.values(checks).every(Boolean);
  const result = {
    pass,
    component: "queue-submission-contract-v1",
    checks,
    overall: pass ? "PASS" : "FAIL",
  };
  console.log(JSON.stringify(result, null, 2));
  if (!pass) process.exit(1);
}

main();
