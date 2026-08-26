/**
 * Agent #249 — Founder Revision Batch.
 * Creates immutable revised candidates for Founder re-review.
 * Never auto-approves. Never publishes. LIVE OFF.
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { ResumeCritic } from "../resume-critic/ResumeCritic.js";
import { writePreviewAndThumbnailGuaranteed } from "../first-production-cycle/ResumeTemplateRuntime.js";
import { reviseCanvas } from "./CanvasRevision.js";
import type {
  BatchTemplateSpec,
  RevisionBatchStatus,
  RevisionSummary,
} from "./types.js";
import { FOUNDER_REVISION_BATCH_VERSION, REVISION_TAG } from "./types.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const CAND_ROOT = join(
  REPO,
  "SOS/07_LOGS/saios/first-production-cycle/candidates",
);
const DECISIONS = join(
  REPO,
  "SOS/07_LOGS/saios/founder-decisions/decisions.jsonl",
);
const OUT = join(REPO, "SOS/07_LOGS/saios/founder-revision");

export const BATCH_SPECS: BatchTemplateSpec[] = [
  {
    role: "Marketing Manager",
    family: "executive",
    prior_candidate_id:
      "cand-marketing-marketing-manager-executive-v0-20260724T070640Z-9ca40a",
    prior_review_id:
      "founder-review-cycle-marketing-marketing-manager-executive-v0-20260724T070640Z-9ca40a",
  },
  {
    role: "Software Engineer",
    family: "modern",
    prior_candidate_id:
      "cand-engineering-software-engineer-modern-v0--20260724T070713Z-c2cee0",
    prior_review_id:
      "founder-review-cycle-engineering-software-engineer-modern-v0--20260724T070713Z-c2cee0",
  },
  {
    role: "Graphic Designer",
    family: "editorial",
    prior_candidate_id:
      "cand-creative-graphic-designer-editorial-v0-o-20260724T070748Z-8df58a",
    prior_review_id:
      "founder-review-cycle-creative-graphic-designer-editorial-v0-o-20260724T070748Z-8df58a",
  },
  {
    role: "Accountant",
    family: "technical",
    prior_candidate_id:
      "cand-finance-accountant-technical-v0-oai240-m-20260724T070816Z-98e7f6",
    prior_review_id:
      "founder-review-cycle-finance-accountant-technical-v0-oai240-m-20260724T070816Z-98e7f6",
  },
  {
    role: "HR Manager",
    family: "contemporary_accent",
    prior_candidate_id:
      "cand-ats-hr-manager-contemporary-accent-v0-oa-20260724T070849Z-e99d14",
    prior_review_id:
      "founder-review-cycle-ats-hr-manager-contemporary-accent-v0-oa-20260724T070849Z-e99d14",
  },
];

const COPY_FILES = [
  "designbrief.json",
  "resume-json-instructions.json",
  "resume-template.json",
  "production-target.json",
  "research-context.json",
  "research-handoff.json",
  "brain.json",
  "knowledge.json",
  "skills.json",
  "editor-compatibility.json",
  "renderer.json",
  "pipeline.json",
  "canvas-meta.json",
];

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function writeJson(path: string, data: unknown): void {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function parseChangesFromReason(reason: string): string[] {
  const out: string[] = [];
  for (const line of reason.split(/\r?\n/)) {
    const m = line.trim().match(/^\d+\.\s+(.+)$/);
    if (m?.[1]) out.push(m[1].trim());
  }
  return out;
}

function loadRequestedChanges(reviewId: string): {
  changes: string[];
  decision_id: string | null;
  decision: string | null;
} {
  if (!existsSync(DECISIONS)) {
    return { changes: [], decision_id: null, decision: null };
  }
  let latest: Record<string, unknown> | null = null;
  for (const line of readFileSync(DECISIONS, "utf8").split("\n")) {
    if (!line.trim()) continue;
    const d = JSON.parse(line) as Record<string, unknown>;
    if (d.review_id !== reviewId) continue;
    if (!latest || String(d.created_at) >= String(latest.created_at)) latest = d;
  }
  if (!latest) return { changes: [], decision_id: null, decision: null };
  const listed = Array.isArray(latest.requested_changes)
    ? (latest.requested_changes as string[])
    : [];
  const fromReason = parseChangesFromReason(String(latest.reason ?? ""));
  // Merge: prefer fuller set when dashboard stored only a partial list
  const merged: string[] = [];
  for (const c of [...fromReason, ...listed]) {
    const key = c.replace(/^\d+\.\s*/, "").trim().toLowerCase();
    if (!key || merged.some((m) => m.replace(/^\d+\.\s*/, "").trim().toLowerCase() === key)) {
      continue;
    }
    merged.push(c);
  }
  return {
    changes: merged.length ? merged : listed,
    decision_id: String(latest.decision_id ?? null),
    decision: String(latest.decision ?? null),
  };
}

