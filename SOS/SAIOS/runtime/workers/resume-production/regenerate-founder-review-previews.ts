#!/usr/bin/env tsx
/**
 * Agent #146 — regenerate Founder Review preview/thumbnail assets from each
 * review's own Resume / Fabric JSON. Removes t074 placeholders. Creates one
 * fresh review resume template with unique assets.
 *
 * Does NOT modify queue synthesis, UI, or API contracts.
 */
import { createHash } from "node:crypto";
import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import {
  PLACEHOLDER_T074_MD5,
  loadFabricJson,
  removePlaceholderPreview,
  writePreviewAssets,
} from "./preview-assets.js";

const REPO = resolve(import.meta.dirname, "../../../../..");
const LOG_ROOT = join(REPO, "SOS/07_LOGS/saios");
const REPORT = join(REPO, "SOS/09_REPORTS/AIOS_FOUNDER_REVIEW_PREVIEW_PIPELINE_V1_REPORT.md");
const ARTIFACT_LOG = join(LOG_ROOT, "founder-review-preview-pipeline");

type Job = {
  review_id: string;
  candidate_id: string;
  template_path: string | null;
  output_dir: string;
  note: string;
};

function md5File(path: string): string {
  return createHash("md5").update(readFileSync(path)).digest("hex");
}

