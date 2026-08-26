/**
 * Append-only release audit log.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { ReleaseAuditEvent } from "./types.js";

const REPO = resolve(import.meta.dirname, "../../../..");
export const RELEASE_AUDIT_PATH = join(
  REPO,
  "SOS/07_LOGS/saios/export/release-audit.jsonl",
);

export function appendReleaseAudit(event: Omit<ReleaseAuditEvent, "at"> & { at?: string }): void {
  mkdirSync(dirname(RELEASE_AUDIT_PATH), { recursive: true });
  const full: ReleaseAuditEvent = {
    at: event.at ?? new Date().toISOString(),
    type: event.type,
    export_package_id: event.export_package_id,
    catalogue_id: event.catalogue_id,
    reservation_id: event.reservation_id,
    release_id: event.release_id,
    authorization_id: event.authorization_id,
    actor: event.actor,
    detail: event.detail,
    ok: event.ok,
  };
  appendFileSync(RELEASE_AUDIT_PATH, `${JSON.stringify(full)}\n`, "utf8");
}

export function readReleaseAudit(): ReleaseAuditEvent[] {
  if (!existsSync(RELEASE_AUDIT_PATH)) return [];
  return readFileSync(RELEASE_AUDIT_PATH, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l) as ReleaseAuditEvent);
}
