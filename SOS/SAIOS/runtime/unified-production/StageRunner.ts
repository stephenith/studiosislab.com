/**
 * Stage runner — executes each production stage using existing SAIOS components.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { interpretFounderObjective, planObjective } from "../controller/ProductionController.js";
import { createMockCursorResearchExecutor } from "../research/ResearchCoordinator.js";
import { runResearchSession } from "../research/ResearchDirector.js";
import { runBenchmarkCycle } from "../benchmark/BenchmarkDirector.js";
import { loadBenchmarkDatabase } from "../benchmark/BenchmarkDatabase.js";
import { runDesignBrain } from "../design-brain/DesignBrain.js";
import { runAdaptiveComposition } from "../adaptive-composer/AdaptiveComposerDirector.js";
import { runProductionV3 } from "../workers/resume-production/production-pipeline-v3.js";
import { runVisualRenderEvaluation } from "../visual-render/VisualRenderDirector.js";
import { runFounderCritic } from "../founder-critic/FounderCriticDirector.js";
import { runPublicationPrep } from "../publication/PublicationDirector.js";
import { runLearningEngine } from "../workers/resume-learning/learning-engine.js";
import { loadTemplateContext } from "../workers/resume-qa/template-input.js";
import { runAlignmentCheck } from "../workers/resume-qa/alignment-check.js";
import { runSpacingCheck } from "../workers/resume-qa/spacing-check.js";
import { runTypographyCheck } from "../workers/resume-qa/typography-check.js";
import { runAtsCheck } from "../workers/resume-qa/ats-check.js";
import { runEditorCheck } from "../workers/resume-qa/editor-check.js";
import { runFabricCheck } from "../workers/resume-qa/fabric-check.js";
import { runThumbnailCheck } from "../workers/resume-qa/thumbnail-check.js";
import { runSEOCheck } from "../workers/resume-qa/seo-check.js";
import { writeQAReports, stageResult } from "../workers/resume-qa/validation-report.js";
import { recordArtifact, stageDir, listFilesRecursive } from "./ArtifactTracker.js";
import type { QualitySummary, UnifiedRunState, UnifiedStage } from "./types.js";
import { saveRunState } from "./ProductionState.js";

export type StageContext = {
  mcp_available: boolean;
  learning_persist: boolean;
  seed: number;
};

export type StageRunResult = {
  state: UnifiedRunState;
  pass: boolean;
  error?: string;
};

export async function runStage(
  stage: UnifiedStage,
  state: UnifiedRunState,
  ctx: StageContext,
): Promise<StageRunResult> {
  const start = Date.now();
  let next = state;

  try {
    switch (stage) {
      case "queued":
        next = await runQueuedStage(next);
        break;
      case "researching":
        next = await runResearchStage(next, ctx);
        break;
      case "benchmarking":
        next = await runBenchmarkStage(next, ctx);
        break;
      case "designing":
        next = await runDesignStage(next, ctx);
        break;
      case "composing":
        next = await runComposeStage(next, ctx);
        break;
      case "generating":
        next = await runGenerateStage(next, ctx);
        break;
      case "qa":
        next = await runQAStage(next);
        break;
      case "render_review":
        next = await runRenderStage(next, ctx);
        break;
      case "founder_critic":
        next = await runCriticStage(next);
        break;
      case "publication_ready":
        next = await runPublicationStage(next);
        break;
      case "waiting_founder":
        next = await runWaitingFounderStage(next, ctx);
        break;
    }

    saveRunState(next);
    return { state: next, pass: true };
  } catch (err) {
    const error = String(err);
    return { state: next, pass: false, error };
  }
}

async function runQueuedStage(state: UnifiedRunState): Promise<UnifiedRunState> {
  const dir = stageDir(state.run_dir, "queued");
  mkdirSync(dir, { recursive: true });

  const command = interpretFounderObjective(state.objective);
  const plan = planObjective(command);

  writeFileSync(
    join(dir, "controller-plan.json"),
    JSON.stringify({ command, plan, supported: command.supported }, null, 2),
  );

  return recordArtifact(state, {
    stage: "queued",
    component: "production-controller",
    path: dir,
    files: listFilesRecursive(dir),
  });
}

async function runResearchStage(state: UnifiedRunState, ctx: StageContext): Promise<UnifiedRunState> {
  const dir = stageDir(state.run_dir, "researching");
  mkdirSync(dir, { recursive: true });

  const executor = createMockCursorResearchExecutor({ failure_rate: 0, base_ms: 5 });
  const result = await runResearchSession({
    objective: state.objective,
    cursor_executor: executor,
    mcp_firecrawl_available: ctx.mcp_available,
    persist: true,
  });

  writeFileSync(join(dir, "research-result.json"), JSON.stringify({ session_id: result.session_id, pass: result.pass }, null, 2));

  return recordArtifact(state, {
    stage: "researching",
    component: "research-engine",
    path: result.session_dir,
    files: [result.session_dir, ...listFilesRecursive(dir)],
  });
}

async function runBenchmarkStage(state: UnifiedRunState, ctx: StageContext): Promise<UnifiedRunState> {
  const dir = stageDir(state.run_dir, "benchmarking");
  mkdirSync(dir, { recursive: true });

  let result;
  if (loadBenchmarkDatabase()) {
    result = { pass: true, run_id: "cached", run_dir: dir };
    writeFileSync(join(dir, "benchmark-cached.json"), JSON.stringify({ cached: true }, null, 2));
  } else {
    const executor = createMockCursorResearchExecutor({ failure_rate: 0, base_ms: 5 });
    const cycle = await runBenchmarkCycle({
      mcp_firecrawl_available: ctx.mcp_available,
      persist: true,
      cursor_executor: executor,
    });
    result = { pass: cycle.pass, run_id: cycle.run_id, run_dir: cycle.run_dir };
    writeFileSync(join(dir, "benchmark-result.json"), JSON.stringify({ run_id: cycle.run_id, pass: cycle.pass }, null, 2));
  }

  if (!result.pass) throw new Error("Benchmark cycle failed");

  return recordArtifact(state, {
    stage: "benchmarking",
    component: "benchmark-engine",
    path: result.run_dir,
    files: listFilesRecursive(dir),
  });
}

async function runDesignStage(state: UnifiedRunState, ctx: StageContext): Promise<UnifiedRunState> {
  const dir = stageDir(state.run_dir, "designing");
  mkdirSync(dir, { recursive: true });

  const executor = createMockCursorResearchExecutor({ failure_rate: 0, base_ms: 5 });
  const brain = await runDesignBrain({
    objective: state.objective,
    mcp_firecrawl_available: ctx.mcp_available,
    persist: true,
    cursor_executor: executor,
  });

  if (!brain.pass) throw new Error("Design Brain failed quality gate");

  writeFileSync(join(dir, "brain-result.json"), JSON.stringify({ session_id: brain.session_id, pass: brain.pass }, null, 2));

  return recordArtifact(state, {
    stage: "designing",
    component: "design-brain",
    path: brain.session_dir,
    files: [brain.session_dir, ...listFilesRecursive(dir)],
  });
}

async function runComposeStage(state: UnifiedRunState, ctx: StageContext): Promise<UnifiedRunState> {
  const composition = await runAdaptiveComposition({
    objective: state.objective,
    mode: "premium",
    seed: ctx.seed,
    mcp_firecrawl_available: ctx.mcp_available,
    persist: true,
  });

  if (!composition.pass) throw new Error("Adaptive composition failed quality targets");

  return {
    ...recordArtifact(state, {
      stage: "composing",
      component: "adaptive-composer",
      path: composition.output_dir,
      files: composition.artifacts.map((f) => join(composition.output_dir, f)),
    }),
    composition_id: composition.composition_id,
  };
}

async function runGenerateStage(state: UnifiedRunState, ctx: StageContext): Promise<UnifiedRunState> {
  const genDir = stageDir(state.run_dir, "generating");
  mkdirSync(genDir, { recursive: true });

  const production = await runProductionV3({
    objective: state.objective,
    output_dir: genDir,
    mcp_firecrawl_available: ctx.mcp_available,
    learning_persist: false,
    seed: ctx.seed,
  });

  if (!production.pass) throw new Error("Premium Generator V3 failed");

  const templatePath = join(genDir, "template-preview.json");
  if (!existsSync(templatePath)) throw new Error("template-preview.json missing after generation");

  return {
    ...recordArtifact(state, {
      stage: "generating",
      component: "premium-generator-v3",
      path: genDir,
      files: production.artifacts.map((f) => join(genDir, f)),
    }),
    prototype_id: production.prototype_id,
    prototype_dir: genDir,
    quality: buildPartialQuality(production),
  };
}

async function runQAStage(state: UnifiedRunState): Promise<UnifiedRunState> {
  if (!state.prototype_dir) throw new Error("No prototype for QA");

  const ctx = loadTemplateContext(state.prototype_dir);
  const thumbnail = await runThumbnailCheck(ctx, {
    output_dir: join(state.run_dir, "qa"),
    render_if_missing: true,
  });

  const stages = [
    stageResult("alignment", runAlignmentCheck(ctx)),
    stageResult("spacing", runSpacingCheck(ctx)),
    stageResult("typography", runTypographyCheck(ctx)),
    stageResult("ats", runAtsCheck(ctx)),
    stageResult("editor", runEditorCheck(ctx)),
    stageResult("fabric", runFabricCheck(ctx)),
    stageResult("thumbnail", thumbnail),
    stageResult("seo", runSEOCheck(ctx)),
  ];

  const { output_dir, summary } = writeQAReports(ctx, stages);
  if (!summary.pass) throw new Error("Resume QA failed");

  const atsScore = summary.stages.find((s) => s.stage === "ats")?.pass ? 100 : 85;

  return {
    ...recordArtifact(state, {
      stage: "qa",
      component: "resume-qa",
      path: output_dir,
      files: listFilesRecursive(output_dir),
    }),
    quality: state.quality
      ? { ...state.quality, ats_score: Math.max(state.quality.ats_score, atsScore) }
      : null,
  };
}

async function runRenderStage(state: UnifiedRunState, ctx: StageContext): Promise<UnifiedRunState> {
  if (!state.prototype_dir) throw new Error("No prototype for render evaluation");

  const templatePath = join(state.prototype_dir, "template-preview.json");
  const render = await runVisualRenderEvaluation({
    template_path: templatePath,
    mcp_firecrawl_available: ctx.mcp_available,
    persist: true,
  });

  if (!render.pass) throw new Error("Visual render evaluation failed");
  if (render.publication_blocked) throw new Error("Visual render blocked publication — score below gate");

  return {
    ...recordArtifact(state, {
      stage: "render_review",
      component: "visual-render-engine",
      path: render.output_dir,
      files: render.artifacts.map((f) => join(render.output_dir, f)),
    }),
    quality: state.quality
      ? {
          ...state.quality,
          visual_render_score: render.scores.overall_render_score,
          founder_prediction: render.scores.founder_approval_prediction,
          publication_blocked: render.publication_blocked,
        }
      : null,
  };
}

async function runCriticStage(state: UnifiedRunState): Promise<UnifiedRunState> {
  if (!state.prototype_dir) throw new Error("No prototype for founder critic");

  const critic = await runFounderCritic({
    prototype_dir: state.prototype_dir,
    objective: state.objective,
    persist: true,
  });

  if (!critic.pass) throw new Error("Founder AI Critic failed");

  return {
    ...recordArtifact(state, {
      stage: "founder_critic",
      component: "founder-ai-critic",
      path: critic.output_dir,
      files: critic.artifacts.map((f) => join(critic.output_dir, f)),
    }),
    quality: state.quality
      ? {
          ...state.quality,
          founder_prediction: mapCriticApproval(critic.approval.policy_band),
          overall_confidence: Math.max(state.quality.overall_confidence, critic.overall_score),
        }
      : null,
  };
}

async function runPublicationStage(state: UnifiedRunState): Promise<UnifiedRunState> {
  if (!state.prototype_dir) throw new Error("No prototype for publication");

  const publication = await runPublicationPrep({
    prototype_dir: state.prototype_dir,
    founder_approved: true,
    founder_name: "Founder",
    persist: true,
  });

  if (!publication.pass) throw new Error("Publication prep failed");

  return {
    ...recordArtifact(state, {
      stage: "publication_ready",
      component: "publication-manager",
      path: publication.package_dir,
      files: publication.artifacts.map((f) => join(publication.package_dir, f)),
    }),
    catalog_id: publication.catalog_id,
    quality: state.quality
      ? { ...state.quality, publication_ready: publication.state === "ready_to_publish" }
      : null,
  };
}

async function runWaitingFounderStage(state: UnifiedRunState, ctx: StageContext): Promise<UnifiedRunState> {
  const dir = stageDir(state.run_dir, "waiting-founder");
  mkdirSync(dir, { recursive: true });

  const learning = runLearningEngine({
    feedback: [
      {
        raw: `Unified production cycle for ${state.objective}. Awaiting founder approval.`,
        template_id: state.prototype_id ?? state.run_id,
        founder_decision: "revision",
      },
    ],
    templates_generated_delta: 1,
    persist: ctx.learning_persist,
  });

  writeFileSync(
    join(dir, "founder-gate.json"),
    JSON.stringify({
      status: "AWAITING_FOUNDER_APPROVAL",
      publication_automatic: false,
      catalog_id: state.catalog_id,
      review_command: state.prototype_dir
        ? `npm run review:template -- --path=${join(state.prototype_dir, "template-preview.json")}`
        : null,
    }, null, 2),
  );

  const learningDir = join(state.run_dir, "learning");
  mkdirSync(learningDir, { recursive: true });
  writeFileSync(join(learningDir, "learning-result.json"), JSON.stringify({ pass: learning.pass }, null, 2));

  return {
    ...recordArtifact(state, {
      stage: "waiting_founder",
      component: "founder-gate",
      path: dir,
      files: listFilesRecursive(dir),
    }),
    status: "waiting_founder",
    current_stage: "waiting_founder",
  };
}

function buildPartialQuality(production: Awaited<ReturnType<typeof runProductionV3>>): QualitySummary {
  return {
    premium_score: production.premium_scores.premium_score,
    ats_score: production.premium_scores.ats_score,
    visual_render_score: 0,
    recruiter_score: production.premium_scores.modern_score,
    overall_confidence: production.confidence.overall_confidence,
    founder_prediction: "PENDING",
    publication_ready: false,
    publication_blocked: false,
  };
}

function mapCriticApproval(band: string): string {
  if (band === "recommend_founder_approval") return "LIKELY APPROVE";
  if (band === "revision_recommended") return "REVISION";
  return "REJECT";
}