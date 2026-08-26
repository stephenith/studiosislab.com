/**
 * Resume Factory entry-point registry — Agent #122.
 * AI-assisted ops enter AIOS; deterministic ops stay outside.
 */

export type FactoryEntryKind = "ai" | "deterministic";

export type FactoryEntryPoint = {
  id: string;
  kind: FactoryEntryKind;
  module: string;
  symbol: string;
  /** ResumeOperation when kind=ai; null when deterministic */
  operation: string | null;
  notes: string;
};

/** AI-assisted Resume Factory entry points — must enter via ResumeKnowledgeGateway. */
export const AI_ENTRY_POINTS: FactoryEntryPoint[] = [
  {
    id: "research.cursor_research_executor",
    kind: "ai",
    module: "SOS/SAIOS/runtime/research/ResearchCoordinator.ts",
    symbol: "createMockCursorResearchExecutor",
    operation: "planning",
    notes: "Primary research/planning intelligence hook used by StageRunner & research pipeline",
  },
  {
    id: "research.research_director",
    kind: "ai",
    module: "SOS/SAIOS/runtime/research/ResearchDirector.ts",
    symbol: "runResearchSession",
    operation: "planning",
    notes: "Delegates to CursorResearchExecutor (gateway-backed)",
  },
  {
    id: "design_brain.research_integration",
    kind: "ai",
    module: "SOS/SAIOS/runtime/design-brain/ResearchIntegration.ts",
    symbol: "integrateResearch",
    operation: "planning",
    notes: "Design Brain research overlay via gateway-backed executor",
  },
  {
    id: "design_brain.design_brain",
    kind: "ai",
    module: "SOS/SAIOS/runtime/design-brain/DesignBrain.ts",
    symbol: "runDesignBrain",
    operation: "planning",
    notes: "Default executor is gateway-backed",
  },
  {
    id: "adaptive_composer.research_integration",
    kind: "ai",
    module: "SOS/SAIOS/runtime/adaptive-composer/ResearchIntegration.ts",
    symbol: "gatherCompositionPrinciples",
    operation: "planning",
    notes: "Composer research via gateway-backed executor",
  },
  {
    id: "visual_render.research_integration",
    kind: "ai",
    module: "SOS/SAIOS/runtime/visual-render/ResearchIntegration.ts",
    symbol: "gatherRenderResearchPrinciples",
    operation: "planning",
    notes: "Render research via gateway-backed executor",
  },
  {
    id: "production.premium_integration",
    kind: "ai",
    module: "SOS/SAIOS/runtime/workers/resume-production/premium-integration.ts",
    symbol: "integratePremiumSources",
    operation: "planning",
    notes: "Premium source integration via gateway-backed executor",
  },
  {
    id: "production.pipeline_v3",
    kind: "ai",
    module: "SOS/SAIOS/runtime/workers/resume-production/production-pipeline-v3.ts",
    symbol: "runProductionV3",
    operation: "planning",
    notes: "Default Cursor executor is gateway-backed",
  },
  {
    id: "production.pipeline",
    kind: "ai",
    module: "SOS/SAIOS/runtime/workers/resume-production/production-pipeline.ts",
    symbol: "runProductionPipeline",
    operation: "planning",
    notes: "Legacy pipeline Cursor research via gateway-backed executor",
  },
  {
    id: "unified.stage_runner",
    kind: "ai",
    module: "SOS/SAIOS/runtime/unified-production/StageRunner.ts",
    symbol: "runStage",
    operation: "planning",
    notes: "Research/design/compose stages use gateway-backed executor",
  },
  {
    id: "controller.production_controller",
    kind: "ai",
    module: "SOS/SAIOS/runtime/controller/ProductionController.ts",
    symbol: "submitFounderObjective",
    operation: "planning",
    notes: "Founder entry defaults to gateway-backed research executor",
  },
  {
    id: "benchmark.benchmark_director",
    kind: "ai",
    module: "SOS/SAIOS/runtime/benchmark/BenchmarkDirector.ts",
    symbol: "runBenchmarkCycle",
    operation: "planning",
    notes: "Benchmark research via gateway-backed executor",
  },
  {
    id: "director.cursor_research_executor",
    kind: "ai",
    module: "SOS/SAIOS/runtime/directors/resume-production/CursorResearchCoordinator.ts",
    symbol: "createMockCursorExecutor",
    operation: "planning",
    notes: "Batch director Cursor executor — gateway-backed",
  },
  {
    id: "director.resume_production",
    kind: "ai",
    module: "SOS/SAIOS/runtime/directors/resume-production/ResumeProductionDirector.ts",
    symbol: "runProductionBatch",
    operation: "planning",
    notes: "Batch orchestration via gateway-backed Cursor executor",
  },
  {
    id: "pipeline.pipeline_executor",
    kind: "ai",
    module: "SOS/SAIOS/runtime/pipeline/PipelineExecutor.ts",
    symbol: "executeCursorResearch",
    operation: "planning",
    notes: "Pipeline Cursor stages via gateway-backed executor",
  },
  {
    id: "founder_critic.critique_path",
    kind: "ai",
    module: "SOS/SAIOS/core/resume-integration/ResumeFactoryEntryBridge.ts",
    symbol: "invokeResumeFactoryAiOperation(resume_critique)",
    operation: "resume_critique",
    notes: "AI critique path available via bridge (rule-based FounderCritic remains deterministic)",
  },
  {
    id: "founder_revision.path",
    kind: "ai",
    module: "SOS/SAIOS/core/resume-integration/ResumeFactoryEntryBridge.ts",
    symbol: "invokeResumeFactoryAiOperation(founder_revision)",
    operation: "founder_revision",
    notes: "Founder revision AI path via bridge",
  },
  {
    id: "report.generation_path",
    kind: "ai",
    module: "SOS/SAIOS/core/resume-integration/ResumeFactoryEntryBridge.ts",
    symbol: "invokeResumeFactoryAiOperation(report)",
    operation: "report",
    notes: "AI report generation path via bridge",
  },
  {
    id: "duplicate_review.path",
    kind: "ai",
    module: "SOS/SAIOS/core/resume-integration/ResumeFactoryEntryBridge.ts",
    symbol: "invokeResumeFactoryAiOperation(duplicate_review)",
    operation: "duplicate_review",
    notes: "AI duplicate review path via bridge (hash guards remain deterministic)",
  },
];

