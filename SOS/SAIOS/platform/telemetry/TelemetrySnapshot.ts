/**
 * TelemetrySnapshot — session health placeholder (Agent #183).
 */
import { randomUUID } from "node:crypto";
import type {
  TelemetryLifecycleStatus,
  TelemetrySnapshotContract,
} from "./TelemetryTypes.js";

export function createTelemetrySnapshot(input: {
  session_id: string;
  health?: TelemetrySnapshotContract["health"];
  progress_pct?: number | null;
  status?: TelemetryLifecycleStatus | "EMPTY";
  warnings?: string[];
  notes?: string[];
  fixture?: boolean;
  snapshot_id?: string;
  created_at?: string;
}): TelemetrySnapshotContract {
  const now = new Date().toISOString();
  return {
    snapshot_id:
      input.snapshot_id ??
      `tls-${now.slice(0, 10).replace(/-/g, "")}-${randomUUID().slice(0, 8)}`,
    session_id: input.session_id,
    health: input.health ?? "declared",
    progress_pct: input.progress_pct ?? null,
    status: input.status ?? "CREATED",
    warnings: input.warnings ?? [
      "No telemetry collected",
      "No events emitted",
    ],
    collected: false,
    created_at: input.created_at ?? now,
    notes: input.notes ?? ["Snapshot metadata only — Agent #183"],
    fixture: Boolean(input.fixture),
  };
}

export class TelemetrySnapshot {
  readonly contract: TelemetrySnapshotContract;

  constructor(contract: TelemetrySnapshotContract) {
    this.contract = contract;
  }

  get id(): string {
    return this.contract.snapshot_id;
  }

  isCollected(): false {
    return false;
  }
}
