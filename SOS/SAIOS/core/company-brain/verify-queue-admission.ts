#!/usr/bin/env tsx
/**
 * Queue Admission Readiness Review V1 verify — Agent #164.
 * Fixtures only. Never executes, enqueues, dispatches, or publishes.
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
import { QueueAdmissionRepository } from "./QueueAdmissionRepository.js";
import { canQueueTransition } from "./QueueAdmissionValidator.js";
import { MISSION_FOUNDER_ACTOR } from "./mission-decision-types.js";
import { QUEUE_FOUNDER_ACTOR } from "./queue-admission-types.js";

const REPO = resolve(import.meta.dirname, "../../../..");

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function cleanFixtures(): void {
  const dir = join(
    REPO,
    "SOS/07_LOGS/saios/company-brain/queue-admission/fixtures",
  );
  mkdirSync(dir, { recursive: true });
  for (const f of [
    "queue-decisions.jsonl",
    "queue-admission-events.jsonl",
    "queue-admission-history.jsonl",
    "queue-reviews.jsonl",
    "latest-queue-review.json",
    "latest-queue-admission.json",
    "queue-admission-health.json",
    "QUEUE_ADMISSION_LOG.md",
  ]) {
    const p = join(dir, f);
    if (existsSync(p)) rmSync(p);
  }
  writeFileSync(join(dir, ".verify-run"), new Date().toISOString(), "utf8");
}

async function main(): Promise<void> {
  assert(process.env.SOS_AIOS_LIVE !== "1", "LIVE OFF");
  cleanFixtures();

  const brain = createCompanyBrain(REPO);
  const missionMgr = new MissionDecisionManager(REPO);
  const queue = new QueueAdmissionReview(REPO);
  const checks: Record<string, boolean> = {};

  function makeApproved(label: string) {
    const created = brain.createMission({
      founder_objective: `FIXTURE QA ${label}: ATS resume queue admission verify`,
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
        reason: `Fixture approve ${label}`,
        fixture: true,
      });
      assert(r.ok, `approve mission ${label}: ${r.error}`);
      m = brain.missions.get(m.mission_id)!;
    }
    assert(m.status === "APPROVED", `${label} approved`);
    assert(m.execution_allowed === false, "no execute");
    assert(m.queue_admission_allowed === false, "no queue flag");
    return m;
  }

  // Readiness calculation + start review
  {
    const m = makeApproved("READY");
    const started = queue.startReview(m.mission_id, { fixture: true });
    assert(started.ok, `start: ${started.error}`);
    assert(started.mission_status === "WAITING_QUEUE_REVIEW", "waiting queue");
    assert(started.review != null, "review present");
    assert(typeof started.review!.overall_score === "number", "score");
    assert(started.review!.publishing_ready === false, "publish not ready");
    assert(started.review!.execution_allowed === false, "exec false");
    assert(started.review!.queue_enqueue_allowed === false, "enqueue false");
    assert(started.review!.categories.length === 10, "10 categories");
    checks.readiness_calc = true;
    checks.state_to_waiting = true;
  }

  // Approve queue admission → READY_FOR_QUEUE only
  {
    const m = makeApproved("APPROVE_Q");
    queue.startReview(m.mission_id, { fixture: true });
    const waiting = brain.missions.get(m.mission_id)!;
    const r = queue.recordDecision({
      mission_id: waiting.mission_id,
      mission_version: waiting.mission_version,
      decision: "APPROVE_QUEUE_ADMISSION",
      actor: QUEUE_FOUNDER_ACTOR,
      reason: "Fixture queue admit",
      fixture: true,
    });
    assert(r.ok, `queue approve: ${r.error}`);
    assert(r.mission_status === "READY_FOR_QUEUE", "ready for queue");
    assert(r.decision?.queue_enqueue_allowed === false, "still no enqueue");
    assert(r.decision?.execution_allowed === false, "still no exec");
    assert(r.decision?.publishing_allowed === false, "still no publish");
    const after = brain.missions.get(m.mission_id)!;
    assert(after.status === "READY_FOR_QUEUE", "mission ready");
    assert(after.execution_allowed === false, "mission no exec");
    assert(after.queue_admission_allowed === false, "mission no admit flag");
    checks.approve_to_ready = true;
  }

  // Reject requires reason → QUEUE_BLOCKED
  {
    const m = makeApproved("REJECT_Q");
    queue.startReview(m.mission_id, { fixture: true });
    const waiting = brain.missions.get(m.mission_id)!;
    const bad = queue.recordDecision({
      mission_id: waiting.mission_id,
      mission_version: waiting.mission_version,
      decision: "REJECT_QUEUE_ADMISSION",
      actor: QUEUE_FOUNDER_ACTOR,
      reason: "",
      fixture: true,
    });
    assert(!bad.ok && bad.error_code === "REASON_REQUIRED", "reject reason");
    const ok = queue.recordDecision({
      mission_id: waiting.mission_id,
      mission_version: waiting.mission_version,
      decision: "REJECT_QUEUE_ADMISSION",
      actor: QUEUE_FOUNDER_ACTOR,
      reason: "Infra not ready",
      fixture: true,
    });
    assert(ok.ok && ok.mission_status === "QUEUE_BLOCKED", "blocked");
    checks.reject_blocked = true;
  }

  // Request changes requires feedback
  {
    const m = makeApproved("CHANGES_Q");
    queue.startReview(m.mission_id, { fixture: true });
    const waiting = brain.missions.get(m.mission_id)!;
    const bad = queue.recordDecision({
      mission_id: waiting.mission_id,
      mission_version: waiting.mission_version,
      decision: "REQUEST_CHANGES",
      actor: QUEUE_FOUNDER_ACTOR,
      feedback: "",
      fixture: true,
    });
    assert(!bad.ok && bad.error_code === "FEEDBACK_REQUIRED", "feedback");
    const ok = queue.recordDecision({
      mission_id: waiting.mission_id,
      mission_version: waiting.mission_version,
      decision: "REQUEST_CHANGES",
      actor: QUEUE_FOUNDER_ACTOR,
      feedback: "Enable resume department first",
      fixture: true,
    });
    assert(ok.ok && ok.mission_status === "QUEUE_BLOCKED", "changes→blocked");
    checks.request_changes = true;
  }

  // Duplicate approve prevention
  {
    const m = makeApproved("DUP_Q");
    queue.startReview(m.mission_id, { fixture: true });
    const waiting = brain.missions.get(m.mission_id)!;
    const first = queue.recordDecision({
      mission_id: waiting.mission_id,
      mission_version: waiting.mission_version,
      decision: "APPROVE_QUEUE_ADMISSION",
      actor: QUEUE_FOUNDER_ACTOR,
      reason: "first",
      fixture: true,
    });
    assert(first.ok, "first approve");
    const second = queue.recordDecision({
      mission_id: waiting.mission_id,
      mission_version: waiting.mission_version,
      decision: "APPROVE_QUEUE_ADMISSION",
      actor: QUEUE_FOUNDER_ACTOR,
      reason: "second",
      fixture: true,
    });
    assert(!second.ok && second.error_code === "DUPLICATE_DECISION", "dup");
    checks.duplicate = true;
  }

  // Cannot approve from APPROVED without review
  {
    const m = makeApproved("SKIP");
    const r = queue.recordDecision({
      mission_id: m.mission_id,
      mission_version: m.mission_version,
      decision: "APPROVE_QUEUE_ADMISSION",
      actor: QUEUE_FOUNDER_ACTOR,
      reason: "skip",
      fixture: true,
    });
    assert(!r.ok && r.error_code === "INVALID_LIFECYCLE_TRANSITION", "no skip");
    checks.no_skip_approve = true;
  }

  // Forbidden side effects
  {
    const m = makeApproved("SIDE");
    queue.startReview(m.mission_id, { fixture: true });
    const waiting = brain.missions.get(m.mission_id)!;
    for (const key of ["enqueue", "execute", "dispatch", "publish", "run", "enable_live"]) {
      const r = queue.recordDecision({
        mission_id: waiting.mission_id,
        mission_version: waiting.mission_version,
        decision: "APPROVE_QUEUE_ADMISSION",
        actor: QUEUE_FOUNDER_ACTOR,
        reason: "x",
        [key]: true,
        fixture: true,
      } as Parameters<typeof queue.recordDecision>[0]);
      assert(!r.ok && r.error_code === "FORBIDDEN_SIDE_EFFECT", `forbid ${key}`);
    }
    checks.forbid_side_effects = true;
  }

  // State machine guards
  {
    assert(canQueueTransition("WAITING_QUEUE_REVIEW", "READY_FOR_QUEUE"), "ok");
    assert(!canQueueTransition("WAITING_QUEUE_REVIEW", "IN_PROGRESS"), "no exec");
    assert(!canQueueTransition("READY_FOR_QUEUE", "IN_PROGRESS"), "stop");
    checks.state_machine = true;
  }

  // Persistence reload
  {
    const repo = new QueueAdmissionRepository(REPO, { fixture: true });
    assert(repo.listDecisions().length > 0, "decisions");
    assert(repo.listHistory().length > 0, "history");
    assert(repo.loadLatestReview() != null, "review");
    assert(repo.loadHealth()?.queue_enqueue_allowed === false, "health");
    assert(repo.loadSnapshot()?.execution_allowed === false, "snapshot");
    const repo2 = new QueueAdmissionRepository(REPO, { fixture: true });
    assert(
      repo2.listDecisions().length === repo.listDecisions().length,
      "reload",
    );
    checks.persistence = true;
  }

  // API surface in server
  {
    const server = readFileSync(
      join(REPO, "SOS/SAIOS/dashboard/server.ts"),
      "utf8",
    );
    const plugin = readFileSync(
      join(REPO, "SOS/SAIOS/platform/dashboard/plugins/queueAdmission.ts"),
      "utf8",
    );
    const src = `${server}\n${plugin}`;
    assert(src.includes("/api/company-brain/queue-review"), "api list");
    assert(src.includes("/api/company-brain/queue-decision"), "api decision");
    assert(server.includes('listen(PORT, "127.0.0.1"'), "localhost");
    assert(
      server.includes("defaultRouteRegistry.tryHandle") ||
        server.includes("ensureDashboardPluginsRegistered"),
      "plugin route dispatch",
    );
    checks.api = true;
  }

  // No runtime queue insertion artifacts from this module
  {
    const src = readFileSync(
      join(REPO, "SOS/SAIOS/core/company-brain/QueueAdmissionReview.ts"),
      "utf8",
    );
    assert(!src.includes("enqueueJob"), "no enqueueJob");
    assert(!src.includes("dispatchWorker"), "no dispatch");
    assert(!src.includes("openai"), "no openai");
    checks.no_runtime = true;
  }

  const all = Object.values(checks).every(Boolean);
  assert(all, JSON.stringify(checks));

  console.log(
    JSON.stringify(
      {
        pass: true,
        component: "queue-admission-readiness-v1",
        checks: {
          ...checks,
          live_off: true,
          no_execution: true,
          no_enqueue: true,
          no_dispatch: true,
          no_publish: true,
          stops_at_ready_for_queue: true,
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
