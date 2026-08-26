/**
 * ExecutionAuthorization — immutable record factory (Agent #179).
 * Scaffold only. Safety flags always locked false.
 */
import { randomUUID } from "node:crypto";
import { sha256Canonical } from "../../platform/checksums/index.js";
import type {
  ExecutionChecksumChain,
  ExecutionControllerLifecycleStatus,
  ExecutionControllerRecord,
  WorkerInventoryPlaceholder,
} from "./ExecutionControllerTypes.js";
import {
  ARCHITECTURE_VERSION,
  EXECUTION_CONTROLLER_FOUNDER_ACTOR,
  EXECUTION_CONTROLLER_SAFETY_FLAGS_LOCKED,
  EXECUTION_CONTROLLER_SCHEMA_VERSION,
  GOVERNANCE_VERSION,
} from "./ExecutionControllerTypes.js";

export function computeControllerChecksum(
  record: Omit<ExecutionControllerRecord, "checksum_chain"> & {
    checksum_chain: Omit<ExecutionChecksumChain, "controller_checksum">;
  },
): string {
  return sha256Canonical(record);
}

export function createExecutionControllerRecord(input: {
  mission_id: string;
  mission_version: number;
  runtime_plan_id: string;
  runtime_release_id: string;
  system_readiness_id: string;
  department: string;
  controller_status: ExecutionControllerLifecycleStatus;
  checksum_chain: Omit<ExecutionChecksumChain, "controller_checksum">;
  worker_inventory?: WorkerInventoryPlaceholder;
  estimated_cost_usd?: number | null;
  estimated_duration_ms?: number | null;
  next_safe_action: string;
  fixture?: boolean;
  controller_id?: string;
  created_at?: string;
}): ExecutionControllerRecord {
  const now = new Date().toISOString();
  const draft = {
    schema_version: EXECUTION_CONTROLLER_SCHEMA_VERSION,
    controller_id:
      input.controller_id ??
      `xc-${now.slice(0, 10).replace(/-/g, "")}-${randomUUID().slice(0, 8)}`,
    mission_id: input.mission_id,
    mission_version: input.mission_version,
    runtime_plan_id: input.runtime_plan_id,
    runtime_release_id: input.runtime_release_id,
    system_readiness_id: input.system_readiness_id,
    department: input.department,
    architecture_version: ARCHITECTURE_VERSION,
    governance_version: GOVERNANCE_VERSION,
    controller_status: input.controller_status,
    worker_inventory: input.worker_inventory ?? {
      declared: [],
      resolved: [],
      missing: [],
      informational: true as const,
      invoked: false as const,
    },
    estimated_cost_usd: input.estimated_cost_usd ?? null,
    estimated_duration_ms: input.estimated_duration_ms ?? null,
    telemetry: {
      run_id: null,
      work_unit_ids: [],
      metrics: {},
      enabled: false as const,
    },
    rollback: {
      points: [],
      implemented: false as const,
    },
    retry: {
      policy: "exponential_backoff_capped" as const,
      max_attempts: 3,
      implemented: false as const,
    },
    safety_flags: EXECUTION_CONTROLLER_SAFETY_FLAGS_LOCKED,
    founder: EXECUTION_CONTROLLER_FOUNDER_ACTOR,
    created_at: input.created_at ?? now,
    updated_at: now,
    next_safe_action: input.next_safe_action,
    fixture: Boolean(input.fixture),
    checksum_chain: {
      ...input.checksum_chain,
      controller_checksum: "",
    },
  };
  const controller_checksum = computeControllerChecksum(draft);
  return {
    ...draft,
    checksum_chain: {
      ...input.checksum_chain,
      controller_checksum,
    },
  };
}
