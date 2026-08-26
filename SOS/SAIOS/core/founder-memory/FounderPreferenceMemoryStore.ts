/**
 * Append-only Founder preference memory store.
 */
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { join, resolve } from "node:path";
import {
  CONFIDENCE_RANK,
  FOUNDER_PREFERENCE_MEMORY_SCHEMA,
  type ActiveIndex,
  type FounderMemoryEvent,
  type FounderPreferenceMemoryRecord,
  type MemoryConfidence,
  type MemoryScope,
} from "./FounderPreferenceMemoryTypes.js";

export function founderMemoryDir(repoRoot?: string): string {
  const repo = repoRoot ?? resolve(import.meta.dirname, "../../../..");
  return join(repo, "SOS/07_LOGS/saios/knowledge/founder-memory");
}

function atomicWriteJson(path: string, data: unknown): void {
  const tmp = `${path}.tmp.${process.pid}.${Date.now()}`;
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  renameSync(tmp, path);
}

export function ensureFounderMemoryDirs(repoRoot?: string): string {
  const dir = founderMemoryDir(repoRoot);
  mkdirSync(dir, { recursive: true });
  mkdirSync(join(dir, "snapshots"), { recursive: true });
  mkdirSync(join(dir, "exports"), { recursive: true });
  return dir;
}

export function identityKey(input: {
  scope: MemoryScope;
  scope_target: string | null;
  issue_type: string;
  normalized_rule: string;
  signal_type: string;
  positive_or_negative: string;
}): string {
  const canonical = [
    input.scope,
    (input.scope_target ?? "").toLowerCase().trim(),
    input.issue_type.toUpperCase(),
    input.normalized_rule.toLowerCase().trim(),
    input.signal_type,
    input.positive_or_negative,
  ].join("|");
  return createHash("sha256").update(canonical).digest("hex").slice(0, 24);
}

export function contentHash(
  record: Omit<
    FounderPreferenceMemoryRecord,
    "memory_id" | "content_hash" | "created_at" | "updated_at" | "superseded_by"
  >,
): string {
  const payload = {
    schema_version: record.schema_version,
    scope: record.scope,
    issue_type: record.issue_type,
    normalized_rule: record.normalized_rule,
    signal_type: record.signal_type,
    confidence: record.confidence,
    status: record.status,
    candidate_id: record.candidate_id,
    review_id: record.review_id,
    decision_id: record.decision_id,
    role: record.role,
    category: record.category,
    role_family: record.role_family,
    design_family: record.design_family,
    architecture: record.architecture,
    positive_or_negative: record.positive_or_negative,
    source_decision: record.source_decision,
    acceptance_result: record.acceptance_result,
    active: record.active,
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function scopeTargetValue(
  scope: MemoryScope,
  enrichment: {
    category: string | null;
    role: string | null;
    role_family: string | null;
    design_family: string | null;
    architecture: string | null;
    section: string | null;
    component: string | null;
  },
): string | null {
  switch (scope) {
    case "GLOBAL":
      return "global";
    case "CATEGORY":
      return enrichment.category;
    case "ROLE":
      return enrichment.role;
    case "ROLE_FAMILY":
      return enrichment.role_family;
    case "DESIGN_FAMILY":
      return enrichment.design_family;
    case "ARCHITECTURE":
      return enrichment.architecture;
    case "SECTION":
      return enrichment.section;
    case "COMPONENT":
      return enrichment.component;
  }
}

export function bumpConfidence(c: MemoryConfidence): MemoryConfidence {
  if (c === "low") return "medium";
  if (c === "medium") return "high";
  return "high";
}

export function maxConfidence(
  a: MemoryConfidence,
  b: MemoryConfidence,
): MemoryConfidence {
  return CONFIDENCE_RANK[a] >= CONFIDENCE_RANK[b] ? a : b;
}

function readJsonlTolerant<T>(path: string): T[] {
  if (!existsSync(path)) return [];
  const out: T[] = [];
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line) as T);
    } catch {
      // tolerate malformed rows; never truncate history
    }
  }
  return out;
}

export class FounderPreferenceMemoryStore {
  constructor(private readonly repoRoot?: string) {}

  dir(): string {
    return founderMemoryDir(this.repoRoot);
  }

  private eventsPath(): string {
    return join(this.dir(), "events.jsonl");
  }

  private memoryPath(): string {
    return join(this.dir(), "memory.jsonl");
  }

  private indexPath(): string {
    return join(this.dir(), "active-index.json");
  }

  appendEvent(event: Omit<FounderMemoryEvent, "event_id" | "at"> & {
    event_id?: string;
    at?: string;
  }): void {
    ensureFounderMemoryDirs(this.repoRoot);
    const full: FounderMemoryEvent = {
      event_id: event.event_id ?? `fme-${randomUUID().slice(0, 12)}`,
      at: event.at ?? new Date().toISOString(),
      type: event.type,
      decision_id: event.decision_id,
      review_id: event.review_id,
      memory_id: event.memory_id,
      detail: event.detail,
    };
    appendFileSync(this.eventsPath(), `${JSON.stringify(full)}\n`, "utf8");
  }

  listAll(): FounderPreferenceMemoryRecord[] {
    return readJsonlTolerant<FounderPreferenceMemoryRecord>(this.memoryPath());
  }

  /** Active records — read-only; never creates store files on miss. */
  listActive(): FounderPreferenceMemoryRecord[] {
    const index = this.readActiveIndex();
    if (index) {
      return index.records.filter((r) => r.active);
    }
    return this.deriveActiveFromHistory().filter((r) => r.active);
  }

