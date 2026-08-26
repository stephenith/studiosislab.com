/**
 * Resume Department Reference — metadata only (Agent #180).
 * DO NOT migrate existing Resume workers. No runtime wiring.
 */
import { createDepartmentContract } from "../Department.js";
import { defineDirector } from "../DepartmentDirector.js";
import { defineManager } from "../DepartmentManager.js";
import { defineWorker } from "../DepartmentWorker.js";
import { defineCapability } from "../DepartmentCapability.js";
import type { DepartmentContract } from "../DepartmentTypes.js";

export const RESUME_DEPARTMENT_ID = "resume" as const;

export function buildResumeDepartmentReference(): DepartmentContract {
  const capabilities = [
    defineCapability({
      capability_id: "resume.render",
      capability_name: "Render",
      kind: "render",
      description: "Deterministic resume visual render (future)",
      inputs: ["template_id", "content_model"],
      outputs: ["render_artifact"],
    }),
    defineCapability({
      capability_id: "resume.critique",
      capability_name: "Critique",
      kind: "critique",
      description: "Founder/critic score surface (future)",
      inputs: ["render_artifact"],
      outputs: ["critique_scores"],
    }),
    defineCapability({
      capability_id: "resume.research",
      capability_name: "Research",
      kind: "research",
      description: "Competitive / design research (future)",
      inputs: ["objective"],
      outputs: ["research_notes"],
    }),
    defineCapability({
      capability_id: "resume.planning",
      capability_name: "Planning",
      kind: "planning",
      description: "Production plan composition (future)",
      inputs: ["mission"],
      outputs: ["production_plan"],
    }),
    defineCapability({
      capability_id: "resume.evaluation",
      capability_name: "Evaluation",
      kind: "evaluation",
      description: "QA evaluation (future)",
      inputs: ["artifact"],
      outputs: ["qa_verdict"],
    }),
    defineCapability({
      capability_id: "resume.packaging",
      capability_name: "Packaging",
      kind: "packaging",
      description: "Release packaging (future)",
      inputs: ["artifact"],
      outputs: ["package"],
    }),
    defineCapability({
      capability_id: "resume.thumbnail",
      capability_name: "Thumbnail",
      kind: "thumbnail",
      description: "Thumbnail generation (future)",
      inputs: ["render_artifact"],
      outputs: ["thumbnail"],
    }),
    defineCapability({
      capability_id: "resume.learning",
      capability_name: "Learning",
      kind: "learning",
      description: "Learning loop capture (future)",
      inputs: ["critique_scores"],
      outputs: ["learning_delta"],
    }),
  ];

  const workers = [
    defineWorker({
      worker_id: "resume.worker.production",
      worker_type: "production",
      capabilities: ["resume.render", "resume.packaging"],
      inputs: ["production_plan"],
      outputs: ["resume_artifact"],
      description:
        "Reference: resume production worker role (metadata — not wired)",
    }),
    defineWorker({
      worker_id: "resume.worker.qa",
      worker_type: "qa",
      capabilities: ["resume.evaluation", "resume.critique"],
      inputs: ["resume_artifact"],
      outputs: ["qa_verdict"],
      description: "Reference: resume QA worker role (metadata — not wired)",
    }),
    defineWorker({
      worker_id: "resume.worker.learning",
      worker_type: "learning",
      capabilities: ["resume.learning"],
      inputs: ["critique_scores"],
      outputs: ["learning_delta"],
      description:
        "Reference: resume learning worker role (metadata — not wired)",
    }),
    defineWorker({
      worker_id: "resume.worker.visual-render",
      worker_type: "visual_render",
      capabilities: ["resume.render", "resume.thumbnail"],
      inputs: ["template_id", "content_model"],
      outputs: ["render_artifact", "thumbnail"],
      description:
        "Reference: visual render worker role (metadata — not wired)",
    }),
  ];

  const managers = [
    defineManager({
      manager_id: "resume.manager.production",
      manager_name: "Resume Production Manager",
      worker_ids: [
        "resume.worker.production",
        "resume.worker.visual-render",
      ],
      description: "Allocates production/render workers (metadata only)",
    }),
    defineManager({
      manager_id: "resume.manager.quality",
      manager_name: "Resume Quality Manager",
      worker_ids: ["resume.worker.qa", "resume.worker.learning"],
      description: "Owns QA/learning grouping (metadata only)",
    }),
  ];

  const director = defineDirector({
    director_id: "resume.director",
    director_name: "Resume Director",
    manager_ids: [
      "resume.manager.production",
      "resume.manager.quality",
    ],
    description:
      "Coordinates Resume department planning & reporting (never executes)",
  });

  return createDepartmentContract({
    department_id: RESUME_DEPARTMENT_ID,
    department_name: "Resume",
    department_type: "production",
    version: "1.0.0-reference",
    status: "READY",
    director,
    managers,
    workers,
    capabilities,
    supported_missions: [
      "resume_production",
      "resume_qa",
      "resume_learning",
      "resume_release",
    ],
    supported_artifacts: [
      "resume_template",
      "resume_preview",
      "resume_package",
      "thumbnail",
    ],
    supported_tools: [
      "adaptive-composer",
      "visual-render",
      "founder-critic",
    ],
    supported_skills: [
      "resume.compose",
      "resume.critique",
      "resume.package",
    ],
    dependencies: [
      "platform.department-sdk",
      "runtime.design-brain (future)",
      "runtime.workers.resume-* (existing — not migrated)",
    ],
    reference: true,
    placeholder: false,
    notes: [
      "REFERENCE IMPLEMENTATION — Agent #180",
      "Metadata only — existing Resume code NOT migrated",
      "No QueueManager / Scheduler / worker runtime wiring",
      "Skills → Brain Router → Providers sealed (future)",
    ],
  });
}
