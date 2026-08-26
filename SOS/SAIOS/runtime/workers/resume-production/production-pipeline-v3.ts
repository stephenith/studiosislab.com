/**
 * Premium Resume Generator v3 — highest-quality generation layer.
 * Extends V2 worker; consumes Research, Benchmark, Design Brain, Learning, QA.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createMockCursorResearchExecutor } from "../../research/ResearchCoordinator.js";
import type { CursorResearchExecutor } from "../../research/ResearchCoordinator.js";
import { analyzeIndustry } from "./knowledge-context.js";
import { integratePremiumSources } from "./premium-integration.js";
import { selectDesignFamily } from "./family-selector.js";
import { checkDuplicateRiskV3 } from "./duplicate-detector-v3.js";
import { buildPreGenerationChecklist } from "./pre-generation-checklist.js";
import { buildDesignPlanV3 } from "./design-plan-v3.js";
import { buildModernAtsProfessionalTemplate } from "./template-builder.js";
import { runDesignQA } from "./design-qa.js";
import { runTripleCritique, tripleCritiquePass } from "./triple-critique.js";
import { validateEditorCompatibility } from "./editor-validation.js";
import { computePremiumScores, toConfidenceScores } from "./premium-scorer.js";
import { appendLearningRecordV3 } from "./learning-append-v3.js";
import { appendFounderCalibration, appendFounderReview001Calibration, appendFounderReview002Calibration, appendFounderReview003Calibration, appendFounderReview004Calibration, appendDesignDNACalibration } from "./founder-calibration.js";
import { buildProductionDesignBundle, writeDesignBundleArtifacts } from "./design-bundle.js";
import { validateDesignSystemGates } from "./design-system-gates.js";
import { writePremiumReports } from "./reports-v3.js";
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
import { DUPLICATE_THRESHOLD } from "./duplicate-detector.js";
import type { ProductionV3Result, RunProductionV3Options } from "./types-v3.js";
import {
  ENGINES,
  acquireExecutionLock,
  enforceEngineAccess,
} from "../../../architecture/runtime-guard.js";

const SOS_ROOT = resolve(import.meta.dirname, "../../../..");
const GENERATED_ROOT = join(SOS_ROOT, "07_LOGS/saios/generated-resumes");

const DEFAULT_OBJECTIVE =
  "Generate a premium modern ATS resume for a senior finance executive founder review.";

export const PREMIUM_RESUME_GENERATOR = {
  generator: "premium-resume-generator",
  version: "3.0.0",
  description:
    "Highest-quality resume generation — Research → Benchmark → Design Brain → Learning → Intelligence → Worker",
  target_confidence: 97,
  architecture_status: "LEGACY",
  architecture_note:
    "Agent #160 runtime freeze — worker capability only; not the canonical execution engine.",
} as const;

export async function runProductionV3(
  options: RunProductionV3Options = {},
): Promise<ProductionV3Result> {
  enforceEngineAccess(ENGINES.LEGACY_PRODUCTION_V3);
  const releaseLock = acquireExecutionLock(ENGINES.LEGACY_PRODUCTION_V3.id);
  try {
    return await runProductionV3Inner(options);
  } finally {
    releaseLock();
  }
}

async function runProductionV3Inner(
  options: RunProductionV3Options = {},
): Promise<ProductionV3Result> {
  const objective = options.objective ?? DEFAULT_OBJECTIVE;
  const mcp = options.mcp_firecrawl_available ?? false;
  appendFounderCalibration();
  appendFounderReview001Calibration();
  appendFounderReview002Calibration();
  appendFounderReview003Calibration();
  appendFounderReview004Calibration();
  appendDesignDNACalibration();
  const executor =
    createMockCursorResearchExecutor({ failure_rate: 0, base_ms: 10 });

  // 1. Integrate all design sources
  const integrated = await integratePremiumSources({
    objective,
    mcp_available: mcp,
    cursor_executor: executor,
  });

  // 1b. Build immutable Design Bundle (Research + Benchmark + Brain + Design System)
  const designBundle = buildProductionDesignBundle(integrated);
  const designSystemGates = validateDesignSystemGates(designBundle);
  if (!designSystemGates.pass) {
    throw new Error("Design System gates failed — Fabric JSON blocked");
  }

  const industry = analyzeIndustry(objective);

  // 2. Family selection + duplicate detection loop (corpus + memory + batch)
  let duplicate_redesigns = 0;
  let family = selectDesignFamily(objective, integrated.ctx.intelligence.database.design_families);
  let duplicate = checkDuplicateRiskV3({
    objective,
    industry: industry.industry,
    family_id: family.selected_family_id,
  });

  while (duplicate.redesign_required && duplicate_redesigns < 6) {
    duplicate_redesigns += 1;
    family = selectDesignFamily(objective, integrated.ctx.intelligence.database.design_families, {
      exclude_family_ids: [family.selected_family_id],
    });
    duplicate = checkDuplicateRiskV3({
      objective,
      industry: industry.industry,
      family_id: family.selected_family_id,
    });
  }

  // 3. Pre-generation checklist (must pass before Fabric JSON)
  const checklist = buildPreGenerationChecklist({
    objective,
    integration: integrated,
    family,
    duplicate,
    duplicate_redesigns,
    design_bundle: designBundle,
    design_system_gates: designSystemGates,
  });

  if (!checklist.all_pass) {
    throw new Error("Pre-generation checklist failed — Fabric JSON blocked");
  }

  const designPlan = buildDesignPlanV3({
    objective,
    integration: integrated,
    family,
    duplicate,
    industry: industry.industry,
    design_bundle: designBundle,
  });

  // 4. Generate Fabric JSON (only after checklist pass)
  const tier = integrated.brain_decisions.ats_mode === "ats_first" ? "ats_safe" : "hybrid";
  const template = buildModernAtsProfessionalTemplate({
    familyId: family.selected_family_id,
    objective,
    designPlan,
    designBundle,
  });

  // 5. Triple critique (designer → recruiter → founder)
  let designQa = runDesignQA({ template, tier, family_id: family.selected_family_id });
  const critiques = runTripleCritique({ template, designQa, confidence_start: 90 });
  designQa = runDesignQA({ template, tier, family_id: family.selected_family_id });

  if (!designQa.pass) {
    throw new Error("Design QA failed after triple critique");
  }

  const triple_pass = tripleCritiquePass(critiques);

  // 6. Editor validation + premium scoring
  const editor = validateEditorCompatibility(template, integrated.ctx);
  if (!editor.pass) {
    throw new Error("Editor validation failed");
  }

  const premium_scores = computePremiumScores({
    integration: integrated,
    checklist,
    designQa,
    validation: editor.contract,
    duplicate,
    critiques,
    editor_pass: editor.pass,
    page_utilization: template.metrics.page_utilization,
  });
  const confidence = toConfidenceScores(premium_scores);

  const output_dir = options.output_dir ?? join(GENERATED_ROOT, `${template.prototype_id}-v3`);
  mkdirSync(output_dir, { recursive: true });
  mkdirSync(join(output_dir, "localhost"), { recursive: true });

  writeFileSync(join(output_dir, "template-preview.json"), JSON.stringify(template.json, null, 2));
  // Agent #146: full preview.png + thumbnail derived from that preview (never copy placeholders).
  const { writePreviewAssetsBesideTemplate } = await import("./preview-assets.js");
  await writePreviewAssetsBesideTemplate(template.json, output_dir);

  const designBundleArtifacts = writeDesignBundleArtifacts(output_dir, designBundle);

  // 7. Resume QA pipeline
  const qaCtx = loadTemplateContext(output_dir);
  const qaStages = [
    stageResult("alignment", runAlignmentCheck(qaCtx)),
    stageResult("spacing", runSpacingCheck(qaCtx)),
    stageResult("typography", runTypographyCheck(qaCtx)),
    stageResult("ats", runAtsCheck(qaCtx)),
    stageResult("editor", runEditorCheck(qaCtx)),
    stageResult("fabric", runFabricCheck(qaCtx)),
  ];
  const thumbQa = await runThumbnailCheck(qaCtx, { output_dir, render_if_missing: false });
  qaStages.push(stageResult("thumbnail", thumbQa));
  qaStages.push(stageResult("seo", runSEOCheck(qaCtx)));
  const { summary: qaSummary } = writeQAReports(qaCtx, qaStages);

  const template_path = join(output_dir, "template-preview.json");
  const local_review_command = `npm run review:template -- --path=${template_path}`;
  const local_review = {
    prototype_id: template.prototype_id,
    template_path,
    thumbnail_path: join(output_dir, "thumbnail.png"),
    review_command: local_review_command,
    status: "AWAITING_FOUNDER_APPROVAL",
    no_publish: true,
    generator: "premium-resume-generator-v3",
    prepared_at: new Date().toISOString(),
    artifacts: [
      "design-intent.json",
      "comparison-report.md",
      "designer-review.md",
      "before-after.md",
    ],
  };

  const result: ProductionV3Result = {
    pass:
      qaSummary.pass &&
      premium_scores.target_met &&
      checklist.all_pass &&
      triple_pass,
    worker_version: "3.0.0",
    generator: "premium-resume-generator",
    prototype_id: template.prototype_id,
    output_dir,
    status: "AWAITING_FOUNDER_APPROVAL",
    premium_scores,
    confidence,
    qa_pass: qaSummary.pass,
    local_review_command,
    duplicate_redesigns,
    checklist_pass: checklist.all_pass,
    triple_critique_pass: triple_pass,
    artifacts: [],
  };

  appendLearningRecordV3({
    prototype_id: template.prototype_id,
    checklist,
    integration: integrated,
    premium_scores,
    persist: options.learning_persist,
  });

  result.artifacts = writePremiumReports(output_dir, {
    objective,
    integration: integrated,
    checklist,
    design_plan: designPlan,
    design_bundle: designBundle,
    design_system_gates: designSystemGates,
    design_bundle_artifacts: designBundleArtifacts,
    critiques,
    validation: editor.contract,
    editor,
    premium_scores,
    confidence,
    duplicate,
    thumbnail_analysis: {
      width: 199,
      height: 281,
      scale: 0.25,
      object_count: template.json.objects.length,
      duplicate_threshold: DUPLICATE_THRESHOLD,
      generated_at: new Date().toISOString(),
    },
    local_review,
    result,
  });

  return result;
}
