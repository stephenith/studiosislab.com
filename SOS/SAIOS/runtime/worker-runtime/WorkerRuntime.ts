/**
 * WorkerRuntime — immutable worker-runtime-1.0.0 contract (Agent #182).
 * WorkerRuntimeSystem: catalog/facade (references only; no XC/SDK/ledger writes).
 */
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { sha256Canonical } from "../../platform/checksums/index.js";
import type {
  WorkerDependencyEdge,
  WorkerRuntimeContract,
  WorkerRuntimeLifecycleStatus,
} from "./WorkerRuntimeTypes.js";
import {
  WORKER_RUNTIME_SAFETY_FLAGS,
  WORKER_RUNTIME_SCHEMA_VERSION,
} from "./WorkerRuntimeTypes.js";
import { WorkerRuntimeRepository } from "./WorkerRuntimeRepository.js";
import { WorkerRuntimeReporter } from "./WorkerRuntimeReporter.js";
import { createWorkerAssignment } from "./WorkerAssignment.js";
import { createWorkerSession } from "./WorkerSession.js";
import { createWorkerExecutionPlan } from "./WorkerExecutionPlan.js";
import { createWorkerCapabilityMap } from "./WorkerCapabilityMap.js";
import { createWorkerDependencyResolver } from "./WorkerDependencyResolver.js";

export function computeWorkerRuntimeChecksum(
  record: Omit<WorkerRuntimeContract, "checksums"> & {
    checksums: {
      runtime_checksum: string;
      assignment_checksum: string | null;
      session_checksum: string | null;
      cost_session_ref: string | null;
      controller_ref: string | null;
    };
  },
): string {
  const { checksums: _c, ...rest } = record;
  return sha256Canonical({
    ...rest,
    checksums: {
      assignment_checksum: record.checksums.assignment_checksum,
      session_checksum: record.checksums.session_checksum,
      cost_session_ref: record.checksums.cost_session_ref,
      controller_ref: record.checksums.controller_ref,
    },
  });
}

export function createWorkerRuntime(input: {
  worker_id: string;
  department_id: string;
  mission_id: string;
  execution_controller_id?: string | null;
  worker_type?: string;
  capabilities?: string[];
  dependencies?: WorkerDependencyEdge[];
  estimated_cost?: number | null;
  estimated_duration_ms?: number | null;
  telemetry_reference?: string | null;
  cost_session_reference?: string | null;
  status?: WorkerRuntimeLifecycleStatus;
  assignment_checksum?: string | null;
  session_checksum?: string | null;
  version?: string;
  notes?: string[];
  fixture?: boolean;
  worker_runtime_id?: string;
  created_at?: string;
}): WorkerRuntimeContract {
  const now = new Date().toISOString();
  const draft: WorkerRuntimeContract = {
    schema_version: WORKER_RUNTIME_SCHEMA_VERSION,
    worker_runtime_id:
      input.worker_runtime_id ??
      `wr-${now.slice(0, 10).replace(/-/g, "")}-${randomUUID().slice(0, 8)}`,
    worker_id: input.worker_id,
    department_id: input.department_id,
    mission_id: input.mission_id,
    execution_controller_id: input.execution_controller_id ?? null,
    worker_type: input.worker_type ?? "generic",
    capabilities: input.capabilities ?? [],
    dependencies: input.dependencies ?? [],
    estimated_cost: input.estimated_cost ?? null,
    estimated_duration_ms: input.estimated_duration_ms ?? null,
    telemetry_reference: input.telemetry_reference ?? null,
    cost_session_reference: input.cost_session_reference ?? null,
    status: input.status ?? "REGISTERED",
    checksums: {
      runtime_checksum: "",
      assignment_checksum: input.assignment_checksum ?? null,
      session_checksum: input.session_checksum ?? null,
      cost_session_ref: input.cost_session_reference ?? null,
      controller_ref: input.execution_controller_id ?? null,
    },
    version: input.version ?? "1.0.0",
    safety_flags: WORKER_RUNTIME_SAFETY_FLAGS,
    created_at: input.created_at ?? now,
    updated_at: now,
    next_safe_action:
      "Worker runtime contracts only · spawn disabled · execution remains impossible · LIVE OFF",
    notes: input.notes ?? [
      "References Execution Controller / Department SDK / Cost Ledger — not wired (Agent #182)",
    ],
    fixture: Boolean(input.fixture),
  };
  return {
    ...draft,
    checksums: {
      ...draft.checksums,
      runtime_checksum: computeWorkerRuntimeChecksum(draft),
    },
  };
}

export class WorkerRuntime {
  readonly contract: WorkerRuntimeContract;

  constructor(contract: WorkerRuntimeContract) {
    this.contract = contract;
  }

  get id(): string {
    return this.contract.worker_runtime_id;
  }

  withStatus(status: WorkerRuntimeLifecycleStatus): WorkerRuntime {
    return new WorkerRuntime(
      createWorkerRuntime({
        worker_runtime_id: this.contract.worker_runtime_id,
        created_at: this.contract.created_at,
        worker_id: this.contract.worker_id,
        department_id: this.contract.department_id,
        mission_id: this.contract.mission_id,
        execution_controller_id: this.contract.execution_controller_id,
        worker_type: this.contract.worker_type,
        capabilities: this.contract.capabilities,
        dependencies: this.contract.dependencies,
        estimated_cost: this.contract.estimated_cost,
        estimated_duration_ms: this.contract.estimated_duration_ms,
        telemetry_reference: this.contract.telemetry_reference,
        cost_session_reference: this.contract.cost_session_reference,
        status,
        assignment_checksum: this.contract.checksums.assignment_checksum,
        session_checksum: this.contract.checksums.session_checksum,
        version: this.contract.version,
        notes: this.contract.notes,
        fixture: this.contract.fixture,
      }),
    );
  }

