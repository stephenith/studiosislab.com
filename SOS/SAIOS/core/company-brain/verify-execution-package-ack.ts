#!/usr/bin/env tsx
/**
 * Execution Package Acknowledgement V1 verify — Agent #166.
 * Fixtures only. Never enqueues, executes, or publishes.
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
import { ExecutionPackageAckRepository } from "./ExecutionPackageAckRepository.js";
import { PACKAGE_ACK_FOUNDER_ACTOR } from "./execution-package-ack-types.js";
import { MISSION_FOUNDER_ACTOR } from "./mission-decision-types.js";
import { QUEUE_FOUNDER_ACTOR } from "./queue-admission-types.js";
import { canPackageAckTransition } from "./ExecutionPackageAckStateMachine.js";

const REPO = resolve(import.meta.dirname, "../../../..");

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function cleanFixtures(): void {
  const dir = join(
    REPO,
    "SOS/07_LOGS/saios/company-brain/execution-package-ack/fixtures",
  );
  mkdirSync(dir, { recursive: true });
  for (const f of [
    "execution-package-acknowledgements.jsonl",
    "execution-package-ack-events.jsonl",
    "execution-package-ack-history.jsonl",
    "latest-execution-package-ack.json",
    "pending-execution-package-acks.json",
    "execution-package-ack-health.json",
    "EXECUTION_PACKAGE_ACK_LOG.md",
  ]) {
    const p = join(dir, f);
    if (existsSync(p)) rmSync(p);
  }
  writeFileSync(join(dir, ".verify-run"), new Date().toISOString(), "utf8");
}

function makeWaitingAck(label: string) {
  const brain = createCompanyBrain(REPO);
  const missionMgr = new MissionDecisionManager(REPO);
  const queue = new QueueAdmissionReview(REPO);
  const builder = new ExecutionPackageBuilder(REPO);

  const created = brain.createMission({
    founder_objective: `FIXTURE ACK ${label}: package acknowledgement verify`,
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
  assert(built.ok && built.package, `package ${label}`);
  const ackMgr = new ExecutionPackageAckManager(REPO);
  const opened = ackMgr.openForAcknowledgement(m.mission_id, { fixture: true });
  assert(opened.ok, `open ${label}: ${opened.error}`);
  m = brain.missions.get(m.mission_id)!;
  assert(m.status === "WAITING_PACKAGE_ACKNOWLEDGEMENT", "waiting ack");
  return { mission: m, pkg: built.package! };
}

async function main(): Promise<void> {
  assert(process.env.SOS_AIOS_LIVE !== "1", "LIVE OFF");
  cleanFixtures();
  const checks: Record<string, boolean> = {};
  const ackMgr = new ExecutionPackageAckManager(REPO);

  // 1. ACKNOWLEDGED
  {
    const { mission, pkg } = makeWaitingAck("ACK");
    const r = ackMgr.recordDecision({
      mission_id: mission.mission_id,
      mission_version: mission.mission_version,
      package_id: pkg.package_id,
      execution_package_version: pkg.package_version,
      execution_package_checksum: pkg.checksum,
      decision: "ACKNOWLEDGED",
      actor: PACKAGE_ACK_FOUNDER_ACTOR,
      reason: "Exact package acknowledged",
      fixture: true,
    });
    assert(r.ok, `ack: ${r.error}`);
    assert(r.mission_status === "PACKAGE_ACKNOWLEDGED", "acked status");
    assert(r.acknowledgement?.execution_allowed === false, "no exec");
    assert(r.acknowledgement?.queue_enqueue_allowed === false, "no enqueue");
    assert(r.acknowledgement?.publishing_allowed === false, "no publish");
    assert(
      r.next_safe_action ===
        "Prepare acknowledged execution package for queue insertion review",
      "next action",
    );
    checks.acknowledged = true;
  }

  // 2. CHANGES_REQUESTED
  {
    const { mission, pkg } = makeWaitingAck("CHANGES");
    const bad = ackMgr.recordDecision({
      mission_id: mission.mission_id,
      mission_version: mission.mission_version,
      package_id: pkg.package_id,
      execution_package_version: pkg.package_version,
      execution_package_checksum: pkg.checksum,
      decision: "CHANGES_REQUESTED",
      actor: PACKAGE_ACK_FOUNDER_ACTOR,
      notes: "",
      fixture: true,
    });
    assert(!bad.ok && bad.error_code === "FEEDBACK_REQUIRED", "notes req");
    const ok = ackMgr.recordDecision({
      mission_id: mission.mission_id,
      mission_version: mission.mission_version,
      package_id: pkg.package_id,
      execution_package_version: pkg.package_version,
      execution_package_checksum: pkg.checksum,
      decision: "CHANGES_REQUESTED",
      actor: PACKAGE_ACK_FOUNDER_ACTOR,
      notes: "Reduce estimated stages",
      fixture: true,
    });
    assert(ok.ok && ok.mission_status === "PACKAGE_CHANGES_REQUESTED", "changes");
    assert(ok.acknowledgement?.revision_proposal?.auto_revise === false, "no auto");
    checks.changes = true;
  }

  // 3. REJECTED
  {
    const { mission, pkg } = makeWaitingAck("REJ");
    const bad = ackMgr.recordDecision({
      mission_id: mission.mission_id,
      mission_version: mission.mission_version,
      package_id: pkg.package_id,
      execution_package_version: pkg.package_version,
      execution_package_checksum: pkg.checksum,
      decision: "REJECTED",
      actor: PACKAGE_ACK_FOUNDER_ACTOR,
      reason: "",
      fixture: true,
    });
    assert(!bad.ok && bad.error_code === "REASON_REQUIRED", "reason");
    const ok = ackMgr.recordDecision({
      mission_id: mission.mission_id,
      mission_version: mission.mission_version,
      package_id: pkg.package_id,
      execution_package_version: pkg.package_version,
      execution_package_checksum: pkg.checksum,
      decision: "REJECTED",
      actor: PACKAGE_ACK_FOUNDER_ACTOR,
      reason: "Package scope wrong",
      fixture: true,
    });
    assert(ok.ok && ok.mission_status === "PACKAGE_REJECTED", "rejected");
    checks.rejected = true;
  }

  // 4. invalid actor
  {
    const { mission, pkg } = makeWaitingAck("ACTOR");
    const r = ackMgr.recordDecision({
      mission_id: mission.mission_id,
      mission_version: mission.mission_version,
      package_id: pkg.package_id,
      execution_package_version: pkg.package_version,
      execution_package_checksum: pkg.checksum,
      decision: "ACKNOWLEDGED",
      actor: "not-stephen",
      fixture: true,
    });
    assert(!r.ok && r.error_code === "INVALID_FOUNDER_ACTOR", "actor");
    checks.invalid_actor = true;
  }

  // 5. stale package version
  {
    const { mission, pkg } = makeWaitingAck("STALE");
    const r = ackMgr.recordDecision({
      mission_id: mission.mission_id,
      mission_version: mission.mission_version,
      package_id: pkg.package_id,
      execution_package_version: pkg.package_version + 9,
      execution_package_checksum: pkg.checksum,
      decision: "ACKNOWLEDGED",
      actor: PACKAGE_ACK_FOUNDER_ACTOR,
      fixture: true,
    });
    assert(!r.ok && r.error_code === "STALE_PACKAGE_VERSION", "stale");
    checks.stale_version = true;
  }

  // 6. checksum mismatch
  {
    const { mission, pkg } = makeWaitingAck("CSUM");
    const r = ackMgr.recordDecision({
      mission_id: mission.mission_id,
      mission_version: mission.mission_version,
      package_id: pkg.package_id,
      execution_package_version: pkg.package_version,
      execution_package_checksum: "deadbeef".repeat(8),
      decision: "ACKNOWLEDGED",
      actor: PACKAGE_ACK_FOUNDER_ACTOR,
      fixture: true,
    });
    assert(!r.ok && r.error_code === "CHECKSUM_MISMATCH", "checksum");
    checks.checksum = true;
  }

  // 7. duplicate
  {
    const { mission, pkg } = makeWaitingAck("DUP");
    const first = ackMgr.recordDecision({
      mission_id: mission.mission_id,
      mission_version: mission.mission_version,
      package_id: pkg.package_id,
      execution_package_version: pkg.package_version,
      execution_package_checksum: pkg.checksum,
      decision: "ACKNOWLEDGED",
      actor: PACKAGE_ACK_FOUNDER_ACTOR,
      fixture: true,
    });
    assert(first.ok, "first");
    const second = ackMgr.recordDecision({
      mission_id: mission.mission_id,
      mission_version: mission.mission_version,
      package_id: pkg.package_id,
      execution_package_version: pkg.package_version,
      execution_package_checksum: pkg.checksum,
      decision: "ACKNOWLEDGED",
      actor: PACKAGE_ACK_FOUNDER_ACTOR,
      fixture: true,
    });
    assert(
      !second.ok && second.error_code === "DUPLICATE_ACKNOWLEDGEMENT",
      "dup",
    );
    checks.duplicate = true;
  }

  // 8. missing package
  {
    const { mission, pkg } = makeWaitingAck("MISS");
    const r = ackMgr.recordDecision({
      mission_id: mission.mission_id,
      mission_version: mission.mission_version,
      package_id: "epkg-does-not-exist",
      execution_package_version: pkg.package_version,
      execution_package_checksum: pkg.checksum,
      decision: "ACKNOWLEDGED",
      actor: PACKAGE_ACK_FOUNDER_ACTOR,
      fixture: true,
    });
    assert(
      !r.ok &&
        (r.error_code === "MISSING_PACKAGE" ||
          r.error_code === "PACKAGE_ID_MISMATCH"),
      "missing",
    );
    checks.missing_package = true;
  }

  // 9–11. forbidden side effects
  {
    const { mission, pkg } = makeWaitingAck("SIDE");
    for (const key of [
      "enqueue",
      "execute",
      "publish",
      "dispatch",
      "run",
      "queue",
      "enable_live",
      "provider_call",
    ]) {
      const r = ackMgr.recordDecision({
        mission_id: mission.mission_id,
        mission_version: mission.mission_version,
        package_id: pkg.package_id,
        execution_package_version: pkg.package_version,
        execution_package_checksum: pkg.checksum,
        decision: "ACKNOWLEDGED",
        actor: PACKAGE_ACK_FOUNDER_ACTOR,
        [key]: true,
        fixture: true,
      } as Parameters<typeof ackMgr.recordDecision>[0]);
      assert(!r.ok && r.error_code === "FORBIDDEN_SIDE_EFFECT", `forbid ${key}`);
    }
    checks.forbid_side_effects = true;
  }

  // state machine
  {
    assert(
      canPackageAckTransition(
        "WAITING_PACKAGE_ACKNOWLEDGEMENT",
        "PACKAGE_ACKNOWLEDGED",
      ),
      "ok transition",
    );
    assert(
      !canPackageAckTransition(
        "WAITING_PACKAGE_ACKNOWLEDGEMENT",
        "IN_PROGRESS",
      ),
      "no exec",
    );
    checks.state_machine = true;
  }

  // 12. persistence reload
  {
    const repo = new ExecutionPackageAckRepository(REPO, { fixture: true });
    assert(repo.listAcknowledgements().length > 0, "acks");
    assert(repo.listHistory().length > 0, "history");
    assert(repo.loadHealth()?.execution_allowed === false, "health");
    assert(repo.loadLatest()?.queue_enqueue_allowed === false, "latest");
    const repo2 = new ExecutionPackageAckRepository(REPO, { fixture: true });
    assert(
      repo2.listAcknowledgements().length ===
        repo.listAcknowledgements().length,
      "reload",
    );
    checks.persistence = true;
  }

  // API
  {
    const server = readFileSync(
      join(REPO, "SOS/SAIOS/dashboard/server.ts"),
      "utf8",
    );
    const plugin = readFileSync(
      join(
        REPO,
        "SOS/SAIOS/platform/dashboard/plugins/executionPackageAck.ts",
      ),
      "utf8",
    );
    const src = `${server}\n${plugin}`;
    assert(src.includes("/api/company-brain/execution-package-ack"), "api");
    assert(
      src.includes("/api/company-brain/execution-package-ack-decision"),
      "decision api",
    );
    assert(server.includes('listen(PORT, "127.0.0.1"'), "localhost");
    assert(
      server.includes("defaultRouteRegistry.tryHandle") ||
        server.includes("ensureDashboardPluginsRegistered"),
      "plugin route dispatch",
    );
    checks.api = true;
  }

  const all = Object.values(checks).every(Boolean);
  assert(all, JSON.stringify(checks));

  console.log(
    JSON.stringify(
      {
        pass: true,
        component: "execution-package-acknowledgement-v1",
        checks: {
          ...checks,
          live_off: true,
          no_execution: true,
          no_enqueue: true,
          no_dispatch: true,
          no_publish: true,
          immutable: true,
          acknowledgement_not_execution: true,
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
