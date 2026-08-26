/**
 * ActivationRepository — persistence (Agent #185).
 * Eligibility records only. Never enables execution.
 */
import { join, resolve } from "node:path";
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import type {
  ActivationCertificateContract,
  ActivationEligibilityContract,
  ActivationGateHealth,
  ActivationGateSnapshot,
  ActivationLifecycleStatus,
  ActivationSummary,
} from "./ActivationGateTypes.js";
import {
  ACTIVATION_GATE_SAFETY_FLAGS,
  ACTIVATION_HEALTH_VERSION,
  ACTIVATION_SNAPSHOT_VERSION,
} from "./ActivationGateTypes.js";
import { assertActivationLifecycleTransition } from "./ActivationStateMachine.js";
import {
  validateActivationCertificate,
  validateActivationEligibility,
} from "./ActivationValidator.js";

const LOG_REL = "SOS/07_LOGS/saios/runtime/activation-gate";

function resolveRepoRoot(fromDir = import.meta.dirname): string {
  return resolve(fromDir, "../../../..");
}

export class ActivationRepository {
  readonly root: string;
  readonly fixture: boolean;
  private readonly activations = new Map<
    string,
    ActivationEligibilityContract
  >();
  private readonly certificates = new Map<
    string,
    ActivationCertificateContract
  >();
  private readonly byMission = new Map<string, string>();

  constructor(repoRoot?: string, opts?: { fixture?: boolean }) {
    this.root = repoRoot ?? resolveRepoRoot();
    this.fixture = Boolean(opts?.fixture);
  }

  get dir(): string {
    const base = join(this.root, LOG_REL);
    return this.fixture ? join(base, "fixtures") : base;
  }

  ensureDir(): void {
    mkdirSync(this.dir, { recursive: true });
  }

  register(
    record: ActivationEligibilityContract,
  ): { ok: boolean; error?: string } {
    if (process.env.SOS_AIOS_LIVE === "1") {
      return { ok: false, error: "LIVE must be OFF" };
    }
    const v = validateActivationEligibility(record);
    if (!v.ok) {
      return { ok: false, error: v.errors[0]?.message ?? "invalid eligibility" };
    }
    if (this.activations.has(record.activation_id)) {
      return {
        ok: false,
        error: `Activation already registered: ${record.activation_id}`,
      };
    }
    this.activations.set(record.activation_id, record);
    this.byMission.set(record.mission_id, record.activation_id);
    this.persist();
    return { ok: true };
  }

  registerCertificate(
    cert: ActivationCertificateContract,
  ): { ok: boolean; error?: string } {
    const v = validateActivationCertificate(cert);
    if (!v.ok) {
      return { ok: false, error: v.errors[0]?.message ?? "invalid certificate" };
    }
    if (this.certificates.has(cert.certificate_id)) {
      return {
        ok: false,
        error: `Certificate already registered: ${cert.certificate_id}`,
      };
    }
    this.certificates.set(cert.certificate_id, cert);
    const act = this.activations.get(cert.activation_id);
    if (act) {
      act.checksums.certificate_checksum = cert.certificate_checksum;
      act.updated_at = new Date().toISOString();
      this.activations.set(act.activation_id, act);
    }
    this.persist();
    return { ok: true };
  }