  /** Derive active view from append-only history without writing. */
  deriveActiveFromHistory(): FounderPreferenceMemoryRecord[] {
    const all = this.listAll();
    const byIdentity = new Map<string, FounderPreferenceMemoryRecord>();
    for (const rec of all) {
      const key = identityKey({
        scope: rec.scope,
        scope_target: scopeTargetValue(rec.scope, rec),
        issue_type: rec.issue_type,
        normalized_rule: rec.normalized_rule,
        signal_type: rec.signal_type,
        positive_or_negative: rec.positive_or_negative,
      });
      const prev = byIdentity.get(key);
      if (!prev) {
        byIdentity.set(key, rec);
        continue;
      }
      const prevT = Date.parse(prev.updated_at) || 0;
      const nextT = Date.parse(rec.updated_at) || 0;
      if (nextT >= prevT) byIdentity.set(key, rec);
    }
    return [...byIdentity.values()].filter((r) => r.active);
  }

  readActiveIndex(): ActiveIndex | null {
    const p = this.indexPath();
    if (!existsSync(p)) return null;
    try {
      return JSON.parse(readFileSync(p, "utf8")) as ActiveIndex;
    } catch {
      return null;
    }
  }

  rebuildActiveIndex(): ActiveIndex {
    const records = this.deriveActiveFromHistory();
    const by_identity: Record<string, string> = {};
    for (const rec of records) {
      const key = identityKey({
        scope: rec.scope,
        scope_target: scopeTargetValue(rec.scope, rec),
        issue_type: rec.issue_type,
        normalized_rule: rec.normalized_rule,
        signal_type: rec.signal_type,
        positive_or_negative: rec.positive_or_negative,
      });
      by_identity[key] = rec.memory_id;
    }
    const index: ActiveIndex = {
      schema_version: FOUNDER_PREFERENCE_MEMORY_SCHEMA,
      generated_at: new Date().toISOString(),
      count: records.length,
      by_identity,
      records,
    };
    ensureFounderMemoryDirs(this.repoRoot);
    atomicWriteJson(this.indexPath(), index);
    return index;
  }

  /**
   * Append a new memory version. If an active identity match exists, supersede it.
   */
  upsertActive(
    draft: Omit<
      FounderPreferenceMemoryRecord,
      "memory_id" | "content_hash" | "created_at" | "updated_at" | "superseded_by" | "schema_version"
    > & {
      memory_id?: string;
      created_at?: string;
      confidence_merge?: boolean;
    },
  ): FounderPreferenceMemoryRecord {
    ensureFounderMemoryDirs(this.repoRoot);
    const now = new Date().toISOString();
    const key = identityKey({
      scope: draft.scope,
      scope_target: scopeTargetValue(draft.scope, draft),
      issue_type: draft.issue_type,
      normalized_rule: draft.normalized_rule,
      signal_type: draft.signal_type,
      positive_or_negative: draft.positive_or_negative,
    });

    const active = this.listActive();
    const existing = active.find(
      (r) =>
        identityKey({
          scope: r.scope,
          scope_target: scopeTargetValue(r.scope, r),
          issue_type: r.issue_type,
          normalized_rule: r.normalized_rule,
          signal_type: r.signal_type,
          positive_or_negative: r.positive_or_negative,
        }) === key,
    );

    let confidence = draft.confidence;
    if (existing && draft.confidence_merge !== false) {
      confidence = maxConfidence(existing.confidence, bumpConfidence(existing.confidence));
      // When recurring identical rule, at least keep max of existing+bumped vs draft
      confidence = maxConfidence(confidence, draft.confidence);
    }

    const memory_id = draft.memory_id ?? `fpm-${randomUUID().slice(0, 12)}`;
    const {
      memory_id: _mid,
      created_at: createdAtOpt,
      confidence_merge: _merge,
      ...fields
    } = draft;
    const base = {
      ...fields,
      schema_version: FOUNDER_PREFERENCE_MEMORY_SCHEMA,
      memory_id,
      confidence,
      created_at: createdAtOpt ?? now,
      updated_at: now,
      superseded_by: null as string | null,
      active: draft.active,
    };
    const record: FounderPreferenceMemoryRecord = {
      ...base,
      content_hash: contentHash(base),
    };

    if (existing && existing.memory_id !== memory_id) {
      const superseded: FounderPreferenceMemoryRecord = {
        ...existing,
        active: false,
        status: "SUPERSEDED",
        superseded_by: memory_id,
        updated_at: now,
        content_hash: contentHash({
          ...existing,
          active: false,
          status: "SUPERSEDED",
        }),
      };
      appendFileSync(this.memoryPath(), `${JSON.stringify(superseded)}\n`, "utf8");
      this.appendEvent({
        type: "MEMORY_SUPERSEDED",
        decision_id: draft.decision_id,
        review_id: draft.review_id,
        memory_id: existing.memory_id,
        detail: `Superseded by ${memory_id} identity=${key}`,
      });
    }

    appendFileSync(this.memoryPath(), `${JSON.stringify(record)}\n`, "utf8");
    this.appendEvent({
      type: draft.status === "CONFIRMED" && existing ? "MEMORY_PROMOTED" : "MEMORY_CREATED",
      decision_id: record.decision_id,
      review_id: record.review_id,
      memory_id: record.memory_id,
      detail: `${record.status}/${record.signal_type}/${record.scope}`,
    });
    this.rebuildActiveIndex();
    return record;
  }

  findActiveByCandidate(candidateId: string): FounderPreferenceMemoryRecord[] {
    return this.listActive().filter((r) => r.candidate_id === candidateId);
  }

  findProvisionalForParent(parentCandidateId: string): FounderPreferenceMemoryRecord[] {
    return this.listActive().filter(
      (r) =>
        r.status === "PROVISIONAL" &&
        r.candidate_id === parentCandidateId &&
        r.active,
    );
  }
}
