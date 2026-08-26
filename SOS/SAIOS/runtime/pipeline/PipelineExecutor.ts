/**
 * Pipeline executor — integrates existing SAIOS components per stage.
 * Does NOT duplicate worker logic; imports and orchestrates.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { QueueManager } from "../queue/QueueManager.js";
import { RegistryManager } from "../registry/RegistryManager.js";
import { createBatchPlan } from "../directors/resume-production/BatchPlanner.js";
import {
  buildResearchRequest,
  delegateToCursor,
  type CursorExecutor,
} from "../directors/resume-production/CursorResearchCoordinator.js";
import { DIRECTOR_POLICIES } from "../directors/resume-production/ProductionPolicies.js";
import type { ProductionPriority } from "../directors/resume-production/types.js";
import { loadResumeDesignKnowledge } from "../../domain/studiosislab/resume/ResumeDesignKnowledge.js";
import { loadResumeIntelligenceEngine } from "../../domain/studiosislab/resume/intelligence/ResumeIntelligenceEngine.js";
import { selectDesignFamily } from "../workers/resume-production/family-selector.js";
import { buildModernAtsProfessionalTemplate } from "../workers/resume-production/template-builder.js";
import { runDesignQA } from "../workers/resume-production/design-qa.js";
import { validateTemplate } from "../workers/resume-production/validator.js";
import { writePreviewAssetsBesideTemplate } from "../workers/resume-production/preview-assets.js";
import { runAlignmentCheck } from "../workers/resume-qa/alignment-check.js";
import { runSpacingCheck } from "../workers/resume-qa/spacing-check.js";
import { runTypographyCheck } from "../workers/resume-qa/typography-check.js";
import { runAtsCheck } from "../workers/resume-qa/ats-check.js";
import { runEditorCheck } from "../workers/resume-qa/editor-check.js";
import { runFabricCheck } from "../workers/resume-qa/fabric-check.js";
import { runThumbnailCheck } from "../workers/resume-qa/thumbnail-check.js";
import { runSEOCheck } from "../workers/resume-qa/seo-check.js";
import { loadTemplateContext } from "../workers/resume-qa/template-input.js";
import { preparePublicationPackage } from "../workers/resume-qa/publisher.js";
import type { QAValidationSummary } from "../workers/resume-qa/types.js";
import { stageResult, writeQAReports } from "../workers/resume-qa/validation-report.js";
import { runLearningEngine } from "../workers/resume-learning/learning-engine.js";
import type { FounderDecision, PipelineRunState } from "./PipelineState.js";
import type { RunFolderLayout } from "./RunManager.js";
import {
  copyGeneratedArtifacts,
  copyQaArtifacts,
  writeBatchPlan,
  writeCursorOutput,
  writeLearningArtifacts,
  writeLocalReviewPackage,
  writeObjective,
  writeResearch,
} from "./RunArtifacts.js";

export type ExecutorContext = {
  layout: RunFolderLayout;
  state: PipelineRunState;
  cursor_executor: CursorExecutor;
  mcp_firecrawl_available?: boolean;
  /** Isolated queue/registry dirs for verify — defaults to production paths */
  queue_jobs_dir?: string;
  registry_dir?: string;
  /** Mock founder decision for verify */
  mock_founder_decision?: FounderDecision;
  /** Skip global learning persistence */
  learning_persist?: boolean;
};

export type StageResult = {
  state: PipelineRunState;
  generated_dir?: string;
  qa_dir?: string;
  qa_pass?: boolean;
  publication_package_dir?: string;
};

const CURSOR_EXECUTION_STEPS = [
  "Read Resume Design Knowledge",
  "Read Resume Intelligence Engine",
  "Read Resume Learning Engine",
  "Analyze existing published StudiosisLab templates",
  "Analyze current editor technical contract",
  "Research external trends (Firecrawl MCP — temporary only)",
  "Generate design",
  "Self-review",
  "Improve design",
  "Generate Fabric JSON",
  "Run QA",
  "Prepare localhost review",
] as const;

export async function executeFounderObjective(ctx: ExecutorContext): Promise<StageResult> {
  writeObjective(ctx.layout, ctx.state.objective);
  return { state: ctx.state };
}

