/**
 * WaitingFounderRepository — append-only persistence + atomic snapshots.
 */
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import type {
  CycleCheckpoint,
  CycleTransition,
  DecisionConsumption,
} from "./types.js";
import { verifyChecksum } from "./CycleCheckpoint.js";

function atomicWrite(path: string, data: unknown): void {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`);
  renameSync(tmp, path);
}

function readJsonl<T>(path: string): T[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as T);
}

export class WaitingFounderRepository {
  readonly dir: string;

  constructor(
    repoRoot = resolve(import.meta.dirname, "../../../.."),
  ) {
    this.dir = join(repoRoot, "SOS/07_LOGS/saios/founder-gate-runtime");
    mkdirSync(this.dir, { recursive: true });
  }

  appendWaiting(cp: CycleCheckpoint): void {
    appendFileSync(
      join(this.dir, "waiting-cycles.jsonl"),
      `${JSON.stringify(cp)}\n`,
    );
    appendFileSync(
      join(this.dir, "cycle-checkpoints.jsonl"),
      `${JSON.stringify(cp)}\n`,
    );
    this.rebuildSnapshots();
  }

  appendTransition(t: CycleTransition): void {
    appendFileSync(
      join(this.dir, "cycle-transitions.jsonl"),
      `${JSON.stringify(t)}\n`,
    );
  }

  appendConsumption(c: DecisionConsumption): void {
    appendFileSync(
      join(this.dir, "decision-consumption.jsonl"),
      `${JSON.stringify(c)}\n`,
    );
  }

  appendRecovery(event: Record<string, unknown>): void {
    appendFileSync(
      join(this.dir, "recovery-events.jsonl"),
      `${JSON.stringify(event)}\n`,
    );
  }

  appendActivity(event: {
    event_type: string;
    cycle_id: string;
    summary: string;
    status?: string;
    at?: string;
    fixture?: boolean;
  }): void {
    appendFileSync(
      join(this.dir, "activity-events.jsonl"),
      `${JSON.stringify({
        ...event,
        at: event.at ?? new Date().toISOString(),
        status: event.status ?? "completed",
      })}\n`,
    );
  }

  listActivity(): Array<{
    event_type: string;
    cycle_id: string;
    summary: string;
    status?: string;
    at: string;
    fixture?: boolean;
  }> {
    return readJsonl(join(this.dir, "activity-events.jsonl"));
  }

  listCheckpoints(includeFixtures = true): CycleCheckpoint[] {
    return readJsonl<CycleCheckpoint>(
      join(this.dir, "cycle-checkpoints.jsonl"),
    ).filter((c) => includeFixtures || !c.fixture);
  }

  listConsumptions(): DecisionConsumption[] {
    return readJsonl(join(this.dir, "decision-consumption.jsonl"));
  }

  latestForCycle(cycleId: string): CycleCheckpoint | null {
    const all = this.listCheckpoints(true).filter((c) => c.cycle_id === cycleId);
    return all.length ? all[all.length - 1] : null;
  }

  activeWaiting(includeFixtures = false): CycleCheckpoint[] {
    const latest = new Map<string, CycleCheckpoint>();
    for (const cp of this.listCheckpoints(true)) {
      if (!includeFixtures && cp.fixture) continue;
      latest.set(cp.cycle_id, cp);
    }
    return [...latest.values()].filter((c) => c.state === "WAITING_FOUNDER");
  }

  isDecisionConsumed(decisionId: string): boolean {
    return this.listConsumptions().some((c) => c.decision_id === decisionId);
  }

  rebuildSnapshots(): void {
    const waiting = this.activeWaiting(true);
    atomicWrite(join(this.dir, "active-waiting-cycles.json"), {
      updated_at: new Date().toISOString(),
      count: waiting.length,
      cycles: waiting.map((c) => ({
        cycle_id: c.cycle_id,
        review_id: c.review_id,
        candidate_id: c.candidate_id,
        state: c.state,
        fixture: Boolean(c.fixture),
      })),
    });

    const all = this.listCheckpoints(true);
    const latest = all.length ? all[all.length - 1] : null;
    atomicWrite(join(this.dir, "latest-cycle-state.json"), {
      updated_at: new Date().toISOString(),
      latest,
    });

    const checksumOk = waiting.every((w) => verifyChecksum(w));
    atomicWrite(join(this.dir, "founder-gate-health.json"), {
      updated_at: new Date().toISOString(),
      waiting_count: waiting.length,
      checksum_ok: checksumOk,
      dry_run: true,
      publication_allowed: false,
      live: false,
    });
  }

  writeReport(md: string): void {
    writeFileSync(join(this.dir, "founder-gate-report.md"), md, "utf8");
  }
}
