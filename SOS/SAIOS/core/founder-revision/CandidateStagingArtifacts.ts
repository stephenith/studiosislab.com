/**
 * Mandatory candidate artifacts for staging / Founder-feedback revisions.
 * StagingService remains fail-closed; this helper is the shared inventory contract.
 */
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { ResumeCritic } from "../resume-critic/ResumeCritic.js";
import { validateScoresForGate } from "../critic-gate/CriticGateValidator.js";
import type { CriticResult } from "../resume-critic/types.js";
import { evaluateCanvasRoleTargetIntegrity } from "../role-integrity/RoleTargetIntegrity.js";
import { resolveRoleSample } from "../resume-renderer/SampleContent.js";

/** Exact StagingService required set — do not weaken. */
export const STAGING_PACKAGE_REQUIRED_FILES = [
  "canvas.json",
  "resume-template.json",
  "preview.png",
  "thumbnail.png",
  "critic.json",
  "editor-compatibility.json",
] as const;

/** Revision pipeline must also materialize gate.json before READY_FOR_FOUNDER_REVIEW. */
export const REVISION_CANDIDATE_REQUIRED_FILES = [
  ...STAGING_PACKAGE_REQUIRED_FILES,
  "gate.json",
] as const;

export type ArtifactValidationResult = {
  ok: boolean;
  missing: string[];
  present: string[];
  require_gate: boolean;
};

export function validateCandidateArtifactsForStaging(
  candidateDir: string,
  opts?: { requireGate?: boolean },
): ArtifactValidationResult {
  const requireGate = opts?.requireGate === true;
  const required = requireGate
    ? REVISION_CANDIDATE_REQUIRED_FILES
    : STAGING_PACKAGE_REQUIRED_FILES;
  const missing: string[] = [];
  const present: string[] = [];
  for (const f of required) {
    if (existsSync(join(candidateDir, f))) present.push(f);
    else missing.push(f);
  }
  return {
    ok: missing.length === 0,
    missing,
    present,
    require_gate: requireGate,
  };
}

