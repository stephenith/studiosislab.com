/**
 * Resume Production Worker v2 — worker definition + exports.
 */
export const RESUME_PRODUCTION_WORKER = {
  worker_type: "resume-production-worker",
  version: "2.0.0",
  display_name: "Resume Production Worker",
  description:
    "Production-ready resume template generation. Mandatory v2 pipeline: research → planning → self-critique → Fabric JSON → validation → QA → local review → founder gate.",
  capabilities: [
    "resume-design-knowledge",
    "resume-intelligence-engine",
    "founder-learning-memory",
    "cursor-research-coordination",
    "firecrawl-research",
    "duplicate-detection",
    "design-plan",
    "self-critique",
    "confidence-engine",
    "fabric-json-generation",
    "editor-validation",
    "thumbnail-render",
    "resume-qa-pipeline",
    "local-review-package",
    "v2-production-pipeline",
    "premium-resume-generator-v3",
    "benchmark-integration",
    "design-brain-integration",
    "triple-critique",
    "pre-generation-checklist",
  ],
  constraints: [
    "Generates ONE template per run (prototype)",
    "Never modifies src/",
    "Never updates manifest or registry",
    "Output only to SOS/07_LOGS/saios/generated-resumes/",
    "STOPS after local review — founder approval mandatory",
    "Learning append-only — never overwrites memory",
  ],
  entrypoint: "run-v2.ts",
  npm_script: "npm run generate:v2",
} as const;

export type ResumeProductionWorker = typeof RESUME_PRODUCTION_WORKER;

export { runProductionV2 } from "./production-pipeline.js";
export { runProductionV3, PREMIUM_RESUME_GENERATOR } from "./production-pipeline-v3.js";
export type { ProductionV2Result, RunProductionV2Options } from "./types-v2.js";
export type { ProductionV3Result, RunProductionV3Options } from "./types-v3.js";
