/**
 * TelemetryCorrelation — link metadata across spine (Agent #183).
 * No runtime linking.
 */
import { randomUUID } from "node:crypto";
import { sha256Canonical } from "../checksums/index.js";
import type { TelemetryCorrelationContract } from "./TelemetryTypes.js";

export function computeCorrelationChecksum(
  record: Omit<TelemetryCorrelationContract, "correlation_checksum"> & {
    correlation_checksum: string;
  },
): string {
  const { correlation_checksum: _c, ...rest } = record;
  return sha256Canonical(rest);
}

export function createTelemetryCorrelation(input: {
  mission_id?: string | null;
  execution_controller_id?: string | null;
  department_id?: string | null;
  worker_runtime_id?: string | null;
  cost_session_id?: string | null;
  runtime_plan_id?: string | null;
  telemetry_session_id?: string | null;
  notes?: string[];
  fixture?: boolean;
  correlation_id?: string;
  created_at?: string;
}): TelemetryCorrelationContract {
  const now = new Date().toISOString();
  const draft: TelemetryCorrelationContract = {
    correlation_id:
      input.correlation_id ??
      `tcr-${now.slice(0, 10).replace(/-/g, "")}-${randomUUID().slice(0, 8)}`,
    mission_id: input.mission_id ?? null,
    execution_controller_id: input.execution_controller_id ?? null,
    department_id: input.department_id ?? null,
    worker_runtime_id: input.worker_runtime_id ?? null,
    cost_session_id: input.cost_session_id ?? null,
    runtime_plan_id: input.runtime_plan_id ?? null,
    telemetry_session_id: input.telemetry_session_id ?? null,
    correlation_checksum: "",
    linked_at_runtime: false,
    created_at: input.created_at ?? now,
    notes: input.notes ?? [
      "Correlation metadata only — no runtime linking (Agent #183)",
    ],
    fixture: Boolean(input.fixture),
  };
  return {
    ...draft,
    correlation_checksum: computeCorrelationChecksum(draft),
  };
}

export class TelemetryCorrelation {
  readonly contract: TelemetryCorrelationContract;

  constructor(contract: TelemetryCorrelationContract) {
    this.contract = contract;
  }

  get id(): string {
    return this.contract.correlation_id;
  }

  isLinkedAtRuntime(): false {
    return false;
  }
}