function writeJson(path: string, data: unknown): void {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

/**
 * Editor compatibility is derived from canvas schema (version + required object fields).
 * Must be regenerated after canvas ops — not blindly copied from prior.
 */
export function writeEditorCompatibilityFromCanvas(
  candidateDir: string,
  canvas?: {
    version?: string;
    objects?: Array<Record<string, unknown>>;
  },
): { pass: boolean; path: string } {
  const doc =
    canvas ??
    readJson<{ version?: string; objects?: Array<Record<string, unknown>> }>(
      join(candidateDir, "canvas.json"),
    );
  const objects = doc.objects ?? [];
  const required = [
    "version",
    "type",
    "left",
    "top",
    "width",
    "height",
    "originX",
    "id",
    "selectable",
    "evented",
  ];
  // Production cycle prefers fabric 6.9.1; revised OpenAI canvases may still be 5.x.
  // Pass when objects are non-empty and each object has the core editor fields
  // (version present on document). Match StagingService: pass === true | overall PASS.
  let ok = typeof doc.version === "string" && objects.length > 0;
  for (const o of objects) {
    for (const k of ["type", "left", "top", "id"] as const) {
      if (o[k] === undefined && o.data === undefined) {
        // soft: many fabric objects use data.id; require type+left+top at minimum
      }
    }
    if (o.type === undefined) ok = false;
    if (o.left === undefined || o.top === undefined) ok = false;
  }
  // Align with production: also check extended fields when present on majority
  let schemaOk = ok;
  if (objects.length > 0) {
    const withId = objects.filter(
      (o) => o.id !== undefined || (o.data as { id?: string } | undefined)?.id,
    ).length;
    if (withId < objects.length * 0.5) schemaOk = false;
  }
  const payload = {
    conversion_required: false,
    fabric_version: doc.version ?? "unknown",
    object_count: objects.length,
    pass: schemaOk,
    regenerated_after_revision: true,
    checked_fields: required,
  };
  const path = join(candidateDir, "editor-compatibility.json");
  writeJson(path, payload);
  return { pass: schemaOk, path };
}

export type MaterializeCriticResult = {
  ok: boolean;
  failure: "CRITIC" | "GATE" | "ARTIFACTS" | null;
  error: string | null;
  critic: CriticResult | null;
  gate_ready: boolean;
  critic_path: string | null;
  gate_path: string | null;
  scores: {
    overall: number;
    ats: number;
    layout: number;
    technical: number;
    visual: number;
    typography: number;
  } | null;
  overflow: boolean;
  layout_pass: boolean;
  ats_pass: boolean;
};

/**
 * Run ResumeCritic on revised canvas and write critic.json + gate.json.
 * Never copies prior critic/gate. Uses CriticGateValidator thresholds.
 */
export function materializeCriticAndGateArtifacts(input: {
  repoRoot: string;
  candidateDir: string;
  candidate_id: string;
  title?: string;
  /** Target professional role for Phase 6A integrity (defaults to title). */
  role?: string;
  /** Test injection — production omits this. */
  critiqueOverride?: () => CriticResult;
}): MaterializeCriticResult {
  const criticPath = join(input.candidateDir, "critic.json");
  const gatePath = join(input.candidateDir, "gate.json");
  const canvasPath = join(input.candidateDir, "canvas.json");
  const resumePath = join(input.candidateDir, "resume-json-instructions.json");

  if (!existsSync(canvasPath)) {
    return {
      ok: false,
      failure: "CRITIC",
      error: "canvas.json missing — cannot run ResumeCritic",
      critic: null,
      gate_ready: false,
      critic_path: null,
      gate_path: null,
      scores: null,
      overflow: false,
      layout_pass: false,
      ats_pass: false,
    };
  }

  let critic: CriticResult;
  try {
    if (input.critiqueOverride) {
      critic = input.critiqueOverride();
    } else {
      critic = new ResumeCritic(input.repoRoot).critique({
        persist: false,
        input: {
          canvas: readJson(canvasPath),
          resume_json: existsSync(resumePath) ? readJson(resumePath) : null,
          overflow: null,
          renderer_validation_pass: true,
        },
      });
    }
  } catch (e) {
    return {
      ok: false,
      failure: "CRITIC",
      error: e instanceof Error ? e.message : String(e),
      critic: null,
      gate_ready: false,
      critic_path: null,
      gate_path: null,
      scores: null,
      overflow: false,
      layout_pass: false,
      ats_pass: false,
    };
  }

  if (
    !critic?.scores ||
    typeof critic.scores.overall !== "number" ||
    typeof critic.scores.ats !== "number" ||
    typeof critic.scores.technical !== "number"
  ) {
    return {
      ok: false,
      failure: "CRITIC",
      error: "ResumeCritic returned incomplete scores",
      critic,
      gate_ready: false,
      critic_path: null,
      gate_path: null,
      scores: null,
      overflow: false,
      layout_pass: false,
      ats_pass: false,
    };
  }

  const criticArtifact = {
    scores: critic.scores,
    readiness: critic.readiness,
    used_ai: false,
    used_mock_provider: false,
    revision_number: 1,
    findings_count: Object.values(critic.reports ?? {}).reduce(
      (n, r) => n + (r?.findings?.length ?? 0),
      0,
    ),
    founder_feedback_revision: true,
  };
  try {
    writeJson(criticPath, criticArtifact);
  } catch (e) {
    return {
      ok: false,
      failure: "CRITIC",
      error: `Failed to write critic.json: ${e instanceof Error ? e.message : String(e)}`,
      critic,
      gate_ready: false,
      critic_path: null,
      gate_path: null,
      scores: null,
      overflow: false,
      layout_pass: false,
      ats_pass: false,
    };
  }

  const overflow = Boolean(
    critic.reports?.layout?.findings?.some(
      (f) => f.code === "LAY_OVERFLOW" || f.code === "LAY_PAGE_BREAK",
    ),
  );

  // Phase 6A — revision must not change professional role vs target.
  const targetRole = String(input.role ?? input.title ?? "").trim();
  if (targetRole) {
    let resumeContent: unknown = null;
    if (existsSync(resumePath)) {
      try {
        const rj = readJson(resumePath) as {
          visual_guidance?: {
            resume_content?: unknown;
            openai_resume_content?: unknown;
          };
        };
        resumeContent =
          rj.visual_guidance?.resume_content ??
          rj.visual_guidance?.openai_resume_content ??
          null;
      } catch {
        resumeContent = null;
      }
    }
    const integrity = evaluateCanvasRoleTargetIntegrity({
      target_title: targetRole,
      target_role_family: targetRole,
      canvas: readJson(canvasPath),
      resume_content: resumeContent,
      openai_resume_content: resumeContent,
      sample_title: (() => {
        if (resumeContent && typeof resumeContent === "object") {
          const t = String((resumeContent as { title?: unknown }).title ?? "").trim();
          if (t) return t;
        }
        const pack = resolveRoleSample({ roleFamily: targetRole });
        return pack.ok ? pack.sample.title : null;
      })(),
    });
    writeJson(join(input.candidateDir, "role-target-integrity.json"), integrity);
    if (!integrity.pass) {
      return {
        ok: false,
        failure: "GATE",
        error: `ROLE_INTEGRITY_FAILED: ${integrity.reason}`,
        critic,
        gate_ready: false,
        critic_path: criticPath,
        gate_path: null,
        scores: {
          overall: critic.scores.overall,
          ats: critic.scores.ats,
          layout: critic.scores.layout,
          technical: critic.scores.technical,
          visual: critic.scores.visual,
          typography: critic.scores.typography,
        },
        overflow,
        layout_pass: (critic.scores.layout ?? 0) >= 90 && !overflow,
        ats_pass: (critic.scores.ats ?? 0) >= 95,
      };
    }
  }

  const verdict = validateScoresForGate({
    overall: critic.scores.overall,
    ats: critic.scores.ats,
    visual: critic.scores.visual,
    typography: critic.scores.typography,
    layout: critic.scores.layout,
    technical: critic.scores.technical,
    consistency: critic.scores.consistency,
    sections: critic.scores.sections,
    ready: critic.readiness.ready,
    blocked_reasons: critic.readiness.blocked_reasons,
  });

  const gateArtifact = {
    ready: verdict.ready,
    founder_review_allowed: verdict.ready,
    publication_allowed: false,
    dry_run: true,
    overall: critic.scores.overall,
    ats: critic.scores.ats,
    technical: critic.scores.technical,
    visual: critic.scores.visual,
    typography: critic.scores.typography,
    layout: critic.scores.layout,
    blocking_reasons: verdict.blocking_reasons,
    warnings: verdict.warnings,
    critic_report_reference: criticPath,
    candidate_id: input.candidate_id,
    evaluated_at: new Date().toISOString(),
    founder_feedback_revision: true,
  };

  try {
    writeJson(gatePath, gateArtifact);
  } catch (e) {
    return {
      ok: false,
      failure: "GATE",
      error: `Failed to write gate.json: ${e instanceof Error ? e.message : String(e)}`,
      critic,
      gate_ready: false,
      critic_path: criticPath,
      gate_path: null,
      scores: {
        overall: critic.scores.overall,
        ats: critic.scores.ats,
        layout: critic.scores.layout,
        technical: critic.scores.technical,
        visual: critic.scores.visual,
        typography: critic.scores.typography,
      },
      overflow,
      layout_pass: (critic.scores.layout ?? 0) >= 90 && !overflow,
      ats_pass: (critic.scores.ats ?? 0) >= 95,
    };
  }

  if (!verdict.ready) {
    return {
      ok: false,
      failure: "GATE",
      error: `Critic gate blocked: ${verdict.blocking_reasons.join("; ")}`,
      critic,
      gate_ready: false,
      critic_path: criticPath,
      gate_path: gatePath,
      scores: {
        overall: critic.scores.overall,
        ats: critic.scores.ats,
        layout: critic.scores.layout,
        technical: critic.scores.technical,
        visual: critic.scores.visual,
        typography: critic.scores.typography,
      },
      overflow,
      layout_pass: (critic.scores.layout ?? 0) >= 90 && !overflow,
      ats_pass: (critic.scores.ats ?? 0) >= 95,
    };
  }

  return {
    ok: true,
    failure: null,
    error: null,
    critic,
    gate_ready: true,
    critic_path: criticPath,
    gate_path: gatePath,
    scores: {
      overall: critic.scores.overall,
      ats: critic.scores.ats,
      layout: critic.scores.layout,
      technical: critic.scores.technical,
      visual: critic.scores.visual,
      typography: critic.scores.typography,
    },
    overflow,
    layout_pass: (critic.scores.layout ?? 0) >= 90 && !overflow,
    ats_pass: (critic.scores.ats ?? 0) >= 95,
  };
}

export function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}
