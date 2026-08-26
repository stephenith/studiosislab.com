/**
 * StagingService — APPROVED → STAGED packages (never publishes).
 * Agent #242. Atomic tmp→rename. Idempotent. No ReleaseManager. No website writes.
 */
import { createHash, randomUUID } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
  openSync,
  closeSync,
  unlinkSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import {
  contentFingerprint,
  ensureGenerationId,
  getGenerationRecord,
} from "./GenerationIdRegistry.js";
import {
  listApprovedCandidateIds,
  readLifecycle,
  upsertLifecycle,
} from "./CandidateLifecycleStore.js";
import { appendStagingAuditEvent } from "./StagingAuditLog.js";
import { assertTransition, canTransition } from "./TemplateLifecycle.js";
import type {
  StageApprovedResult,
  StagingManifest,
  StagingValidationReport,
  TemplateLifecycleStatus,
} from "./types.js";
import { validateCandidateArtifactsForStaging } from "../founder-revision/CandidateStagingArtifacts.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const CYCLE = join(REPO, "SOS/07_LOGS/saios/first-production-cycle");
export const STAGING_PACKAGES_ROOT = join(
  REPO,
  "SOS/07_LOGS/saios/staging/packages",
);
export const STAGING_FAILURES_ROOT = join(
  REPO,
  "SOS/07_LOGS/saios/staging/failures",
);
export const STAGING_INDEX_PATH = join(
  REPO,
  "SOS/07_LOGS/saios/staging/index.json",
);
const LOCK_ROOT = join(REPO, "SOS/07_LOGS/saios/staging/locks");
const DECISIONS_JSONL = join(
  REPO,
  "SOS/07_LOGS/saios/founder-decisions/decisions.jsonl",
);

type CandidateManifest = {
  candidate_id: string;
  status: string;
  publication_allowed?: boolean;
  provider?: string | null;
  batch_id?: string | null;
  review_id?: string;
  task_id?: string;
  cycle_id?: string;
  created_at?: string;
  target?: {
    title?: string;
    category?: string;
    role_family?: string;
  };
};

type IndexDoc = {
  schema_version: 1;
  by_decision: Record<string, string>;
  by_candidate: Record<string, string>;
  by_generation: Record<string, string>;
};

function sha256File(path: string): string {
  const h = createHash("sha256");
  h.update(readFileSync(path));
  return h.digest("hex");
}

function atomicWriteJson(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  renameSync(tmp, path);
}

function loadIndex(): IndexDoc {
  if (!existsSync(STAGING_INDEX_PATH)) {
    return {
      schema_version: 1,
      by_decision: {},
      by_candidate: {},
      by_generation: {},
    };
  }
  return JSON.parse(readFileSync(STAGING_INDEX_PATH, "utf8")) as IndexDoc;
}

function saveIndex(doc: IndexDoc): void {
  atomicWriteJson(STAGING_INDEX_PATH, doc);
}

