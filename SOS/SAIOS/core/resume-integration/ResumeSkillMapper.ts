/**
 * Maps Resume Department operations → Skills (or deterministic code path).
 */
import type { SkillId } from "../skills/Skill.js";

export type ResumeOperation =
  | "planning"
  | "founder_revision"
  | "resume_critique"
  | "report"
  | "duplicate_review"
  | "qa"
  | "publication_gate";

export type ResumeSkillMapping =
  | { kind: "skill"; skill_id: SkillId; operation: ResumeOperation }
  | {
      kind: "deterministic";
      operation: ResumeOperation;
      reason: string;
    };

const MAP: Record<ResumeOperation, ResumeSkillMapping> = {
  planning: {
    kind: "skill",
    skill_id: "resume.layout_planning",
    operation: "planning",
  },
  founder_revision: {
    kind: "skill",
    skill_id: "resume.founder_feedback_interpretation",
    operation: "founder_revision",
  },
  resume_critique: {
    kind: "skill",
    skill_id: "resume.resume_critique",
    operation: "resume_critique",
  },
  report: {
    kind: "skill",
    skill_id: "common.report_generation",
    operation: "report",
  },
  duplicate_review: {
    kind: "skill",
    skill_id: "resume.duplicate_detection",
    operation: "duplicate_review",
  },
  qa: {
    kind: "deterministic",
    operation: "qa",
    reason: "QA uses deterministic ATS/Fabric/layout checks — no Brain Provider",
  },
  publication_gate: {
    kind: "deterministic",
    operation: "publication_gate",
    reason: "Publication gates are deterministic founder-approval checks — no Brain Provider",
  },
};

export function mapResumeOperationToSkill(
  operation: ResumeOperation,
): ResumeSkillMapping {
  return MAP[operation];
}

export function listResumeSkillMappings(): ResumeSkillMapping[] {
  return Object.values(MAP);
}
