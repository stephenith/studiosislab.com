/**
 * Agent #233 — Resume Template runtime projection + preview/thumbnail guarantees.
 * Storage remains candidate-compatible; Founder-facing object is a Resume Template.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { CandidateManifest, CandidateStatus } from "./CandidateStore.js";
import type { ProductionTarget } from "./ProductionTarget.js";

export type ResumeTemplateFounderStatus =
  | "ready_for_review"
  | "preview_failed"
  | "thumbnail_failed"
  | "critic_blocked"
  | "failed"
  | "running";

export type ResumeTemplateObject = {
  schema_version: 1;
  product_kind: "resume_template";
  template_id: string;
  role: string;
  category: string;
  ats_family: string | null;
  design_family: string | null;
  design_brief: string | null;
  research_summary: string | null;
  fabric_canvas: string | null;
  canvas_json: string | null;
  editor_compatibility_status: "PASS" | "FAIL" | "UNKNOWN";
  critic_score: number | null;
  ats_score: number | null;
  overall_quality_score: number | null;
  preview_png: string | null;
  thumbnail: string | null;
  generation_timestamp: string;
  publication_status: "not_published";
  founder_review_status: ResumeTemplateFounderStatus;
  /** Internal storage id (unchanged) */
  candidate_id: string;
  review_id: string;
  status: CandidateStatus;
};

export type PreviewGuaranteeErrorCode = "PREVIEW_FAILED" | "THUMBNAIL_FAILED";

export class PreviewGuaranteeError extends Error {
  readonly code: PreviewGuaranteeErrorCode;
  readonly detail: string;
  constructor(code: PreviewGuaranteeErrorCode, detail: string) {
    super(`${code}: ${detail}`);
    this.name = "PreviewGuaranteeError";
    this.code = code;
    this.detail = detail;
  }
}

function atomicWriteJson(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  renameSync(tmp, path);
}

/**
 * Mandatory preview + thumbnail. Throws PreviewGuaranteeError — never swallows.
 * Thumbnail: one regeneration attempt if missing after initial write.
 */