  advance(
    activationId: string,
    to: ActivationLifecycleStatus,
  ): { ok: boolean; error?: string; record?: ActivationEligibilityContract } {
    const record = this.activations.get(activationId);
    if (!record) return { ok: false, error: "activation not found" };
    try {
      assertActivationLifecycleTransition(record.status, to);
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
    record.status = to;
    record.updated_at = new Date().toISOString();
    this.activations.set(activationId, record);
    this.persist();
    return { ok: true, record };
  }

  find(activationId: string): ActivationEligibilityContract | null {
    return this.activations.get(activationId) ?? null;
  }

  findByMission(missionId: string): ActivationEligibilityContract | null {
    const id = this.byMission.get(missionId);
    return id ? (this.activations.get(id) ?? null) : null;
  }

  findCertificateByMission(
    missionId: string,
  ): ActivationCertificateContract | null {
    for (const cert of this.certificates.values()) {
      if (cert.mission_id === missionId) return cert;
    }
    return null;
  }

  listActivations(): ActivationSummary[] {
    return [...this.activations.values()].map((a) => {
      const cert = [...this.certificates.values()].find(
        (c) => c.activation_id === a.activation_id,
      );
      return {
        activation_id: a.activation_id,
        mission_id: a.mission_id,
        status: a.status,
        outcome: a.outcome,
        overall_score: a.score.overall,
        blocking_count: a.blocking_items.length,
        certificate_id: cert?.certificate_id ?? null,
        fixture: a.fixture,
      };
    });
  }

  listCertificates(): ActivationCertificateContract[] {
    return [...this.certificates.values()];
  }

  buildHealth(): ActivationGateHealth {
    const list = [...this.activations.values()];
    return {
      schema_version: ACTIVATION_HEALTH_VERSION,
      activation_count: list.length,
      eligible_count: list.filter(
        (a) =>
          a.outcome === "ACTIVATION_ELIGIBLE" ||
          a.status === "ACTIVATION_ELIGIBLE",
      ).length,
      blocked_count: list.filter(
        (a) =>
          a.outcome === "ACTIVATION_BLOCKED" ||
          a.status === "ACTIVATION_BLOCKED",
      ).length,
      certificate_count: this.certificates.size,
      status: list.length === 0 ? "idle" : "declared",
      mode: "activation_eligibility_only",
      execution_allowed: false,
      live_enabled: false,
      safety_flags: { ...ACTIVATION_GATE_SAFETY_FLAGS },
    };
  }

  buildSnapshot(): ActivationGateSnapshot {
    const list = this.listActivations();
    const latest = list[list.length - 1] ?? null;
    const full = latest ? this.find(latest.activation_id) : null;
    const all = [...this.activations.values()];
    return {
      schema_version: ACTIVATION_SNAPSHOT_VERSION,
      activation_count: list.length,
      eligible_count: all.filter(
        (a) =>
          a.outcome === "ACTIVATION_ELIGIBLE" ||
          a.status === "ACTIVATION_ELIGIBLE",
      ).length,
      blocked_count: all.filter(
        (a) =>
          a.outcome === "ACTIVATION_BLOCKED" ||
          a.status === "ACTIVATION_BLOCKED",
      ).length,
      certificate_count: this.certificates.size,
      latest_activation_id: latest?.activation_id ?? null,
      latest_mission_id: latest?.mission_id ?? null,
      latest_status: latest?.status ?? null,
      overall_score: full?.score.overall ?? null,
      next_safe_action:
        full?.next_safe_action ??
        "Activation Gate idle · eligibility only · LIVE OFF",
    };
  }

  persist(): void {
    this.ensureDir();
    writeFileSync(
      join(this.dir, "activation-records.json"),
      JSON.stringify([...this.activations.values()], null, 2) + "\n",
      "utf8",
    );
    writeFileSync(
      join(this.dir, "activation-certificates.json"),
      JSON.stringify([...this.certificates.values()], null, 2) + "\n",
      "utf8",
    );
    writeFileSync(
      join(this.dir, "latest-activation-gate-snapshot.json"),
      JSON.stringify(this.buildSnapshot(), null, 2) + "\n",
      "utf8",
    );
    writeFileSync(
      join(this.dir, "activation-gate-health.json"),
      JSON.stringify(this.buildHealth(), null, 2) + "\n",
      "utf8",
    );
  }

  loadPersisted(): void {
    this.ensureDir();
    const actPath = join(this.dir, "activation-records.json");
    const certPath = join(this.dir, "activation-certificates.json");
    if (existsSync(actPath)) {
      const rows = JSON.parse(
        readFileSync(actPath, "utf8"),
      ) as ActivationEligibilityContract[];
      for (const row of rows) {
        this.activations.set(row.activation_id, row);
        this.byMission.set(row.mission_id, row.activation_id);
      }
    }
    if (existsSync(certPath)) {
      const rows = JSON.parse(
        readFileSync(certPath, "utf8"),
      ) as ActivationCertificateContract[];
      for (const row of rows) {
        this.certificates.set(row.certificate_id, row);
      }
    }
  }
}
