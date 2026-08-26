/**
 * TelemetryTimeline — ordered event metadata (Agent #183).
 */
import { randomUUID } from "node:crypto";
import { sha256Canonical } from "../checksums/index.js";
import type {
  TelemetryEventKind,
  TelemetryTimelineContract,
} from "./TelemetryTypes.js";

export function computeTimelineChecksum(
  record: Omit<TelemetryTimelineContract, "timeline_checksum"> & {
    timeline_checksum: string;
  },
): string {
  const { timeline_checksum: _t, ...rest } = record;
  return sha256Canonical(rest);
}

export function createTelemetryTimeline(input: {
  telemetry_session_id: string;
  ordered_event_kinds?: TelemetryEventKind[];
  timestamps?: Record<string, string | null>;
  dependencies?: string[];
  parent_timeline_id?: string | null;
  child_timeline_ids?: string[];
  notes?: string[];
  fixture?: boolean;
  timeline_id?: string;
  created_at?: string;
}): TelemetryTimelineContract {
  const now = new Date().toISOString();
  const draft: TelemetryTimelineContract = {
    timeline_id:
      input.timeline_id ??
      `tlt-${now.slice(0, 10).replace(/-/g, "")}-${randomUUID().slice(0, 8)}`,
    telemetry_session_id: input.telemetry_session_id,
    ordered_event_kinds: input.ordered_event_kinds ?? [
      "MISSION_CREATED",
      "MISSION_APPROVED",
      "PACKAGE_ACKNOWLEDGED",
      "QUEUE_READY",
      "RUNTIME_PLAN_READY",
      "SYSTEM_READY",
      "EXECUTION_CONTROLLER_READY",
      "WORKER_ASSIGNED",
      "WORKER_READY",
    ],
    timestamps: input.timestamps ?? {},
    dependencies: input.dependencies ?? [],
    parent_timeline_id: input.parent_timeline_id ?? null,
    child_timeline_ids: input.child_timeline_ids ?? [],
    timeline_checksum: "",
    activated: false,
    created_at: input.created_at ?? now,
    notes: input.notes ?? ["Timeline metadata only — no events emitted"],
    fixture: Boolean(input.fixture),
  };
  return {
    ...draft,
    timeline_checksum: computeTimelineChecksum(draft),
  };
}

export class TelemetryTimeline {
  readonly contract: TelemetryTimelineContract;

  constructor(contract: TelemetryTimelineContract) {
    this.contract = contract;
  }

  get id(): string {
    return this.contract.timeline_id;
  }

  isActivated(): false {
    return false;
  }
}
