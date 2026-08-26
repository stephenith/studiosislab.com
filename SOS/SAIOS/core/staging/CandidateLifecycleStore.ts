/**
 * Per-candidate lifecycle projection for staging — Agent #242.
 * Separate from candidate.json status; never enables publication.
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { CandidateLifecycleRecord, TemplateLifecycleStatus } from "./types.js";

const REPO = resolve(import.meta.dirname, "../../../..");
export const LIFECYCLE_ROOT = join(
  REPO,
  "SOS/07_LOGS/saios/staging/lifecycle",
);

function pathFor(candidateId: string): string {
  return join(LIFECYCLE_ROOT, `${candidateId}.json`);
}

function atomicWriteJson(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  renameSync(tmp, path);
}

export function readLifecycle(
  candidateId: string,
): CandidateLifecycleRecord | null {
  const p = pathFor(candidateId);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8")) as CandidateLifecycleRecord;
}

export function writeLifecycle(record: CandidateLifecycleRecord): void {
  atomicWriteJson(pathFor(record.candidate_id), {
    ...record,
    publication_allowed: false,
    updated_at: new Date().toISOString(),
  });
}

export function upsertLifecycle(
  partial: Omit<CandidateLifecycleRecord, "updated_at" | "publication_allowed"> & {
    publication_allowed?: false;
  },
): CandidateLifecycleRecord {
  const next: CandidateLifecycleRecord = {
    ...partial,
    publication_allowed: false,
    updated_at: new Date().toISOString(),
  };
  writeLifecycle(next);
  return next;
}

export function listApprovedCandidateIds(): string[] {
  if (!existsSync(LIFECYCLE_ROOT)) return [];
  return readdirSync(LIFECYCLE_ROOT)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const rec = JSON.parse(
        readFileSync(join(LIFECYCLE_ROOT, f), "utf8"),
      ) as CandidateLifecycleRecord;
      return rec;
    })
    .filter((r) =>
      ["APPROVED", "STAGING_REQUESTED", "STAGING", "STAGED", "VALIDATED", "STAGING_FAILED"].includes(
        r.lifecycle_status,
      ),
    )
    .map((r) => r.candidate_id);
}

export function statusLabel(status: TemplateLifecycleStatus): string {
  switch (status) {
    case "STAGING_REQUESTED":
      return "Staging Requested";
    case "STAGING":
      return "Staging";
    case "STAGED":
      return "Staged";
    case "STAGING_FAILED":
      return "Validation Failed";
    case "VALIDATED":
      return "Validated";
    case "PUBLISHING":
      return "Publishing";
    case "PUBLICATION_FAILED":
      return "Publication Failed";
    case "PUBLISHED":
      return "Published";
    default:
      return status;
  }
}
