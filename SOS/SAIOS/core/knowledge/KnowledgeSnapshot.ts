/**
 * Minimal Knowledge Snapshot contract — Agent #120.
 */
import type {
  KnowledgeDomain,
  KnowledgeEntry,
  KnowledgeReference,
  KnowledgeRequest,
} from "./KnowledgeEntry.js";

export interface KnowledgeSnapshotMeta {
  snapshot_id: string;
  generated_at: string;
  request_id: string;
  department_id: string;
  purpose: string;
  domains_requested: KnowledgeDomain[];
  entry_count: number;
  references_only: boolean;
  unrestricted: false;
  live: false;
}

export interface KnowledgeSnapshot {
  meta: KnowledgeSnapshotMeta;
  references: KnowledgeReference[];
  /** Omitted or empty when include_references_only=true */
  entries: KnowledgeEntry[];
}

export function buildSnapshotMeta(
  request: KnowledgeRequest,
  entryCount: number,
): KnowledgeSnapshotMeta {
  return {
    snapshot_id: `knsnap-${request.request_id}`,
    generated_at: new Date().toISOString(),
    request_id: request.request_id,
    department_id: request.department_id,
    purpose: request.purpose,
    domains_requested: [...request.domains],
    entry_count: entryCount,
    references_only: Boolean(request.include_references_only),
    unrestricted: false,
    live: false,
  };
}

export function toReference(entry: KnowledgeEntry): KnowledgeReference {
  return {
    entry_id: entry.entry_id,
    domain: entry.domain,
    version: entry.version,
    title: entry.title,
  };
}

export function emptySnapshot(request: KnowledgeRequest): KnowledgeSnapshot {
  return {
    meta: buildSnapshotMeta(request, 0),
    references: [],
    entries: [],
  };
}