  canSpawn(): false {
    return false;
  }

  canExecute(): false {
    return false;
  }
}

function resolveRepoRoot(fromDir = import.meta.dirname): string {
  return resolve(fromDir, "../../../..");
}

export class WorkerRuntimeSystem {
  readonly repository: WorkerRuntimeRepository;
  readonly reporter: WorkerRuntimeReporter;
  readonly capabilities = createWorkerCapabilityMap();
  readonly dependencies = createWorkerDependencyResolver();
  readonly root: string;
  private seeded = false;

  constructor(repoRoot?: string, opts?: { fixture?: boolean }) {
    this.root = repoRoot ?? resolveRepoRoot();
    this.repository = new WorkerRuntimeRepository(this.root, opts);
    this.reporter = new WorkerRuntimeReporter();
  }

  bootstrapCatalog(): { ok: boolean; registered: string[]; errors: string[] } {
    if (process.env.SOS_AIOS_LIVE === "1") {
      return { ok: false, registered: [], errors: ["LIVE must be OFF"] };
    }
    this.repository.loadPersisted();
    const registered: string[] = [];
    const errors: string[] = [];

    if (this.repository.listRuntimes().length === 0) {
      const assignment = createWorkerAssignment({
        worker_id: "resume.worker.production",
        department_id: "resume",
        mission_id: "mission-placeholder",
        director_id: "resume.director",
        manager_id: "resume.manager.production",
        priority: "normal",
        dependency_order: 0,
        retry_policy_reference: "cost-ledger.retry_policy",
        rollback_reference: "execution-controller.rollback",
        fixture: this.repository.fixture,
        notes: [
          "Reference Department SDK resume worker — not migrated",
          "Metadata only — Agent #182",
        ],
      });
      const ar = this.repository.registerAssignment(assignment);
      if (!ar.ok && ar.error) errors.push(ar.error);
      else registered.push(assignment.assignment_id);

      const runtime = createWorkerRuntime({
        worker_id: "resume.worker.production",
        department_id: "resume",
        mission_id: "mission-placeholder",
        execution_controller_id: "execution-controller-ref",
        worker_type: "production",
        capabilities: ["render", "packaging", "planning"],
        dependencies: [
          {
            kind: "parallel",
            worker_id: "resume.worker.visual-render",
            note: "May run in parallel (metadata)",
          },
          {
            kind: "blocking",
            worker_id: "resume.worker.qa",
            note: "QA blocks release (metadata)",
          },
        ],
        estimated_cost: null,
        estimated_duration_ms: null,
        telemetry_reference: "telemetry-ref-placeholder",
        cost_session_reference: "cost-session-ref-placeholder",
        status: "REGISTERED",
        assignment_checksum: assignment.assignment_checksum,
        fixture: this.repository.fixture,
      });
      const rr = this.repository.registerRuntime(runtime);
      if (!rr.ok && rr.error) errors.push(rr.error);
      else registered.push(runtime.worker_runtime_id);

      const session = createWorkerSession({
        department_id: "resume",
        worker_id: "resume.worker.production",
        mission_id: "mission-placeholder",
        assignment_id: assignment.assignment_id,
        runtime_plan_id: "runtime-plan-ref",
        runtime_release_id: "runtime-release-ref",
        system_readiness_id: "system-readiness-ref",
        execution_controller_id: "execution-controller-ref",
        worker_runtime_id: runtime.worker_runtime_id,
        fixture: this.repository.fixture,
      });
      const sr = this.repository.registerSession(session);
      if (!sr.ok && sr.error) errors.push(sr.error);
      else registered.push(session.session_id);

      const qa = createWorkerRuntime({
        worker_id: "resume.worker.qa",
        department_id: "resume",
        mission_id: "mission-placeholder",
        execution_controller_id: "execution-controller-ref",
        worker_type: "qa",
        capabilities: ["critique", "evaluation"],
        dependencies: [
          {
            kind: "parent",
            worker_id: "resume.worker.production",
            note: "Depends on production (metadata)",
          },
        ],
        telemetry_reference: "telemetry-ref-qa",
        cost_session_reference: "cost-session-ref-placeholder",
        status: "REGISTERED",
        fixture: this.repository.fixture,
      });
      const qr = this.repository.registerRuntime(qa);
      if (!qr.ok && qr.error) errors.push(qr.error);
      else registered.push(qa.worker_runtime_id);
    }

    createWorkerExecutionPlan({
      worker_runtime_ids: this.repository
        .listRuntimes()
        .map((r) => r.worker_runtime_id),
      topological_order: this.repository.listRuntimes().map((r) => r.worker_id),
    });

    this.reporter.writeMarkdown(this.repository);
    this.seeded = true;
    return { ok: errors.length === 0, registered, errors };
  }

  ensureBootstrapped(): void {
    if (this.seeded) return;
    this.repository.loadPersisted();
    if (this.repository.listRuntimes().length === 0) {
      this.bootstrapCatalog();
    } else {
      this.seeded = true;
      this.repository.persist();
    }
  }
}

export function createWorkerRuntimeSystem(
  repoRoot?: string,
  opts?: { fixture?: boolean },
): WorkerRuntimeSystem {
  return new WorkerRuntimeSystem(repoRoot, opts);
}
