/**
 * SimulationRepository — Agent #187.
 * Append-only simulation metadata. Never executes.
 */
import { join, resolve } from "node:path";
import { writeFileSync, mkdirSync, readFileSync, existsSync, appendFileSync } from "node:fs";
import type {
  PreDispatchSimulationCertificate,
  PreDispatchSimulationContract,
  PreDispatchSimulationHealth,
  PreDispatchSimulationSnapshot,
  SimulationSummary,
} from "./SimulationTypes.js";
import {
  PRE_DISPATCH_SIMULATION_HEALTH_VERSION,
  PRE_DISPATCH_SIMULATION_SAFETY_FLAGS,
  PRE_DISPATCH_SIMULATION_SNAPSHOT_VERSION,
} from "./SimulationTypes.js";
import {
  validateSimulation,
  validateSimulationCertificate,
  scoreSimulation,
} from "./SimulationValidator.js";

const LOG_REL = "SOS/07_LOGS/saios/runtime/pre-dispatch-simulation";

function resolveRepoRoot(fromDir = import.meta.dirname): string {
  return resolve(fromDir, "../../../..");
}

export class SimulationRepository {
  readonly root: string;
  readonly fixture: boolean;
  private readonly simulations = new Map<string, PreDispatchSimulationContract>();
  private readonly certificates = new Map<
    string,
    PreDispatchSimulationCertificate
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
    mkdirSync(join(this.dir, "history"), { recursive: true });
    mkdirSync(join(this.dir, "events"), { recursive: true });
  }

  register(
    record: PreDispatchSimulationContract,
  ): { ok: boolean; error?: string } {
    if (process.env.SOS_AIOS_LIVE === "1") {
      return { ok: false, error: "LIVE must be OFF" };
    }
    const v = validateSimulation(record);
    if (!v.ok) {
      return { ok: false, error: v.errors[0]?.message ?? "invalid simulation" };
    }
    if (this.simulations.has(record.simulation_id)) {
      return {
        ok: false,
        error: `Simulation already registered: ${record.simulation_id}`,
      };
    }
    this.simulations.set(record.simulation_id, record);
    this.byMission.set(record.mission_id, record.simulation_id);
    this.appendEvent({
      type: "simulation_registered",
      simulation_id: record.simulation_id,
      mission_id: record.mission_id,
      at: new Date().toISOString(),
    });
    this.persist();
    return { ok: true };
  }

  registerCertificate(
    cert: PreDispatchSimulationCertificate,
  ): { ok: boolean; error?: string } {
    const v = validateSimulationCertificate(cert);
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
    const sim = this.simulations.get(cert.simulation_id);
    if (sim) {
      sim.checksums.certificate_checksum = cert.certificate_checksum;
      sim.updated_at = new Date().toISOString();
      this.simulations.set(sim.simulation_id, sim);
    }
    this.appendEvent({
      type: "certificate_registered",
      certificate_id: cert.certificate_id,
      simulation_id: cert.simulation_id,
      at: new Date().toISOString(),
    });
    this.persist();
    return { ok: true };
  }

  find(id: string): PreDispatchSimulationContract | null {
    return this.simulations.get(id) ?? null;
  }

  findByMission(missionId: string): PreDispatchSimulationContract | null {
    const id = this.byMission.get(missionId);
    return id ? (this.simulations.get(id) ?? null) : null;
  }

  findCertificateByMission(
    missionId: string,
  ): PreDispatchSimulationCertificate | null {
    for (const cert of this.certificates.values()) {
      if (cert.mission_id === missionId) return cert;
    }
    return null;
  }

  listSimulations(): SimulationSummary[] {
    return [...this.simulations.values()].map((s) => {
      const cert = [...this.certificates.values()].find(
        (c) => c.simulation_id === s.simulation_id,
      );
      return {
        simulation_id: s.simulation_id,
        mission_id: s.mission_id,
        status: s.status,
        overall_readiness: cert?.scores.overall_readiness ?? null,
        certificate_id: cert?.certificate_id ?? null,
        fixture: s.fixture,
      };
    });
  }

  listCertificates(): PreDispatchSimulationCertificate[] {
    return [...this.certificates.values()];
  }

  buildHealth(): PreDispatchSimulationHealth {
    const list = [...this.simulations.values()];
    return {
      schema_version: PRE_DISPATCH_SIMULATION_HEALTH_VERSION,
      simulation_count: list.length,
      complete_count: list.filter((s) => s.status === "SIMULATION_COMPLETE")
        .length,
      blocked_count: list.filter((s) => s.status === "SIMULATION_BLOCKED")
        .length,
      certificate_count: this.certificates.size,
      status: list.length === 0 ? "idle" : "declared",
      mode: "pre_dispatch_simulation_only",
      execution_allowed: false,
      live_enabled: false,
      safety_flags: { ...PRE_DISPATCH_SIMULATION_SAFETY_FLAGS },
    };
  }

  buildSnapshot(): PreDispatchSimulationSnapshot {
    const list = this.listSimulations();
    const latest = list[list.length - 1] ?? null;
    const full = latest ? this.find(latest.simulation_id) : null;
    return {
      schema_version: PRE_DISPATCH_SIMULATION_SNAPSHOT_VERSION,
      simulation_count: list.length,
      complete_count: list.filter((s) => s.status === "SIMULATION_COMPLETE")
        .length,
      blocked_count: list.filter((s) => s.status === "SIMULATION_BLOCKED")
        .length,
      certificate_count: this.certificates.size,
      latest_simulation_id: latest?.simulation_id ?? null,
      latest_mission_id: latest?.mission_id ?? null,
      latest_status: latest?.status ?? null,
      overall_readiness: latest?.overall_readiness ?? null,
      next_safe_action:
        full?.next_safe_action ??
        "Pre-dispatch simulation idle · simulation only · LIVE OFF",
    };
  }

  appendEvent(event: Record<string, unknown>): void {
    this.ensureDir();
    const day = new Date().toISOString().slice(0, 10);
    appendFileSync(
      join(this.dir, "events", `${day}.jsonl`),
      JSON.stringify(event) + "\n",
      "utf8",
    );
  }

  persist(): void {
    this.ensureDir();
    const sims = [...this.simulations.values()];
    writeFileSync(
      join(this.dir, "simulations.json"),
      JSON.stringify(sims, null, 2) + "\n",
      "utf8",
    );
    writeFileSync(
      join(this.dir, "certificates.json"),
      JSON.stringify([...this.certificates.values()], null, 2) + "\n",
      "utf8",
    );
    writeFileSync(
      join(this.dir, "latest.json"),
      JSON.stringify(this.buildSnapshot(), null, 2) + "\n",
      "utf8",
    );
    writeFileSync(
      join(this.dir, "latest-pre-dispatch-simulation-snapshot.json"),
      JSON.stringify(this.buildSnapshot(), null, 2) + "\n",
      "utf8",
    );
    writeFileSync(
      join(this.dir, "pre-dispatch-simulation-health.json"),
      JSON.stringify(this.buildHealth(), null, 2) + "\n",
      "utf8",
    );
    writeFileSync(
      join(this.dir, "health.json"),
      JSON.stringify(this.buildHealth(), null, 2) + "\n",
      "utf8",
    );
    for (const sim of sims) {
      writeFileSync(
        join(this.dir, "history", `${sim.simulation_id}.json`),
        JSON.stringify(sim, null, 2) + "\n",
        "utf8",
      );
    }
  }

  loadPersisted(): void {
    this.ensureDir();
    const simPath = join(this.dir, "simulations.json");
    const certPath = join(this.dir, "certificates.json");
    if (existsSync(simPath)) {
      const rows = JSON.parse(
        readFileSync(simPath, "utf8"),
      ) as PreDispatchSimulationContract[];
      for (const row of rows) {
        this.simulations.set(row.simulation_id, row);
        this.byMission.set(row.mission_id, row.simulation_id);
      }
    }
    if (existsSync(certPath)) {
      const rows = JSON.parse(
        readFileSync(certPath, "utf8"),
      ) as PreDispatchSimulationCertificate[];
      for (const row of rows) {
        this.certificates.set(row.certificate_id, row);
      }
    }
  }

  scoreOf(sim: PreDispatchSimulationContract) {
    return scoreSimulation(sim);
  }
}
