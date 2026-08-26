/**
 * TelemetrySession — telemetry-session-1.0.0 (Agent #183).
 * No collection.
 */
import { randomUUID } from "node:crypto";
import { sha256Canonical } from "../checksums/index.js";
import type {
  TelemetryLifecycleStatus,
  TelemetrySessionContract,
} from "./TelemetryTypes.js";
import {
  TELEMETRY_SAFETY_FLAGS,
  TELEMETRY_SESSION_SCHEMA_VERSION,
} from "./TelemetryTypes.js";

export function computeTelemetrySessionChecksum(
  record: Omit<TelemetrySessionContract, "checksums"> & {
    checksums: {
      session_checksum: string;
      correlation_checksum: string | null;
      timeline_checksum: string | null;
      controller_ref: string | null;
      worker_runtime_ref: string | null;
      cost_session_ref: string | null;
    };
  },
): string {
  const { checksums: _c, ...rest } = record;
  return sha256Canonical({
    ...rest,
    checksums: {
      correlation_checksum: record.checksums.correlation_checksum,
      timeline_checksum: record.checksums.timeline_checksum,
      controller_ref: record.checksums.controller_ref,
      worker_runtime_ref: record.checksums.worker_runtime_ref,
      cost_session_ref: record.checksums.cost_session_ref,
    },
  });
}

export function createTelemetrySession(input: {
  mission_id: string;
  execution_controller_id?: string | null;
  department_id?: string | null;
  worker_runtime_id?: string | null;
  cost_session_id?: string | null;
  runtime_plan_id?: string | null;
  runtime_release_id?: string | null;
  system_readiness_id?: string | null;
  correlation_id?: string | null;
  timeline_id?: string | null;
  status?: TelemetryLifecycleStatus;
  correlation_checksum?: string | null;
  timeline_checksum?: string | null;
  version?: string;
  notes?: string[];
  fixture?: boolean;
  telemetry_session_id?: string;
  created_at?: string;
}): TelemetrySessionContract {
  const now = new Date().toISOString();
  const draft: TelemetrySessionContract = {
    schema_version: TELEMETRY_SESSION_SCHEMA_VERSION,
    telemetry_session_id:
      input.telemetry_session_id ??
      `tel-${now.slice(0, 10).replace(/-/g, "")}-${randomUUID().slice(0, 8)}`,
    mission_id: input.mission_id,
    execution_controller_id: input.execution_controller_id ?? null,
    department_id: input.department_id ?? null,
    worker_runtime_id: input.worker_runtime_id ?? null,
    cost_session_id: input.cost_session_id ?? null,
    runtime_plan_id: input.runtime_plan_id ?? null,
    runtime_release_id: input.runtime_release_id ?? null,
    system_readiness_id: input.system_readiness_id ?? null,
    correlation_id: input.correlation_id ?? null,
    timeline_id: input.timeline_id ?? null,
    status: input.status ?? "CREATED",
    checksums: {
      session_checksum: "",
      correlation_checksum: input.correlation_checksum ?? null,
      timeline_checksum: input.timeline_checksum ?? null,
      controller_ref: input.execution_controller_id ?? null,
      worker_runtime_ref: input.worker_runtime_id ?? null,
      cost_session_ref: input.cost_session_id ?? null,
    },
    version: input.version ?? "1.0.0",
    collection_enabled: false,
    emission_enabled: false,
    safety_flags: TELEMETRY_SAFETY_FLAGS,
    created_at: input.created_at ?? now,
    updated_at: now,
    next_safe_action:
      "Telemetry contracts only · no collection · no emission · LIVE OFF",
    notes: input.notes ?? [
      "References XC / Worker Runtime / Cost Ledger — not wired (Agent #183)",
    ],
    fixture: Boolean(input.fixture),
  };
  return {
    ...draft,
    checksums: {
      ...draft.checksums,
      session_checksum: computeTelemetrySessionChecksum(draft),
    },
  };
}

export class TelemetrySession {
  readonly contract: TelemetrySessionContract;

  constructor(contract: TelemetrySessionContract) {
    this.contract = contract;
  }

  get id(): string {
    return this.contract.telemetry_session_id;
  }

  withStatus(status: TelemetryLifecycleStatus): TelemetrySession {
    return new TelemetrySession(
      createTelemetrySession({
        ...this.contract,
        status,
        correlation_checksum: this.contract.checksums.correlation_checksum,
        timeline_checksum: this.contract.checksums.timeline_checksum,
        telemetry_session_id: this.contract.telemetry_session_id,
        created_at: this.contract.created_at,
        fixture: this.contract.fixture,
      }),
    );
  }

  canCollect(): false {
    return false;
  }
}
