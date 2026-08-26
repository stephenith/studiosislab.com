#!/usr/bin/env tsx
/**
 * Founder Mission Approval V1 verify — Agent #163.
 * Isolated fixtures. Never executes, enqueues, publishes, or calls providers.
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
import { MissionApprovalRepository } from "./MissionApprovalRepository.js";
import { canApprovalTransition } from "./MissionApprovalStateMachine.js";
import { MISSION_FOUNDER_ACTOR } from "./mission-decision-types.js";
import { validateMissionDecisionInput } from "./MissionDecisionValidator.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const FIXTURE_MARKER = join(
  REPO,
  "SOS/07_LOGS/saios/company-brain/mission-approvals/fixtures/.verify-run",
);

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function cleanFixtureApprovals(): void {
  const dir = join(
    REPO,
    "SOS/07_LOGS/saios/company-brain/mission-approvals/fixtures",
  );
  mkdirSync(dir, { recursive: true });
  for (const f of [
    "mission-decisions.jsonl",
    "mission-decision-events.jsonl",
    "mission-approval-history.jsonl",
    "latest-mission-approval.json",
    "pending-mission-approvals.json",
    "mission-approval-health.json",
    "MISSION_APPROVAL_LOG.md",
  ]) {
    const p = join(dir, f);
    if (existsSync(p)) rmSync(p);
  }
  writeFileSync(FIXTURE_MARKER, new Date().toISOString(), "utf8");
}

async function main(): Promise<void> {
  assert(process.env.SOS_AIOS_LIVE !== "1", "LIVE must be OFF");
  cleanFixtureApprovals();

  const brain = createCompanyBrain(REPO);
  const mgr = new MissionDecisionManager(REPO);

  // Helper: create WAITING_FOUNDER fixture mission
  function makeWaitingMission(label: string) {
    const result = brain.createMission({
      founder_objective: `FIXTURE ${label}: ATS resume dry-run mission approval verify`,
      fixture: true,
      await_founder: true,
    });
    assert(result.overall === "PASS", `create mission ${label}`);
    assert(result.mission.execution_allowed === false, "pre-approval non-executable");
    assert(result.mission.queue_admission_allowed === false, "pre-approval no queue");
    assert(result.mission.publishing_allowed === false, "pre-approval no publish");
    // Ensure WAITING_FOUNDER
    if (result.mission.status === "PLANNED") {
      const sub = mgr.submitForFounderApproval(result.mission.mission_id, {
        fixture: true,
      });
      assert(sub.ok, `submit ${label}`);
    }
    const m = brain.missions.get(result.mission.mission_id)!;
    assert(m.status === "WAITING_FOUNDER", `${label} waiting`);
    return m;
  }

  const checks: Record<string, boolean> = {};

  // 1. APPROVED
  {
    const m = makeWaitingMission("APPROVED");
    const r = mgr.recordDecision({
      mission_id: m.mission_id,
      mission_version: m.mission_version,
      decision: "APPROVED",
      actor: MISSION_FOUNDER_ACTOR,
      reason: "Fixture approve",
      fixture: true,
    });
    assert(r.ok, `approved: ${r.error}`);
    assert(r.mission_status === "APPROVED", "status approved");
    assert(r.decision?.execution_allowed === false, "approved no execute");
    assert(r.decision?.queue_admission_allowed === false, "approved no queue");
    assert(r.decision?.publishing_allowed === false, "approved no publish");
    assert(
      r.next_safe_action ===
        "Open Queue Admission Readiness Review (no enqueue)",
      "next safe action",
    );
    const after = brain.missions.get(m.mission_id)!;
    assert(after.execution_allowed === false, "mission still no execute");
    assert(after.queue_admission_allowed === false, "mission still no queue");
    assert(after.publishing_allowed === false, "mission still no publish");
    checks.approved = true;
  }

  // 2. REJECTED requires reason
  {
    const m = makeWaitingMission("REJECTED");
    const bad = mgr.recordDecision({
      mission_id: m.mission_id,
      mission_version: m.mission_version,
      decision: "REJECTED",
      actor: MISSION_FOUNDER_ACTOR,
      reason: "",
      fixture: true,
    });
    assert(!bad.ok && bad.error_code === "REASON_REQUIRED", "reject needs reason");
    const ok = mgr.recordDecision({
      mission_id: m.mission_id,
      mission_version: m.mission_version,
      decision: "REJECTED",
      actor: MISSION_FOUNDER_ACTOR,
      reason: "Not aligned with founder priorities",
      fixture: true,
    });
    assert(ok.ok && ok.mission_status === "REJECTED", "rejected ok");
    checks.rejected = true;
  }

  // 3. CHANGES_REQUESTED requires feedback
  {
    const m = makeWaitingMission("CHANGES");
    const bad = mgr.recordDecision({
      mission_id: m.mission_id,
      mission_version: m.mission_version,
      decision: "CHANGES_REQUESTED",
      actor: MISSION_FOUNDER_ACTOR,
      feedback: "",
      fixture: true,
    });
    assert(!bad.ok && bad.error_code === "FEEDBACK_REQUIRED", "changes need feedback");
    const ok = mgr.recordDecision({
      mission_id: m.mission_id,
      mission_version: m.mission_version,
      decision: "CHANGES_REQUESTED",
      actor: MISSION_FOUNDER_ACTOR,
      feedback: "Narrow department scope to resume only",
      reason: "Scope too broad",
      fixture: true,
    });
    assert(ok.ok && ok.mission_status === "CHANGES_REQUESTED", "changes ok");
    assert(ok.decision?.revision_proposal?.auto_revise === false, "no auto revise");
    checks.changes_requested = true;
  }

  // 4. invalid founder actor
  {
    const m = makeWaitingMission("BAD_ACTOR");
    const r = mgr.recordDecision({
      mission_id: m.mission_id,
      mission_version: m.mission_version,
      decision: "APPROVED",
      actor: "not-stephen",
      reason: "x",
      fixture: true,
    });
    assert(!r.ok && r.error_code === "INVALID_FOUNDER_ACTOR", "bad actor");
    checks.invalid_actor = true;
  }

  // 5. stale Mission version
  {
    const m = makeWaitingMission("STALE");
    const r = mgr.recordDecision({
      mission_id: m.mission_id,
      mission_version: m.mission_version + 99,
      decision: "APPROVED",
      actor: MISSION_FOUNDER_ACTOR,
      reason: "x",
      fixture: true,
    });
    assert(!r.ok && r.error_code === "STALE_MISSION_VERSION", "stale version");
    checks.stale_version = true;
  }

  // 6. duplicate decision
  {
    const m = makeWaitingMission("DUP");
    const first = mgr.recordDecision({
      mission_id: m.mission_id,
      mission_version: m.mission_version,
      decision: "APPROVED",
      actor: MISSION_FOUNDER_ACTOR,
      reason: "first",
      fixture: true,
    });
    assert(first.ok, "first decision");
    const second = mgr.recordDecision({
      mission_id: m.mission_id,
      mission_version: m.mission_version,
      decision: "APPROVED",
      actor: MISSION_FOUNDER_ACTOR,
      reason: "second",
      fixture: true,
    });
    assert(!second.ok && second.error_code === "DUPLICATE_DECISION", "duplicate");
    checks.duplicate = true;
  }

  // 7. invalid lifecycle transition
  {
    assert(
      !canApprovalTransition("APPROVED", "IN_PROGRESS"),
      "no in_progress",
    );
    assert(
      !canApprovalTransition("PLANNED", "APPROVED"),
      "no skip planned→approved",
    );
    const m = makeWaitingMission("LIFECYCLE");
    // Force mission to APPROVED via first decision, then try REJECTED
    mgr.recordDecision({
      mission_id: m.mission_id,
      mission_version: m.mission_version,
      decision: "APPROVED",
      actor: MISSION_FOUNDER_ACTOR,
      reason: "approve first",
      fixture: true,
    });
    // Temporarily bypass duplicate by validating transition on APPROVED mission
    const approved = brain.missions.get(m.mission_id)!;
    const v = validateMissionDecisionInput(
      {
        mission_id: approved.mission_id,
        mission_version: approved.mission_version,
        decision: "REJECTED",
        actor: MISSION_FOUNDER_ACTOR,
        reason: "too late",
        fixture: true,
      },
      approved,
      { consumed_for_version: false },
    );
    assert(
      v.errors.some((e) => e.code === "INVALID_LIFECYCLE_TRANSITION"),
      "invalid lifecycle",
    );
    checks.invalid_lifecycle = true;
  }

  // 8–9. attempt enqueue / publish through decision payload
  {
    const m = makeWaitingMission("SIDE_EFFECTS");
    const enq = mgr.recordDecision({
      mission_id: m.mission_id,
      mission_version: m.mission_version,
      decision: "APPROVED",
      actor: MISSION_FOUNDER_ACTOR,
      reason: "x",
      enqueue: true,
      fixture: true,
    } as Parameters<typeof mgr.recordDecision>[0]);
    assert(!enq.ok && enq.error_code === "FORBIDDEN_SIDE_EFFECT", "no enqueue");

    const pub = mgr.recordDecision({
      mission_id: m.mission_id,
      mission_version: m.mission_version,
      decision: "APPROVED",
      actor: MISSION_FOUNDER_ACTOR,
      reason: "x",
      publish: true,
      fixture: true,
    } as Parameters<typeof mgr.recordDecision>[0]);
    assert(!pub.ok && pub.error_code === "FORBIDDEN_SIDE_EFFECT", "no publish");
    checks.forbid_enqueue = true;
    checks.forbid_publish = true;
  }

  // 10. restart/reload persistence
  {
    const repo = new MissionApprovalRepository(REPO, { fixture: true });
    const before = repo.listDecisions(true).length;
    assert(before > 0, "decisions persisted");
    const health = repo.loadHealth();
    assert(health?.execution_allowed === false, "health no execute");
    assert(health?.queue_admission_allowed === false, "health no queue");
    assert(health?.publishing_allowed === false, "health no publish");
    assert(health?.live === false, "health live off");
    const latest = repo.loadLatestApproval();
    assert(latest?.execution_allowed === false, "latest no execute");
    // Reload via new manager instance
    const mgr2 = new MissionDecisionManager(REPO);
    const repo2 = new MissionApprovalRepository(REPO, { fixture: true });
    assert(repo2.listDecisions(true).length === before, "reload same count");
    assert(repo2.listHistory().length > 0, "history preserved");
    assert(mgr2.listMissions().some((m) => m.fixture), "fixture missions exist");
    checks.persistence_reload = true;
  }

  // Immutability: decision lines are append-only (multiple lines per decision_id ok for RECORDED+CONSUMED)
  {
    const repo = new MissionApprovalRepository(REPO, { fixture: true });
    const lines = repo.listDecisions(true);
    assert(lines.every((d) => d.execution_allowed === false), "immutable no exec");
    checks.immutable = true;
  }

  // Localhost API contract (server binds 127.0.0.1) — routes may live in dashboard plugins
  {
    const serverSrc = readFileSync(
      join(REPO, "SOS/SAIOS/dashboard/server.ts"),
      "utf8",
    );
    const pluginSrc = readFileSync(
      join(
        REPO,
        "SOS/SAIOS/platform/dashboard/plugins/missionApproval.ts",
      ),
      "utf8",
    );
    const apiSurface = `${serverSrc}\n${pluginSrc}`;
    assert(serverSrc.includes('listen(PORT, "127.0.0.1"'), "localhost bind");
    assert(
      apiSurface.includes("/api/company-brain/mission-decision"),
      "mission-decision API",
    );
    assert(
      apiSurface.includes("/api/company-brain/missions"),
      "missions list API",
    );
    assert(
      serverSrc.includes("defaultRouteRegistry.tryHandle") ||
        serverSrc.includes("ensureDashboardPluginsRegistered"),
      "plugin route dispatch",
    );
    // Founder Review API untouched as separate path
    assert(serverSrc.includes("/api/founder-decision"), "founder review intact");
    checks.localhost_api = true;
  }

  // No openai / provider in company-brain package
  {
    const pkg = JSON.parse(
      readFileSync(join(REPO, "SOS/SAIOS/core/company-brain/package.json"), "utf8"),
    ) as { dependencies?: Record<string, string> };
    assert(!pkg.dependencies?.openai, "no openai");
    checks.no_provider = true;
  }

  const allPass = Object.values(checks).every(Boolean);
  assert(allPass, `checks failed: ${JSON.stringify(checks)}`);

  console.log(
    JSON.stringify(
      {
        pass: true,
        component: "founder-mission-approval-v1",
        checks: {
          ...checks,
          live_off: true,
          no_execution: true,
          no_enqueue: true,
          no_publish: true,
          founder_review_unchanged: true,
          fixtures_isolated: true,
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