export async function executeBatchPlan(ctx: ExecutorContext): Promise<StageResult> {
  const priority = (ctx.state.priority || "ats") as ProductionPriority;
  const fullPlan = createBatchPlan({
    size: 10,
    primary_priority: priority,
    batch_id: `pipeline-${ctx.layout.run_id}`,
  });
  const plan = {
    ...fullPlan,
    size: 1,
    jobs: [fullPlan.jobs[0]!],
  };
  writeBatchPlan(ctx.layout, plan);
  const state: PipelineRunState = {
    ...ctx.state,
    batch_id: plan.batch_id,
    batch_plan: plan,
    prototype_id: plan.jobs[0]?.template_slug ?? null,
  };
  return { state };
}

export async function executeQueueEnqueue(ctx: ExecutorContext): Promise<StageResult> {
  const queue = new QueueManager(
    ctx.queue_jobs_dir ? { jobsDir: ctx.queue_jobs_dir } : undefined,
  );
  if (!ctx.state.batch_plan?.jobs[0]) {
    throw new Error("Batch plan missing job");
  }
  const resumeJob = ctx.state.batch_plan.jobs[0];
  const saiosJob = await queue.createJob({
    id: `JOB-${ctx.layout.run_id}`,
    title: `Resume production: ${resumeJob.template_slug}`,
    description: ctx.state.objective,
    priority: "P1",
    creator: "founder",
    metadata: {
      pipeline_run_id: ctx.layout.run_id,
      batch_id: ctx.state.batch_id,
      resume_job_id: resumeJob.job_id,
      priority: resumeJob.priority,
      required_capability: "resume-production",
      prototype_slug: resumeJob.template_slug,
    },
  });
  return {
    state: { ...ctx.state, queue_job_id: saiosJob.id },
  };
}

// Fix typo - I used `plan` instead of checking state. Let me fix in the file.

export async function executeRuntimeDispatch(ctx: ExecutorContext): Promise<StageResult> {
  if (!ctx.state.queue_job_id) throw new Error("No queue job to dispatch");

  const queue = new QueueManager(
    ctx.queue_jobs_dir ? { jobsDir: ctx.queue_jobs_dir } : undefined,
  );
  const registry = new RegistryManager(
    ctx.registry_dir ? { registryDir: ctx.registry_dir } : undefined,
  );

  const worker = await registry.registerWorker({
    name: "Resume Production Worker",
    type: "resume-production-worker",
    version: "1.0.0",
    capabilities: ["resume-production", "cursor-delegation"],
  });
  await registry.heartbeat(worker.id, { pipeline_run: ctx.layout.run_id });

  await queue.updateStatus(ctx.state.queue_job_id, { status: "PLANNING", note: "pipeline batch plan" });
  await queue.updateStatus(ctx.state.queue_job_id, { status: "RUNNING", note: "runtime loop dispatch" });
  await queue.assignWorker(ctx.state.queue_job_id, worker.id);
  await registry.assignJob(worker.id, ctx.state.queue_job_id);

  return {
    state: { ...ctx.state, worker_id: worker.id },
  };
}

export async function executeCursorResearch(ctx: ExecutorContext): Promise<StageResult> {
  const resumeJob = ctx.state.batch_plan?.jobs[0];
  if (!resumeJob) throw new Error("No resume job for research");

  const request = buildResearchRequest({
    job_id: resumeJob.job_id,
    priority: resumeJob.priority,
    mcp_firecrawl_available: ctx.mcp_firecrawl_available ?? false,
  });

  const result = await delegateToCursor(request, ctx.cursor_executor);
  writeResearch(ctx.layout, result);

  let state: PipelineRunState = {
    ...ctx.state,
    cursor_invocations: ctx.state.cursor_invocations + 1,
  };

  if (!result.success) {
    state = { ...state, cursor_failures: state.cursor_failures + 1 };
    throw new Error(result.error ?? "Cursor research failed");
  }

  return { state };
}

