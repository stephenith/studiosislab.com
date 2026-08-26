/**
 * ExecutionAuthorizationRepository — Agent #186.
 * Intent records only. Never enables execution.
 */
import { join, resolve } from "node:path";
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import type {
  ExecutionAuthorizationCertificateContract,
  ExecutionAuthorizationContract,
  ExecutionAuthorizationDecisionContract,
  ExecutionAuthorizationHealth,
  ExecutionAuthorizationLifecycleStatus,
  ExecutionAuthorizationRequestContract,
  ExecutionAuthorizationSnapshot,
  ExecutionAuthorizationSummary,
} from "./ExecutionAuthorizationTypes.js";
import {
  EXECUTION_AUTHORIZATION_HEALTH_VERSION,
  EXECUTION_AUTHORIZATION_SAFETY_FLAGS,
  EXECUTION_AUTHORIZATION_SNAPSHOT_VERSION,
} from "./ExecutionAuthorizationTypes.js";
import { assertExecutionAuthorizationTransition } from "./ExecutionAuthorizationStateMachine.js";
import {
  validateExecutionAuthorization,
  validateExecutionAuthorizationCertificate,
} from "./ExecutionAuthorizationValidator.js";
import { computeAuthorizationChecksum } from "./ExecutionAuthorizationValidator.js";

const LOG_REL = "SOS/07_LOGS/saios/runtime/execution-authorization";

function resolveRepoRoot(fromDir = import.meta.dirname): string {
  return resolve(fromDir, "../../../..");
}

