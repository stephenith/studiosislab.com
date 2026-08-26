/**
 * Production policies — what the Director may and may not do.
 */

export const DIRECTOR_POLICIES = {
  version: "1.0.0",
  role: "orchestration_only",
  primary_executor: "cursor_agent",

  forbidden_actions: [
    "design_resumes",
    "write_fabric_json",
    "edit_templates",
    "research_internet_directly",
    "modify_src",
    "modify_editor",
    "modify_runtime",
    "modify_published_templates",
    "modify_registry",
    "modify_manifest",
    "bypass_founder_approval",
    "permanently_overwrite_studiosislab_knowledge_without_founder_approval",
  ] as const,

  delegation_chain: [
    "founder",
    "resume_production_director",
    "batch_plan",
    "resume_jobs",
    "resume_workers",
    "cursor_agent",
    "qa_pipeline",
    "founder_approval",
    "learning_engine",
  ] as const,

  knowledge_sources_readonly: [
    "StudiosisLab Resume Intelligence",
    "Resume Learning Engine",
    "Resume Design Knowledge",
    "Existing published templates (read-only)",
    "ATS standards",
    "Editor Technical Contract",
  ] as const,

  external_research_when_mcp_available: [
    "modern ATS resumes",
    "latest hiring trends",
    "resume.io",
    "Canva",
    "Enhancv",
    "Novoresume",
    "Harvard guidance",
    "current typography trends",
    "current layout trends",
  ] as const,

  output_roots: {
    batches: "SOS/07_LOGS/saios/batches",
    generated: "SOS/07_LOGS/saios/generated-resumes",
    qa: "SOS/07_LOGS/saios/qa",
    learning: "SOS/07_LOGS/saios/learning",
  },

  founder_approval_required: true,
  max_retries_per_job: 2,
  default_batch_sizes: [10, 25, 50, 100] as const,
} as const;

export type DirectorPolicies = typeof DIRECTOR_POLICIES;

export function assertDirectorDoesNotDesign(action: string): void {
  const designVerbs = ["design", "fabric", "template-json", "write-json", "render"];
  const lower = action.toLowerCase();
  if (designVerbs.some((v) => lower.includes(v))) {
    throw new Error(
      `Director policy violation: "${action}" — Director orchestrates only; Cursor Agent executes production.`,
    );
  }
}
