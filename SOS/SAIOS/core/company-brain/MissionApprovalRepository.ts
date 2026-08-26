/**
 * MissionApprovalRepository — append-only persistence (Agent #163).
 * Fixtures write under fixtures/ subdir when fixture=true.
 * Platform consolidation (Agent #173): extends BaseAppendOnlyRepository.
 */
import { join } from "node:path";
import { resolveRepoRoot } from "./PlanRepository.js";
import { BaseAppendOnlyRepository } from "../../platform/repositories/BaseAppendOnlyRepository.js";
import type {
  MissionApprovalHealth,
  MissionApprovalHistoryEntry,
  MissionApprovalSnapshot,
  MissionDecision,
  MissionDecisionEvent,
  PendingMissionApproval,
} from "./mission-decision-types.js";

const LOG_REL = "SOS/07_LOGS/saios/company-brain/mission-approvals";

export function missionApprovalLogDir(
  repoRoot?: string,
  fixture = false,
): string {
  const base = join(repoRoot ?? resolveRepoRoot(), LOG_REL);
  return fixture ? join(base, "fixtures") : base;
}

export class MissionApprovalRepository extends BaseAppendOnlyRepository {
  constructor(repoRoot?: string, opts?: { fixture?: boolean }) {
    super({
      repoRoot: repoRoot ?? resolveRepoRoot(),
      logRelativePath: LOG_REL,
      fixture: Boolean(opts?.fixture),
      lenientJsonl: true,
    });
  }

  appendDecision(decision: MissionDecision): void {
    this.appendJsonl("mission-decisions.jsonl", decision);
  }

  appendEvent(event: MissionDecisionEvent): void {
    this.appendJsonl("mission-decision-events.jsonl", event);
  }

  appendHistory(entry: MissionApprovalHistoryEntry): void {
    this.appendJsonl("mission-approval-history.jsonl", entry);
  }

  listDecisions(includeFixtures = true): MissionDecision[] {
    return this.readJsonl<MissionDecision>("mission-decisions.jsonl").filter(
      (d) => (includeFixtures ? true : !d.fixture),
    );
  }

  listEvents(): MissionDecisionEvent[] {
    return this.readJsonl("mission-decision-events.jsonl");
  }

  listHistory(): MissionApprovalHistoryEntry[] {
    return this.readJsonl("mission-approval-history.jsonl");
  }

  latestDecisionForMission(
    missionId: string,
    missionVersion?: number,
  ): MissionDecision | null {
    const all = this.listDecisions(true)
      .filter((d) => d.mission_id === missionId)
      .filter((d) =>
        missionVersion === undefined
          ? true
          : d.mission_version === missionVersion,
      )
      .filter((d) => d.status === "CONSUMED" || d.status === "RECORDED");
    return all.length ? all[all.length - 1]! : null;
  }

  hasConsumedForVersion(missionId: string, missionVersion: number): boolean {
    return this.listDecisions(true).some(
      (d) =>
        d.mission_id === missionId &&
        d.mission_version === missionVersion &&
        d.status === "CONSUMED",
    );
  }

  writeLatestApproval(snapshot: MissionApprovalSnapshot): void {
    this.atomicWrite("latest-mission-approval.json", snapshot);
  }

  writePending(pending: PendingMissionApproval[]): void {
    this.atomicWrite("pending-mission-approvals.json", {
      schema_version: "pending-mission-approvals-1.0.0",
      updated_at: new Date().toISOString(),
      count: pending.length,
      pending,
    });
  }

  writeHealth(health: MissionApprovalHealth): void {
    this.atomicWrite("mission-approval-health.json", health);
  }

  loadLatestApproval(): MissionApprovalSnapshot | null {
    return this.loadJson("latest-mission-approval.json");
  }

  loadPending(): PendingMissionApproval[] {
    const doc = this.loadJson<{ pending?: PendingMissionApproval[] }>(
      "pending-mission-approvals.json",
    );
    return Array.isArray(doc?.pending) ? doc.pending : [];
  }

  loadHealth(): MissionApprovalHealth | null {
    return this.loadJson("mission-approval-health.json");
  }
}
