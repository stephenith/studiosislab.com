/**
 * SimulationValidator — Agent #187.
 */
import { rejectForbiddenKeys, sha256Canonical } from "../../platform/checksums/index.js";
import type {
  PreDispatchSimulationCertificate,
  PreDispatchSimulationContract,
  SimulationIntegrityScores,
  SimulationValidationIssue,
  SimulationValidationResult,
} from "./SimulationTypes.js";
import { assertGraphIntegrity } from "./SimulationGraph.js";
import { assertTimelineIntegrity } from "./SimulationTimeline.js";
import { assertWorkerIntegrity } from "./SimulationWorkers.js";
import { assertDepartmentIntegrity } from "./SimulationDepartments.js";
import { assertCostIntegrity } from "./SimulationCost.js";
import { assertTelemetryIntegrity } from "./SimulationTelemetry.js";
import { assertLearningIntegrity } from "./SimulationLearning.js";
import { computeSimulationCertificateChecksum } from "./SimulationCertificate.js";

export const SIMULATION_FORBIDDEN_KEYS = [
  "execute",
  "dispatch",
  "scheduler",
  "enqueue",
  "spawn",
  "provider",
  "publish",
  "enable_live",
  "enable_execution",
  "openai",
  "cursor_sdk",
  "firecrawl",
] as const;

export function computeSimulationChecksum(
  record: Omit<PreDispatchSimulationContract, "simulation_checksum" | "checksums"> & {
    simulation_checksum: string;
    checksums: {
      simulation_checksum: string;
      graph_checksum: string;
      timeline_checksum: string;
      certificate_checksum: string | null;
    };
  },
): string {
  const { simulation_checksum: _s, checksums: _c, ...rest } = record;
  return sha256Canonical({
    ...rest,
    checksums: {
      graph_checksum: record.checksums.graph_checksum,
      timeline_checksum: record.checksums.timeline_checksum,
      certificate_checksum: record.checksums.certificate_checksum,
    },
  });
}

export function rejectForbiddenSimulationPayload(
  payload: Record<string, unknown>,
): SimulationValidationIssue | null {
  return rejectForbiddenKeys(payload, SIMULATION_FORBIDDEN_KEYS, {
    messageForKey: (key) => `Field '${key}' is forbidden on pre-dispatch simulation`,
  });
}

export function scoreSimulation(
  sim: PreDispatchSimulationContract,
): SimulationIntegrityScores {
  const graph_integrity = assertGraphIntegrity(sim.graph_nodes) ? 100 : 0;
  const timeline_integrity = assertTimelineIntegrity(sim.timeline) ? 100 : 0;
  const worker_integrity = assertWorkerIntegrity(sim.worker_allocations)
    ? 100
    : 0;
  const department_integrity = assertDepartmentIntegrity(
    sim.department_allocations,
  )
    ? 100
    : 0;
  const cost_integrity = assertCostIntegrity(sim.estimated_cost) ? 100 : 0;
  const telemetry_integrity = assertTelemetryIntegrity(sim.telemetry_refs)
    ? 100
    : 0;
  const learning_integrity = assertLearningIntegrity(sim.learning_ref)
    ? 100
    : 0;
  const parts = [
    graph_integrity,
    timeline_integrity,
    worker_integrity,
    department_integrity,
    cost_integrity,
    telemetry_integrity,
    learning_integrity,
  ];
  const simulation_score = Math.round(
    parts.reduce((a, b) => a + b, 0) / parts.length,
  );
  const overall_readiness = Math.min(
    simulation_score,
    sim.safety_flags.simulation_only ? simulation_score : 0,
  );
  return {
    simulation_score,
    graph_integrity,
    worker_integrity,
    department_integrity,
    timeline_integrity,
    cost_integrity,
    telemetry_integrity,
    learning_integrity,
    overall_readiness,
  };
}