export async function executeCursorExecution(ctx: ExecutorContext): Promise<StageResult> {
  const external = ctx.mcp_firecrawl_available
    ? DIRECTOR_POLICIES.external_research_when_mcp_available.join(", ")
    : "(skipped — MCP unavailable)";

  const body = [
    "# Cursor Execution Log",
    "",
    `**Run:** ${ctx.layout.run_id}`,
    `**Worker:** ${ctx.state.worker_id ?? "resume-production-worker"}`,
    "",
    "## Cursor instructions (delegated — pipeline does not execute design)",
    "",
    ...CURSOR_EXECUTION_STEPS.map((step, i) => `${i + 1}. ${step}`),
    "",
    "## External research scope (temporary)",
    "",
    external,
    "",
    "## Policy",
    "",
    "- Research is temporary execution knowledge only",
    "- Never overwrite permanent StudiosisLab knowledge without founder approval",
    "- Fabric JSON generation delegated to Resume Production Worker after Cursor research",
  ].join("\n");

  writeCursorOutput(ctx.layout, body);
  return { state: ctx.state };
}

export async function executeProduction(ctx: ExecutorContext): Promise<StageResult> {
  const outputDir = ctx.layout.generated;
  mkdirSync(outputDir, { recursive: true });

  const knowledge = loadResumeDesignKnowledge();
  const intelligence = loadResumeIntelligenceEngine();
  const brief = ctx.state.objective;

  const familySelection = selectDesignFamily(
    brief,
    intelligence.database.design_families,
  );

  const tier = "ats_safe" as const;
  const template = buildModernAtsProfessionalTemplate(familySelection.selected_family_id);

  const designQa = runDesignQA({
    template,
    tier,
    family_id: familySelection.selected_family_id,
  });
  if (!designQa.pass) {
    throw new Error(`Design QA failed: ${designQa.checks.filter((c) => !c.pass).map((c) => c.id).join(", ")}`);
  }

  const validation = validateTemplate(template);
  if (!validation.pass) {
    throw new Error("Template validation failed");
  }

  writeFileSync(join(outputDir, "template-preview.json"), JSON.stringify(template.json, null, 2));
  writeFileSync(join(outputDir, "validation.json"), JSON.stringify(validation, null, 2));
  await writePreviewAssetsBesideTemplate(template.json, outputDir);

  const designReport = [
    `# Design Report — ${template.title}`,
    "",
    `**Prototype:** \`${template.prototype_id}\``,
    `**Pipeline Run:** ${ctx.layout.run_id}`,
    `**Family:** ${familySelection.selected_family_id}`,
    "",
    `Knowledge v${knowledge.version} | Intelligence families: ${intelligence.database.design_families.length}`,
  ].join("\n");
  writeFileSync(join(outputDir, "design-report.md"), designReport);

  return {
    state: { ...ctx.state, prototype_id: template.prototype_id },
    generated_dir: outputDir,
  };
}

export async function executeQa(ctx: ExecutorContext): Promise<StageResult> {
  const sourceDir = ctx.layout.generated;
  const ctx_qa = loadTemplateContext(sourceDir);

  const stages = [
    stageResult("alignment", runAlignmentCheck(ctx_qa)),
    stageResult("spacing", runSpacingCheck(ctx_qa)),
    stageResult("typography", runTypographyCheck(ctx_qa)),
    stageResult("ats", runAtsCheck(ctx_qa)),
    stageResult("editor", runEditorCheck(ctx_qa)),
    stageResult("fabric", runFabricCheck(ctx_qa)),
  ];

  const qaRunDir = join(ctx.layout.qa, "_staging");
  mkdirSync(qaRunDir, { recursive: true });

  const thumbnailReport = await runThumbnailCheck(ctx_qa, {
    output_dir: qaRunDir,
    render_if_missing: true,
  });
  stages.push(stageResult("thumbnail", thumbnailReport));
  stages.push(stageResult("seo", runSEOCheck(ctx_qa)));

  const { output_dir, summary } = writeQAReports(ctx_qa, stages);
  copyQaArtifacts(ctx.layout, output_dir);

  const queue = ctx.state.queue_job_id
    ? new QueueManager(ctx.queue_jobs_dir ? { jobsDir: ctx.queue_jobs_dir } : undefined)
    : null;
  if (queue && ctx.state.queue_job_id) {
    await queue.updateStatus(ctx.state.queue_job_id, {
      status: "WAITING_QA",
      note: "QA complete — awaiting founder",
    });
  }

  if (!summary.pass) {
    throw new Error("QA pipeline failed");
  }

  return { state: ctx.state, qa_dir: output_dir, qa_pass: summary.pass };
}

