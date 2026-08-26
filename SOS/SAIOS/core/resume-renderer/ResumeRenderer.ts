/**
 * ResumeRenderer — orchestrates deterministic execution of Resume JSON.
 * Does not call Brain, OpenAI, or modify DesignBrief.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { buildCanvasJson } from "./CanvasBuilder.js";
import { fitContentDensity } from "./ContentDensityFitter.js";
import { detectOverflow } from "./OverflowDetector.js";
import { buildPageLayout } from "./PageLayoutEngine.js";
import { validateRender } from "./RenderValidator.js";
import { renderSpacing } from "./SpacingRenderer.js";
import { renderTheme } from "./ThemeRenderer.js";
import { renderTypography } from "./TypographyRenderer.js";
import type {
  LayoutMargins,
  PreviewDocument,
  RenderTree,
  ResumeJsonInput,
  ResumeRenderResult,
  ResumeRendererOptions,
} from "./types.js";

function atomicWriteJson(path: string, data: unknown): void {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  renameSync(tmp, path);
}

function loadResumeJson(path: string): ResumeJsonInput {
  return JSON.parse(readFileSync(path, "utf8")) as ResumeJsonInput;
}

function loadMargins(path: string | undefined): LayoutMargins | undefined {
  if (!path || !existsSync(path)) return undefined;
  const raw = JSON.parse(readFileSync(path, "utf8")) as {
    margins_px?: LayoutMargins;
    content_width_px?: number;
  };
  if (!raw.margins_px) return undefined;
  return {
    ...raw.margins_px,
    content_width_px: raw.content_width_px,
  };
}

function loadBriefMeta(briefPath: string): {
  brief_id: string | null;
  task_id: string | null;
} {
  if (!existsSync(briefPath)) return { brief_id: null, task_id: null };
  const brief = JSON.parse(readFileSync(briefPath, "utf8")) as {
    brief_id?: string;
    source?: { task_id?: string | null };
  };
  return {
    brief_id: brief.brief_id ?? null,
    task_id: brief.source?.task_id ?? null,
  };
}

export class ResumeRenderer {
  constructor(private readonly repoRoot: string) {}

  render(opts: ResumeRendererOptions = {}): ResumeRenderResult {
    if (process.env.SOS_AIOS_LIVE === "1") {
      throw new Error("ResumeRenderer refuses to run while SOS_AIOS_LIVE=1");
    }

    const root = opts.repoRoot ?? this.repoRoot;
    const resumeJsonPath =
      opts.resumeJsonPath ??
      join(root, "SOS/07_LOGS/saios/designbrief/resume-json-instructions.json");
    const layoutPath =
      opts.layoutBlueprintPath ??
      join(root, "SOS/07_LOGS/saios/designbrief/layout-blueprint.json");
    const briefPath = join(root, "SOS/07_LOGS/saios/designbrief/design-brief.json");

    const resume = opts.resume_json ?? loadResumeJson(resumeJsonPath);
    const margins = opts.margins ?? loadMargins(layoutPath);
    const meta = loadBriefMeta(briefPath);
    const brief_id = opts.briefId ?? meta.brief_id;
    const task_id = opts.taskId ?? meta.task_id;

    // Execute instructions — never mutate DesignBrief / resume input object deeply for persistence of source
    const theme = renderTheme(resume);
    const typography = renderTypography(resume);
    const spacing = renderSpacing(resume);
    const layout = buildPageLayout(resume, margins);
    const { sections, cursor_end_y } = fitContentDensity({
      resume,
      layout,
      theme,
      typography,
      spacing,
    });

    const rootNode = {
      id: "page-root",
      kind: "page" as const,
      x: 0,
      y: 0,
      width: layout.width_px,
      height: layout.height_px,
      fill: layout.background,
      children: sections,
    };

    const render_tree: RenderTree = {
      version: "resume-render-tree-1.0.0",
      dry_run: true,
      page: {
        width_px: layout.width_px,
        height_px: layout.height_px,
        background: layout.background,
      },
      root: rootNode,
      cursor_end_y,
      content_bottom_y: cursor_end_y,
    };

    const canvas_json = buildCanvasJson({
      tree: render_tree,
      source_version: resume.version,
      brief_id,
      task_id,
    });

    const overflow = detectOverflow(render_tree);
    const validation = validateRender({
      resume,
      tree: render_tree,
      canvas: canvas_json,
      overflow,
    });

    const outDir = join(
      root,
      opts.fixture
        ? "SOS/07_LOGS/saios/resume-renderer/fixtures"
        : "SOS/07_LOGS/saios/resume-renderer",
    );
    const canvas_path = join(outDir, "canvas.json");
    const tree_path = join(outDir, "render-tree.json");

    const preview: PreviewDocument = {
      version: "resume-preview-1.0.0",
      dry_run: true,
      publication_allowed: false,
      status: !validation.pass
        ? "invalid"
        : overflow.overflow
          ? "overflow"
          : "preview_ready",
      founder_review_required: true,
      canvas_path: "SOS/07_LOGS/saios/resume-renderer/canvas.json",
      render_tree_path: "SOS/07_LOGS/saios/resume-renderer/render-tree.json",
      notes: [
        "Deterministic render from DesignBrief Resume JSON",
        "Fictional sample content only",
        "DesignBrief was not modified",
        "No publication",
        "No LIVE",
        "Awaiting founder review of preview",
      ],
    };

    const wrote_artifacts: string[] = [];
    if (opts.persist !== false) {
      mkdirSync(outDir, { recursive: true });
      atomicWriteJson(tree_path, render_tree);
      atomicWriteJson(canvas_path, canvas_json);
      atomicWriteJson(join(outDir, "overflow.json"), overflow);
      atomicWriteJson(join(outDir, "validation.json"), validation);
      atomicWriteJson(join(outDir, "preview.json"), preview);
      atomicWriteJson(join(outDir, "render-index.json"), {
        updated_at: new Date().toISOString(),
        brief_id,
        task_id,
        fabric_version: canvas_json.version,
        dry_run: true,
        publication_allowed: false,
        template_generated: false,
        published: false,
        validation_pass: validation.pass,
        overflow: overflow.overflow,
        object_count: canvas_json.objects.length,
        schema: canvas_json.aios?.schema ?? null,
      });
      writeFileSync(
        join(outDir, "resume-renderer-report.md"),
        [
          `# Resume Renderer Report`,
          ``,
          `- brief_id: \`${brief_id}\``,
          `- task_id: \`${task_id}\``,
          `- fabric_version: ${canvas_json.version}`,
          `- objects: ${canvas_json.objects.length}`,
          `- overflow: ${overflow.overflow}`,
          `- validation: ${validation.pass ? "PASS" : "FAIL"}`,
          `- publication_allowed: false`,
          `- dry_run: true`,
          ``,
        ].join("\n"),
        "utf8",
      );
      wrote_artifacts.push(
        tree_path,
        canvas_path,
        join(outDir, "overflow.json"),
        join(outDir, "validation.json"),
        join(outDir, "preview.json"),
        join(outDir, "render-index.json"),
        join(outDir, "resume-renderer-report.md"),
      );
    }

    return {
      render_tree,
      canvas_json,
      overflow,
      validation,
      preview,
      wrote_artifacts,
      overall: validation.pass ? "PASS" : "FAIL",
    };
  }
}

export function createResumeRenderer(repoRoot?: string): ResumeRenderer {
  return new ResumeRenderer(repoRoot ?? resolve(import.meta.dirname, "../../../.."));
}