export function validateSimulation(
  sim: PreDispatchSimulationContract | null,
): SimulationValidationResult {
  const errors: SimulationValidationIssue[] = [];
  if (!sim) {
    return {
      ok: false,
      errors: [{ code: "MISSING", message: "Simulation missing" }],
    };
  }
  const forbidden = rejectForbiddenSimulationPayload(
    sim as unknown as Record<string, unknown>,
  );
  if (forbidden) errors.push(forbidden);

  if (sim.schema_version !== "pre-dispatch-simulation-1.0.0") {
    errors.push({
      code: "BAD_SCHEMA",
      message: "schema must be pre-dispatch-simulation-1.0.0",
      field: "schema_version",
    });
  }
  if (!sim.mission_id?.trim()) {
    errors.push({
      code: "MISSING_MISSION",
      message: "mission_id required",
      field: "mission_id",
    });
  }
  if (!sim.activation_id) {
    errors.push({
      code: "INVALID_ACTIVATION",
      message: "activation_id reference required",
      field: "activation_id",
    });
  }
  if (!sim.authorization_id) {
    errors.push({
      code: "INVALID_AUTHORIZATION",
      message: "authorization_id reference required",
      field: "authorization_id",
    });
  }
  if (!sim.execution_controller_id) {
    errors.push({
      code: "INVALID_CONTROLLER",
      message: "execution_controller_id reference required",
      field: "execution_controller_id",
    });
  }
  if (sim.department_ids.length === 0) {
    errors.push({
      code: "INVALID_DEPARTMENTS",
      message: "at least one department_id required",
      field: "department_ids",
    });
  }
  if (sim.worker_runtime_ids.length === 0) {
    errors.push({
      code: "INVALID_WORKERS",
      message: "at least one worker_runtime_id required",
      field: "worker_runtime_ids",
    });
  }
  if (!assertGraphIntegrity(sim.graph_nodes)) {
    errors.push({ code: "GRAPH_INTEGRITY", message: "graph integrity failed" });
  }
  if (!assertTimelineIntegrity(sim.timeline)) {
    errors.push({
      code: "TIMELINE_INTEGRITY",
      message: "timeline integrity failed",
    });
  }
  if (new Set(sim.department_ids).size !== sim.department_ids.length) {
    errors.push({
      code: "DUPLICATE_IDS",
      message: "duplicate department_ids",
      field: "department_ids",
    });
  }
  if (sim.execution_enabled !== false || sim.live_enabled !== false) {
    errors.push({
      code: "EXECUTION_UNLOCKED",
      message: "execution/live must remain false",
    });
  }
  if (sim.safety_flags.simulation_only !== true) {
    errors.push({
      code: "NOT_SIMULATION",
      message: "simulation_only must be true",
    });
  }
  const expected = computeSimulationChecksum({
    ...sim,
    simulation_checksum: "",
    checksums: { ...sim.checksums, simulation_checksum: "" },
  });
  if (sim.simulation_checksum !== expected) {
    errors.push({
      code: "CHECKSUM_MISMATCH",
      message: "simulation checksum mismatch",
      field: "simulation_checksum",
    });
  }
  return { ok: errors.length === 0, errors };
}

export function validateSimulationCertificate(
  cert: PreDispatchSimulationCertificate | null,
): SimulationValidationResult {
  const errors: SimulationValidationIssue[] = [];
  if (!cert) {
    return {
      ok: false,
      errors: [{ code: "MISSING", message: "Certificate missing" }],
    };
  }
  if (cert.schema_version !== "pre-dispatch-simulation-certificate-1.0.0") {
    errors.push({ code: "BAD_SCHEMA", message: "bad certificate schema" });
  }
  if (cert.execution_permissions !== false) {
    errors.push({
      code: "EXEC_PERMS",
      message: "execution_permissions must be false",
    });
  }
  const expected = computeSimulationCertificateChecksum({
    ...cert,
    certificate_checksum: "",
  });
  if (cert.certificate_checksum !== expected) {
    errors.push({ code: "CHECKSUM_MISMATCH", message: "cert checksum mismatch" });
  }
  return { ok: errors.length === 0, errors };
}
