#!/usr/bin/env tsx
/**
 * Resume QA & Publishing Pipeline — worker definition
 */
export const RESUME_QA_WORKER = {
  worker_type: "resume-qa-worker",
  version: "1.0.0",
  display_name: "Resume QA & Publishing Pipeline",
  description:
    "Validates generated resume templates against StudiosisLab production standards and prepares draft publication packages. Never writes to src/, registry, or manifest.",
  capabilities: [
    "alignment-check",
    "spacing-check",
    "typography-check",
    "ats-compliance",
    "editor-compatibility",
    "fabric-validation",
    "thumbnail-validation",
    "seo-validation",
    "qa-report",
    "publication-package",
  ],
  constraints: [
    "Orchestration only — does not generate templates",
    "Never modifies src/",
    "Never updates templates.manifest.json or registry",
    "Never publishes templates automatically",
    "Output only to SOS/07_LOGS/saios/qa/",
    "WAITING_FOR_FOUNDER_APPROVAL before any production write",
  ],
  entrypoint: "run.ts",
  npm_script: "npm run qa",
} as const;

export type ResumeQAWorker = typeof RESUME_QA_WORKER;
