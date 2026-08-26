/**
 * Per-candidate artifact persistence — Agent #207 / #231.
 * Authoritative production: candidates/{candidate_id}/
 * Verification isolation: candidates-verify/{candidate_id}/
 * Latest-run: flat CYCLE_LOG + latest-candidate.json pointer
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import type { CandidateIdentity } from "./CandidateIdentity.js";
import type { ProductionTarget } from "./ProductionTarget.js";

export type CandidateStatus =
  | "RUNNING"
  | "FAILED"
  | "WAITING_FOUNDER"
  /** Agent #249 — revised candidate awaiting Founder re-review (not auto-approved) */
  | "READY_FOR_FOUNDER_REVIEW"
  | "CRITIC_BLOCKED"
  /** Agent #233 — preview mandatory; not Ready for Review */
  | "PREVIEW_FAILED"
  /** Agent #233 — thumbnail mandatory after preview */
  | "THUMBNAIL_FAILED";

export type CandidateManifest = {
  schema_version: 1;
  candidate_id: string;
  /** Agent #233 — Founder-facing alias (same as candidate_id) */
  template_id?: string;
  product_kind?: "resume_template";
  task_id: string;
  review_id: string;
  cycle_id: string;
  run_id: string;
  created_at: string;
  updated_at: string;
  status: CandidateStatus;
  publication_allowed: false;
  provider: string | null;
  failure_stage: string | null;
  failure_detail: string | null;
  /** Agent #209 — optional batch orchestration metadata */
  batch_id?: string | null;
  batch_sequence?: number | null;
  batch_size?: number | null;
  /** Agent #210 — duplicate-control metadata for accepted candidates */
  duplicate_control?: {
    target_fingerprint: string;
    normalization_version: number;
    duplicate_status: "UNIQUE";
    decision: "ALLOW";
    checked_at: string;
    comparison_registry_size: number;
    batch_local_check: boolean;
  } | null;
  /** Agent #231 — set only for verification-isolated artifacts */
  verification_artifact?: boolean;
  verification_context?: string | null;
  target: {
    category: string;
    title: string;
    industry: string;
    seniority: string;
    objective: string;
    role_family: string;
  };
  artifacts: Record<string, string | null>;
};

export type LatestCandidatePointer = {
  schema_version: 1;
  candidate_id: string;
  candidate_directory: string;
  review_id: string;
  task_id: string;
  cycle_id: string;
  created_at: string;
  status: CandidateStatus;
  publication_allowed: false;
};

function atomicWriteJson(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  renameSync(tmp, path);
}

export type CandidateRegistryKind = "production" | "verification";

export const CANDIDATES_DIR_PRODUCTION = "candidates" as const;
export const CANDIDATES_DIR_VERIFICATION = "candidates-verify" as const;

export function candidatesRoot(
  cycleLog: string,
  kind: CandidateRegistryKind = "production",
): string {
  return join(
    cycleLog,
    kind === "verification"
      ? CANDIDATES_DIR_VERIFICATION
      : CANDIDATES_DIR_PRODUCTION,
  );
}

export function candidateDir(
  cycleLog: string,
  candidateId: string,
  kind: CandidateRegistryKind = "production",
): string {
  return join(candidatesRoot(cycleLog, kind), candidateId);
}

export function latestPointerPath(cycleLog: string): string {
  return join(cycleLog, "latest-candidate.json");
}

