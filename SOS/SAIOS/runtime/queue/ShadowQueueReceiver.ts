/**
 * ShadowQueueReceiver — receives immutable submissions into Shadow Queue (Agent #168).
 * Never dispatches, executes, schedules, or publishes.
 * Does not modify the existing execution queue.
 */
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { MissionRegistry } from "../../core/company-brain/MissionRegistry.js";
import { QueueSubmissionRepository } from "../../core/company-brain/QueueSubmissionRepository.js";
import { canTransition } from "../../core/company-brain/MissionValidator.js";
import type { MissionContract } from "../../core/company-brain/mission-types.js";
import { ShadowQueueRepository } from "./ShadowQueueRepository.js";
import { ShadowQueueReporter } from "./ShadowQueueReporter.js";
import { validateShadowReceiveInput } from "./ShadowQueueValidator.js";
import type {
  ShadowQueueHealth,
  ShadowQueueReceiveInput,
  ShadowQueueReceiveResult,
  ShadowQueueRecord,
  ShadowQueueSnapshot,
} from "./shadow-queue-types.js";
import {
  SHADOW_QUEUE_FOUNDER_ACTOR,
  SHADOW_QUEUE_SCHEMA_VERSION,
} from "./shadow-queue-types.js";

function resolveRepoRoot(fromDir = import.meta.dirname): string {
  return resolve(fromDir, "../../../..");
}

export class ShadowQueueReceiver {
  readonly registry: MissionRegistry;
  readonly reporter: ShadowQueueReporter;
  readonly root: string;

  constructor(repoRoot?: string) {
    this.root = repoRoot ?? resolveRepoRoot();
    this.registry = new MissionRegistry(this.root);
    this.reporter = new ShadowQueueReporter();
  }

  private repo(fixture?: boolean): ShadowQueueRepository {
    return new ShadowQueueRepository(this.root, {
      fixture: Boolean(fixture),
    });
  }

  private submissionStore(fixture?: boolean): QueueSubmissionRepository {
    return new QueueSubmissionRepository(this.root, {
      fixture: Boolean(fixture),
    });
  }

  getForMission(
    missionId: string,
    fixture?: boolean,
  ): ShadowQueueRecord | null {
    const fromFixture = this.repo(true).getForMission(missionId);
    if (fixture) return fromFixture;
    return this.repo(false).getForMission(missionId) ?? fromFixture;
  }

  /**
   * QUEUE_SUBMISSION_READY → accept into Shadow Queue → SHADOW_QUEUE_RECEIVED → STOP.
   */
  receive(input: ShadowQueueReceiveInput): ShadowQueueReceiveResult {
    if (process.env.SOS_AIOS_LIVE === "1") {
      return fail("LIVE must be OFF", "LIVE_ON");
    }

    const fixture = Boolean(input.fixture);
    const store = this.repo(fixture);
    const mission = this.registry.get(input.mission_id);
    const submission =
      this.submissionStore(fixture).get(input.submission_id) ??
      this.submissionStore(fixture).getForMission(input.mission_id);

    const already =
      submission != null &&
      store.hasReceivedSubmission(
        input.mission_id,
        submission.submission_id,
        submission.submission_checksum,
      );

    if (already) {
      const existing = store.getForMission(input.mission_id);
      return {
        ok: true,
        record: existing,
        mission_status: mission?.status ?? "SHADOW_QUEUE_RECEIVED",
        next_safe_action:
          existing?.next_safe_action ??
          "Shadow queue already holds this package · STOP — do not dispatch",
        duplicate: true,
      };
    }

    const validation = validateShadowReceiveInput(input, mission, submission, {
      already_received: already,
    });
    if (!validation.ok) {
      const first = validation.errors[0]!;
      store.appendEvent({
        event_id: `sqevt-${randomUUID().slice(0, 8)}`,
        event_type: "SHADOW_REJECTED",
        at: new Date().toISOString(),
        mission_id: input.mission_id,
        shadow_queue_id: null,
        submission_id: input.submission_id,
        summary: first.message,
        fixture,
      });
      return {
        ok: false,
        record: null,
        mission_status: mission?.status ?? null,
        next_safe_action: null,
        error: first.message,
        error_code: first.code,
        duplicate: first.code === "DUPLICATE_SHADOW_RECORD",
      };
    }

    const now = new Date().toISOString();
    const record: ShadowQueueRecord = {
      schema_version: SHADOW_QUEUE_SCHEMA_VERSION,
      shadow_queue_id: `shq-${now.slice(0, 10).replace(/-/g, "")}-${randomUUID().slice(0, 8)}`,
      submission_id: submission!.submission_id,
      mission_id: mission!.mission_id,
      mission_version: mission!.mission_version,
      execution_package_id: submission!.execution_package_id,
      execution_package_checksum: submission!.execution_package_checksum,
      acknowledgement_id: submission!.acknowledgement_id,
      acknowledgement_checksum: submission!.acknowledgement_checksum,
      submission_checksum: submission!.submission_checksum,
      department: submission!.department,
      priority: submission!.priority,
      received_timestamp: now,
      status: "SHADOW_QUEUE_RECEIVED",
      validation_summary:
        "Submission READY · checksums matched · accepted into Shadow Queue only",
      warnings: [
        "Shadow Queue only — never consumed",
        "dispatch_allowed=false",
        "execution_allowed=false",
        "publishing_allowed=false",
        "LIVE OFF",
        ...(submission!.warnings ?? []),
      ],
      shadow: true,
      dispatch_allowed: false,
      execution_allowed: false,
      publishing_allowed: false,
      never_consumed: true,
      never_dispatched: true,
      never_scheduled: true,
      next_safe_action:
        "Inspect Shadow Queue record · STOP — do not dispatch or execute",
      fixture: fixture || undefined,
    };

    store.save(record);
    store.appendEvent({
      event_id: `sqevt-${randomUUID().slice(0, 8)}`,
      event_type: "VALIDATION_PASSED",
      at: now,
      mission_id: record.mission_id,
      shadow_queue_id: record.shadow_queue_id,
      submission_id: record.submission_id,
      summary: record.validation_summary,
      fixture,
    });
    store.appendEvent({
      event_id: `sqevt-${randomUUID().slice(0, 8)}`,
      event_type: "SHADOW_RECEIVED",
      at: now,
      mission_id: record.mission_id,
      shadow_queue_id: record.shadow_queue_id,
      submission_id: record.submission_id,
      summary: `Received ${record.shadow_queue_id} into Shadow Queue`,
      fixture,
    });

    if (!canTransition(mission!.status, "SHADOW_QUEUE_RECEIVED")) {
      return fail(
        `Invalid transition ${mission!.status} → SHADOW_QUEUE_RECEIVED`,
        "INVALID_LIFECYCLE_TRANSITION",
        mission!.status,
      );
    }

    const from = mission!.status;
    const updated = this.applyStatus(mission!, "SHADOW_QUEUE_RECEIVED", fixture);
    store.appendHistory({
      at: now,
      mission_id: updated.mission_id,
      mission_version: updated.mission_version,
      shadow_queue_id: record.shadow_queue_id,
      submission_id: record.submission_id,
      from_status: from,
      to_status: "SHADOW_QUEUE_RECEIVED",
      actor: input.actor || SHADOW_QUEUE_FOUNDER_ACTOR,
      note:
        String(input.reason ?? "").trim() ||
        "Accepted into Shadow Queue — runtime execution queue untouched",
      fixture,
    });
    store.appendEvent({
      event_id: `sqevt-${randomUUID().slice(0, 8)}`,
      event_type: "MISSION_STATUS_UPDATED",
      at: now,
      mission_id: updated.mission_id,
      shadow_queue_id: record.shadow_queue_id,
      submission_id: record.submission_id,
      summary: `${from} → SHADOW_QUEUE_RECEIVED`,
      fixture,
    });

    this.refreshSnapshots(fixture);
    this.reporter.writeMarkdown(store);

    if (
      record.dispatch_allowed !== false ||
      record.execution_allowed !== false ||
      record.publishing_allowed !== false ||
      updated.execution_allowed !== false
    ) {
      throw new Error("Safety invariant violated");
    }

    return {
      ok: true,
      record,
      mission_status: "SHADOW_QUEUE_RECEIVED",
      next_safe_action: record.next_safe_action,
    };
  }

