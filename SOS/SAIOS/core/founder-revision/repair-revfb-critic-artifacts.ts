/**
 * Repair critic/gate artifacts on an existing revfb candidate without altering canvas.
 * SAFE WRITE — no stage, export, release, commit, or publish.
 *
 * Usage:
 *   npx tsx .../repair-revfb-critic-artifacts.ts --candidate-id=<id>
 *   npx tsx .../repair-revfb-critic-artifacts.ts --graphic-designer
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import {
  materializeCriticAndGateArtifacts,
  sha256File,
  validateCandidateArtifactsForStaging,
  writeEditorCompatibilityFromCanvas,
} from "./CandidateStagingArtifacts.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const CAND_ROOT = join(
  REPO,
  "SOS/07_LOGS/saios/first-production-cycle/candidates",
);
const EVIDENCE_ROOT = join(
  REPO,
  "SOS/07_LOGS/saios/founder-revision/repairs",
);

const GD_REVFB =
  "cand-creative-graphic-designer-editorial-v0-o-20260727T045842Z-b8946b-revfb-9b4b42";

function arg(name: string): string | null {
  const pref = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(pref));
  return hit ? hit.slice(pref.length) : null;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function writeJson(path: string, data: unknown): void {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export function repairRevfbCriticArtifacts(candidateId: string): {
  ok: boolean;
  evidence_path: string;
  report: Record<string, unknown>;
} {
  const dir = join(CAND_ROOT, candidateId);
  const now = new Date().toISOString();
  const missingBefore = validateCandidateArtifactsForStaging(dir, {
    requireGate: true,
  });

  if (!existsSync(join(dir, "canvas.json"))) {
    throw new Error(`canvas.json missing for ${candidateId}`);
  }

  const canvasShaBefore = sha256File(join(dir, "canvas.json"));
  const priorCriticExisted = existsSync(join(dir, "critic.json"));
  const priorGateExisted = existsSync(join(dir, "gate.json"));

  // Regenerate editor compatibility from current revised canvas
  const editor = writeEditorCompatibilityFromCanvas(dir);

  const quality = materializeCriticAndGateArtifacts({
    repoRoot: REPO,
    candidateDir: dir,
    candidate_id: candidateId,
  });

  const canvasShaAfter = sha256File(join(dir, "canvas.json"));
  if (canvasShaAfter !== canvasShaBefore) {
    throw new Error("CRITICAL: repair mutated canvas.json");
  }

  // Refresh revision-summary validation if present
  const summaryPath = join(dir, "revision-summary.json");
  if (existsSync(summaryPath) && quality.scores) {
    const summary = readJson<Record<string, unknown>>(summaryPath);
    summary.validation = {
      ...(typeof summary.validation === "object" && summary.validation
        ? (summary.validation as object)
        : {}),
      layout_pass: quality.layout_pass,
      ats_pass: quality.ats_pass,
      content_pass:
        (summary.validation as { content_pass?: boolean } | undefined)
          ?.content_pass ?? true,
      asset_pass:
        existsSync(join(dir, "preview.png")) &&
        existsSync(join(dir, "thumbnail.png")),
      critic_overall: quality.scores.overall,
      critic_ats: quality.scores.ats,
      critic_layout: quality.scores.layout,
      critic_technical: quality.scores.technical,
      overflow: quality.overflow,
      gate_ready: quality.gate_ready,
    };
    summary.updated_at = now;
    summary.critic_repaired_at = now;
    writeJson(summaryPath, summary);
  }

  // Refresh candidate.json artifact refs — do not change Founder approval status
  const candPath = join(dir, "candidate.json");
  if (existsSync(candPath)) {
    const cand = readJson<Record<string, unknown>>(candPath);
    const artifacts = {
      ...((cand.artifacts as Record<string, string> | undefined) ?? {}),
      canvas: "canvas.json",
      preview: "preview.png",
      thumbnail: "thumbnail.png",
      critic: "critic.json",
      gate: "gate.json",
      editor_compatibility: "editor-compatibility.json",
      resume_template: "resume-template.json",
    };
    cand.artifacts = artifacts;
    cand.updated_at = now;
    cand.critic_repaired_at = now;
    writeJson(candPath, cand);
  }

  const after = validateCandidateArtifactsForStaging(dir, { requireGate: true });
  const stagingPreflight = validateCandidateArtifactsForStaging(dir, {
    requireGate: false,
  });

  const report = {
    schema_version: "revfb-critic-repair-1.0.0",
    candidate_id: candidateId,
    repaired_at: now,
    missing_before: missingBefore.missing,
    artifacts_generated: [
      !priorCriticExisted ? "critic.json" : "critic.json (regenerated)",
      !priorGateExisted ? "gate.json" : "gate.json (regenerated)",
      "editor-compatibility.json (regenerated)",
    ],
    critic_scores: quality.scores,
    gate_result: {
      ready: quality.gate_ready,
      ok: quality.ok,
      error: quality.error,
    },
    editor_compatibility_pass: editor.pass,
    canvas_sha256_unchanged: canvasShaBefore === canvasShaAfter,
    canvas_sha256: canvasShaBefore,
    files_changed: [
      "critic.json",
      "gate.json",
      "editor-compatibility.json",
      existsSync(summaryPath) ? "revision-summary.json" : null,
      existsSync(candPath) ? "candidate.json" : null,
    ].filter(Boolean),
    artifact_validation_after: after,
    staging_preflight_pass: stagingPreflight.ok,
    founder_approval_unchanged: true,
    staged: false,
    exported: false,
    released: false,
    website_files_changed: false,
    publication_allowed: false,
    live: false,
  };

  const evidencePath = join(
    EVIDENCE_ROOT,
    `${candidateId}-critic-repair-${now.slice(0, 10)}.json`,
  );
  writeJson(evidencePath, report);

  return {
    ok: quality.ok && after.ok && stagingPreflight.ok,
    evidence_path: evidencePath,
    report,
  };
}

export function auditRevfbCandidates(): Array<{
  candidate_id: string;
  missing: string[];
  staging_ok: boolean;
  revision_ok: boolean;
}> {
  if (!existsSync(CAND_ROOT)) return [];
  return readdirSync(CAND_ROOT)
    .filter((n) => n.includes("-revfb-"))
    .map((candidate_id) => {
      const dir = join(CAND_ROOT, candidate_id);
      const staging = validateCandidateArtifactsForStaging(dir, {
        requireGate: false,
      });
      const revision = validateCandidateArtifactsForStaging(dir, {
        requireGate: true,
      });
      return {
        candidate_id,
        missing: revision.missing,
        staging_ok: staging.ok,
        revision_ok: revision.ok,
      };
    });
}

function main(): void {
  const candidateId = hasFlag("graphic-designer")
    ? GD_REVFB
    : arg("candidate-id");
  if (!candidateId) {
    console.error(
      "Usage: --candidate-id=<id> | --graphic-designer",
    );
    process.exit(1);
  }

  const audit = auditRevfbCandidates();
  const result = repairRevfbCriticArtifacts(candidateId);
  console.log(
    JSON.stringify(
      {
        repair: result,
        revfb_audit: audit,
      },
      null,
      2,
    ),
  );
  if (!result.ok) process.exit(1);
}

if (process.argv[1] && process.argv[1].includes("repair-revfb-critic-artifacts")) {
  main();
}