export async function writePreviewAndThumbnailGuaranteed(opts: {
  canvasJson: {
    version?: string;
    width?: number;
    height?: number;
    objects?: unknown[];
  };
  outputDir: string;
  reviewId: string;
}): Promise<{ preview_path: string; thumbnail_path: string }> {
  const { writePreviewAssets, thumbnailFromPreviewPng } = await import(
    "../../runtime/workers/resume-production/preview-assets.js"
  );

  const previewPath = join(opts.outputDir, "preview.png");
  const thumbPath = join(opts.outputDir, "thumbnail.png");

  try {
    await writePreviewAssets({
      json: opts.canvasJson,
      outputDir: opts.outputDir,
      reviewId: opts.reviewId,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    atomicWriteJson(join(opts.outputDir, "preview-error.json"), {
      schema_version: 1,
      code: "PREVIEW_FAILED",
      detail,
      at: new Date().toISOString(),
    });
    throw new PreviewGuaranteeError("PREVIEW_FAILED", detail);
  }

  if (!existsSync(previewPath)) {
    atomicWriteJson(join(opts.outputDir, "preview-error.json"), {
      schema_version: 1,
      code: "PREVIEW_FAILED",
      detail: "preview.png missing after writePreviewAssets",
      at: new Date().toISOString(),
    });
    throw new PreviewGuaranteeError(
      "PREVIEW_FAILED",
      "preview.png missing after writePreviewAssets",
    );
  }

  const ensureThumbnail = async (): Promise<boolean> => {
    if (existsSync(thumbPath)) return true;
    try {
      const previewBuf = readFileSync(previewPath);
      const thumb = await thumbnailFromPreviewPng(previewBuf, 0.125);
      writeFileSync(thumbPath, thumb);
      return existsSync(thumbPath);
    } catch {
      return false;
    }
  };

  if (!(await ensureThumbnail())) {
    // One regeneration attempt (brief requirement)
    if (!(await ensureThumbnail())) {
      atomicWriteJson(join(opts.outputDir, "thumbnail-error.json"), {
        schema_version: 1,
        code: "THUMBNAIL_FAILED",
        detail: "thumbnail.png missing after preview + one regeneration attempt",
        at: new Date().toISOString(),
      });
      throw new PreviewGuaranteeError(
        "THUMBNAIL_FAILED",
        "thumbnail.png missing after preview + one regeneration attempt",
      );
    }
  }

  return { preview_path: previewPath, thumbnail_path: thumbPath };
}

export function founderStatusFromCandidateStatus(
  status: CandidateStatus,
): ResumeTemplateFounderStatus {
  if (status === "WAITING_FOUNDER" || status === "READY_FOR_FOUNDER_REVIEW") {
    return "ready_for_review";
  }
  if (status === "PREVIEW_FAILED") return "preview_failed";
  if (status === "THUMBNAIL_FAILED") return "thumbnail_failed";
  if (status === "CRITIC_BLOCKED") return "critic_blocked";
  if (status === "FAILED") return "failed";
  return "running";
}

export function buildResumeTemplateObject(input: {
  manifest: CandidateManifest;
  design_brief_summary?: string | null;
  research_summary?: string | null;
  ats_family?: string | null;
  design_family?: string | null;
  editor_compatibility_status?: "PASS" | "FAIL" | "UNKNOWN";
  critic_score?: number | null;
  ats_score?: number | null;
  overall_quality_score?: number | null;
}): ResumeTemplateObject {
  const m = input.manifest;
  const preview = m.artifacts.preview ? "preview.png" : null;
  const thumbnail = m.artifacts.thumbnail ? "thumbnail.png" : null;
  return {
    schema_version: 1,
    product_kind: "resume_template",
    template_id: m.candidate_id,
    role: m.target.title,
    category: m.target.category,
    ats_family: input.ats_family ?? m.target.role_family ?? null,
    design_family: input.design_family ?? null,
    design_brief: input.design_brief_summary ?? m.artifacts.designbrief,
    research_summary: input.research_summary ?? m.artifacts.research_context,
    fabric_canvas: m.artifacts.canvas,
    canvas_json: m.artifacts.canvas ? "canvas.json" : null,
    editor_compatibility_status: input.editor_compatibility_status ?? "UNKNOWN",
    critic_score: input.critic_score ?? null,
    ats_score: input.ats_score ?? null,
    overall_quality_score: input.overall_quality_score ?? null,
    preview_png: preview,
    thumbnail,
    generation_timestamp: m.updated_at || m.created_at,
    publication_status: "not_published",
    founder_review_status: founderStatusFromCandidateStatus(m.status),
    candidate_id: m.candidate_id,
    review_id: m.review_id,
    status: m.status,
  };
}

export function writeResumeTemplateRuntimeReport(opts: {
  cycleLog: string;
  templateDir: string;
  template: ResumeTemplateObject;
}): { report_path: string; history_path: string } {
  const root = join(opts.cycleLog, "resume-template-runtime");
  const history = join(root, "history");
  mkdirSync(history, { recursive: true });
  const stamp = opts.template.generation_timestamp.replace(/[:.]/g, "-");
  const entry = {
    generated_at: new Date().toISOString(),
    agent: "233",
    template_id: opts.template.template_id,
    role: opts.template.role,
    preview: opts.template.preview_png,
    thumbnail: opts.template.thumbnail,
    ats: opts.template.ats_score,
    critic: opts.template.critic_score,
    quality: opts.template.overall_quality_score,
    status: opts.template.founder_review_status,
    publication_status: opts.template.publication_status,
    live: false,
  };
  const latest = join(root, "resume-template-runtime-report.json");
  const histPath = join(history, `template-${opts.template.template_id}-${stamp}.json`);
  atomicWriteJson(latest, {
    schema_version: 1,
    agent: "233",
    generated_at: entry.generated_at,
    latest: entry,
    template: opts.template,
  });
  atomicWriteJson(histPath, entry);
  atomicWriteJson(join(opts.templateDir, "resume-template.json"), opts.template);
  atomicWriteJson(
    join(opts.templateDir, "resume-template-runtime-report.json"),
    entry,
  );
  return { report_path: latest, history_path: histPath };
}

export function targetToTemplateLabels(target: ProductionTarget): {
  role: string;
  category: string;
} {
  return { role: target.title, category: target.category };
}