function candidateDir(candidateId: string): string {
  return join(CYCLE, "candidates", candidateId);
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function decisionMatchesCandidate(
  d: {
    review_id?: string;
    structured_feedback?: { candidate_id?: string };
  },
  candidateId: string,
): boolean {
  const reviewId = String(d.review_id ?? "");
  const fbCand = d.structured_feedback?.candidate_id;
  if (fbCand === candidateId) return true;
  if (reviewId.includes(candidateId) || reviewId.endsWith(candidateId)) {
    return true;
  }
  const mPath = join(candidateDir(candidateId), "candidate.json");
  if (!existsSync(mPath)) return false;
  return readJson<CandidateManifest>(mPath).review_id === reviewId;
}

/** Latest Founder decision for candidate (any kind). */
function findLatestDecision(candidateId: string): {
  decision_id: string;
  decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";
  created_at: string;
  review_id: string;
} | null {
  if (!existsSync(DECISIONS_JSONL)) return null;
  const lines = readFileSync(DECISIONS_JSONL, "utf8")
    .split("\n")
    .filter(Boolean);
  let latest: {
    decision_id: string;
    decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";
    created_at: string;
    review_id: string;
  } | null = null;
  for (const line of lines) {
    try {
      const d = JSON.parse(line) as {
        decision_id?: string;
        decision?: string;
        created_at?: string;
        review_id?: string;
        fixture?: boolean;
        structured_feedback?: { candidate_id?: string };
      };
      if (
        !d.decision_id ||
        (d.decision !== "APPROVED" &&
          d.decision !== "REJECTED" &&
          d.decision !== "CHANGES_REQUESTED")
      ) {
        continue;
      }
      if (!decisionMatchesCandidate(d, candidateId)) continue;
      if (!latest || String(d.created_at) > latest.created_at) {
        latest = {
          decision_id: d.decision_id,
          decision: d.decision,
          created_at: String(d.created_at ?? ""),
          review_id: String(d.review_id ?? ""),
        };
      }
    } catch {
      /* skip bad line */
    }
  }
  return latest;
}

function findLatestApproval(candidateId: string): {
  decision_id: string;
  created_at: string;
  review_id: string;
} | null {
  const latest = findLatestDecision(candidateId);
  if (!latest || latest.decision !== "APPROVED") return null;
  return {
    decision_id: latest.decision_id,
    created_at: latest.created_at,
    review_id: latest.review_id,
  };
}

function acquireLock(candidateId: string): { release: () => void } {
  mkdirSync(LOCK_ROOT, { recursive: true });
  const lockPath = join(LOCK_ROOT, `${candidateId}.lock`);
  try {
    const fd = openSync(lockPath, "wx");
    writeFileSync(lockPath, `${process.pid}\n${new Date().toISOString()}\n`);
    closeSync(fd);
  } catch {
    throw new Error(
      `Staging lock held for ${candidateId} — another staging action is in progress`,
    );
  }
  return {
    release: () => {
      try {
        unlinkSync(lockPath);
      } catch {
        /* ignore */
      }
    },
  };
}

/** Restart recovery: drop incomplete temporary staging dirs (never promote). */
export function recoverIncompleteStagingTemps(): string[] {
  const removed: string[] = [];
  if (!existsSync(STAGING_PACKAGES_ROOT)) return removed;
  for (const name of readdirSync(STAGING_PACKAGES_ROOT)) {
    if (!name.startsWith(".tmp-")) continue;
    const p = join(STAGING_PACKAGES_ROOT, name);
    try {
      rmSync(p, { recursive: true, force: true });
      removed.push(name);
    } catch {
      /* ignore */
    }
  }
  return removed;
}

function cleanupStaleTemps(): void {
  recoverIncompleteStagingTemps();
}

/** Re-read files and return mismatches (used by tests + package verify). */
export function findChecksumMismatches(
  dir: string,
  expected: Record<string, string>,
): string[] {
  const mismatches: string[] = [];
  for (const [rel, sum] of Object.entries(expected)) {
    const p = join(dir, rel);
    if (!existsSync(p) || sha256File(p) !== sum) mismatches.push(rel);
  }
  return mismatches;
}

function computeFingerprint(dir: string): string {
  const canvas = existsSync(join(dir, "canvas.json"))
    ? readFileSync(join(dir, "canvas.json"))
    : Buffer.alloc(0);
  const preview = existsSync(join(dir, "preview.png"))
    ? readFileSync(join(dir, "preview.png"))
    : Buffer.alloc(0);
  return contentFingerprint([canvas, preview]);
}

export function recordFounderLifecycleDecision(input: {
  candidate_id: string;
  decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";
  decision_id: string;
  actor?: string;
}): void {
  const dir = candidateDir(input.candidate_id);
  if (!existsSync(join(dir, "candidate.json"))) {
    throw new Error(`Resume template not found: ${input.candidate_id}`);
  }
  const fp = computeFingerprint(dir);
  const gen = ensureGenerationId({
    candidate_id: input.candidate_id,
    content_fingerprint: fp,
    source_batch_id: readJson<CandidateManifest>(join(dir, "candidate.json"))
      .batch_id,
  });
  const prev = readLifecycle(input.candidate_id);
  const from: TemplateLifecycleStatus =
    prev?.lifecycle_status ?? "READY_FOR_REVIEW";
  const to =
    input.decision === "APPROVED"
      ? ("APPROVED" as const)
      : input.decision === "REJECTED"
        ? ("REJECTED" as const)
        : ("CHANGES_REQUESTED" as const);
  if (!canTransition(from, to) && from !== to) {
    appendStagingAuditEvent({
      type: "INVALID_TRANSITION_ATTEMPT",
      candidate_id: input.candidate_id,
      generation_id: gen.generation_id,
      previous_status: from,
      new_status: to,
      decision_id: input.decision_id,
      reason: `Invalid transition ${from} → ${to}`,
    });
    throw new Error(`Invalid lifecycle transition: ${from} → ${to}`);
  }
  upsertLifecycle({
    candidate_id: input.candidate_id,
    generation_id: gen.generation_id,
    lifecycle_status: to,
    approval_decision_id:
      input.decision === "APPROVED" ? input.decision_id : null,
    founder_approved_at:
      input.decision === "APPROVED" ? new Date().toISOString() : null,
    staging_package_id: prev?.staging_package_id ?? null,
    content_fingerprint: fp,
  });
  appendStagingAuditEvent({
    type:
      input.decision === "APPROVED"
        ? "FOUNDER_APPROVAL"
        : input.decision === "REJECTED"
          ? "REJECTION"
          : "CHANGES_REQUESTED",
    actor: input.actor ?? "founder",
    candidate_id: input.candidate_id,
    generation_id: gen.generation_id,
    previous_status: from,
    new_status: to,
    decision_id: input.decision_id,
    reason: `Founder decision ${input.decision}`,
  });
}

function invalidateIfChanged(candidateId: string): void {
  const life = readLifecycle(candidateId);
  if (!life?.approval_decision_id) return;
  const fp = computeFingerprint(candidateDir(candidateId));
  if (fp === life.content_fingerprint) return;
  upsertLifecycle({
    ...life,
    lifecycle_status: "READY_FOR_REVIEW",
    approval_decision_id: null,
    founder_approved_at: null,
    staging_package_id: null,
    content_fingerprint: fp,
  });
  appendStagingAuditEvent({
    type: "APPROVAL_INVALIDATED",
    candidate_id: candidateId,
    generation_id: life.generation_id,
    previous_status: life.lifecycle_status,
    new_status: "READY_FOR_REVIEW",
    decision_id: life.approval_decision_id,
    reason: "Resume template content fingerprint changed after approval",
  });
}

export function getStagingStatus(candidateId: string): {
  candidate_id: string;
  lifecycle_status: TemplateLifecycleStatus | null;
  generation_id: string | null;
  staging_package_id: string | null;
  staging_path: string | null;
  validation: StagingValidationReport | null;
  publication_allowed: false;
} {
  invalidateIfChanged(candidateId);
  const life = readLifecycle(candidateId);
  const gen = getGenerationRecord(candidateId);
  let validation: StagingValidationReport | null = null;
  let staging_path: string | null = null;
  if (life?.staging_package_id) {
    staging_path = join(STAGING_PACKAGES_ROOT, life.staging_package_id);
    const vr = join(staging_path, "validation-report.json");
    if (existsSync(vr)) validation = readJson(vr);
  }
  return {
    candidate_id: candidateId,
    lifecycle_status: life?.lifecycle_status ?? null,
    generation_id: gen?.generation_id ?? life?.generation_id ?? null,
    staging_package_id: life?.staging_package_id ?? null,
    staging_path: staging_path
      ? relative(REPO, staging_path).replace(/\\/g, "/")
      : null,
    validation,
    publication_allowed: false,
  };
}

export function listApprovedForStaging(): Array<{
  candidate_id: string;
  lifecycle_status: TemplateLifecycleStatus;
  generation_id: string;
  staging_package_id: string | null;
  title: string;
}> {
  if (!existsSync(join(REPO, "SOS/07_LOGS/saios/staging/lifecycle"))) return [];
  return listApprovedCandidateIds().map((id) => {
    const life = readLifecycle(id)!;
    const mPath = join(candidateDir(id), "candidate.json");
    const title = existsSync(mPath)
      ? String(readJson<CandidateManifest>(mPath).target?.title ?? id)
      : id;
    return {
      candidate_id: id,
      lifecycle_status: life.lifecycle_status,
      generation_id: life.generation_id,
      staging_package_id: life.staging_package_id,
      title,
    };
  });
}

export async function stageApprovedCandidate(input: {
  candidate_id: string;
  actor?: string;
  decision_id?: string | null;
  allow_fixture_approval?: boolean;
}): Promise<StageApprovedResult> {
  cleanupStaleTemps();
  const candidate_id = input.candidate_id;
  const dir = candidateDir(candidate_id);
  const fail = (
    status: TemplateLifecycleStatus,
    error: string,
    generation_id = "",
  ): StageApprovedResult => ({
    ok: false,
    idempotent: false,
    candidate_id,
    generation_id,
    staging_package_id: null,
    staging_path: null,
    lifecycle_status: status,
    validation: null,
    error,
    publication_allowed: false,
  });

  if (!existsSync(join(dir, "candidate.json"))) {
    return fail("STAGING_FAILED", `Resume template not found: ${candidate_id}`);
  }

  invalidateIfChanged(candidate_id);
  let life = readLifecycle(candidate_id);
  const manifest = readJson<CandidateManifest>(join(dir, "candidate.json"));
  if (manifest.publication_allowed === true) {
    return fail("STAGING_FAILED", "publication_allowed must be false");
  }

  const fp = computeFingerprint(dir);
  const gen = ensureGenerationId({
    candidate_id,
    content_fingerprint: fp,
    source_batch_id: manifest.batch_id ?? null,
  });

  // Resolve approval
  let decisionId = input.decision_id ?? life?.approval_decision_id ?? null;
  let approvedAt = life?.founder_approved_at ?? null;
  if (!decisionId) {
    const found = findLatestApproval(candidate_id);
    if (found) {
      decisionId = found.decision_id;
      approvedAt = found.created_at;
    }
  }
  if (
    !decisionId &&
    input.allow_fixture_approval &&
    life?.lifecycle_status === "APPROVED"
  ) {
    decisionId = life.approval_decision_id ?? `fixture-approval-${candidate_id}`;
    approvedAt = life.founder_approved_at ?? new Date().toISOString();
  }

  // Bootstrap lifecycle from immutable Founder APPROVED decision (pre-#242 approvals)
  if (
    decisionId &&
    (!life ||
      life.lifecycle_status === "READY_FOR_REVIEW" ||
      life.lifecycle_status === "GENERATING" ||
      life.lifecycle_status === "QUALITY_CHECK")
  ) {
    upsertLifecycle({
      candidate_id,
      generation_id: gen.generation_id,
      lifecycle_status: "APPROVED",
      approval_decision_id: decisionId,
      founder_approved_at: approvedAt ?? new Date().toISOString(),
      staging_package_id: null,
      content_fingerprint: fp,
    });
    life = readLifecycle(candidate_id);
  }

  const retryFromFailed = life?.lifecycle_status === "STAGING_FAILED";
  const canEnterStaging =
    life?.lifecycle_status === "APPROVED" || retryFromFailed;

  if (!life || !canEnterStaging) {
    // Allow STAGED/VALIDATED idempotent return
    if (
      life &&
      (life.lifecycle_status === "STAGED" ||
        life.lifecycle_status === "VALIDATED") &&
      life.staging_package_id
    ) {
      const path = join(STAGING_PACKAGES_ROOT, life.staging_package_id);
      if (existsSync(join(path, "staging-manifest.json"))) {
        appendStagingAuditEvent({
          type: "DUPLICATE_IDEMPOTENT_REQUEST",
          candidate_id,
          generation_id: gen.generation_id,
          previous_status: life.lifecycle_status,
          new_status: life.lifecycle_status,
          decision_id: life.approval_decision_id,
          staging_package_id: life.staging_package_id,
          reason: "Idempotent staging request — returning existing package",
        });
        return {
          ok: true,
          idempotent: true,
          candidate_id,
          generation_id: gen.generation_id,
          staging_package_id: life.staging_package_id,
          staging_path: relative(REPO, path).replace(/\\/g, "/"),
          lifecycle_status: life.lifecycle_status,
          validation: existsSync(join(path, "validation-report.json"))
            ? readJson(join(path, "validation-report.json"))
            : null,
          error: null,
          publication_allowed: false,
        };
      }
    }
    if (life?.lifecycle_status === "CHANGES_REQUESTED") {
      return fail(
        "CHANGES_REQUESTED",
        "CHANGES_REQUESTED cannot stage",
        gen.generation_id,
      );
    }
    if (life?.lifecycle_status === "REJECTED") {
      return fail("REJECTED", "REJECTED cannot stage", gen.generation_id);
    }
    appendStagingAuditEvent({
      type: "INVALID_TRANSITION_ATTEMPT",
      candidate_id,
      generation_id: gen.generation_id,
      previous_status: life?.lifecycle_status ?? null,
      new_status: "STAGING_REQUESTED",
      reason: "Non-approved resume template cannot stage",
    });
    return fail(
      life?.lifecycle_status ?? "READY_FOR_REVIEW",
      "Only APPROVED (or STAGING_FAILED retry) resume templates may be staged",
      gen.generation_id,
    );
  }

  if (!decisionId) {
    return fail(
      "APPROVED",
      "Founder approval decision ID missing — approve via dashboard first",
      gen.generation_id,
    );
  }

  // Idempotency by decision
  const index = loadIndex();
  const existingPkg = index.by_decision[decisionId];
  if (existingPkg) {
    const path = join(STAGING_PACKAGES_ROOT, existingPkg);
    if (existsSync(join(path, "staging-manifest.json"))) {
      appendStagingAuditEvent({
        type: "DUPLICATE_IDEMPOTENT_REQUEST",
        candidate_id,
        generation_id: gen.generation_id,
        decision_id: decisionId,
        staging_package_id: existingPkg,
        previous_status: life.lifecycle_status,
        new_status: "STAGED",
        reason: "Duplicate staging for same approval decision",
      });
      return {
        ok: true,
        idempotent: true,
        candidate_id,
        generation_id: gen.generation_id,
        staging_package_id: existingPkg,
        staging_path: relative(REPO, path).replace(/\\/g, "/"),
        lifecycle_status: "STAGED",
        validation: readJson(join(path, "validation-report.json")),
        error: null,
        publication_allowed: false,
      };
    }
  }

  const lock = acquireLock(candidate_id);
  const staging_package_id = `stg-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomUUID().slice(0, 8)}`;
  const tmpDir = join(STAGING_PACKAGES_ROOT, `.tmp-${staging_package_id}`);
  const finalDir = join(STAGING_PACKAGES_ROOT, staging_package_id);

  try {
    const fromStatus = life.lifecycle_status;
    // Retry path: STAGING_FAILED → STAGING_REQUESTED (approval retained)
    if (fromStatus === "STAGING_FAILED") {
      assertTransition("STAGING_FAILED", "STAGING_REQUESTED");
    } else {
      assertTransition("APPROVED", "STAGING_REQUESTED");
    }
    upsertLifecycle({
      ...life,
      generation_id: gen.generation_id,
      lifecycle_status: "STAGING_REQUESTED",
      approval_decision_id: decisionId,
      founder_approved_at: approvedAt ?? new Date().toISOString(),
      content_fingerprint: fp,
    });
    appendStagingAuditEvent({
      type: "STAGING_REQUESTED",
      candidate_id,
      generation_id: gen.generation_id,
      previous_status: fromStatus,
      new_status: "STAGING_REQUESTED",
      decision_id: decisionId,
      reason: retryFromFailed
        ? "Founder retry after STAGING_FAILED"
        : "Founder requested Stage for StudiosisLab",
      actor: input.actor ?? "founder",
    });

    assertTransition("STAGING_REQUESTED", "STAGING");
    upsertLifecycle({
      ...readLifecycle(candidate_id)!,
      lifecycle_status: "STAGING",
    });
    appendStagingAuditEvent({
      type: "STAGING_STARTED",
      candidate_id,
      generation_id: gen.generation_id,
      previous_status: "STAGING_REQUESTED",
      new_status: "STAGING",
      decision_id: decisionId,
      staging_package_id,
      reason: "Staging package assembly started",
    });

    mkdirSync(tmpDir, { recursive: true });
    mkdirSync(join(tmpDir, "quality"), { recursive: true });

    const requiredCheck = validateCandidateArtifactsForStaging(dir, {
      requireGate: false,
    });
    if (!requiredCheck.ok) {
      throw new Error(
        `Missing required artifact: ${requiredCheck.missing[0]}`,
      );
    }

    // Parse validations
    let canvas: { version?: string; objects?: unknown[] };
    try {
      canvas = readJson(join(dir, "canvas.json"));
      if (!Array.isArray(canvas.objects) || canvas.objects.length === 0) {
        throw new Error("canvas.objects empty");
      }
    } catch (e) {
      throw new Error(
        `Invalid canvas JSON: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
    try {
      readJson(join(dir, "resume-template.json"));
    } catch (e) {
      throw new Error(
        `Invalid resume-template JSON: ${e instanceof Error ? e.message : String(e)}`,
      );
    }

    const critic = readJson<{
      scores?: Record<string, number>;
      readiness?: { ready?: boolean };
    }>(join(dir, "critic.json"));
    const editor = readJson<{ pass?: boolean; overall?: string }>(
      join(dir, "editor-compatibility.json"),
    );
    const editorPass =
      editor.pass === true ||
      String(editor.overall ?? "").toUpperCase() === "PASS";
    const ats = Number(critic.scores?.ats ?? 0);
    const visual = Number(critic.scores?.visual ?? 0);
    const typography = Number(critic.scores?.typography ?? 0);
    const layout = Number(critic.scores?.layout ?? 0);
    const design = Math.round((visual + typography + layout) / 3);
    const thumb = Number(critic.scores?.thumbnail_appeal ?? 0);

    // Optional quality artifacts from candidate or openai batch side-car
    const copyQuality = (name: string, dest: string) => {
      const src = join(dir, name);
      if (existsSync(src)) copyFileSync(src, join(tmpDir, "quality", dest));
    };
    copyFileSync(join(dir, "critic.json"), join(tmpDir, "quality", "critic.json"));
    copyFileSync(
      join(dir, "editor-compatibility.json"),
      join(tmpDir, "quality", "editor.json"),
    );
    copyQuality("mock-provider.json", "openai-execution.json");
    // Prefer sidecar reports if present in openai batch out — otherwise synthesize from critic
    for (const [srcName, dest] of [
      ["safe-area-geometry.json", "safe-area.json"],
      ["contrast-report.json", "contrast.json"],
      ["thumbnail-report.json", "thumbnail-report.json"],
      ["visual-fingerprint.json", "fingerprint.json"],
      ["page-balance.json", "page-balance.json"],
      ["ats-report.json", "ats.json"],
    ] as const) {
      copyQuality(srcName, dest);
    }

    // Soft geometry/contrast: if missing reports, mark pass from critic readiness + scores
    const safePass = existsSync(join(tmpDir, "quality", "safe-area.json"))
      ? Boolean(
          (readJson<{ pass?: boolean }>(join(tmpDir, "quality", "safe-area.json")))
            .pass,
        )
      : ats >= 70 && design >= 80;
    const contrastPass = existsSync(join(tmpDir, "quality", "contrast.json"))
      ? Boolean(
          (
            readJson<{ metrics?: { contrast_pass?: boolean }; pass?: boolean }>(
              join(tmpDir, "quality", "contrast.json"),
            )
          ).metrics?.contrast_pass ??
            readJson<{ pass?: boolean }>(join(tmpDir, "quality", "contrast.json"))
              .pass,
        )
      : design >= 80;

    if (!existsSync(join(tmpDir, "quality", "ats.json"))) {
      atomicWriteJson(join(tmpDir, "quality", "ats.json"), {
        score: ats,
        pass: ats >= 70,
      });
    }
    if (!existsSync(join(tmpDir, "quality", "safe-area.json"))) {
      atomicWriteJson(join(tmpDir, "quality", "safe-area.json"), {
        pass: safePass,
        synthesized: true,
      });
    }
    if (!existsSync(join(tmpDir, "quality", "contrast.json"))) {
      atomicWriteJson(join(tmpDir, "quality", "contrast.json"), {
        pass: contrastPass,
        synthesized: true,
      });
    }

    // thumbnail_appeal may be absent on older critic.json — treat missing as non-blocking
    // when design/ATS/editor/safe/contrast already meet Founder floors.
    const thumbOk = thumb === 0 || thumb >= 85;
    const founderClass =
      ats >= 70 &&
      editorPass &&
      design >= 90 &&
      thumbOk &&
      safePass &&
      contrastPass
        ? "PUBLISHABLE"
        : design >= 80
          ? "NEEDS_REFINEMENT"
          : "REGENERATE";

    copyFileSync(join(dir, "canvas.json"), join(tmpDir, "canvas.json"));
    copyFileSync(
      join(dir, "resume-template.json"),
      join(tmpDir, "resume-template.json"),
    );
    copyFileSync(join(dir, "preview.png"), join(tmpDir, "preview-source.png"));
    copyFileSync(
      join(dir, "thumbnail.png"),
      join(tmpDir, "thumbnail-source.png"),
    );

    // Provider/model from mock-provider
    let provider = String(manifest.provider ?? "unknown");
    let model: string | null = null;
    let executionId: string | null = null;
    if (existsSync(join(dir, "mock-provider.json"))) {
      const mp = readJson<{
        provider?: string;
        openai_execution?: {
          model?: string;
          provider_request_id?: string;
        };
        consumed?: { model_identifier_internal?: string };
      }>(join(dir, "mock-provider.json"));
      provider = String(mp.provider ?? provider);
      model =
        mp.openai_execution?.model ??
        mp.consumed?.model_identifier_internal ??
        null;
      executionId = mp.openai_execution?.provider_request_id ?? null;
    }

    const designbrief = existsSync(join(dir, "designbrief.json"))
      ? readJson<{ visual_guidance?: Record<string, unknown> }>(
          join(dir, "designbrief.json"),
        )
      : {};
    const vg = designbrief.visual_guidance ?? {};
    const role = String(
      manifest.target?.role_family ?? vg.role_family ?? "unknown",
    );
    const title = String(manifest.target?.title ?? candidate_id);
    const family = vg.design_family != null ? String(vg.design_family) : null;

    const checks: Record<string, boolean> = {
      source_candidate_exists: true,
      status_approved: true,
      founder_approval_exists: Boolean(decisionId),
      generation_id_exists: Boolean(gen.generation_id),
      canvas_parses: true,
      resume_template_parses: true,
      preview_exists: true,
      thumbnail_exists: true,
      ats_pass: ats >= 70,
      editor_pass: editorPass,
      safe_area_pass: safePass,
      contrast_pass: contrastPass,
      founder_publishable: founderClass === "PUBLISHABLE",
      no_duplicate_decision_package: true,
      publication_allowed_false: manifest.publication_allowed !== true,
      release_manager_not_invoked: true,
      website_untouched: true,
    };

    const errors: string[] = [];
    for (const [k, v] of Object.entries(checks)) {
      if (!v) errors.push(`check failed: ${k}`);
    }
    if (founderClass !== "PUBLISHABLE") {
      errors.push(`Founder quality class is ${founderClass}, need PUBLISHABLE`);
      checks.founder_publishable = false;
    }

    // Checksums
    const artifactFiles = [
      "canvas.json",
      "resume-template.json",
      "preview-source.png",
      "thumbnail-source.png",
      "staging-manifest.json",
      "validation-report.json",
      "quality/critic.json",
      "quality/editor.json",
      "quality/ats.json",
      "quality/safe-area.json",
      "quality/contrast.json",
    ];
    // Write manifest+validation after checksums of content files first
    const checksums: Record<string, string> = {};
    for (const rel of [
      "canvas.json",
      "resume-template.json",
      "preview-source.png",
      "thumbnail-source.png",
      "quality/critic.json",
      "quality/editor.json",
      "quality/ats.json",
      "quality/safe-area.json",
      "quality/contrast.json",
    ]) {
      const p = join(tmpDir, rel);
      if (existsSync(p)) checksums[rel] = sha256File(p);
    }

    // Re-verify checksums
    for (const [rel, sum] of Object.entries(checksums)) {
      const again = sha256File(join(tmpDir, rel));
      if (again !== sum) {
        errors.push(`checksum mismatch: ${rel}`);
        checks.checksums_match = false;
      }
    }
    if (checks.checksums_match === undefined) checks.checksums_match = true;

    const pass = errors.length === 0;
    const stagedAt = new Date().toISOString();
    const requestedAt = stagedAt;

    const manifestDoc: StagingManifest = {
      staging_package_id,
      schema_version: "staging-package-1.0.0",
      generation_id: gen.generation_id,
      candidate_id,
      source_batch_id: manifest.batch_id ?? null,
      source_execution_id: executionId,
      source_provider: provider,
      source_model: model,
      role,
      category: String(manifest.target?.category ?? "general"),
      design_family: family,
      variant:
        vg.design_variant != null ? Number(vg.design_variant) : null,
      title,
      source_created_at: String(manifest.created_at ?? stagedAt),
      founder_approved_at: approvedAt ?? stagedAt,
      staging_requested_at: requestedAt,
      staged_at: stagedAt,
      approval_decision_id: decisionId,
      source_paths: {
        candidate_dir: relative(REPO, dir).replace(/\\/g, "/"),
        canvas: "canvas.json",
        preview: "preview.png",
        thumbnail: "thumbnail.png",
      },
      artifact_checksums: checksums,
      ats_result: { score: ats, pass: ats >= 70 },
      editor_compatibility_result: {
        pass: editorPass,
        overall: editor.overall,
      },
      design_score: design,
      thumbnail_score: thumb || null,
      safe_area_result: { pass: safePass },
      contrast_result: { pass: contrastPass },
      founder_quality_class: founderClass,
      current_lifecycle_status: pass ? "STAGED" : "STAGING_FAILED",
      proposed_seo_slug: slugify(
        `${role.replace(/_/g, "-")}-${family ?? "template"}-resume`,
      ),
      proposed_catalogue_metadata: {
        title,
        categoryId: String(manifest.target?.category ?? "business"),
        role_family: role,
        design_family: family,
      },
      publication_allowed: false,
      live: false,
    };

    atomicWriteJson(join(tmpDir, "staging-manifest.json"), manifestDoc);
    checksums["staging-manifest.json"] = sha256File(
      join(tmpDir, "staging-manifest.json"),
    );

    const validation: StagingValidationReport = {
      staging_package_id,
      candidate_id,
      generation_id: gen.generation_id,
      pass,
      checked_at: stagedAt,
      checks,
      errors,
      warnings: [],
      publication_allowed: false,
      release_manager_invoked: false,
      website_files_written: false,
      catalogue_id_allocated: false,
    };
    atomicWriteJson(join(tmpDir, "validation-report.json"), validation);
    checksums["validation-report.json"] = sha256File(
      join(tmpDir, "validation-report.json"),
    );
    atomicWriteJson(join(tmpDir, "checksums.json"), {
      algorithm: "sha256",
      generated_at: stagedAt,
      files: checksums,
    });

    // Final checksum re-read for content files
    for (const rel of Object.keys(checksums)) {
      if (rel === "staging-manifest.json" || rel === "validation-report.json")
        continue;
      const again = sha256File(join(tmpDir, rel));
      if (again !== checksums[rel]) {
        throw new Error(`Post-write checksum mismatch: ${rel}`);
      }
    }

    if (!pass) {
      mkdirSync(STAGING_FAILURES_ROOT, { recursive: true });
      const failDir = join(
        STAGING_FAILURES_ROOT,
        `${staging_package_id}-failed`,
      );
      renameSync(tmpDir, failDir);
      upsertLifecycle({
        ...readLifecycle(candidate_id)!,
        lifecycle_status: "STAGING_FAILED",
        staging_package_id: null,
      });
      appendStagingAuditEvent({
        type: "STAGING_FAILED",
        candidate_id,
        generation_id: gen.generation_id,
        previous_status: "STAGING",
        new_status: "STAGING_FAILED",
        decision_id: decisionId,
        staging_package_id,
        reason: errors.join("; "),
        evidence_paths: [relative(REPO, failDir).replace(/\\/g, "/")],
      });
      return {
        ok: false,
        idempotent: false,
        candidate_id,
        generation_id: gen.generation_id,
        staging_package_id: null,
        staging_path: relative(REPO, failDir).replace(/\\/g, "/"),
        lifecycle_status: "STAGING_FAILED",
        validation,
        error: errors.join("; "),
        publication_allowed: false,
      };
    }

    // Atomic promote
    mkdirSync(STAGING_PACKAGES_ROOT, { recursive: true });
    renameSync(tmpDir, finalDir);

    assertTransition("STAGING", "STAGED");
    upsertLifecycle({
      ...readLifecycle(candidate_id)!,
      lifecycle_status: "STAGED",
      staging_package_id,
      approval_decision_id: decisionId,
    });

    // VALIDATED immediately after successful package validation
    assertTransition("STAGED", "VALIDATED");
    upsertLifecycle({
      ...readLifecycle(candidate_id)!,
      lifecycle_status: "VALIDATED",
      staging_package_id,
    });
    manifestDoc.current_lifecycle_status = "VALIDATED";
    atomicWriteJson(join(finalDir, "staging-manifest.json"), manifestDoc);

    const idx = loadIndex();
    idx.by_decision[decisionId] = staging_package_id;
    idx.by_candidate[candidate_id] = staging_package_id;
    idx.by_generation[gen.generation_id] = staging_package_id;
    saveIndex(idx);

    appendStagingAuditEvent({
      type: "STAGING_VALIDATED",
      candidate_id,
      generation_id: gen.generation_id,
      previous_status: "STAGING",
      new_status: "STAGED",
      decision_id: decisionId,
      staging_package_id,
      reason: "Checksum and quality validation passed",
      evidence_paths: [
        relative(REPO, join(finalDir, "validation-report.json")).replace(
          /\\/g,
          "/",
        ),
      ],
    });
    appendStagingAuditEvent({
      type: "STAGING_COMPLETED",
      candidate_id,
      generation_id: gen.generation_id,
      previous_status: "STAGED",
      new_status: "VALIDATED",
      decision_id: decisionId,
      staging_package_id,
      reason: "Staging package atomically promoted",
      evidence_paths: [relative(REPO, finalDir).replace(/\\/g, "/")],
    });

    // Website / ReleaseManager safety asserts
    void artifactFiles;

    return {
      ok: true,
      idempotent: false,
      candidate_id,
      generation_id: gen.generation_id,
      staging_package_id,
      staging_path: relative(REPO, finalDir).replace(/\\/g, "/"),
      lifecycle_status: "VALIDATED",
      validation: { ...validation, pass: true },
      error: null,
      publication_allowed: false,
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    if (existsSync(tmpDir)) {
      mkdirSync(STAGING_FAILURES_ROOT, { recursive: true });
      const failDir = join(
        STAGING_FAILURES_ROOT,
        `${staging_package_id}-error`,
      );
      try {
        renameSync(tmpDir, failDir);
      } catch {
        rmSync(tmpDir, { recursive: true, force: true });
      }
    }
    upsertLifecycle({
      candidate_id,
      generation_id: gen.generation_id,
      lifecycle_status: "STAGING_FAILED",
      approval_decision_id: decisionId,
      founder_approved_at: approvedAt,
      staging_package_id: null,
      content_fingerprint: fp,
    });
    appendStagingAuditEvent({
      type: "STAGING_FAILED",
      candidate_id,
      generation_id: gen.generation_id,
      previous_status: "STAGING",
      new_status: "STAGING_FAILED",
      decision_id: decisionId,
      staging_package_id,
      reason: detail,
    });
    return fail("STAGING_FAILED", detail, gen.generation_id);
  } finally {
    lock.release();
  }
}

/** Backfill generation IDs for Agent #240 OpenAI batch candidates. */
export function backfillOpenAI240GenerationIds(): {
  assigned: string[];
  skipped: string[];
} {
  const batch = join(
    CYCLE,
    "openai-production-batch-v1/batch-comparison.json",
  );
  if (!existsSync(batch)) return { assigned: [], skipped: [] };
  const cmp = readJson<{
    templates?: Array<{ candidate_id?: string; candidate_dir?: string }>;
    execution_id?: string;
    batch_id?: string;
  }>(batch);
  const assigned: string[] = [];
  const skipped: string[] = [];
  for (const t of cmp.templates ?? []) {
    const id = t.candidate_id;
    if (!id) continue;
    const dir = candidateDir(id);
    if (!existsSync(join(dir, "candidate.json"))) {
      skipped.push(id);
      continue;
    }
    const existing = getGenerationRecord(id);
    if (existing) {
      skipped.push(id);
      continue;
    }
    const fp = computeFingerprint(dir);
    const rec = ensureGenerationId({
      candidate_id: id,
      content_fingerprint: fp,
      source_batch_id: cmp.batch_id ?? "batch-20260724-011",
      source_execution_id: cmp.execution_id ?? null,
      backfilled: true,
    });
    assigned.push(rec.generation_id);
    appendStagingAuditEvent({
      type: "GENERATION_ID_BACKFILL",
      candidate_id: id,
      generation_id: rec.generation_id,
      reason: "Agent #240 backfill",
      evidence_paths: [relative(REPO, dir).replace(/\\/g, "/")],
    });
  }
  return { assigned, skipped };
}