export class ExecutionAuthorizationRepository {
  readonly root: string;
  readonly fixture: boolean;
  private readonly authorizations = new Map<
    string,
    ExecutionAuthorizationContract
  >();
  private readonly requests = new Map<
    string,
    ExecutionAuthorizationRequestContract
  >();
  private readonly decisions = new Map<
    string,
    ExecutionAuthorizationDecisionContract
  >();
  private readonly certificates = new Map<
    string,
    ExecutionAuthorizationCertificateContract
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
    record: ExecutionAuthorizationContract,
  ): { ok: boolean; error?: string } {
    if (process.env.SOS_AIOS_LIVE === "1") {
      return { ok: false, error: "LIVE must be OFF" };
    }
    const v = validateExecutionAuthorization(record);
    if (!v.ok) {
      return {
        ok: false,
        error: v.errors[0]?.message ?? "invalid authorization",
      };
    }
    if (this.authorizations.has(record.authorization_id)) {
      return {
        ok: false,
        error: `Authorization already registered: ${record.authorization_id}`,
      };
    }
    this.authorizations.set(record.authorization_id, record);
    this.byMission.set(record.mission_id, record.authorization_id);
    this.persist();
    return { ok: true };
  }

  registerRequest(request: ExecutionAuthorizationRequestContract): void {
    this.requests.set(request.request_id, request);
    this.persist();
  }

  registerDecision(decision: ExecutionAuthorizationDecisionContract): void {
    this.decisions.set(decision.decision_id, decision);
    this.persist();
  }

  registerCertificate(
    cert: ExecutionAuthorizationCertificateContract,
  ): { ok: boolean; error?: string } {
    const v = validateExecutionAuthorizationCertificate(cert);
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
    const act = this.authorizations.get(cert.authorization_id);
    if (act) {
      act.checksums.certificate_checksum = cert.checksums.certificate_checksum;
      act.checksums.authorization_checksum = "";
      act.checksums.authorization_checksum = computeAuthorizationChecksum(act);
      act.updated_at = new Date().toISOString();
      this.authorizations.set(act.authorization_id, act);
    }
    this.persist();
    return { ok: true };
  }

  applyDecision(
    authorizationId: string,
    outcome: "AUTHORIZED" | "REJECTED",
    decisionChecksum: string,
    authorizedAt: string | null,
  ): { ok: boolean; error?: string; record?: ExecutionAuthorizationContract } {
    const record = this.authorizations.get(authorizationId);
    if (!record) return { ok: false, error: "authorization not found" };
    try {
      assertExecutionAuthorizationTransition(record.status, outcome);
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
    record.status = outcome;
    record.outcome = outcome;
    record.authorized_at = authorizedAt;
    record.checksums.decision_checksum = decisionChecksum;
    record.checksums.authorization_checksum = "";
    record.checksums.authorization_checksum =
      computeAuthorizationChecksum(record);
    record.updated_at = new Date().toISOString();
    this.authorizations.set(authorizationId, record);
    this.persist();
    return { ok: true, record };
  }

  advance(
    authorizationId: string,
    to: ExecutionAuthorizationLifecycleStatus,
  ): { ok: boolean; error?: string; record?: ExecutionAuthorizationContract } {
    const record = this.authorizations.get(authorizationId);
    if (!record) return { ok: false, error: "authorization not found" };
    try {
      assertExecutionAuthorizationTransition(record.status, to);
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
    record.status = to;
    record.updated_at = new Date().toISOString();
    record.checksums.authorization_checksum = "";
    record.checksums.authorization_checksum =
      computeAuthorizationChecksum(record);
    this.authorizations.set(authorizationId, record);
    this.persist();
    return { ok: true, record };
  }

  find(id: string): ExecutionAuthorizationContract | null {
    return this.authorizations.get(id) ?? null;
  }

  findByMission(missionId: string): ExecutionAuthorizationContract | null {
    const id = this.byMission.get(missionId);
    return id ? (this.authorizations.get(id) ?? null) : null;
  }

  findCertificateByMission(
    missionId: string,
  ): ExecutionAuthorizationCertificateContract | null {
    for (const cert of this.certificates.values()) {
      if (cert.mission_id === missionId) return cert;
    }
    return null;
  }

  findRequestByMission(
    missionId: string,
  ): ExecutionAuthorizationRequestContract | null {
    for (const r of this.requests.values()) {
      if (r.mission_id === missionId) return r;
    }
    return null;
  }

  findDecisionByMission(
    missionId: string,
  ): ExecutionAuthorizationDecisionContract | null {
    for (const d of this.decisions.values()) {
      if (d.mission_id === missionId) return d;
    }
    return null;
  }

  listAuthorizations(): ExecutionAuthorizationSummary[] {
    return [...this.authorizations.values()].map((a) => {
      const cert = [...this.certificates.values()].find(
        (c) => c.authorization_id === a.authorization_id,
      );
      return {
        authorization_id: a.authorization_id,
        mission_id: a.mission_id,
        status: a.status,
        outcome: a.outcome,
        founder: a.founder,
        activation_id: a.activation_id,
        certificate_id: cert?.certificate_id ?? null,
        fixture: a.fixture,
      };
    });
  }

  listCertificates(): ExecutionAuthorizationCertificateContract[] {
    return [...this.certificates.values()];
  }

  buildHealth(): ExecutionAuthorizationHealth {
    const list = [...this.authorizations.values()];
    return {
      schema_version: EXECUTION_AUTHORIZATION_HEALTH_VERSION,
      authorization_count: list.length,
      waiting_count: list.filter((a) => a.status === "WAITING_FOUNDER")
        .length,
      authorized_count: list.filter(
        (a) =>
          a.outcome === "AUTHORIZED" || a.status === "AUTHORIZED",
      ).length,
      rejected_count: list.filter(
        (a) => a.outcome === "REJECTED" || a.status === "REJECTED",
      ).length,
      certificate_count: this.certificates.size,
      status: list.length === 0 ? "idle" : "declared",
      mode: "founder_intent_only",
      execution_allowed: false,
      live_enabled: false,
      safety_flags: { ...EXECUTION_AUTHORIZATION_SAFETY_FLAGS },
    };
  }

  buildSnapshot(): ExecutionAuthorizationSnapshot {
    const list = this.listAuthorizations();
    const latest = list[list.length - 1] ?? null;
    const full = latest ? this.find(latest.authorization_id) : null;
    const all = [...this.authorizations.values()];
    return {
      schema_version: EXECUTION_AUTHORIZATION_SNAPSHOT_VERSION,
      authorization_count: list.length,
      waiting_count: all.filter((a) => a.status === "WAITING_FOUNDER").length,
      authorized_count: all.filter(
        (a) => a.outcome === "AUTHORIZED" || a.status === "AUTHORIZED",
      ).length,
      rejected_count: all.filter(
        (a) => a.outcome === "REJECTED" || a.status === "REJECTED",
      ).length,
      certificate_count: this.certificates.size,
      latest_authorization_id: latest?.authorization_id ?? null,
      latest_mission_id: latest?.mission_id ?? null,
      latest_status: latest?.status ?? null,
      next_safe_action:
        full?.next_safe_action ??
        "Execution Authorization idle · intent only · LIVE OFF",
    };
  }

  persist(): void {
    this.ensureDir();
    writeFileSync(
      join(this.dir, "authorization-records.json"),
      JSON.stringify([...this.authorizations.values()], null, 2) + "\n",
      "utf8",
    );
    writeFileSync(
      join(this.dir, "authorization-requests.json"),
      JSON.stringify([...this.requests.values()], null, 2) + "\n",
      "utf8",
    );
    writeFileSync(
      join(this.dir, "authorization-decisions.json"),
      JSON.stringify([...this.decisions.values()], null, 2) + "\n",
      "utf8",
    );
    writeFileSync(
      join(this.dir, "authorization-certificates.json"),
      JSON.stringify([...this.certificates.values()], null, 2) + "\n",
      "utf8",
    );
    writeFileSync(
      join(this.dir, "latest-execution-authorization-snapshot.json"),
      JSON.stringify(this.buildSnapshot(), null, 2) + "\n",
      "utf8",
    );
    writeFileSync(
      join(this.dir, "execution-authorization-health.json"),
      JSON.stringify(this.buildHealth(), null, 2) + "\n",
      "utf8",
    );
  }

  loadPersisted(): void {
    this.ensureDir();
    const load = <T>(name: string): T[] => {
      const p = join(this.dir, name);
      if (!existsSync(p)) return [];
      return JSON.parse(readFileSync(p, "utf8")) as T[];
    };
    for (const row of load<ExecutionAuthorizationContract>(
      "authorization-records.json",
    )) {
      this.authorizations.set(row.authorization_id, row);
      this.byMission.set(row.mission_id, row.authorization_id);
    }
    for (const row of load<ExecutionAuthorizationRequestContract>(
      "authorization-requests.json",
    )) {
      this.requests.set(row.request_id, row);
    }
    for (const row of load<ExecutionAuthorizationDecisionContract>(
      "authorization-decisions.json",
    )) {
      this.decisions.set(row.decision_id, row);
    }
    for (const row of load<ExecutionAuthorizationCertificateContract>(
      "authorization-certificates.json",
    )) {
      this.certificates.set(row.certificate_id, row);
    }
  }
}
