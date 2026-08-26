/**
 * Run artifacts — write and copy pipeline outputs into run folder layout.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { BatchPlan } from "../directors/resume-production/types.js";
import type { CursorResearchResult } from "../directors/resume-production/types.js";
import type { RunFolderLayout } from "./RunManager.js";

export function writeObjective(layout: RunFolderLayout, objective: string): void {
  const body = [
    "# Founder Objective",
    "",
    objective,
    "",
    `**Run ID:** \`${layout.run_id}\``,
    `**Created:** ${new Date().toISOString()}`,
  ].join("\n");
  writeFileSync(layout.objective, body, "utf8");
}

export function writeBatchPlan(layout: RunFolderLayout, plan: BatchPlan): void {
  writeFileSync(layout.batch_plan, JSON.stringify(plan, null, 2), "utf8");
}

export function writeResearch(layout: RunFolderLayout, research: CursorResearchResult): void {
  const body = [
    "# Cursor Research (Temporary Execution Knowledge)",
    "",
    `**Job:** ${research.job_id}`,
    `**Success:** ${research.success}`,
    `**Duration:** ${research.duration_ms}ms`,
    "",
    "## Internal sources (read-only)",
    "",
    ...research.sources_consulted.map((s) => `- ${s}`),
    "",
    "## External research (temporary — not persisted to StudiosisLab knowledge)",
    "",
    ...(research.external_research.length
      ? research.external_research.map((s) => `- ${s}`)
      : ["- (none — Firecrawl MCP unavailable or skipped)"]),
    "",
    "## Intelligence applied",
    "",
    ...research.intelligence_applied.map((s) => `- ${s}`),
  ].join("\n");
  writeFileSync(layout.research, body, "utf8");
}

export function writeCursorOutput(layout: RunFolderLayout, content: string): void {
  writeFileSync(layout.cursor_output, content, "utf8");
}

export function copyGeneratedArtifacts(
  layout: RunFolderLayout,
  sourceDir: string,
  files = ["template-preview.json", "thumbnail.png", "validation.json", "design-report.md"],
): void {
  mkdirSync(layout.generated, { recursive: true });
  for (const file of files) {
    const src = join(sourceDir, file);
    if (existsSync(src)) {
      copyFileSync(src, join(layout.generated, file));
    }
  }
}

export function copyQaArtifacts(layout: RunFolderLayout, qaOutputDir: string): void {
  mkdirSync(layout.qa, { recursive: true });
  for (const file of ["validation.json", "report.md", "thumbnail.png"]) {
    const src = join(qaOutputDir, file);
    if (existsSync(src)) {
      copyFileSync(src, join(layout.qa, file));
    }
  }
}

export function writeLocalReviewPackage(
  layout: RunFolderLayout,
  opts: {
    template_path: string;
    prototype_id: string;
    qa_pass: boolean;
  },
): { review_command: string } {
  mkdirSync(layout.localhost, { recursive: true });
  const review_command = `npm run review:template -- --path=${opts.template_path}`;
  const review = {
    run_id: layout.run_id,
    prototype_id: opts.prototype_id,
    template_path: opts.template_path,
    qa_pass: opts.qa_pass,
    review_command,
    instructions: [
      "Run the review command from repo root",
      "Opens localhost editor on :3000",
      "Imports template-preview.json via __slbImportTemplate",
      "Founder reviews visually — no publishing",
    ],
    no_publish: true,
    no_registry_changes: true,
    no_manifest_changes: true,
    prepared_at: new Date().toISOString(),
  };
  writeFileSync(join(layout.localhost, "review.json"), JSON.stringify(review, null, 2));
  return { review_command };
}

export function writeLearningArtifacts(
  layout: RunFolderLayout,
  feedback: unknown,
  rules: unknown,
): void {
  mkdirSync(layout.learning, { recursive: true });
  writeFileSync(join(layout.learning, "feedback.json"), JSON.stringify(feedback, null, 2));
  writeFileSync(join(layout.learning, "updated-rules.json"), JSON.stringify(rules, null, 2));
}

export function writeRunSummary(layout: RunFolderLayout, summary: string): void {
  writeFileSync(layout.summary, summary, "utf8");
}

export function readJsonIfExists<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as T;
}
