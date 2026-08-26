/**
 * Persist gate results, blocked resume templates, remediation (append-only).
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
  BlockedCandidate,
  CriticGateResult,
  RemediationProposal,
} from "./types.js";

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

export class CriticGateStore {
  constructor(
    private readonly dir = join(
      resolve(import.meta.dirname, "../../../.."),
      "SOS/07_LOGS/saios/critic-gate",
    ),
  ) {
    mkdirSync(this.dir, { recursive: true });
  }

  appendGate(gate: CriticGateResult): void {
    appendFileSync(
      join(this.dir, "gate-results.jsonl"),
      `${JSON.stringify(gate)}\n`,
    );
    this.rebuildIndex();
  }

  appendBlocked(blocked: BlockedCandidate): void {
    appendFileSync(
      join(this.dir, "blocked-candidates.jsonl"),
      `${JSON.stringify(blocked)}\n`,
    );
  }

  appendRemediation(proposal: RemediationProposal): void {
    appendFileSync(
      join(this.dir, "remediation-proposals.jsonl"),
      `${JSON.stringify(proposal)}\n`,
    );
  }

  listGates(): CriticGateResult[] {
    return readJsonl(join(this.dir, "gate-results.jsonl"));
  }

  listBlocked(): BlockedCandidate[] {
    return readJsonl(join(this.dir, "blocked-candidates.jsonl"));
  }

  latestForCandidate(candidateId: string): CriticGateResult | null {
    const all = this.listGates().filter((g) => g.candidate_id === candidateId);
    return all.length ? all[all.length - 1] : null;
  }

  private rebuildIndex(): void {
    const gates = this.listGates();
    const latestByCandidate: Record<string, string> = {};
    for (const g of gates) latestByCandidate[g.candidate_id] = g.gate_id;
    atomicWrite(join(this.dir, "gate-index.json"), {
      updated_at: new Date().toISOString(),
      count: gates.length,
      latest_by_candidate: latestByCandidate,
      dry_run: true,
      publication_allowed: false,
    });
  }

  writeReport(md: string): void {
    writeFileSync(join(this.dir, "critic-gate-report.md"), md, "utf8");
  }
}
