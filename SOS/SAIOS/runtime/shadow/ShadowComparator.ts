import type {
  LegacyShadowOutcome,
  SaiosShadowOutcome,
  ShadowComparisonMetrics,
  ShadowComparisonResult,
} from "./types.js";

export class ShadowComparator {
  compare(
    legacy: LegacyShadowOutcome,
    saios: SaiosShadowOutcome | null,
  ): ShadowComparisonResult {
    const notes: string[] = [];
    const errors: string[] = [];

    if (!legacy.ok) {
      errors.push(`legacy failed: ${legacy.error ?? legacy.runtime_action}`);
    }
    if (!saios) {
      notes.push("saios shadow skipped (non-execute intent)");
      return {
        pass: legacy.ok,
        metrics: {
          legacy_duration_ms: legacy.duration_ms,
          saios_duration_ms: 0,
          legacy_ok: legacy.ok,
          saios_ok: true,
          legacy_work_order_id: legacy.work_order_id,
          saios_plan_id: undefined,
          saios_job_count: 0,
          saios_jobs_completed: 0,
          queue_behavior_match: true,
          worker_selection_noted: false,
          completion_match: legacy.ok,
          errors,
          notes,
        },
        compared_at: new Date().toISOString(),
      };
    }

    if (!saios.ok) {
      errors.push(...saios.errors);
      if (!saios.accepted) errors.push("saios rejected founder command");
    }

    const legacyCaptured =
      legacy.ok &&
      (legacy.runtime_action === "work_order_created" || Boolean(legacy.work_order_id));
    const saiosCaptured = Boolean(saios?.accepted && saios.job_ids.length > 0);
    const queue_behavior_match =
      legacyCaptured === saiosCaptured || (legacy.ok && saiosCaptured);

    if (!queue_behavior_match) {
      notes.push(
        `queue path differs: legacy_action=${legacy.runtime_action} saios_jobs=${saios?.job_ids.length ?? 0}`,
      );
    }

    const completion_match =
      legacy.ok &&
      saios.ok &&
      saios.jobs_completed === saios.job_ids.length &&
      saios.jobs_failed === 0;

    const worker_selection_noted = saios.worker_assignments > 0;
    if (worker_selection_noted) {
      notes.push(`saios assigned workers ${saios.worker_assignments} time(s)`);
    }
    notes.push("legacy uses work-order runner; saios uses registry dispatcher");

    const metrics: ShadowComparisonMetrics = {
      legacy_duration_ms: legacy.duration_ms,
      saios_duration_ms: saios.duration_ms,
      legacy_ok: legacy.ok,
      saios_ok: saios.ok,
      legacy_work_order_id: legacy.work_order_id,
      saios_plan_id: saios.plan_id,
      saios_job_count: saios.job_ids.length,
      saios_jobs_completed: saios.jobs_completed,
      queue_behavior_match,
      worker_selection_noted,
      completion_match,
      errors,
      notes,
    };

    const pass = legacy.ok && saios.ok && saios.accepted && completion_match;

    return { pass, metrics, compared_at: new Date().toISOString() };
  }
}