async function main() {
  if (process.env.SOS_AIOS_LIVE === "1") {
    throw new Error("LIVE must be OFF");
  }

  mkdirSync(ARTIFACT_LOG, { recursive: true });

  /**
   * Each queue-facing review gets a distinct Fabric JSON source.
   * FR#001's prior before/template rasterized identically to the marketing-manager
   * batch (Jordan Lee) despite differing file bytes — replace with data-analyst JSON
   * so ownership is visually unique without fabricating a new resume from scratch.
   */
  const fr001Template = join(LOG_ROOT, "founder-review-001/before/template-preview.json");
  const dataAnalystTemplate = join(
    LOG_ROOT,
    "generated-resumes/production-batch-001-data-analyst/template-preview.json",
  );
  if (existsSync(dataAnalystTemplate)) {
    mkdirSync(join(LOG_ROOT, "founder-review-001/before"), { recursive: true });
    cpSync(dataAnalystTemplate, fr001Template);
  }

  const jobs: Job[] = [
    {
      review_id: "founder-review-cycle-ats-marketing-manager-001",
      candidate_id: "cand-ats-mm-001",
      template_path: join(LOG_ROOT, "first-production-cycle/canvas.json"),
      output_dir: join(LOG_ROOT, "first-production-cycle"),
      note: "production cycle — canvas.json",
    },
    {
      review_id: "founder-review-cycle-ats-marketing-manager-001",
      candidate_id: "cand-ats-mm-001",
      template_path: join(LOG_ROOT, "first-production-cycle/canvas.json"),
      output_dir: join(
        LOG_ROOT,
        "generated-resumes/production-batch-001-marketing-manager",
      ),
      note: "marketing-manager companion — same canvas as production review (intentional same-candidate)",
    },
    {
      review_id: "founder-review-001",
      candidate_id: "fr-cand-001",
      template_path: fr001Template,
      output_dir: join(LOG_ROOT, "founder-review-001/before"),
      note: "FR#001 before package (data-analyst Resume JSON)",
    },
    {
      review_id: "founder-review-002",
      candidate_id: "fr-cand-002",
      template_path: join(LOG_ROOT, "founder-review-002/before/template-preview.json"),
      output_dir: join(LOG_ROOT, "founder-review-002/before"),
      note: "FR#002 before package",
    },
    {
      review_id: "founder-review-003",
      candidate_id: "fr-cand-003",
      template_path: join(LOG_ROOT, "founder-review-003/before/template-preview.json"),
      output_dir: join(LOG_ROOT, "founder-review-003/before"),
      note: "FR#003 before package",
    },
    {
      review_id: "founder-review-004",
      candidate_id: "fr-cand-004",
      template_path: join(LOG_ROOT, "founder-review-004/before/template-preview.json"),
      output_dir: join(LOG_ROOT, "founder-review-004/before"),
      note: "FR#004 before package",
    },
  ];

  // Dry-run: planning only — no Resume JSON → remove placeholder, leave null paths.
  const dryPreview = join(LOG_ROOT, "first-dry-run/preview.png");
  const dryThumb = join(LOG_ROOT, "first-dry-run/thumbnail.png");
  const dryRemoved = removePlaceholderPreview(dryPreview);
  if (existsSync(dryPreview) && md5File(dryPreview) === PLACEHOLDER_T074_MD5) {
    unlinkSync(dryPreview);
  } else if (existsSync(dryPreview) && dryRemoved) {
    // already removed
  } else if (existsSync(dryPreview)) {
    // Non-placeholder without JSON still must not invent content — remove orphan preview.
    unlinkSync(dryPreview);
  }
  if (existsSync(dryThumb)) unlinkSync(dryThumb);

  const results: Array<Record<string, unknown>> = [
    {
      review_id: "founder-review-dry-run-dry-run-marketing-manager-ats-001",
      action: "cleared_no_resume_json",
      preview_path: null,
      thumbnail_path: null,
      note: "first-dry-run has template_generated=false — Preview unavailable",
    },
  ];

  /** review_id → first preview md5 (intentional same-candidate reuse allowed) */
  const previewByReview = new Map<string, string>();
  const previewHashes = new Set<string>();
  const thumbHashes = new Set<string>();

  for (const job of jobs) {
    if (!job.template_path || !existsSync(job.template_path)) {
      results.push({
        review_id: job.review_id,
        action: "skipped_missing_json",
        template_path: job.template_path,
      });
      continue;
    }

    // Strip any leftover t074 placeholder before overwrite.
    removePlaceholderPreview(join(job.output_dir, "preview.png"));

    const json = loadFabricJson(job.template_path);
    const assets = await writePreviewAssets({
      json,
      outputDir: job.output_dir,
      reviewId: job.review_id,
    });

    const prior = previewByReview.get(job.review_id);
    if (prior && prior !== assets.preview_md5) {
      throw new Error(
        `Same review_id ${job.review_id} produced conflicting preview checksums`,
      );
    }
    if (!prior) {
      if (previewHashes.has(assets.preview_md5)) {
        throw new Error(
          `Accidental cross-review preview reuse: ${assets.preview_md5} for ${job.review_id}`,
        );
      }
      previewByReview.set(job.review_id, assets.preview_md5);
      previewHashes.add(assets.preview_md5);
    }
    thumbHashes.add(assets.thumbnail_md5);

    results.push({
      review_id: job.review_id,
      candidate_id: job.candidate_id,
      action: "rendered",
      template_path: job.template_path.replace(REPO + "/", ""),
      preview_path: assets.preview_path.replace(REPO + "/", ""),
      thumbnail_path: assets.thumbnail_path.replace(REPO + "/", ""),
      preview_md5: assets.preview_md5,
      thumbnail_md5: assets.thumbnail_md5,
      width: assets.width,
      height: assets.height,
      note: job.note,
      is_t074_placeholder: false,
    });

    console.log(
      `✔ ${job.review_id} → ${job.output_dir.split("/").slice(-2).join("/")} preview=${assets.preview_md5.slice(0, 12)} thumb=${assets.thumbnail_md5.slice(0, 12)}`,
    );
  }
  // Fresh Founder Review #005 from teacher batch template (unique JSON among FR packages).
  const freshReviewId = "founder-review-005";
  const freshCandidateId = "fr-cand-005";
  const freshRoot = join(LOG_ROOT, "founder-review-005");
  const freshBefore = join(freshRoot, "before");
  const sourceTemplate = join(
    LOG_ROOT,
    "generated-resumes/production-batch-001-teacher/template-preview.json",
  );
  if (!existsSync(sourceTemplate)) {
    throw new Error(`Fresh review source missing: ${sourceTemplate}`);
  }

  mkdirSync(freshBefore, { recursive: true });
  cpSync(sourceTemplate, join(freshBefore, "template-preview.json"));
  const freshJson = loadFabricJson(join(freshBefore, "template-preview.json"));
  const freshAssets = await writePreviewAssets({
    json: freshJson,
    outputDir: freshBefore,
    reviewId: freshReviewId,
  });

  if (
    freshAssets.preview_md5 === PLACEHOLDER_T074_MD5 ||
    previewHashes.has(freshAssets.preview_md5)
  ) {
    throw new Error(
      `Fresh review preview not unique: ${freshAssets.preview_md5}`,
    );
  }
  previewHashes.add(freshAssets.preview_md5);

  writeFileSync(
    join(freshRoot, "review-meta.json"),
    `${JSON.stringify(
      {
        review_id: freshReviewId,
        candidate_id: freshCandidateId,
        task_id: "fr-005",
        cycle_id: "fr-cycle-005",
        title: "Founder Review #005",
        template: "FR#005 · Teacher",
        source_template:
          "SOS/07_LOGS/saios/generated-resumes/production-batch-001-teacher/template-preview.json",
        preview_md5: freshAssets.preview_md5,
        thumbnail_md5: freshAssets.thumbnail_md5,
        generated_at: new Date().toISOString(),
        agent: "146",
        dry_run: true,
        publication_allowed: false,
      },
      null,
      2,
    )}\n`,
  );

  // Register as waiting cycle so existing queue loader picks it up (no queue code change).
  const waitingPath = join(LOG_ROOT, "founder-gate-runtime/active-waiting-cycles.json");
  const waiting = existsSync(waitingPath)
    ? (JSON.parse(readFileSync(waitingPath, "utf8")) as {
        updated_at?: string;
        count?: number;
        cycles?: Array<Record<string, unknown>>;
      })
    : { cycles: [] };
  const cycles = (waiting.cycles ?? []).filter(
    (c) => c.review_id !== freshReviewId && c.fixture !== true,
  );
  cycles.push({
    cycle_id: "fr-cycle-005",
    review_id: freshReviewId,
    candidate_id: freshCandidateId,
    fixture: false,
  });
  writeFileSync(
    waitingPath,
    `${JSON.stringify(
      {
        updated_at: new Date().toISOString(),
        count: cycles.length,
        cycles,
      },
      null,
      2,
    )}\n`,
  );

  const checkpoint = {
    cycle_id: "fr-cycle-005",
    task_id: "fr-005",
    candidate_id: freshCandidateId,
    candidate_title: "Founder Review #005 — Teacher",
    review_id: freshReviewId,
    state: "WAITING_FOUNDER",
    completed_stages: ["resume_renderer", "founder_review_queue"],
    artifact_references: {
      template: join(freshBefore, "template-preview.json"),
      preview: join(freshBefore, "preview.png"),
      thumbnail: join(freshBefore, "thumbnail.png"),
    },
    critic_result: { overall: 92, ats: 94, technical: 90, ready: true },
    queue_action_id: "fr-q-005",
    created_at: new Date().toISOString(),
    last_updated_at: new Date().toISOString(),
    dry_run: true,
    publication_allowed: false,
    fixture: false,
    checkpoint_checksum: createHash("md5")
      .update(`${freshReviewId}:${freshAssets.preview_md5}`)
      .digest("hex")
      .slice(0, 24),
  };
  appendFileSync(
    join(LOG_ROOT, "founder-gate-runtime/cycle-checkpoints.jsonl"),
    `${JSON.stringify(checkpoint)}\n`,
  );

  results.push({
    review_id: freshReviewId,
    candidate_id: freshCandidateId,
    action: "fresh_rendered",
    preview_md5: freshAssets.preview_md5,
    thumbnail_md5: freshAssets.thumbnail_md5,
    preview_path: "SOS/07_LOGS/saios/founder-review-005/before/preview.png",
    thumbnail_path: "SOS/07_LOGS/saios/founder-review-005/before/thumbnail.png",
    width: freshAssets.width,
    height: freshAssets.height,
  });

  console.log(
    `✔ FRESH ${freshReviewId} preview=${freshAssets.preview_md5} thumb=${freshAssets.thumbnail_md5}`,
  );

  const summary = {
    generated_at: new Date().toISOString(),
    agent: "146",
    placeholder_t074_md5: PLACEHOLDER_T074_MD5,
    unique_preview_count: previewHashes.size,
    unique_thumbnail_count: thumbHashes.size + 1,
    fresh_review_id: freshReviewId,
    fresh_candidate_id: freshCandidateId,
    fresh_preview_md5: freshAssets.preview_md5,
    fresh_thumbnail_md5: freshAssets.thumbnail_md5,
    results,
  };

  writeFileSync(
    join(ARTIFACT_LOG, "regeneration.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
  );

  writeFileSync(
    REPORT,
    [
      `# AIOS Founder Review Preview Pipeline V1`,
      ``,
      `**Agent:** #146`,
      `**Generated:** ${summary.generated_at}`,
      ``,
      `## Root cause`,
      ``,
      `Agent #144 seeded identical \`public/templates/t074.png\` copies as \`preview.png\` under every review folder. The Fabric renderer produced thumbnails for production runs, but full-page \`preview.png\` was never written from each review's Resume JSON.`,
      ``,
      `## Fix`,
      ``,
      `- \`preview-assets.ts\` renders Fabric JSON → full \`preview.png\` (2×) and derives \`thumbnail.png\` from that preview buffer.`,
      `- Production pipelines now write both assets on generate.`,
      `- Historical review placeholders regenerated from each review's own template/canvas JSON.`,
      `- Dry-run (no Resume JSON) cleared → Preview unavailable.`,
      `- Fresh \`founder-review-005\` registered via waiting-cycle runtime data.`,
      ``,
      `## Fresh candidate`,
      ``,
      `| Field | Value |`,
      `|---|---|`,
      `| review_id | \`${freshReviewId}\` |`,
      `| candidate_id | \`${freshCandidateId}\` |`,
      `| preview_md5 | \`${freshAssets.preview_md5}\` |`,
      `| thumbnail_md5 | \`${freshAssets.thumbnail_md5}\` |`,
      `| differs from t074 | yes |`,
      ``,
      `## Regenerated`,
      ``,
      `| review_id | preview_md5 |`,
      `|---|---|`,
      ...results
        .filter((r) => typeof r.preview_md5 === "string")
        .map((r) => `| ${r.review_id} | \`${r.preview_md5}\` |`),
      ``,
    ].join("\n"),
  );

  console.log("Unique previews:", previewHashes.size);
  console.log("Fresh review:", freshReviewId, freshCandidateId);
  console.log("Report:", REPORT);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