  private applyStatus(
    mission: MissionContract,
    status: "SHADOW_QUEUE_RECEIVED",
    fixture?: boolean,
  ): MissionContract {
    const updated: MissionContract = {
      ...mission,
      status,
      current_stage: status,
      updated_at: new Date().toISOString(),
      execution_allowed: false,
      queue_admission_allowed: false,
      publishing_allowed: false,
      founder_approval_required: true,
      planning_notes: [
        ...mission.planning_notes,
        `Shadow Queue received (Agent #168; never dispatch/execute)`,
      ],
      fixture: fixture ?? mission.fixture,
    };
    this.registry.save(updated, { set_current: !fixture });
    return updated;
  }

  refreshSnapshots(fixture?: boolean): void {
    const repo = this.repo(fixture);
    const records = repo.list();
    const latest = records.length ? records[records.length - 1]! : null;
    const snapshot: ShadowQueueSnapshot = {
      schema_version: "shadow-queue-snapshot-1.0.0",
      updated_at: new Date().toISOString(),
      mission_id: latest?.mission_id ?? null,
      shadow_queue_id: latest?.shadow_queue_id ?? null,
      submission_id: latest?.submission_id ?? null,
      status: latest?.status ?? "EMPTY",
      submission_checksum: latest?.submission_checksum ?? null,
      received_count: records.length,
      shadow: true,
      dispatch_allowed: false,
      execution_allowed: false,
      publishing_allowed: false,
      next_safe_action: latest?.next_safe_action ?? null,
    };
    repo.writeLatest(snapshot);

    const health: ShadowQueueHealth = {
      schema_version: "shadow-queue-health-1.0.0",
      updated_at: new Date().toISOString(),
      received_count: records.length,
      shadow: true,
      dispatch_allowed: false,
      execution_allowed: false,
      publishing_allowed: false,
      live: false,
      mode: "shadow_receive_only",
      status: records.length ? "healthy" : "idle",
    };
    repo.writeHealth(health);
  }
}

function fail(
  error: string,
  error_code: string,
  mission_status: string | null = null,
): ShadowQueueReceiveResult {
  return {
    ok: false,
    record: null,
    mission_status,
    next_safe_action: null,
    error,
    error_code,
  };
}

export function createShadowQueueReceiver(
  repoRoot?: string,
): ShadowQueueReceiver {
  return new ShadowQueueReceiver(repoRoot);
}