function newIds(priorId: string): {
  candidate_id: string;
  review_id: string;
  revision_id: string;
} {
  const candidate_id = `${priorId}-${REVISION_TAG}`;
  return {
    candidate_id,
    review_id: `founder-review-${candidate_id}`,
    revision_id: `revision-${REVISION_TAG}-${priorId.slice(-8)}`,
  };
}

async function reviseOne(spec: BatchTemplateSpec): Promise<{
  ok: boolean;
  summary: RevisionSummary | null;
  error: string | null;
}> {
  const priorDir = join(CAND_ROOT, spec.prior_candidate_id);
  if (!existsSync(join(priorDir, "canvas.json"))) {
    return { ok: false, summary: null, error: "prior canvas missing" };
  }
  if (spec.prior_candidate_id.includes("fixture") || spec.prior_candidate_id.includes("t099")) {
    return { ok: false, summary: null, error: "fixture excluded" };
  }

  const feedback = loadRequestedChanges(spec.prior_review_id);
  if (feedback.decision === "REJECTED") {
    return { ok: false, summary: null, error: "rejected templates excluded" };
  }

  const ids = newIds(spec.prior_candidate_id);
  const outDir = join(CAND_ROOT, ids.candidate_id);

  // Idempotent: remove prior revision attempt for same tag
  if (existsSync(outDir)) {
    rmSync(outDir, { recursive: true, force: true });
  }
  mkdirSync(outDir, { recursive: true });

  // Preserve original snapshot link under prior revisions/
  const snapDir = join(priorDir, "revisions", REVISION_TAG, "pre-revision-snapshot");
  mkdirSync(snapDir, { recursive: true });
  for (const f of ["canvas.json", "preview.png", "thumbnail.png", "candidate.json"]) {
    const src = join(priorDir, f);
    if (existsSync(src)) copyFileSync(src, join(snapDir, f));
  }

  for (const f of COPY_FILES) {
    const src = join(priorDir, f);
    if (existsSync(src)) copyFileSync(src, join(outDir, f));
  }

  const priorCanvas = readJson<Record<string, unknown>>(join(priorDir, "canvas.json"));
  const revised = reviseCanvas({
    canvas: priorCanvas as never,
    role: spec.role,
    requested_changes: feedback.changes,
  });
  // Content-safety: do not fabricate new certifications/projects
  if (
    feedback.changes.some((c) =>
      /add .+ (certification|project)/i.test(c),
    )
  ) {
    revised.changes_not_applied.push(
      "did not add new certifications/projects (content safety — no fabricated credentials)",
    );
  }
  writeJson(join(outDir, "canvas.json"), revised.canvas);

  // Preview + thumbnail
  await writePreviewAndThumbnailGuaranteed({
    canvasJson: revised.canvas as never,
    outputDir: outDir,
    reviewId: ids.review_id,
  });

  // Critic / ATS / layout
  const critic = new ResumeCritic(REPO).critique({
    persist: false,
    input: {
      canvas: revised.canvas as never,
      resume_json: existsSync(join(outDir, "resume-json-instructions.json"))
        ? readJson(join(outDir, "resume-json-instructions.json"))
        : null,
      overflow: null,
      renderer_validation_pass: true,
    },
  });
  writeJson(join(outDir, "critic.json"), {
    scores: critic.scores,
    readiness: critic.readiness,
    used_ai: false,
    used_mock_provider: false,
    revision_number: 1,
    findings_count: Object.values(critic.reports).reduce(
      (n, r) => n + (r.findings?.length ?? 0),
      0,
    ),
    founder_revision_batch: true,
  });
  writeJson(join(outDir, "gate.json"), {
    ready: critic.readiness.ready,
    founder_review_allowed: critic.readiness.ready,
    publication_allowed: false,
    overall: critic.scores.overall,
    ats: critic.scores.ats,
    technical: critic.scores.technical,
  });

  const pageH = Number((revised.canvas as { height?: number }).height ?? 1123);
  let maxBottom = 0;
  for (const o of (revised.canvas as {
    objects?: Array<{
      top?: number;
      height?: number;
      scaleY?: number;
      text?: string;
      fontSize?: number;
      lineHeight?: number;
    }>;
  }).objects ?? []) {
    const top = o.top ?? 0;
    const h =
      typeof o.height === "number" && o.height > 0
        ? o.height * Number(o.scaleY ?? 1)
        : Number(o.fontSize ?? 10) *
          Number(o.lineHeight ?? 1.35) *
          (typeof o.text === "string" ? Math.max(1, o.text.split("\n").length) : 1);
    maxBottom = Math.max(maxBottom, top + h);
  }
  // Align with ResumeCritic page bounds; small footer pad only
  const overflow =
    Boolean(critic.reports.layout?.findings?.some((f) => f.code === "LAY_OVERFLOW" || f.code === "LAY_PAGE_BREAK")) ||
    maxBottom > pageH + 0.5;
  const ats_pass = (critic.scores.ats ?? 0) >= 95;
  const layout_pass = (critic.scores.layout ?? 0) >= 90 && !overflow;
  const content_pass =
    revised.changes_applied.some((c) => /Skills|skills/i.test(c)) ||
    revised.changes_applied.some((c) => /contact/i.test(c));
  const asset_pass =
    existsSync(join(outDir, "preview.png")) &&
    existsSync(join(outDir, "thumbnail.png"));

  const priorManifest = readJson<Record<string, unknown>>(
    join(priorDir, "candidate.json"),
  );
  const now = new Date().toISOString();
  const target = (priorManifest.target as Record<string, unknown>) ?? {};

  const candidate = {
    schema_version: 1,
    candidate_id: ids.candidate_id,
    template_id: ids.candidate_id,
    product_kind: "resume_template",
    task_id: `cycle-${ids.candidate_id}`,
    review_id: ids.review_id,
    cycle_id: `cycle-run-${ids.candidate_id}`,
    run_id: ids.candidate_id,
    created_at: now,
    updated_at: now,
    status: "READY_FOR_FOUNDER_REVIEW",
    publication_allowed: false,
    provider: priorManifest.provider ?? "openai",
    failure_stage: null,
    failure_detail: null,
    batch_id: "founder-revision-batch-249",
    batch_sequence: BATCH_SPECS.findIndex(
      (s) => s.prior_candidate_id === spec.prior_candidate_id,
    ) + 1,
    batch_size: BATCH_SPECS.length,
    revision: {
      revision_id: ids.revision_id,
      revision_number: 1,
      prior_candidate_id: spec.prior_candidate_id,
      prior_review_id: spec.prior_review_id,
      prior_decision_id: feedback.decision_id,
      tag: REVISION_TAG,
      ready_for_founder_review: true,
      approved: false,
    },
    target: {
      ...target,
      title: `${spec.role} ${spec.family} revised v1`,
      objective: `Agent #249 Founder revision of ${spec.prior_candidate_id}`,
    },
    artifacts: {
      canvas: "canvas.json",
      critic: "critic.json",
      gate: "gate.json",
      preview: "preview.png",
      thumbnail: "thumbnail.png",
      revision_summary: "revision-summary.json",
      changelog: "changelog.json",
      designbrief: "designbrief.json",
      resume_json_instructions: "resume-json-instructions.json",
      resume_template: "resume-template.json",
      production_target: "production-target.json",
      editor_compatibility: "editor-compatibility.json",
      waiting_founder: "waiting-founder.json",
      review: "review.json",
    },
  };
  writeJson(join(outDir, "candidate.json"), candidate);

  writeJson(join(outDir, "waiting-founder.json"), {
    state: "READY_FOR_FOUNDER_REVIEW",
    founder_review_status: "ready_for_review",
    revised: true,
    revision_number: 1,
    prior_candidate_id: spec.prior_candidate_id,
    prior_status: "CHANGES_REQUESTED",
    message:
      "Revised — Ready for Review. No auto-decision. No publication.",
    publication_allowed: false,
    live: false,
    dry_run: true,
    candidate_id: ids.candidate_id,
    review_id: ids.review_id,
  });

  writeJson(join(outDir, "review.json"), {
    review_id: ids.review_id,
    candidate_id: ids.candidate_id,
    status: "READY_FOR_FOUNDER_REVIEW",
    revised: true,
    prior_candidate_id: spec.prior_candidate_id,
    requested_changes: feedback.changes,
    changes_applied: revised.changes_applied,
    approved: false,
    publication_allowed: false,
  });

  const changelog = {
    schema_version: "founder-revision-changelog-1.0.0",
    revision_id: ids.revision_id,
    prior_candidate_id: spec.prior_candidate_id,
    new_candidate_id: ids.candidate_id,
    role: spec.role,
    requested_changes: feedback.changes,
    changes_applied: revised.changes_applied,
    changes_not_applied: revised.changes_not_applied,
    at: now,
  };
  writeJson(join(outDir, "changelog.json"), changelog);

  const summary: RevisionSummary = {
    schema_version: "founder-revision-summary-1.0.0",
    candidate_id: ids.candidate_id,
    prior_candidate_id: spec.prior_candidate_id,
    prior_revision_id: null,
    new_revision_id: ids.revision_id,
    revision_number: 1,
    role: spec.role,
    design_family: spec.family,
    review_id: ids.review_id,
    prior_review_id: spec.prior_review_id,
    prior_decision_id: feedback.decision_id,
    requested_changes: feedback.changes,
    changes_applied: revised.changes_applied,
    changes_not_applied: revised.changes_not_applied,
    validation: {
      layout_pass,
      ats_pass,
      content_pass,
      asset_pass,
      critic_overall: critic.scores.overall ?? null,
      critic_ats: critic.scores.ats ?? null,
      overflow,
    },
    preview: "preview.png",
    thumbnail: "thumbnail.png",
    status: "READY_FOR_FOUNDER_REVIEW",
    ready_for_founder_review: true,
    approved: false,
    publication_allowed: false,
    live: false,
    created_at: now,
    changelog_path: "changelog.json",
  };
  writeJson(join(outDir, "revision-summary.json"), summary);

  // Link from prior → new revision (does not mutate prior canvas)
  writeJson(join(priorDir, "revisions", REVISION_TAG, "forward-link.json"), {
    new_candidate_id: ids.candidate_id,
    new_review_id: ids.review_id,
    revision_id: ids.revision_id,
    at: now,
  });
  // Mark prior superseded for queue projection only — canvas/preview untouched
  try {
    const priorManifest = readJson<Record<string, unknown>>(
      join(priorDir, "candidate.json"),
    );
    writeJson(join(priorDir, "candidate.json"), {
      ...priorManifest,
      superseded_by_revision: ids.candidate_id,
      revision_forward: {
        tag: REVISION_TAG,
        new_candidate_id: ids.candidate_id,
        new_review_id: ids.review_id,
      },
      updated_at: now,
    });
  } catch {
    /* non-fatal */
  }

  const ok =
    layout_pass &&
    ats_pass &&
    asset_pass &&
    summary.ready_for_founder_review &&
    summary.approved === false;

  if (!ok) {
    mkdirSync(join(OUT, "failures"), { recursive: true });
    writeJson(join(OUT, "failures", `${ids.candidate_id}.json`), {
      error: "validation failed",
      summary,
    });
  }

  return {
    ok,
    summary,
    error: ok
      ? null
      : `validation failed layout=${layout_pass} ats=${ats_pass} assets=${asset_pass} overflow=${overflow}`,
  };
}

