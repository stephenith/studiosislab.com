/**
 * Append-only staging audit events — Agent #242.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import type {
  StagingAuditEvent,
  StagingAuditEventType,
  TemplateLifecycleStatus,
} from "./types.js";

const REPO = resolve(import.meta.dirname, "../../../..");
export const STAGING_AUDIT_PATH = join(
  REPO,
  "SOS/07_LOGS/saios/staging/audit/events.jsonl",
);

export function appendStagingAuditEvent(input: {
  type: StagingAuditEventType;
  actor?: string;
  candidate_id: string;
  generation_id?: string | null;
  previous_status?: TemplateLifecycleStatus | null;
  new_status?: TemplateLifecycleStatus | null;
  decision_id?: string | null;
  staging_package_id?: string | null;
  reason: string;
  evidence_paths?: string[];
}): StagingAuditEvent {
  mkdirSync(join(REPO, "SOS/07_LOGS/saios/staging/audit"), { recursive: true });
  const event: StagingAuditEvent = {
    event_id: `sev-${randomUUID().slice(0, 12)}`,
    type: input.type,
    timestamp: new Date().toISOString(),
    actor: input.actor ?? "founder",
    candidate_id: input.candidate_id,
    generation_id: input.generation_id ?? null,
    previous_status: input.previous_status ?? null,
    new_status: input.new_status ?? null,
    decision_id: input.decision_id ?? null,
    staging_package_id: input.staging_package_id ?? null,
    reason: input.reason,
    evidence_paths: input.evidence_paths ?? [],
    publication_allowed: false,
  };
  writeFileSync(STAGING_AUDIT_PATH, `${JSON.stringify(event)}\n`, {
    flag: "a",
  });
  return event;
}
