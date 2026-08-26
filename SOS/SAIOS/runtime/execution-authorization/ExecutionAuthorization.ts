/**
 * ExecutionAuthorization — founder intent authority (Agent #186).
 * Records AUTHORIZED | REJECTED intent only. Never enables execution.
 * Never overrides Activation Gate.
 */
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { ExecutionAuthorizationRepository } from "./ExecutionAuthorizationRepository.js";
import { ExecutionAuthorizationReporter } from "./ExecutionAuthorizationReporter.js";
import { createExecutionAuthorizationRequest } from "./ExecutionAuthorizationRequest.js";
import { createExecutionAuthorizationDecision } from "./ExecutionAuthorizationDecision.js";
import { createExecutionAuthorizationCertificate } from "./ExecutionAuthorizationCertificate.js";
import { computeAuthorizationChecksum } from "./ExecutionAuthorizationValidator.js";
import {
  assertAuthorizationDoesNotEnableExecution,
  authorizationPolicyNotes,
} from "./ExecutionAuthorizationPolicy.js";
import type {
  ExecutionAuthorizationCertificateContract,
  ExecutionAuthorizationContract,
  ExecutionAuthorizationLifecycleStatus,
  ExecutionAuthorizationScope,
  ExecutionAuthorizationSummary,
} from "./ExecutionAuthorizationTypes.js";
import {
  EXECUTION_AUTHORIZATION_FOUNDER,
  EXECUTION_AUTHORIZATION_SAFETY_FLAGS,
  EXECUTION_AUTHORIZATION_SCHEMA_VERSION,
} from "./ExecutionAuthorizationTypes.js";

function resolveRepoRoot(fromDir = import.meta.dirname): string {
  return resolve(fromDir, "../../../..");
}

export { computeAuthorizationChecksum } from "./ExecutionAuthorizationValidator.js";

export function createExecutionAuthorizationRecord(input: {
  mission_id: string;
  activation_id?: string | null;
  reason: string;
  scope?: ExecutionAuthorizationScope;
  status?: ExecutionAuthorizationLifecycleStatus;
  requested_at?: string;
  authorized_at?: string | null;
  request_checksum?: string | null;
  decision_checksum?: string | null;
  certificate_checksum?: string | null;
  outcome?: "AUTHORIZED" | "REJECTED" | null;
  version?: string;
  notes?: string[];
  fixture?: boolean;
  authorization_id?: string;
  created_at?: string;
}): ExecutionAuthorizationContract {
  const now = new Date().toISOString();
  const requested_at = input.requested_at ?? now;
  const draft: ExecutionAuthorizationContract = {
    schema_version: EXECUTION_AUTHORIZATION_SCHEMA_VERSION,
    authorization_id:
      input.authorization_id ??
      `eau-${now.slice(0, 10).replace(/-/g, "")}-${randomUUID().slice(0, 8)}`,
    mission_id: input.mission_id,
    activation_id: input.activation_id ?? null,
    founder: EXECUTION_AUTHORIZATION_FOUNDER,
    requested_at,
    authorized_at: input.authorized_at ?? null,
    reason: input.reason,
    scope: input.scope ?? "mission",
    status: input.status ?? "CREATED",
    outcome: input.outcome ?? null,
    checksums: {
      authorization_checksum: "",
      request_checksum: input.request_checksum ?? null,
      decision_checksum: input.decision_checksum ?? null,
      certificate_checksum: input.certificate_checksum ?? null,
    },
    version: input.version ?? "1.0.0",
    safety_flags: { ...EXECUTION_AUTHORIZATION_SAFETY_FLAGS },
    execution_enabled: false,
    live_enabled: false,
    overrides_activation_gate: false,
    created_at: input.created_at ?? now,
    updated_at: now,
    next_safe_action:
      "Review Execution Authorization · intent only · execution remains disabled",
    notes: input.notes ?? authorizationPolicyNotes(),
    fixture: input.fixture,
  };
  draft.checksums.authorization_checksum = computeAuthorizationChecksum(draft);
  return draft;
}

export type RecordAuthorizationInput = {
  mission_id: string;
  activation_id?: string | null;
  controller_id?: string | null;
  reason: string;
  scope?: ExecutionAuthorizationScope;
  decision: "AUTHORIZED" | "REJECTED";
  decision_reason?: string;
  fixture?: boolean;
  notes?: string[];
};

export class ExecutionAuthorization {
  readonly repository: ExecutionAuthorizationRepository;
  readonly reporter: ExecutionAuthorizationReporter;
  readonly root: string;
  private seeded = false;

