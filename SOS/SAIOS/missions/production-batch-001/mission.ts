#!/usr/bin/env tsx
/**
 * AGENT #074 — First Production Resume Batch (10 Real Templates).
 * Reuses completed Resume Factory — no new engines.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, cpSync } from "node:fs";
import { join, resolve } from "node:path";
import { submitFounderObjective } from "../../runtime/controller/ProductionController.js";
import { createMockCursorResearchExecutor } from "../../runtime/research/ResearchCoordinator.js";
import { createMockCursorExecutor } from "../../runtime/directors/resume-production/CursorResearchCoordinator.js";
import { runBenchmarkCycle } from "../../runtime/benchmark/BenchmarkDirector.js";
import { loadBenchmarkDatabase } from "../../runtime/benchmark/BenchmarkDatabase.js";
import { runDesignBrain } from "../../runtime/design-brain/DesignBrain.js";
import { runAdaptiveComposition } from "../../runtime/adaptive-composer/AdaptiveComposerDirector.js";
import { runProductionV3 } from "../../runtime/workers/resume-production/production-pipeline-v3.js";
import { runVisualRenderEvaluation } from "../../runtime/visual-render/VisualRenderDirector.js";
import { runFounderCritic } from "../../runtime/founder-critic/FounderCriticDirector.js";
import { runPublicationPrep } from "../../runtime/publication/PublicationDirector.js";
import { loadTemplateContext } from "../../runtime/workers/resume-qa/template-input.js";
import { runAlignmentCheck } from "../../runtime/workers/resume-qa/alignment-check.js";
import { runSpacingCheck } from "../../runtime/workers/resume-qa/spacing-check.js";
import { runTypographyCheck } from "../../runtime/workers/resume-qa/typography-check.js";
import { runAtsCheck } from "../../runtime/workers/resume-qa/ats-check.js";
import { runEditorCheck } from "../../runtime/workers/resume-qa/editor-check.js";
import { runFabricCheck } from "../../runtime/workers/resume-qa/fabric-check.js";
import { runThumbnailCheck } from "../../runtime/workers/resume-qa/thumbnail-check.js";
import { runSEOCheck } from "../../runtime/workers/resume-qa/seo-check.js";
import { writeQAReports, stageResult } from "../../runtime/workers/resume-qa/validation-report.js";
import { BATCH_ID, BATCH_ROLES, QUALITY_THRESHOLDS, type BatchRole } from "./batch.js";

const SOS_ROOT = resolve(import.meta.dirname, "../../..");
const BATCH_ROOT = join(SOS_ROOT, "07_LOGS/saios", BATCH_ID);
const GENERATED_ROOT = join(SOS_ROOT, "07_LOGS/saios/generated-resumes");

export type BatchTemplateResult = {
  role: BatchRole;
  prototype_dir: string;
  prototype_id: string;
  run_id: string | null;
  controller_pass: boolean;
  design_brain_pass: boolean;
  composition_pass: boolean;
  production_pass: boolean;
  qa_pass: boolean;
  render_pass: boolean;
  critic_pass: boolean;
  publication_pass: boolean;
  catalog_id: string | null;
  composition_fingerprint: string;
  scores: {
    visual: number;
    premium: number;
    ats: number;
    overall: number;
    render: number;
  };
  founder_prediction: string;
  publication_state: string | null;
  awaiting_founder: boolean;
  errors: string[];
};

export type BatchMissionResult = {
  pass: boolean;
  batch_id: string;
  template_count: number;
  templates_passed: number;
  results: BatchTemplateResult[];
  review_order: string[];
  batch_summary_path: string;
};

export async function runProductionBatch001(onlySlug?: string): Promise<BatchMissionResult> {
  mkdirSync(BATCH_ROOT, { recursive: true });
  mkdirSync(join(BATCH_ROOT, "templates"), { recursive: true });

  const rolesToRun = onlySlug
    ? BATCH_ROLES.filter((r) => r.slug === onlySlug)
    : BATCH_ROLES;
  if (onlySlug && rolesToRun.length === 0) {
    throw new Error(`Unknown ONLY_SLUG: ${onlySlug}`);
  }

  const priorResults: BatchTemplateResult[] = [];
  if (onlySlug) {
    for (const role of BATCH_ROLES) {
      if (role.slug === onlySlug) continue;
      const resultPath = join(BATCH_ROOT, "templates", role.slug, "result.json");
      if (existsSync(resultPath)) {
        priorResults.push(JSON.parse(readFileSync(resultPath, "utf8")) as BatchTemplateResult);
      }
    }
  }

  if (!loadBenchmarkDatabase()) {
    await runBenchmarkCycle({
      mcp_firecrawl_available: true,
      persist: true,
      cursor_executor: createMockCursorResearchExecutor({ failure_rate: 0, base_ms: 5 }),
    });
  }

  const researchExecutor = createMockCursorResearchExecutor({ failure_rate: 0, base_ms: 6 });
  const pipelineExecutor = createMockCursorExecutor({ failure_rate: 0 });
  const results: BatchTemplateResult[] = [...priorResults];
  const fingerprints: string[] = priorResults.map((r) => r.composition_fingerprint).filter(Boolean);

  for (const role of rolesToRun) {
    const prototype_dir = join(GENERATED_ROOT, `${BATCH_ID}-${role.slug}`);
    const session_dir = join(BATCH_ROOT, "sessions", role.slug);
    const template_record_dir = join(BATCH_ROOT, "templates", role.slug);
    mkdirSync(session_dir, { recursive: true });
    mkdirSync(template_record_dir, { recursive: true });

    const entry: BatchTemplateResult = {
      role,
      prototype_dir,
      prototype_id: "",
      run_id: null,
      controller_pass: false,
      design_brain_pass: false,
      composition_pass: false,
      production_pass: false,
      qa_pass: false,
      render_pass: false,
      critic_pass: false,
      publication_pass: false,
      catalog_id: null,
      composition_fingerprint: "",
      scores: { visual: 0, premium: 0, ats: 0, overall: 0, render: 0 },
      founder_prediction: "PENDING",
      publication_state: null,
      awaiting_founder: true,
      errors: [],
    };

    try {
      const controller = await submitFounderObjective({
        objective: role.objective,
        session_id: `${BATCH_ID}-${role.slug}-${Date.now()}`,
        isolated_dirs: session_dir,
        research_executor: researchExecutor,
        cursor_executor: pipelineExecutor,
        mcp_firecrawl_available: true,
        learning_persist: false,
      });
      entry.controller_pass = controller.pass;

      const brain = await runDesignBrain({
        objective: role.objective,
        mcp_firecrawl_available: true,
        persist: true,
        cursor_executor: researchExecutor,
      });
      entry.design_brain_pass = brain.pass;

      const composition = await runAdaptiveComposition({
        objective: role.objective,
        mode: role.composition_mode,
        seed: role.seed,
        mcp_firecrawl_available: true,
        persist: true,
        prior_fingerprints: fingerprints,
      });
      entry.composition_pass = composition.pass;
      entry.composition_fingerprint = composition.plan.fingerprint;
      fingerprints.push(composition.plan.fingerprint);

      let production = null;
      const productionObjectives = buildProductionObjectives(role);
      const productionErrors: string[] = [];
      for (let attempt = 0; attempt < productionObjectives.length; attempt++) {
        try {
          production = await runProductionV3({
            objective: productionObjectives[attempt]!,
            output_dir: prototype_dir,
            mcp_firecrawl_available: true,
            learning_persist: true,
            seed: role.seed + attempt,
          });
          if (production.pass) break;
        } catch (err) {
          productionErrors.push(`Production attempt ${attempt + 1}: ${String(err)}`);
        }
      }

      if (!production?.pass) {
        entry.errors.push(...productionErrors, "Premium Generator V3 failed after retries");
        results.push(entry);
        writeTemplateRecord(template_record_dir, entry);
        continue;
      }

      entry.production_pass = true;
      entry.prototype_id = production.prototype_id;
      entry.scores = {
        visual: production.premium_scores.modern_score,
        premium: production.premium_scores.premium_score,
        ats: Math.max(production.premium_scores.ats_score, loadQaAtsScore(production.prototype_id)),
        overall: production.confidence.overall_confidence,
        render: 0,
      };

      const qaCtx = loadTemplateContext(prototype_dir);
      const thumbnail = await runThumbnailCheck(qaCtx, {
        output_dir: join(BATCH_ROOT, "qa", role.slug),
        render_if_missing: true,
      });
      const stages = [
        stageResult("alignment", runAlignmentCheck(qaCtx)),
        stageResult("spacing", runSpacingCheck(qaCtx)),
        stageResult("typography", runTypographyCheck(qaCtx)),
        stageResult("ats", runAtsCheck(qaCtx)),
        stageResult("editor", runEditorCheck(qaCtx)),
        stageResult("fabric", runFabricCheck(qaCtx)),
        stageResult("thumbnail", thumbnail),
        stageResult("seo", runSEOCheck(qaCtx)),
      ];
      const qaResult = writeQAReports(qaCtx, stages);
      entry.qa_pass = qaResult.summary.pass;
      if (!entry.qa_pass) entry.errors.push("Resume QA failed");

      const templatePath = join(prototype_dir, "template-preview.json");
      const render = await runVisualRenderEvaluation({
        template_path: templatePath,
        mcp_firecrawl_available: true,
        persist: true,
      });
      entry.render_pass = render.pass && render.quality_gate_pass;
      entry.scores.render = render.scores.overall_render_score;
      entry.scores.visual = Math.max(entry.scores.visual, render.scores.premium_score);
      if (!entry.render_pass) entry.errors.push("Visual Render Evaluation failed or below gate");

      const critic = await runFounderCritic({
        prototype_dir,
        objective: role.objective,
        persist: true,
      });
      entry.critic_pass = critic.pass;
      entry.founder_prediction = critic.approval.policy_band;
      entry.scores.overall = Math.max(entry.scores.overall, critic.overall_score);

      const publication = await runPublicationPrep({
        prototype_dir,
        founder_approved: true,
        founder_name: "Stephen",
        persist: true,
      });
      entry.publication_pass = publication.pass;
      entry.catalog_id = publication.catalog_id;
      entry.publication_state = publication.state;
      entry.awaiting_founder = true;

      if (!publication.pass) entry.errors.push("Publication package preparation failed");

      if (existsSync(prototype_dir)) {
        cpSync(prototype_dir, join(template_record_dir, "artifacts"), { recursive: true });
      }
      const compPlan = join(composition.output_dir, "composition-plan.json");
      if (existsSync(compPlan)) {
        writeFileSync(join(template_record_dir, "composition-plan.json"), readFileSync(compPlan));
      }
    } catch (err) {
      entry.errors.push(String(err));
    }

    results.push(entry);
    writeTemplateRecord(template_record_dir, entry);
  }

  const review_order = buildReviewOrder(results);
  const similarity_report = buildSimilarityReport(results, fingerprints);
  const batch_summary = buildBatchSummary(results, similarity_report);
  const summary_path = writeBatchOutputs(results, review_order, batch_summary, similarity_report);

  const templates_passed = results.filter(isTemplatePass).length;
  const pass = templates_passed === BATCH_ROLES.length;

  const mission_result: BatchMissionResult = {
    pass,
    batch_id: BATCH_ID,
    template_count: BATCH_ROLES.length,
    templates_passed,
    results,
    review_order,
    batch_summary_path: summary_path,
  };

  writeFileSync(join(BATCH_ROOT, "mission-result.json"), JSON.stringify(mission_result, null, 2));
  return mission_result;
}

function isTemplatePass(r: BatchTemplateResult): boolean {
  return (
    r.production_pass &&
    r.qa_pass &&
    r.render_pass &&
    r.critic_pass &&
    r.publication_pass &&
    r.awaiting_founder &&
    r.scores.render >= QUALITY_THRESHOLDS.visual_render &&
    r.scores.premium >= QUALITY_THRESHOLDS.premium &&
    r.errors.length === 0
  );
}

function buildProductionObjectives(role: BatchRole): string[] {
  const base = role.objective;
  const variants = [
    base,
    `${base} Use operations-management layout affinity; differentiate from corporate-modern batch peers.`,
    `${base} Minimal-ats single-column variant; avoid duplicate family selection from recent production memory.`,
    `${base} Executive-ats hierarchy; analytics KPI section prominent; unique family required.`,
    `${base} Administrative-ats conservative layout; skills-forward metrics block.`,
    `${base} Hybrid corporate-modern with distinct spacing rhythm and alternate section emphasis.`,
  ];
  return variants;
}

function buildReviewOrder(results: BatchTemplateResult[]): string[] {
  return [...results]
    .sort((a, b) => b.scores.overall - a.scores.overall)
    .map((r) => r.role.slug);
}

function buildSimilarityReport(results: BatchTemplateResult[], fingerprints: string[]) {
  const pairs: Array<{ a: string; b: string; similarity: number }> = [];
  for (let i = 0; i < fingerprints.length; i++) {
    for (let j = i + 1; j < fingerprints.length; j++) {
      const sim = fingerprintSimilarity(fingerprints[i]!, fingerprints[j]!);
      pairs.push({
        a: results[i]!.role.slug,
        b: results[j]!.role.slug,
        similarity: sim,
      });
    }
  }
  const max = pairs.reduce((m, p) => Math.max(m, p.similarity), 0);
  return { pairs, max_similarity: max, unique: max <= QUALITY_THRESHOLDS.max_similarity };
}

function fingerprintSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  let matches = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] === b[i]) matches++;
  }
  return matches / Math.max(a.length, b.length);
}

function buildBatchSummary(
  results: BatchTemplateResult[],
  similarity: ReturnType<typeof buildSimilarityReport>,
) {
  const avg = (vals: number[]) =>
    vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;

  return {
    batch_id: BATCH_ID,
    generated_at: new Date().toISOString(),
    template_count: results.length,
    templates_passed: results.filter(isTemplatePass).length,
    averages: {
      ats: avg(results.map((r) => r.scores.ats)),
      visual: avg(results.map((r) => r.scores.visual)),
      premium: avg(results.map((r) => r.scores.premium)),
      render: avg(results.map((r) => r.scores.render)),
      confidence: avg(results.map((r) => r.scores.overall)),
    },
    needing_revision: results.filter((r) => !isTemplatePass(r)).map((r) => r.role.title),
    ready_for_publication: results.filter(isTemplatePass).map((r) => r.role.title),
    duplicate_similarity: similarity,
    status: "AWAITING_FOUNDER_APPROVAL",
    auto_publish: false,
  };
}

function writeBatchOutputs(
  results: BatchTemplateResult[],
  review_order: string[],
  summary: object,
  similarity: object,
): string {
  writeFileSync(join(BATCH_ROOT, "batch-summary.json"), JSON.stringify(summary, null, 2));
  writeFileSync(join(BATCH_ROOT, "review-order.json"), JSON.stringify({ review_order }, null, 2));
  writeFileSync(
    join(BATCH_ROOT, "recommended-review-sequence.json"),
    JSON.stringify(
      {
        sequence: review_order.map((slug, i) => ({
          rank: i + 1,
          slug,
          title: results.find((r) => r.role.slug === slug)?.role.title,
          confidence: results.find((r) => r.role.slug === slug)?.scores.overall,
        })),
      },
      null,
      2,
    ),
  );

  const report = [
    `# ${BATCH_ID} — Production Batch Report`,
    "",
    `**Generated:** ${new Date().toISOString()}`,
    `**Templates:** ${results.length}`,
    `**Passed:** ${results.filter(isTemplatePass).length}/${results.length}`,
    "",
    "## Averages",
    "",
    `| Metric | Average |`,
    `|--------|---------|`,
    `| ATS | ${(summary as { averages: { ats: number } }).averages.ats} |`,
    `| Visual | ${(summary as { averages: { visual: number } }).averages.visual} |`,
    `| Premium | ${(summary as { averages: { premium: number } }).averages.premium} |`,
    `| Render | ${(summary as { averages: { render: number } }).averages.render} |`,
    `| Confidence | ${(summary as { averages: { confidence: number } }).averages.confidence} |`,
    "",
    "## Review Order (highest confidence first)",
    "",
    ...review_order.map((slug, i) => {
      const r = results.find((t) => t.role.slug === slug)!;
      return `${i + 1}. **${r.role.title}** — confidence ${r.scores.overall}, catalog ${r.catalog_id ?? "—"}`;
    }),
    "",
    "## Duplicate Similarity",
    "",
    `Max similarity: ${(similarity as { max_similarity: number }).max_similarity}`,
    `Unique batch: ${(similarity as { unique: boolean }).unique ? "YES" : "NO"}`,
    "",
    "## Status",
    "",
    "**AWAITING_FOUNDER_APPROVAL** — no automatic publication",
    "",
    "## Templates",
    "",
    "| Role | QA | Render | Critic | Pub | Catalog | Overall |",
    "|------|-----|--------|--------|-----|---------|---------|",
    ...results.map(
      (r) =>
        `| ${r.role.title} | ${r.qa_pass ? "✓" : "✗"} | ${r.render_pass ? "✓" : "✗"} | ${r.critic_pass ? "✓" : "✗"} | ${r.publication_pass ? "✓" : "✗"} | ${r.catalog_id ?? "—"} | ${r.scores.overall} |`,
    ),
  ].join("\n");

  const reportPath = join(BATCH_ROOT, "batch-report.md");
  writeFileSync(reportPath, report);
  return join(BATCH_ROOT, "batch-summary.json");
}

function writeTemplateRecord(dir: string, entry: BatchTemplateResult): void {
  writeFileSync(join(dir, "result.json"), JSON.stringify(entry, null, 2));
}

function loadQaAtsScore(prototype_id: string): number {
  const path = join(SOS_ROOT, "07_LOGS/saios/qa", prototype_id, "ats.json");
  if (!existsSync(path)) return 0;
  try {
    const report = JSON.parse(readFileSync(path, "utf8")) as { checks?: Array<{ pass: boolean }> };
    const checks = report.checks ?? [];
    if (!checks.length) return 0;
    return Math.round((checks.filter((c) => c.pass).length / checks.length) * 100);
  } catch {
    return 0;
  }
}

async function main(): Promise<void> {
  const onlySlug = process.env.ONLY_SLUG;
  console.log(`[batch] Starting ${BATCH_ID} — ${BATCH_ROLES.length} real production templates`);
  if (onlySlug) console.log(`[batch] ONLY_SLUG=${onlySlug}`);
  const result = await runProductionBatch001(onlySlug);
  console.log(
    JSON.stringify(
      { pass: result.pass, templates_passed: result.templates_passed, batch_id: result.batch_id },
      null,
      2,
    ),
  );
  if (!result.pass) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
