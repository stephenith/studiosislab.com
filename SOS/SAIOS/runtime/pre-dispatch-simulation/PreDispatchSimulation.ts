/**
 * PreDispatchSimulation — Agent #187.
 * Builds deterministic simulation metadata. Never executes.
 */
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { SimulationRepository } from "./SimulationRepository.js";
import { SimulationReporter } from "./SimulationReporter.js";
import { buildSimulationGraph } from "./SimulationGraph.js";
import { buildSimulationTimeline } from "./SimulationTimeline.js";
import { buildWorkerAllocations } from "./SimulationWorkers.js";
import { buildDepartmentAllocations } from "./SimulationDepartments.js";
import { buildCostEstimate } from "./SimulationCost.js";
import { buildTelemetryRefs } from "./SimulationTelemetry.js";
import { buildLearningRef } from "./SimulationLearning.js";
import { createSimulationCertificate } from "./SimulationCertificate.js";
import {
  computeSimulationChecksum,
  scoreSimulation,
  validateSimulation,
} from "./SimulationValidator.js";
import type {
  PreDispatchSimulationCertificate,
  PreDispatchSimulationContract,
  SimulationArtifactFlow,
  SimulationSummary,
} from "./SimulationTypes.js";
import {
  PRE_DISPATCH_SIMULATION_SAFETY_FLAGS,
  PRE_DISPATCH_SIMULATION_SCHEMA_VERSION,
} from "./SimulationTypes.js";

function resolveRepoRoot(fromDir = import.meta.dirname): string {
  return resolve(fromDir, "../../../..");
}

export type SimulateInput = {
  mission_id: string;
  activation_id?: string | null;
  authorization_id?: string | null;
  execution_controller_id?: string | null;
  runtime_plan_id?: string | null;
  department_ids?: string[];
  worker_runtime_ids?: string[];
  cost_session_ids?: string[];
  telemetry_session_ids?: string[];
  fixture?: boolean;
  notes?: string[];
};

function buildArtifactFlow(): SimulationArtifactFlow[] {
  return [
    {
      artifact_id: "mission-contract",
      from_node: "mission",
      to_node: "approval",
      kind: "mission",
      produced: false,
    },
    {
      artifact_id: "execution-package",
      from_node: "execution_package",
      to_node: "package_ack",
      kind: "package",
      produced: false,
    },
    {
      artifact_id: "runtime-plan",
      from_node: "runtime_plan",
      to_node: "runtime_release",
      kind: "plan",
      produced: false,
    },
    {
      artifact_id: "activation-certificate",
      from_node: "activation_gate",
      to_node: "execution_authorization",
      kind: "eligibility",
      produced: false,
    },
    {
      artifact_id: "authorization-certificate",
      from_node: "execution_authorization",
      to_node: "execution_controller",
      kind: "intent",
      produced: false,
    },
  ];
}