/** Deterministic entry points — must NOT enter Brain/Provider path. */
export const DETERMINISTIC_ENTRY_POINTS: FactoryEntryPoint[] = [
  {
    id: "qa.resume_qa",
    kind: "deterministic",
    module: "SOS/SAIOS/runtime/workers/resume-qa/",
    symbol: "run*Check",
    operation: "qa",
    notes: "ATS/Fabric/layout/typography QA checks",
  },
  {
    id: "publication.director",
    kind: "deterministic",
    module: "SOS/SAIOS/runtime/publication/PublicationDirector.ts",
    symbol: "runPublicationPrep",
    operation: "publication_gate",
    notes: "Publication prep requires founder approval",
  },
  {
    id: "publication.template_id",
    kind: "deterministic",
    module: "SOS/SAIOS/runtime/publication/TemplateIdAssigner.ts",
    symbol: "assignPermanentTemplateId",
    operation: null,
    notes: "ID assignment",
  },
  {
    id: "publication.release_manager",
    kind: "deterministic",
    module: "SOS/SAIOS/runtime/publication/ReleaseManager.ts",
    symbol: "runReleaseManager",
    operation: null,
    notes: "Checksums / release verify",
  },
  {
    id: "publication.package_validator",
    kind: "deterministic",
    module: "SOS/SAIOS/runtime/publication/PackageValidator.ts",
    symbol: "validatePublicationPackage",
    operation: null,
    notes: "Package validation",
  },
  {
    id: "scheduler.founder_gate",
    kind: "deterministic",
    module: "SOS/SAIOS/runtime/scheduler/ProductionExecutor.ts",
    symbol: "validateFounderGate",
    operation: "publication_gate",
    notes: "Founder gate validation",
  },
  {
    id: "originality.guard",
    kind: "deterministic",
    module: "SOS/SAIOS/runtime/adaptive-composer/OriginalityGuard.ts",
    symbol: "checkCompositionOriginality",
    operation: null,
    notes: "Fingerprint / originality hashing",
  },
  {
    id: "duplicate.detector_v3",
    kind: "deterministic",
    module: "SOS/SAIOS/runtime/workers/resume-production/duplicate-detector-v3.ts",
    symbol: "checkDuplicateRiskV3",
    operation: null,
    notes: "Deterministic duplicate risk checks",
  },
  {
    id: "design_system.gates",
    kind: "deterministic",
    module: "SOS/SAIOS/runtime/workers/resume-production/design-system-gates.ts",
    symbol: "validateDesignSystemGates",
    operation: null,
    notes: "Design system gates",
  },
];

export function listAiEntryPoints(): FactoryEntryPoint[] {
  return [...AI_ENTRY_POINTS];
}

export function listDeterministicEntryPoints(): FactoryEntryPoint[] {
  return [...DETERMINISTIC_ENTRY_POINTS];
}