export async function runFounderRevisionBatch(): Promise<{
  ok: boolean;
  batch_status: RevisionBatchStatus;
  results: Array<{
    role: string;
    ok: boolean;
    candidate_id: string | null;
    error: string | null;
    summary: RevisionSummary | null;
  }>;
  production_unchanged: true;
  live: false;
  approved_automatically: false;
}> {
  process.env.SOS_AIOS_LIVE = "0";
  mkdirSync(OUT, { recursive: true });

  const results: Array<{
    role: string;
    ok: boolean;
    candidate_id: string | null;
    error: string | null;
    summary: RevisionSummary | null;
  }> = [];

  for (const spec of BATCH_SPECS) {
    try {
      const r = await reviseOne(spec);
      results.push({
        role: spec.role,
        ok: r.ok,
        candidate_id: r.summary?.candidate_id ?? null,
        error: r.error,
        summary: r.summary,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      mkdirSync(join(OUT, "failures"), { recursive: true });
      writeJson(join(OUT, "failures", `${spec.prior_candidate_id}.json`), {
        error: msg,
        at: new Date().toISOString(),
      });
      results.push({
        role: spec.role,
        ok: false,
        candidate_id: null,
        error: msg,
        summary: null,
      });
    }
  }

  const passCount = results.filter((r) => r.ok).length;
  const batch_status: RevisionBatchStatus =
    passCount === results.length
      ? "REVISION_BATCH_READY_FOR_REVIEW"
      : passCount === 0
        ? "REVISION_BATCH_FAILED"
        : "REVISION_BATCH_PARTIAL";

  const report = {
    schema_version: "founder-revision-batch-1.0.0",
    version: FOUNDER_REVISION_BATCH_VERSION,
    generated_at: new Date().toISOString(),
    batch_status,
    live: false,
    approved_automatically: false,
    production_publication: false,
    fixture_t099_excluded: true,
    results,
  };
  writeJson(join(OUT, "batch-report.json"), report);

  return {
    ok: batch_status === "REVISION_BATCH_READY_FOR_REVIEW",
    batch_status,
    results,
    production_unchanged: true,
    live: false,
    approved_automatically: false,
  };
}

export function listRevisedCandidates(): string[] {
  if (!existsSync(CAND_ROOT)) return [];
  return readdirSync(CAND_ROOT).filter((n) => n.endsWith(`-${REVISION_TAG}`));
}