export function createPreDispatchSimulationRecord(
  input: SimulateInput & {
    simulation_id?: string;
  },
): PreDispatchSimulationContract {
  const now = new Date().toISOString();
  const graph = buildSimulationGraph();
  const timeline = buildSimulationTimeline();
  const department_ids = input.department_ids?.length
    ? input.department_ids
    : ["resume"];
  const worker_runtime_ids = input.worker_runtime_ids?.length
    ? input.worker_runtime_ids
    : ["worker-runtime-ref"];
  const cost_session_ids = input.cost_session_ids?.length
    ? input.cost_session_ids
    : ["cost-session-ref"];
  const telemetry_session_ids = input.telemetry_session_ids?.length
    ? input.telemetry_session_ids
    : ["telemetry-session-ref"];
  const learning = buildLearningRef();
  const workers = buildWorkerAllocations({
    worker_runtime_ids,
    department_id: department_ids[0],
  });
  const departments = buildDepartmentAllocations({ department_ids });
  const cost = buildCostEstimate({
    worker_count: workers.length,
    step_count: timeline.steps.length,
  });
  const telemetry_refs = buildTelemetryRefs({ telemetry_session_ids });

  const draft: PreDispatchSimulationContract = {
    schema_version: PRE_DISPATCH_SIMULATION_SCHEMA_VERSION,
    simulation_id:
      input.simulation_id ??
      `pds-${now.slice(0, 10).replace(/-/g, "")}-${randomUUID().slice(0, 8)}`,
    mission_id: input.mission_id,
    activation_id: input.activation_id ?? "activation-ref-placeholder",
    authorization_id:
      input.authorization_id ?? "authorization-ref-placeholder",
    execution_controller_id:
      input.execution_controller_id ?? "execution-controller-ref",
    runtime_plan_id: input.runtime_plan_id ?? "runtime-plan-ref",
    department_ids,
    worker_runtime_ids,
    cost_session_ids,
    telemetry_session_ids,
    timeline_id: timeline.timeline_id,
    graph_id: graph.graph_id,
    learning_plan_id: learning.learning_plan_id,
    status: "SIMULATION_COMPLETE",
    simulation_checksum: "",
    checksums: {
      simulation_checksum: "",
      graph_checksum: graph.graph_checksum,
      timeline_checksum: timeline.timeline_checksum,
      certificate_checksum: null,
    },
    estimated_duration_ms: timeline.estimated_duration_ms,
    estimated_cost: cost,
    timeline: timeline.steps,
    graph_nodes: graph.nodes,
    dependency_edges: graph.edges,
    worker_allocations: workers,
    department_allocations: departments,
    rollback_plan: {
      rollback_id: `rb-${randomUUID().slice(0, 8)}`,
      steps: [
        "Abort simulated dispatch",
        "Retain governance artifacts",
        "Do not mutate mission state",
      ],
      executable: false,
    },
    retry_plan: {
      retry_id: `rt-${randomUUID().slice(0, 8)}`,
      max_attempts: 0,
      backoff: "none",
      executable: false,
    },
    telemetry_refs,
    learning_ref: learning,
    artifact_flow: buildArtifactFlow(),
    safety_flags: { ...PRE_DISPATCH_SIMULATION_SAFETY_FLAGS },
    execution_enabled: false,
    live_enabled: false,
    created_at: now,
    updated_at: now,
    next_safe_action:
      "Review pre-dispatch simulation · simulation only · execution remains disabled",
    notes: input.notes ?? [
      "Pre-dispatch simulation is metadata only.",
      "No workers spawned. No queue insert. No LIVE.",
    ],
    fixture: input.fixture,
  };
  const checksum = computeSimulationChecksum({
    ...draft,
    simulation_checksum: "",
    checksums: { ...draft.checksums, simulation_checksum: "" },
  });
  draft.simulation_checksum = checksum;
  draft.checksums.simulation_checksum = checksum;
  return draft;
}

export class PreDispatchSimulation {
  readonly repository: SimulationRepository;
  readonly reporter: SimulationReporter;
  readonly root: string;
  private seeded = false;

  constructor(repoRoot?: string, opts?: { fixture?: boolean }) {
    this.root = repoRoot ?? resolveRepoRoot();
    this.repository = new SimulationRepository(this.root, opts);
    this.reporter = new SimulationReporter();
  }

  simulate(input: SimulateInput): {
    ok: boolean;
    simulation?: PreDispatchSimulationContract;
    certificate?: PreDispatchSimulationCertificate;
    error?: string;
  } {
    if (process.env.SOS_AIOS_LIVE === "1") {
      return { ok: false, error: "LIVE must be OFF" };
    }
    if (!input.mission_id?.trim()) {
      return { ok: false, error: "mission_id required" };
    }

    const simulation = createPreDispatchSimulationRecord({
      ...input,
      fixture: input.fixture ?? this.repository.fixture,
    });
    const v = validateSimulation(simulation);
    if (!v.ok) {
      return { ok: false, error: v.errors[0]?.message ?? "invalid simulation" };
    }

    const reg = this.repository.register(simulation);
    if (!reg.ok) return { ok: false, error: reg.error };

    const scores = scoreSimulation(simulation);
    const certificate = createSimulationCertificate({
      simulation_id: simulation.simulation_id,
      mission_id: simulation.mission_id,
      scores,
      fixture: simulation.fixture,
    });
    const cr = this.repository.registerCertificate(certificate);
    if (!cr.ok) return { ok: false, error: cr.error };

    this.reporter.writeMarkdown(this.repository);
    return { ok: true, simulation, certificate };
  }

  ensureBootstrapped(): void {
    if (this.seeded) return;
    this.repository.loadPersisted();
    if (this.repository.listSimulations().length === 0) {
      this.simulate({
        mission_id: "mission-placeholder",
        fixture: this.repository.fixture,
        notes: ["Bootstrap seed — pre-dispatch simulation only"],
      });
    } else {
      this.repository.persist();
    }
    this.seeded = true;
  }

  list(): SimulationSummary[] {
    this.ensureBootstrapped();
    return this.repository.listSimulations();
  }

  loadByMission(missionId: string): PreDispatchSimulationContract | null {
    this.ensureBootstrapped();
    return this.repository.findByMission(missionId);
  }
}

export function createPreDispatchSimulation(
  repoRoot?: string,
  opts?: { fixture?: boolean },
): PreDispatchSimulation {
  return new PreDispatchSimulation(repoRoot, opts);
}
