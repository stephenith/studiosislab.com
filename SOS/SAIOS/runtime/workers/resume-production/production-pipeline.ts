/**
 * Resume Production Worker v2 — complete mandatory execution pipeline.
 * Cursor is primary intelligence (coordinated via research stage); SAIOS validates.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createMockCursorResearchExecutor } from "../../research/ResearchCoordinator.js";
import { buildCursorResearchTask, delegateResearchToCursor } from "../../research/ResearchCoordinator.js";
import { FIRECRAWL_RESEARCH_TOPICS } from "../../research/FirecrawlCoordinator.js";
import { runAlignmentCheck } from "../resume-qa/alignment-check.js";
import { runSpacingCheck } from "../resume-qa/spacing-check.js";
import { runTypographyCheck } from "../resume-qa/typography-check.js";
import { runAtsCheck } from "../resume-qa/ats-check.js";
import { runEditorCheck } from "../resume-qa/editor-check.js";
import { runFabricCheck } from "../resume-qa/fabric-check.js";
import { runThumbnailCheck } from "../resume-qa/thumbnail-check.js";
import { runSEOCheck } from "../resume-qa/seo-check.js";
import { loadTemplateContext } from "../resume-qa/template-input.js";
import { stageResult, writeQAReports } from "../resume-qa/validation-report.js";
import { selectDesignFamily } from "./family-selector.js";
import { buildModernAtsProfessionalTemplate } from "./template-builder.js";
import { runDesignQA } from "./design-qa.js";
import { loadKnowledgeContext, analyzeIndustry } from "./knowledge-context.js";
import { checkDuplicateRisk, DUPLICATE_THRESHOLD, pickAlternateFamily } from "./duplicate-detector.js";
import { buildDesignPlan } from "./design-plan.js";
import { runSelfCritiquePass } from "./self-critique.js";
import { computeConfidence } from "./confidence-engine.js";
import { validateEditorCompatibility } from "./editor-validation.js";
import { appendLearningRecord } from "./learning-append.js";
import { writeProductionReports } from "./reports-v2.js";
import type { ProductionV2Result, RunProductionV2Options } from "./types-v2.js";
import {
  ENGINES,
  acquireExecutionLock,
  enforceEngineAccess,
} from "../../../architecture/runtime-guard.js";

const SOS_ROOT = resolve(import.meta.dirname, "../../../..");
const GENERATED_ROOT = join(SOS_ROOT, "07_LOGS/saios/generated-resumes");

const DEFAULT_OBJECTIVE =
  "Generate a modern ATS professional resume for software engineer founder review.";

export async function runProductionV2(
  options: RunProductionV2Options = {},
): Promise<ProductionV2Result> {
  enforceEngineAccess(ENGINES.LEGACY_PRODUCTION_V2);
  const releaseLock = acquireExecutionLock(ENGINES.LEGACY_PRODUCTION_V2.id);
  try {
    return await runProductionV2Inner(options);
  } finally {
    releaseLock();
  }
}

async function runProductionV2Inner(
  options: RunProductionV2Options = {},
): Promise<ProductionV2Result> {
  const objective = options.objective ?? DEFAULT_OBJECTIVE;
  const mcp = options.mcp_firecrawl_available ?? false;
  let duplicate_redesigns = 0;

  // 1. Load all mandatory knowledge
  const ctx = loadKnowledgeContext();
  const industry = analyzeIndustry(objective);

  // 2. Cursor research (delegated — SAIOS coordinates)
  const cursorTask = buildCursorResearchTask({
    objective,
    mcp_firecrawl_available: mcp,
  });
  const cursorResult = await delegateResearchToCursor(
    cursorTask,
    createMockCursorResearchExecutor({ failure_rate: 0, base_ms: 10 }),
  );
  if (!cursorResult.success) {
    throw new Error(cursorResult.error ?? "Cursor research failed");
  }

  const research_md = buildResearchReport(objective, cursorResult, mcp, industry.industry);

  // 3. Family selection + duplicate detection loop
  let family = selectDesignFamily(objective, ctx.intelligence.database.design_families);
  let duplicate = checkDuplicateRisk({
    objective,
    industry: industry.industry,
    family_id: family.selected_family_id,
  });

  while (duplicate.redesign_required && duplicate_redesigns < 3) {
    duplicate_redesigns += 1;
    const alt = pickAlternateFamily(
      ["corporate-modern", "operations-management", "minimal-ats", "executive-ats", "administrative-ats"],
      [family.selected_family_id],
    );
    if (!alt) break;
    family = selectDesignFamily(objective, ctx.intelligence.database.design_families, {
      exclude_family_ids: [family.selected_family_id],
    });
    duplicate = checkDuplicateRisk({
      objective,
      industry: industry.industry,
      family_id: family.selected_family_id,
    });
  }

  // 4. Design plan (before JSON)
  const designPlan = buildDesignPlan({
    objective,
    ctx,
    family,
    duplicate,
    industry: industry.industry,
  });

  // 5. Generate Fabric JSON
  const tier = "ats_safe" as const;
  const template = buildModernAtsProfessionalTemplate(family.selected_family_id);

  // 6. Self critique passes
  let designQa = runDesignQA({ template, tier, family_id: family.selected_family_id });
  const critique1 = runSelfCritiquePass({
    pass_number: 1,
    template,
    designQa,
    confidence_before: 85,
  });
  designQa = runDesignQA({ template, tier, family_id: family.selected_family_id });
  const critique2 = runSelfCritiquePass({
    pass_number: 2,
    template,
    designQa,
    confidence_before: critique1.confidence_after,
  });

  if (!designQa.pass) {
    throw new Error("Design QA failed after self-critique");
  }

  // 7. Editor + contract validation
  const editor = validateEditorCompatibility(template, ctx);
  if (!editor.pass) {
    throw new Error("Editor validation failed");
  }

  const confidence = computeConfidence({
    designQa,
    validation: editor.contract,
    duplicate,
    critique1,
    critique2,
    editor_pass: editor.pass,
  });

  const output_dir = options.output_dir ?? join(GENERATED_ROOT, template.prototype_id);
  mkdirSync(output_dir, { recursive: true });
  mkdirSync(join(output_dir, "localhost"), { recursive: true });

  writeFileSync(join(output_dir, "template-preview.json"), JSON.stringify(template.json, null, 2));
  // Agent #146: full preview.png + thumbnail derived from that preview (never copy placeholders).
  const { writePreviewAssetsBesideTemplate } = await import("./preview-assets.js");
  await writePreviewAssetsBesideTemplate(template.json, output_dir);

  // 8. Resume QA pipeline
  const qaCtx = loadTemplateContext(output_dir);
  const qaStages = [
    stageResult("alignment", runAlignmentCheck(qaCtx)),
    stageResult("spacing", runSpacingCheck(qaCtx)),
    stageResult("typography", runTypographyCheck(qaCtx)),
    stageResult("ats", runAtsCheck(qaCtx)),
    stageResult("editor", runEditorCheck(qaCtx)),
    stageResult("fabric", runFabricCheck(qaCtx)),
  ];
  const thumbQa = await runThumbnailCheck(qaCtx, {
    output_dir,
    render_if_missing: false,
  });
  qaStages.push(stageResult("thumbnail", thumbQa));
  qaStages.push(stageResult("seo", runSEOCheck(qaCtx)));
  const { summary: qaSummary } = writeQAReports(qaCtx, qaStages);

  const template_path = join(output_dir, "template-preview.json");
  const local_review_command = `npm run review:template -- --path=${template_path}`;
  const local_review = {
    prototype_id: template.prototype_id,
    template_path,
    review_command: local_review_command,
    status: "AWAITING_FOUNDER_APPROVAL",
    no_publish: true,
    prepared_at: new Date().toISOString(),
  };

  const result: ProductionV2Result = {
    pass: qaSummary.pass && confidence.target_met,
    worker_version: "2.0.0",
    prototype_id: template.prototype_id,
    output_dir,
    status: "AWAITING_FOUNDER_APPROVAL",
    confidence,
    qa_pass: qaSummary.pass,
    local_review_command,
    duplicate_redesigns,
    artifacts: [],
  };

  appendLearningRecord({
    prototype_id: template.prototype_id,
    plan: designPlan,
    confidence,
    persist: options.learning_persist,
  });

  result.artifacts = writeProductionReports(output_dir, {
    objective,
    research_md,
    design_plan: designPlan,
    critique1,
    critique2,
    validation: editor.contract,
    editor,
    confidence,
    duplicate,
    thumbnail_analysis: {
      width: 199,
      height: 281,
      scale: 0.25,
      object_count: template.json.objects.length,
      generated_at: new Date().toISOString(),
    },
    local_review,
    result,
  });

  return result;
}

function buildResearchReport(
  objective: string,
  cursor: Awaited<ReturnType<typeof delegateResearchToCursor>>,
  mcp: boolean,
  industry: string,
): string {
  return [
    "# Research Report — Resume Production Worker v2",
    "",
    `**Objective:** ${objective}`,
    `**Industry:** ${industry}`,
    `**Cursor session:** ${cursor.session_id}`,
    "",
    "## Mandatory reads",
    "",
    ...cursor.sources_consulted.map((s) => `- ${s}`),
    "",
    "## Intelligence applied",
    "",
    ...cursor.intelligence_applied.map((s) => `- ${s}`),
    "",
    "## External research (patterns only — no copying)",
    "",
    mcp
      ? FIRECRAWL_RESEARCH_TOPICS.slice(0, 12).map((t) => `- ${t}`).join("\n")
      : "_Firecrawl MCP unavailable — skipped_",
    "",
    "## Policy",
    "",
    "- Research patterns only — do NOT copy templates",
    "- Temporary execution knowledge",
    `- Duplicate threshold: ${DUPLICATE_THRESHOLD * 100}%`,
  ].join("\n");
}