export function createCandidateWorkspace(
  cycleLog: string,
  identity: CandidateIdentity,
  target: ProductionTarget,
  batch?: {
    batch_id: string;
    batch_sequence: number;
    batch_size: number;
  } | null,
  opts?: {
    registry_kind?: CandidateRegistryKind;
    verification_context?: string | null;
  },
): {
  dir: string;
  writeArtifact: (name: string, data: unknown) => string;
  copyBinary: (name: string, srcAbs: string) => string | null;
  recordBinaryIfPresent: (name: "preview.png" | "thumbnail.png") => string | null;
  updateManifest: (patch: Partial<CandidateManifest>) => CandidateManifest;
  syncLatestFlat: (name: string, absInCandidate: string) => void;
  writeLatestPointer: (status: CandidateStatus) => void;
  getManifest: () => CandidateManifest;
} {
  const registry_kind = opts?.registry_kind ?? "production";
  const dir = candidateDir(cycleLog, identity.candidate_id, registry_kind);
  if (existsSync(dir)) {
    throw new Error(
      `Candidate directory already exists — refusing overwrite: ${identity.candidate_id}`,
    );
  }
  mkdirSync(dir, { recursive: true });
  mkdirSync(cycleLog, { recursive: true });

  let manifest: CandidateManifest = {
    schema_version: 1,
    candidate_id: identity.candidate_id,
    template_id: identity.candidate_id,
    product_kind: "resume_template",
    task_id: identity.task_id,
    review_id: identity.review_id,
    cycle_id: identity.cycle_id,
    run_id: identity.run_id,
    created_at: identity.created_at,
    updated_at: identity.created_at,
    status: "RUNNING",
    publication_allowed: false,
    provider: null,
    failure_stage: null,
    failure_detail: null,
    batch_id: batch?.batch_id ?? null,
    batch_sequence: batch?.batch_sequence ?? null,
    batch_size: batch?.batch_size ?? null,
    verification_artifact: registry_kind === "verification" ? true : undefined,
    verification_context:
      registry_kind === "verification"
        ? opts?.verification_context ?? "aios-verify"
        : undefined,
    target: {
      category: target.category,
      title: target.title,
      industry: target.industry,
      seniority: target.seniority,
      objective: target.objective,
      role_family: target.role_family,
    },
    artifacts: {
      production_target: null,
      research_context: null,
      research_handoff: null,
      brain: null,
      mock_provider: null,
      designbrief: null,
      resume_json_instructions: null,
      canvas: null,
      editor_compatibility: null,
      critic: null,
      gate: null,
      review: null,
      dashboard: null,
      waiting_founder: null,
      execution_summary: null,
      preview: null,
      thumbnail: null,
      resume_template: null,
    },
  };
  atomicWriteJson(join(dir, "candidate.json"), manifest);

  const rel = (abs: string) => relative(dir, abs).replace(/\\/g, "/");

  const writeArtifact = (name: string, data: unknown): string => {
    const abs = join(dir, name);
    atomicWriteJson(abs, data);
    const key = name.replace(/\.json$/, "").replace(/-/g, "_");
    if (key in manifest.artifacts || name.endsWith(".json")) {
      const artifactKey =
        name === "candidate.json"
          ? null
          : name
              .replace(/\.json$/, "")
              .replace(/-/g, "_");
      if (artifactKey && artifactKey in manifest.artifacts) {
        manifest.artifacts[artifactKey] = rel(abs);
      } else if (name === "cycle-summary.md") {
        /* skip */
      } else if (name.endsWith(".json")) {
        // map known names
        const map: Record<string, string> = {
          "production-target.json": "production_target",
          "research-context.json": "research_context",
          "research-handoff.json": "research_handoff",
          "brain.json": "brain",
          "mock-provider.json": "mock_provider",
          "designbrief.json": "designbrief",
          "resume-json-instructions.json": "resume_json_instructions",
          "canvas.json": "canvas",
          "editor-compatibility.json": "editor_compatibility",
          "critic.json": "critic",
          "gate.json": "gate",
          "review.json": "review",
          "dashboard.json": "dashboard",
          "waiting-founder.json": "waiting_founder",
          "execution-summary.json": "execution_summary",
          "cycle-complete.json": "execution_summary",
          "resume-template.json": "resume_template",
        };
        const mk = map[name];
        if (mk) manifest.artifacts[mk] = rel(abs);
      }
    }
    manifest.updated_at = new Date().toISOString();
    atomicWriteJson(join(dir, "candidate.json"), manifest);
    // latest flat copy
    atomicWriteJson(join(cycleLog, name), data);
    return abs;
  };

  const copyBinary = (name: string, srcAbs: string): string | null => {
    if (!existsSync(srcAbs)) return null;
    const abs = join(dir, name);
    copyFileSync(srcAbs, abs);
    if (name === "preview.png") manifest.artifacts.preview = rel(abs);
    if (name === "thumbnail.png") manifest.artifacts.thumbnail = rel(abs);
    manifest.updated_at = new Date().toISOString();
    atomicWriteJson(join(dir, "candidate.json"), manifest);
    try {
      copyFileSync(srcAbs, join(cycleLog, name));
    } catch {
      /* ignore latest copy failures for binaries */
    }
    return abs;
  };

  const updateManifest = (patch: Partial<CandidateManifest>): CandidateManifest => {
    manifest = {
      ...manifest,
      ...patch,
      artifacts: { ...manifest.artifacts, ...(patch.artifacts ?? {}) },
      publication_allowed: false,
      updated_at: new Date().toISOString(),
    };
    atomicWriteJson(join(dir, "candidate.json"), manifest);
    return manifest;
  };

  const syncLatestFlat = (name: string, absInCandidate: string): void => {
    if (!existsSync(absInCandidate)) return;
    if (name.endsWith(".json")) {
      atomicWriteJson(
        join(cycleLog, name),
        JSON.parse(readFileSync(absInCandidate, "utf8")),
      );
    } else {
      copyFileSync(absInCandidate, join(cycleLog, name));
    }
  };

  const writeLatestPointer = (status: CandidateStatus): void => {
    const pointer: LatestCandidatePointer = {
      schema_version: 1,
      candidate_id: identity.candidate_id,
      candidate_directory: relative(cycleLog, dir).replace(/\\/g, "/"),
      review_id: identity.review_id,
      task_id: identity.task_id,
      cycle_id: identity.cycle_id,
      created_at: identity.created_at,
      status,
      publication_allowed: false,
    };
    atomicWriteJson(latestPointerPath(cycleLog), pointer);
  };

  /** Record binaries already written into the candidate dir (e.g. preview-assets). */
  const recordBinaryIfPresent = (
    name: "preview.png" | "thumbnail.png",
  ): string | null => {
    const abs = join(dir, name);
    if (!existsSync(abs)) return null;
    if (name === "preview.png") manifest.artifacts.preview = rel(abs);
    if (name === "thumbnail.png") manifest.artifacts.thumbnail = rel(abs);
    manifest.updated_at = new Date().toISOString();
    atomicWriteJson(join(dir, "candidate.json"), manifest);
    try {
      copyFileSync(abs, join(cycleLog, name));
    } catch {
      /* ignore latest flat copy */
    }
    return abs;
  };

  return {
    dir,
    writeArtifact,
    copyBinary,
    recordBinaryIfPresent,
    updateManifest,
    syncLatestFlat,
    writeLatestPointer,
    getManifest: () => manifest,
  };
}

