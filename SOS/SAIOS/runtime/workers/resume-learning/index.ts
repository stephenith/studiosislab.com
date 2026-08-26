#!/usr/bin/env tsx
/**
 * Resume Learning Engine — worker definition
 */
export const RESUME_LEARNING_WORKER = {
  worker_type: "resume-learning-worker",
  version: "1.0.0",
  display_name: "Resume Learning Engine",
  description:
    "Converts founder feedback into persistent design memory and learned rule layers. Never modifies src/, templates, registry, or manifest.",
  capabilities: [
    "feedback-parsing",
    "pattern-extraction",
    "design-memory",
    "rule-updater",
    "quality-tracking",
    "confidence-scoring",
    "learning-reports",
  ],
  constraints: [
    "Knowledge layer only — does not generate templates",
    "Never modifies src/",
    "Never overwrites base design standards",
    "Learned rules are overlay layers for Resume Workers",
    "Output only to SOS/07_LOGS/saios/learning/",
    "No runtime or production changes",
  ],
  entrypoint: "run.ts",
  npm_script: "npm run learn",
} as const;

export type ResumeLearningWorker = typeof RESUME_LEARNING_WORKER;
