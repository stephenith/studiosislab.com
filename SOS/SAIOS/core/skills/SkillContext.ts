/**
 * Skill context — department-facing context without provider leakage.
 */
export type SkillContext = {
  task_id: string;
  department: string;
  dry_run: boolean;
  live_enabled: boolean;
  memory_references: string[];
  context_references: string[];
  founder_approval_required: boolean;
  /** Never includes provider credentials or model names. */
  metadata?: Record<string, unknown>;
};

export function createSkillContext(
  partial: Omit<SkillContext, "live_enabled"> & { live_enabled?: boolean },
): SkillContext {
  return {
    task_id: partial.task_id,
    department: partial.department,
    dry_run: partial.dry_run,
    live_enabled: partial.live_enabled ?? false,
    memory_references: partial.memory_references ?? [],
    context_references: partial.context_references ?? [],
    founder_approval_required: partial.founder_approval_required ?? true,
    metadata: partial.metadata,
  };
}