/**
 * Raw WAITING_FOUNDER count by category (storage scan only).
 *
 * @deprecated For production Founder-review queue capacity and Mission Ready-for-Review,
 * use `countFounderReviewWaiting` / `countFounderReviewWaitingByCategory` from
 * `SOS/SAIOS/core/founder-review/FounderReviewProjection.ts`.
 * Keep this for candidates-verify / isolation tests and legacy debug only.
 */
export function countCanonicalWaitingByCategory(
  cycleLog: string,
  kind: CandidateRegistryKind = "production",
): Record<string, number> {
  const counts: Record<string, number> = {};
  const root = candidatesRoot(cycleLog, kind);
  if (!existsSync(root)) return counts;
  for (const name of readdirSync(root)) {
    const manifestPath = join(root, name, "candidate.json");
    if (!existsSync(manifestPath)) continue;
    try {
      const m = JSON.parse(readFileSync(manifestPath, "utf8")) as CandidateManifest;
      if (m.status !== "WAITING_FOUNDER") continue;
      const cat = m.target?.category;
      if (!cat) continue;
      counts[cat] = (counts[cat] ?? 0) + 1;
    } catch {
      /* ignore corrupt */
    }
  }
  return counts;
}

/**
 * Raw WAITING_FOUNDER total (storage scan only).
 *
 * @deprecated Production Founder-review queue capacity must use
 * `countFounderReviewWaiting` from FounderReviewProjection.
 * Keep for candidates-verify / isolation tests only.
 */
export function countCanonicalWaitingTotal(
  cycleLog: string,
  kind: CandidateRegistryKind = "production",
): number {
  return Object.values(countCanonicalWaitingByCategory(cycleLog, kind)).reduce(
    (a, n) => a + n,
    0,
  );
}

export function listCandidateManifests(
  cycleLog: string,
  kind: CandidateRegistryKind = "production",
): CandidateManifest[] {
  const root = candidatesRoot(cycleLog, kind);
  if (!existsSync(root)) return [];
  const out: CandidateManifest[] = [];
  for (const name of readdirSync(root)) {
    const manifestPath = join(root, name, "candidate.json");
    if (!existsSync(manifestPath)) continue;
    try {
      out.push(JSON.parse(readFileSync(manifestPath, "utf8")) as CandidateManifest);
    } catch {
      /* ignore */
    }
  }
  return out;
}

export function readLatestCandidatePointer(
  cycleLog: string,
): LatestCandidatePointer | null {
  const p = latestPointerPath(cycleLog);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as LatestCandidatePointer;
  } catch {
    return null;
  }
}
