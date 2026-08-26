/**
 * Immutable generation IDs — GEN-YYYYMMDD-NNNNNN.
 * Agent #242. Never reuse. Backfill without overwrite.
 */
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { GenerationIdRecord } from "./types.js";

const REPO = resolve(import.meta.dirname, "../../../..");
export const GENERATION_ID_ROOT = join(
  REPO,
  "SOS/07_LOGS/saios/staging/generation-ids",
);
const REGISTRY_PATH = join(GENERATION_ID_ROOT, "registry.json");
const SEQ_PATH = join(GENERATION_ID_ROOT, "sequence.json");
const BACKFILL_LOG = join(GENERATION_ID_ROOT, "backfill-audit.jsonl");

type RegistryDoc = {
  schema_version: 1;
  by_candidate: Record<string, GenerationIdRecord>;
  by_generation: Record<string, string>;
};

type SeqDoc = { day: string; next: number };

function atomicWriteJson(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  renameSync(tmp, path);
}

function loadRegistry(): RegistryDoc {
  if (!existsSync(REGISTRY_PATH)) {
    return { schema_version: 1, by_candidate: {}, by_generation: {} };
  }
  return JSON.parse(readFileSync(REGISTRY_PATH, "utf8")) as RegistryDoc;
}

function loadSeq(): SeqDoc {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  if (!existsSync(SEQ_PATH)) return { day, next: 1 };
  const doc = JSON.parse(readFileSync(SEQ_PATH, "utf8")) as SeqDoc;
  if (doc.day !== day) return { day, next: 1 };
  return doc;
}

export function contentFingerprint(parts: Array<string | Buffer | null | undefined>): string {
  const h = createHash("sha256");
  for (const p of parts) {
    if (p == null) continue;
    h.update(typeof p === "string" ? p : p);
    h.update("\0");
  }
  return h.digest("hex");
}

export function getGenerationIdForCandidate(candidateId: string): string | null {
  const reg = loadRegistry();
  return reg.by_candidate[candidateId]?.generation_id ?? null;
}

export function getGenerationRecord(
  candidateId: string,
): GenerationIdRecord | null {
  return loadRegistry().by_candidate[candidateId] ?? null;
}

/**
 * Allocate or return existing generation ID. Never overwrites existing mapping.
 */
export function ensureGenerationId(input: {
  candidate_id: string;
  source_batch_id?: string | null;
  source_execution_id?: string | null;
  content_fingerprint: string;
  backfilled?: boolean;
}): GenerationIdRecord {
  mkdirSync(GENERATION_ID_ROOT, { recursive: true });
  const reg = loadRegistry();
  const existing = reg.by_candidate[input.candidate_id];
  if (existing) return existing;

  const seq = loadSeq();
  const n = String(seq.next).padStart(6, "0");
  const generation_id = `GEN-${seq.day}-${n}`;
  if (reg.by_generation[generation_id]) {
    throw new Error(`Generation ID collision: ${generation_id}`);
  }

  const record: GenerationIdRecord = {
    generation_id,
    candidate_id: input.candidate_id,
    source_batch_id: input.source_batch_id ?? null,
    source_execution_id: input.source_execution_id ?? null,
    created_at: new Date().toISOString(),
    backfilled: Boolean(input.backfilled),
    content_fingerprint: input.content_fingerprint,
  };

  reg.by_candidate[input.candidate_id] = record;
  reg.by_generation[generation_id] = input.candidate_id;
  atomicWriteJson(REGISTRY_PATH, reg);
  atomicWriteJson(SEQ_PATH, { day: seq.day, next: seq.next + 1 });

  if (input.backfilled) {
    writeFileSync(
      BACKFILL_LOG,
      `${JSON.stringify({
        at: record.created_at,
        type: "GENERATION_ID_BACKFILL",
        ...record,
      })}\n`,
      { flag: "a" },
    );
  }

  return record;
}