export async function executeLocalReview(ctx: ExecutorContext, qa_pass: boolean): Promise<StageResult> {
  const template_path = join(ctx.layout.generated, "template-preview.json");
  writeLocalReviewPackage(ctx.layout, {
    template_path,
    prototype_id: ctx.state.prototype_id ?? "unknown",
    qa_pass,
  });
  return { state: ctx.state };
}

export async function executeFounderApproval(
  ctx: ExecutorContext,
  qa_dir: string,
): Promise<StageResult> {
  const decision = ctx.mock_founder_decision;
  if (!decision) {
    const state: PipelineRunState = {
      ...ctx.state,
      final_status: "awaiting_founder",
      current_stage: "founder_approval",
      founder_decision: null,
    };
    return { state };
  }

  const ctx_qa = loadTemplateContext(ctx.layout.generated);
  const summary = JSON.parse(
    readFileSync(join(qa_dir, "validation.json"), "utf8"),
  ) as QAValidationSummary;

  let publication_package_dir: string | undefined;

  if (decision === "APPROVE") {
    const pub = preparePublicationPackage(ctx_qa, qa_dir, summary);
    publication_package_dir = pub.package_dir;
  }

  const queue = ctx.state.queue_job_id
    ? new QueueManager(ctx.queue_jobs_dir ? { jobsDir: ctx.queue_jobs_dir } : undefined)
    : null;

  if (queue && ctx.state.queue_job_id) {
    if (decision === "APPROVE") {
      await queue.completeJob(ctx.state.queue_job_id, publication_package_dir ?? qa_dir);
    } else if (decision === "REJECT") {
      await queue.updateStatus(ctx.state.queue_job_id, {
        status: "FAILED",
        note: "Founder rejected",
      });
    } else if (decision === "REVISE") {
      await queue.updateStatus(ctx.state.queue_job_id, {
        status: "QUEUED",
        note: "Founder requested revision — re-queued",
      });
    }
  }

  return {
    state: {
      ...ctx.state,
      founder_decision: decision,
      final_status: decision === "REVISE" ? "running" : "running",
    },
    publication_package_dir,
  };
}

export async function executeLearning(ctx: ExecutorContext): Promise<StageResult> {
  const decision = ctx.state.founder_decision ?? ctx.mock_founder_decision ?? "APPROVE";
  const template_id = ctx.state.prototype_id ?? "pipeline-template";

  const founder_decision =
    decision === "APPROVE" ? "approved" : decision === "REJECT" ? "rejected" : "revision";

  const feedbackText =
    decision === "APPROVE"
      ? "Approved for publication."
      : decision === "REJECT"
        ? "Rejected — does not meet StudiosisLab standards."
        : "Revision required — adjust spacing and typography.";

  const result = runLearningEngine({
    feedback: [{ raw: feedbackText, template_id, founder_decision }],
    persist: ctx.learning_persist !== false,
  });

  writeLearningArtifacts(ctx.layout, result.structured_feedback, result.learned_rules);

  return { state: ctx.state };
}

export async function executeRevisionRequeue(ctx: ExecutorContext): Promise<StageResult> {
  if (ctx.state.founder_decision !== "REVISE") return { state: ctx.state };

  const queue = new QueueManager(
    ctx.queue_jobs_dir ? { jobsDir: ctx.queue_jobs_dir } : undefined,
  );
  const revisionJob = await queue.createJob({
    title: `Revision: ${ctx.state.prototype_id}`,
    description: `Founder revision for run ${ctx.layout.run_id}`,
    priority: "P0",
    creator: "founder",
    parent_job: ctx.state.queue_job_id,
    metadata: {
      pipeline_run_id: ctx.layout.run_id,
      revision_of: ctx.state.prototype_id,
      required_capability: "resume-production",
    },
  });

  return {
    state: { ...ctx.state, queue_job_id: revisionJob.id },
  };
}
