/**
 * Export Founder memory + related artifacts for local-model corpora.
 * Manual invocation only — no automatic execution.
 */
import {
  createHash,
  randomUUID,
} from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  renameSync,
} from "node:fs";
import { join, relative, resolve } from "node:path";
import {
  FOUNDER_PREFERENCE_MEMORY_SCHEMA,
} from "./FounderPreferenceMemoryTypes.js";
import {
  FounderPreferenceMemoryStore,
  ensureFounderMemoryDirs,
  founderMemoryDir,
} from "./FounderPreferenceMemoryStore.js";

const SECRET_PATTERNS =
  /OPENAI_API_KEY|sk-[A-Za-z0-9]{10,}|Bearer\s+[A-Za-z0-9._\-]+|BEGIN (RSA |OPENSSH )?PRIVATE KEY/i;

function atomicWrite(path: string, text: string): void {
  const tmp = `${path}.tmp.${process.pid}`;
  writeFileSync(tmp, text, "utf8");
  renameSync(tmp, path);
}

function sha(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function containsSecret(text: string): boolean {
  return SECRET_PATTERNS.test(text);
}

function readJsonl(path: string): unknown[] {
  if (!existsSync(path)) return [];
  const rows: unknown[] = [];
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line) as unknown;
      if (containsSecret(JSON.stringify(obj))) continue;
      rows.push(obj);
    } catch {
      // skip
    }
  }
  return rows;
}

function writeJsonl(path: string, rows: unknown[]): string {
  const body = rows.map((r) => JSON.stringify(r)).join("\n") + (rows.length ? "\n" : "");
  atomicWrite(path, body);
  return sha(body);
}

export type ExportResult = {
  export_id: string;
  export_dir: string;
  files: Record<string, { rows: number; content_hash: string }>;
};

export class FounderMemoryDatasetExporter {
  constructor(
    private readonly repoRoot: string = resolve(
      import.meta.dirname,
      "../../../..",
    ),
  ) {}

  exportDataset(exportId?: string): ExportResult {
    ensureFounderMemoryDirs(this.repoRoot);
    const export_id =
      exportId ?? `export-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
    const export_dir = join(founderMemoryDir(this.repoRoot), "exports", export_id);
    mkdirSync(export_dir, { recursive: true });

    const store = new FounderPreferenceMemoryStore(this.repoRoot);
    const memoryRows = store.listAll().filter((r) => !containsSecret(JSON.stringify(r)));

    const decisionsPath = join(
      this.repoRoot,
      "SOS/07_LOGS/saios/founder-decisions/decisions.jsonl",
    );
    const decisions = readJsonl(decisionsPath) as Array<Record<string, unknown>>;

    const candidatesRoot = join(
      this.repoRoot,
      "SOS/07_LOGS/saios/first-production-cycle/candidates",
    );

    const generationExamples: unknown[] = [];
    const revisionPairs: unknown[] = [];
    const approved: unknown[] = [];
    const rejected: unknown[] = [];
    const failures: unknown[] = [];

    if (existsSync(candidatesRoot)) {
      for (const name of readdirSync(candidatesRoot)) {
        const dir = join(candidatesRoot, name);
        const candPath = join(dir, "candidate.json");
        if (!existsSync(candPath)) continue;
        let cand: Record<string, unknown>;
        try {
          cand = JSON.parse(readFileSync(candPath, "utf8")) as Record<
            string,
            unknown
          >;
        } catch {
          continue;
        }
        if (containsSecret(JSON.stringify(cand))) continue;

        const rel = relative(this.repoRoot, dir).replace(/\\/g, "/");
        const status = String(cand.status ?? "");
        const rowBase = {
          row_id: `gen-${name}`,
          schema_version: FOUNDER_PREFERENCE_MEMORY_SCHEMA,
          candidate_id: cand.candidate_id ?? name,
          review_id: cand.review_id ?? null,
          status,
          artifact_refs: {
            candidate: `${rel}/candidate.json`,
            designbrief: existsSync(join(dir, "designbrief.json"))
              ? `${rel}/designbrief.json`
              : null,
            critic: existsSync(join(dir, "critic.json"))
              ? `${rel}/critic.json`
              : null,
          },
          content_hash: sha(JSON.stringify({
            id: cand.candidate_id,
            status,
            target: cand.target ?? null,
          })),
        };
        generationExamples.push(rowBase);

        if (String(name).includes("-revfb-")) {
          revisionPairs.push({
            ...rowBase,
            row_id: `rev-${name}`,
            parent_candidate_id: String(name).split("-revfb-")[0] ?? null,
          });
        }
        if (status === "PREVIEW_FAILED" || status.includes("FAIL")) {
          failures.push({ ...rowBase, row_id: `fail-${name}` });
        }
      }
    }

    for (const d of decisions) {
      const decision = String(d.decision ?? "");
      const row = {
        row_id: `dec-${String(d.decision_id ?? randomUUID().slice(0, 8))}`,
        schema_version: FOUNDER_PREFERENCE_MEMORY_SCHEMA,
        decision_id: d.decision_id ?? null,
        review_id: d.review_id ?? null,
        decision,
        reason: typeof d.reason === "string" ? d.reason.slice(0, 500) : null,
        content_hash: sha(JSON.stringify({
          decision_id: d.decision_id,
          decision,
          reason: d.reason ?? null,
        })),
      };
      if (containsSecret(JSON.stringify(row))) continue;
      if (decision === "APPROVED") approved.push(row);
      if (decision === "REJECTED") rejected.push(row);
    }

    const files: ExportResult["files"] = {};
    const pairs: Array<[string, unknown[]]> = [
      ["founder-memory.jsonl", memoryRows],
      ["generation-examples.jsonl", generationExamples],
      ["revision-pairs.jsonl", revisionPairs],
      ["approved-exemplars.jsonl", approved],
      ["rejected-examples.jsonl", rejected],
      ["failure-examples.jsonl", failures],
    ];

    for (const [name, rows] of pairs) {
      const hash = writeJsonl(join(export_dir, name), rows);
      files[name] = { rows: rows.length, content_hash: hash };
    }

    const manifest = {
      schema_version: FOUNDER_PREFERENCE_MEMORY_SCHEMA,
      export_id,
      generated_at: new Date().toISOString(),
      repo_relative_root: "SOS/07_LOGS/saios/knowledge/founder-memory/exports",
      files,
      redaction: {
        skipped_secret_pattern_classes: [
          "api_key_env_name",
          "vendor_secret_token_prefix",
          "http_auth_header",
          "pem_private_key_block",
        ],
      },
    };
    const manifestBody = `${JSON.stringify(manifest, null, 2)}\n`;
    atomicWrite(join(export_dir, "dataset-manifest.json"), manifestBody);
    files["dataset-manifest.json"] = {
      rows: 1,
      content_hash: sha(manifestBody),
    };

    return { export_id, export_dir, files };
  }
}