  constructor(repoRoot?: string, opts?: { fixture?: boolean }) {
    this.root = repoRoot ?? resolveRepoRoot();
    this.repository = new ExecutionAuthorizationRepository(this.root, opts);
    this.reporter = new ExecutionAuthorizationReporter();
  }

  /**
   * Record founder authorization intent. Does not enable execution.
   * Does not override Activation Gate.
   */
  recordIntent(input: RecordAuthorizationInput): {
    ok: boolean;
    authorization?: ExecutionAuthorizationContract;
    certificate?: ExecutionAuthorizationCertificateContract;
    error?: string;
  } {
    if (process.env.SOS_AIOS_LIVE === "1") {
      return { ok: false, error: "LIVE must be OFF" };
    }
    assertAuthorizationDoesNotEnableExecution();
    if (!input.mission_id?.trim()) {
      return { ok: false, error: "mission_id required" };
    }

    const request = createExecutionAuthorizationRequest({
      mission_id: input.mission_id,
      activation_id: input.activation_id ?? "activation-ref-placeholder",
      controller_id: input.controller_id ?? "execution-controller-ref",
      reason: input.reason,
      scope: input.scope ?? "mission",
      fixture: input.fixture ?? this.repository.fixture,
    });

    const authorization = createExecutionAuthorizationRecord({
      mission_id: input.mission_id,
      activation_id: request.activation_id,
      reason: input.reason,
      scope: request.scope,
      status: "WAITING_FOUNDER",
      requested_at: request.requested_at,
      request_checksum: request.request_checksum,
      fixture: request.fixture,
      notes: [
        ...(input.notes ?? []),
        ...authorizationPolicyNotes(),
        `founder=${EXECUTION_AUTHORIZATION_FOUNDER}`,
      ],
    });

    const reg = this.repository.register(authorization);
    if (!reg.ok) return { ok: false, error: reg.error };
    this.repository.registerRequest(request);

    const decision = createExecutionAuthorizationDecision({
      authorization_id: authorization.authorization_id,
      mission_id: authorization.mission_id,
      decision: input.decision,
      reason: input.decision_reason ?? input.reason,
      fixture: authorization.fixture,
    });
    this.repository.registerDecision(decision);

    const outcome = input.decision;
    const advanced = this.repository.applyDecision(
      authorization.authorization_id,
      outcome,
      decision.decision_checksum,
      outcome === "AUTHORIZED" ? decision.decided_at : null,
    );
    if (!advanced.ok) return { ok: false, error: advanced.error };

    const certificate = createExecutionAuthorizationCertificate({
      authorization_id: authorization.authorization_id,
      mission_id: authorization.mission_id,
      activation_reference: authorization.activation_id,
      status: outcome,
      authorization_checksum:
        advanced.record!.checksums.authorization_checksum,
      fixture: authorization.fixture,
    });
    const cr = this.repository.registerCertificate(certificate);
    if (!cr.ok) return { ok: false, error: cr.error };

    this.repository.advance(authorization.authorization_id, "STOP");
    const frozen = this.repository.find(authorization.authorization_id)!;

    this.reporter.writeMarkdown(this.repository);
    return { ok: true, authorization: frozen, certificate };
  }

  ensureBootstrapped(): void {
    if (this.seeded) return;
    this.repository.loadPersisted();
    if (this.repository.listAuthorizations().length === 0) {
      this.recordIntent({
        mission_id: "mission-placeholder",
        activation_id: "activation-ref-placeholder",
        reason: "Bootstrap seed — founder intent scaffold (not execution)",
        decision: "REJECTED",
        decision_reason: "Scaffold default — authorization withheld",
        fixture: this.repository.fixture,
      });
    } else {
      this.repository.persist();
    }
    this.seeded = true;
  }

  list(): ExecutionAuthorizationSummary[] {
    this.ensureBootstrapped();
    return this.repository.listAuthorizations();
  }

  loadByMission(missionId: string): ExecutionAuthorizationContract | null {
    this.ensureBootstrapped();
    return this.repository.findByMission(missionId);
  }

  loadCertificateByMission(
    missionId: string,
  ): ExecutionAuthorizationCertificateContract | null {
    this.ensureBootstrapped();
    return this.repository.findCertificateByMission(missionId);
  }
}

export function createExecutionAuthorization(
  repoRoot?: string,
  opts?: { fixture?: boolean },
): ExecutionAuthorization {
  return new ExecutionAuthorization(repoRoot, opts);
}
