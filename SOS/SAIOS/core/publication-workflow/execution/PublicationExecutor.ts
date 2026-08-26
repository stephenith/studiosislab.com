/**
 * Durable, resumable multi-candidate publication executor.
 * Fail-closed. Never silently omits plan entries.
 */
import {
  defaultPublicationRoots,
  expectedGeneratedFilesForCatalogue,
  type PublicationRoots,
} from "../paths.js";
import { readPlan, writePlan } from "../PublicationPlanService.js";
import type { PublicationApplyRecord, PublicationPlan } from "../types.js";
import {
  createDryRunAdapters,
  type ExecutionAdapters,
  type SimulateHooks,
  createSimulateAdapters,
} from "./adapters.js";
import {
  ensureExecutionsDir,
  findExecutionForPlan,
  newExecutionId,
  readExecution,
  writeExecution,
} from "./ExecutionJournal.js";
import {
  acquirePublicationLock,
  releasePublicationLock,
  touchPublicationLock,
} from "./PublicationLock.js";
import { runPreExecutionGate } from "./PreExecutionGate.js";
import type {
  EntryStep,
  ExecutionPhase,
  PublicationExecution,
} from "./types.js";
import { PHASE_ORDER } from "./types.js";

export type ExecutorMode = "dry_run" | "execute" | "simulate";

export type RunExecutorInput = {
  plan_id: string;
  confirm_phrase: string;
  mode: ExecutorMode;
  actor?: string;
  force_stale_lock?: boolean;
  adapters?: ExecutionAdapters;
  simulate_hooks?: SimulateHooks;
  /** Test-only: inject crash after persisting a phase */
  crash_after_phase?: ExecutionPhase | "RESERVED" | "EXPORT_PARTIAL";
};

function envAllowsExecute(): boolean {
  return (
    process.env.SOS_AIOS_PUBLICATION_APPLY === "1" &&
    process.env.SOS_AIOS_LIVE !== "1"
  );
}

function hasPhase(exec: PublicationExecution, phase: ExecutionPhase): boolean {
  return exec.phases_completed.includes(phase);
}

function markStep(entry: PublicationExecution["entries"][0], step: EntryStep): void {
  if (!entry.completed_steps.includes(step)) {
    entry.completed_steps.push(step);
  }
}

function failRecoverable(
  exec: PublicationExecution,
  error: string,
  recovery: string[],
  roots: PublicationRoots,
): PublicationExecution {
  exec.status = "FAILED_RECOVERABLE";
  exec.current_phase = "FAILED_RECOVERABLE";
  exec.error = error;
  exec.recovery_instructions = recovery;
  exec.retry_count += 1;
  writeExecution(exec, roots);
  return exec;
}

function failTerminal(
  exec: PublicationExecution,
  error: string,
  recovery: string[],
  roots: PublicationRoots,
): PublicationExecution {
  exec.status = "FAILED_TERMINAL";
  exec.current_phase = "FAILED_TERMINAL";
  exec.error = error;
  exec.recovery_instructions = recovery;
  writeExecution(exec, roots);
  return exec;
}

function applyRecordFromExecution(
  exec: PublicationExecution,
  started_at: string,
  execute_writes: boolean,
): PublicationApplyRecord {
  const status: PublicationApplyRecord["status"] =
    exec.status === "COMPLETED"
      ? "COMPLETED"
      : exec.status === "DRY_RUN"
        ? "DRY_RUN"
        : exec.status === "FAILED_TERMINAL" || exec.status === "FAILED_RECOVERABLE"
          ? "FAILED"
          : "PUBLISHING";
  return {
    plan_id: exec.plan_id,
    started_at,
    finished_at: new Date().toISOString(),
    status,
    confirm_phrase_accepted: true,
    execute_writes,
    steps_completed: [
      ...exec.phases_completed,
      ...(exec.error ? [`error:${exec.error.slice(0, 80)}`] : []),
    ],
    partial_writes: exec.generated_files_all,
    results: exec.entries.map((e) => ({
      candidate_id: e.candidate_id,
      catalogue_id: e.catalogue_id,
      export_package_id: e.export_package_id,
      release_id: null,
      git_commit_sha: exec.git_commit_sha,
      deployment_id: exec.deployment_id,
      live_url: e.live_url,
      published: e.completed_steps.includes("lifecycle_published"),
    })),
    error: exec.error,
    recovery_instructions: exec.recovery_instructions,
    website_modified:
      hasPhase(exec, "WEBSITE_WRITES_APPLIED") && exec.mode !== "dry_run",
    git_committed: Boolean(exec.git_commit_sha),
    git_pushed: exec.git_pushed,
    live_verified: exec.deployment_verified,
  };
}

function initExecution(
  plan: PublicationPlan,
  mode: ExecutorMode,
  confirm: string,
): PublicationExecution {
  const now = new Date().toISOString();
  return {
    schema_version: "publication-execution-1.0.0",
    plan_id: plan.plan_id,
    execution_id: newExecutionId(),
    started_at: now,
    updated_at: now,
    status: mode === "dry_run" ? "DRY_RUN" : "PREPARED",
    current_phase: mode === "dry_run" ? "DRY_RUN" : "PREPARED",
    mode,
    eligibility_fingerprint: plan.eligibility_fingerprint,
    confirm_phrase: confirm,
    entries: plan.entries.map((e) => ({
      candidate_id: e.candidate_id,
      title: e.title,
      staging_package_id: e.staging_package_id,
      catalogue_id: e.proposed_catalogue_id,
      decision_id: e.decision_id,
      generation_id: e.generation_id,
      completed_steps: [],
      export_package_id: null,
      reservation_id: null,
      generated_files: [...e.expected_generated_files],
      file_checksums: {},
      live_url: null,
      lifecycle_status: null,
      error: null,
    })),
    phases_completed: [],
    generated_files_all: [],
    rollback_manifest_path: null,
    git_commit_sha: null,
    git_branch: null,
    git_pushed: false,
    push_remote: null,
    deployment_id: null,
    deployment_verified: false,
    live_urls: {},
    lifecycle_reconciled: false,
    error: null,
    retry_count: 0,
    recovery_instructions: [],
    publication_allowed: false,
    live: false,
  };
}

export async function runPublicationExecutor(
  input: RunExecutorInput,
  roots: PublicationRoots = defaultPublicationRoots(),
): Promise<{
  ok: boolean;
  plan: PublicationPlan | null;
  apply: PublicationApplyRecord;
  execution: PublicationExecution | null;
}> {
  const started_at = new Date().toISOString();
  const plan = readPlan(input.plan_id, roots);
  if (!plan) {
    const apply: PublicationApplyRecord = {
      plan_id: input.plan_id,
      started_at,
      finished_at: new Date().toISOString(),
      status: "FAILED",
      confirm_phrase_accepted: false,
      execute_writes: false,
      steps_completed: [],
      partial_writes: [],
      results: [],
      error: `Plan not found: ${input.plan_id}`,
      recovery_instructions: ["Create a new plan with aios:publication:plan"],
      website_modified: false,
      git_committed: false,
      git_pushed: false,
      live_verified: false,
    };
    return { ok: false, plan: null, apply, execution: null };
  }

  const expected = `PUBLISH_PLAN_${plan.plan_id}`;
  if (input.confirm_phrase !== expected) {
    const apply: PublicationApplyRecord = {
      plan_id: plan.plan_id,
      started_at,
      finished_at: new Date().toISOString(),
      status: "FAILED",
      confirm_phrase_accepted: false,
      execute_writes: false,
      steps_completed: [],
      partial_writes: [],
      results: [],
      error: `confirm_phrase must be exactly ${expected}`,
      recovery_instructions: [`Re-run with --confirm=${expected}`],
      website_modified: false,
      git_committed: false,
      git_pushed: false,
      live_verified: false,
    };
    return { ok: false, plan, apply, execution: null };
  }

  if (input.mode === "execute" && !envAllowsExecute()) {
    const apply: PublicationApplyRecord = {
      plan_id: plan.plan_id,
      started_at,
      finished_at: new Date().toISOString(),
      status: "FAILED",
      confirm_phrase_accepted: true,
      execute_writes: false,
      steps_completed: ["confirm_phrase"],
      partial_writes: [],
      results: [],
      error:
        "Execute refused: require --execute, SOS_AIOS_PUBLICATION_APPLY=1, and SOS_AIOS_LIVE≠1",
      recovery_instructions: [
        "Set SOS_AIOS_PUBLICATION_APPLY=1",
        "Keep SOS_AIOS_LIVE=0",
        "Pass --execute",
      ],
      website_modified: false,
      git_committed: false,
      git_pushed: false,
      live_verified: false,
    };
    return { ok: false, plan, apply, execution: null };
  }

  // Omit check: every plan entry must be processed
  if (plan.entries.length === 0) {
    const apply: PublicationApplyRecord = {
      plan_id: plan.plan_id,
      started_at,
      finished_at: new Date().toISOString(),
      status: "FAILED",
      confirm_phrase_accepted: true,
      execute_writes: false,
      steps_completed: [],
      partial_writes: [],
      results: [],
      error: "Plan has zero entries — refusing",
      recovery_instructions: ["Rebuild plan"],
      website_modified: false,
      git_committed: false,
      git_pushed: false,
      live_verified: false,
    };
    return { ok: false, plan, apply, execution: null };
  }

  ensureExecutionsDir(roots);

  // Resume existing non-dry execution
  let exec: PublicationExecution | null = null;
  if (input.mode !== "dry_run") {
    let existing: PublicationExecution | null = null;
    try {
      existing = findExecutionForPlan(plan.plan_id, roots);
    } catch (e) {
      const apply: PublicationApplyRecord = {
        plan_id: plan.plan_id,
        started_at,
        finished_at: new Date().toISOString(),
        status: "FAILED",
        confirm_phrase_accepted: true,
        execute_writes: true,
        steps_completed: [],
        partial_writes: [],
        results: [],
        error: `Malformed execution journal: ${e instanceof Error ? e.message : String(e)}`,
        recovery_instructions: [
          "Inspect executions journal",
          "Do not invent publication state",
        ],
        website_modified: false,
        git_committed: false,
        git_pushed: false,
        live_verified: false,
      };
      return { ok: false, plan, apply, execution: null };
    }
    if (existing && existing.mode !== "dry_run") {
      if (existing.status === "COMPLETED") {
        const apply = applyRecordFromExecution(existing, started_at, true);
        apply.recovery_instructions = [
          "Execution already COMPLETED — no-op re-run",
        ];
        return { ok: true, plan, apply, execution: existing };
      }
      try {
        // Validate journal schema
        if (existing.schema_version !== "publication-execution-1.0.0") {
          throw new Error("unsupported schema_version");
        }
        if (!Array.isArray(existing.entries) || existing.entries.length === 0) {
          throw new Error("entries missing");
        }
        exec = existing;
        exec.retry_count += 1;
        exec.error = null;
      } catch (e) {
        const apply: PublicationApplyRecord = {
          plan_id: plan.plan_id,
          started_at,
          finished_at: new Date().toISOString(),
          status: "FAILED",
          confirm_phrase_accepted: true,
          execute_writes: input.mode !== "dry_run",
          steps_completed: [],
          partial_writes: [],
          results: [],
          error: `Malformed execution journal: ${e instanceof Error ? e.message : String(e)}`,
          recovery_instructions: [
            "Inspect executions journal",
            "Do not invent publication state",
          ],
          website_modified: false,
          git_committed: false,
          git_pushed: false,
          live_verified: false,
        };
        return { ok: false, plan, apply, execution: null };
      }
    }
  }

  if (!exec) {
    exec = initExecution(plan, input.mode, input.confirm_phrase);
  }

  // Entry count must match plan (no silent omission on resume)
  if (exec.entries.length !== plan.entries.length) {
    return {
      ok: false,
      plan,
      apply: {
        plan_id: plan.plan_id,
        started_at,
        finished_at: new Date().toISOString(),
        status: "FAILED",
        confirm_phrase_accepted: true,
        execute_writes: false,
        steps_completed: [],
        partial_writes: [],
        results: [],
        error: `Execution entry count ${exec.entries.length} != plan ${plan.entries.length}`,
        recovery_instructions: ["Do not resume mismatched journal"],
        website_modified: false,
        git_committed: false,
        git_pushed: false,
        live_verified: false,
      },
      execution: exec,
    };
  }

  const adapters: ExecutionAdapters =
    input.adapters ??
    (input.mode === "dry_run"
      ? createDryRunAdapters(roots)
      : input.mode === "simulate"
        ? createSimulateAdapters(roots, input.simulate_hooks ?? {})
        : await (async () => {
            const { createProductionAdapters } = await import(
              "./productionAdapters.js"
            );
            return createProductionAdapters(roots);
          })());

  // Lock (not for dry-run)
  if (input.mode !== "dry_run") {
    const lock = acquirePublicationLock({
      plan_id: plan.plan_id,
      execution_id: exec.execution_id,
      mode: input.mode === "simulate" ? "simulate" : "execute",
      force_stale: input.force_stale_lock,
      roots,
    });
    if (!lock.ok) {
      const apply: PublicationApplyRecord = {
        plan_id: plan.plan_id,
        started_at,
        finished_at: new Date().toISOString(),
        status: "FAILED",
        confirm_phrase_accepted: true,
        execute_writes: true,
        steps_completed: [],
        partial_writes: [],
        results: [],
        error: lock.error,
        recovery_instructions: [
          "Wait for other executor or resume the locked execution_id",
          "Stale lock takeover requires explicit force after stale window",
        ],
        website_modified: false,
        git_committed: false,
        git_pushed: false,
        live_verified: false,
      };
      return { ok: false, plan, apply, execution: exec };
    }
    writePlan(
      {
        ...plan,
        status: "PUBLISHING",
        updated_at: new Date().toISOString(),
      },
      roots,
    );
    writeExecution(exec, roots);
  }

  try {
    // ---- PREPARED / revalidate ----
    if (!hasPhase(exec, "PREPARED") || input.mode === "dry_run") {
      const gate = runPreExecutionGate(plan.plan_id, roots, {
        skip_git_dirty: input.mode === "simulate" || input.mode === "dry_run",
      });
      if (!gate.ok) {
        if (input.mode === "dry_run") {
          const dry = initExecution(plan, "dry_run", input.confirm_phrase);
          dry.status = "FAILED_TERMINAL";
          dry.error = gate.errors.join("; ");
          dry.recovery_instructions = [
            "Fix verification failures before apply",
            ...gate.errors,
          ];
          const apply = applyRecordFromExecution(dry, started_at, false);
          apply.status = "FAILED";
          writePlan(
            {
              ...plan,
              status: plan.status === "VERIFIED" ? "VERIFIED" : plan.status,
              updated_at: new Date().toISOString(),
              apply,
            },
            roots,
          );
          return { ok: false, plan: readPlan(plan.plan_id, roots), apply, execution: dry };
        }
        failRecoverable(exec, gate.errors.join("; "), [
          "Fix eligibility/state",
          "Re-verify plan",
          "Re-run apply to resume",
        ], roots);
        const apply = applyRecordFromExecution(exec, started_at, true);
        writePlan(
          {
            ...readPlan(plan.plan_id, roots)!,
            status: "FAILED",
            updated_at: new Date().toISOString(),
            apply,
          },
          roots,
        );
        return { ok: false, plan: readPlan(plan.plan_id, roots), apply, execution: exec };
      }

      if (input.mode !== "dry_run") {
        exec.status = "PREPARED";
        exec.current_phase = "PREPARED";
        if (!hasPhase(exec, "PREPARED")) exec.phases_completed.push("PREPARED");
        writeExecution(exec, roots);
        touchPublicationLock(plan.plan_id, exec.execution_id, roots);
        if (
          input.crash_after_phase === "PREPARED" ||
          input.simulate_hooks?.crash_after_phase === "PREPARED"
        ) {
          throw new Error("CRASH_INJECTED:PREPARED");
        }
      }
    }

    // ---- RESERVE (logical part of EXPORTING prep) ----
    const needsReserve = exec.entries.some(
      (e) => !e.completed_steps.includes("reserved"),
    );
    if (needsReserve || input.mode === "dry_run") {
      const reserves = await adapters.reserveAll({
        plan_id: plan.plan_id,
        execution_id: exec.execution_id,
        entries: exec.entries,
      });
      for (let i = 0; i < exec.entries.length; i++) {
        const r = reserves[i]!;
        const entry = exec.entries[i]!;
        if (!r.ok) {
          if (input.mode === "dry_run") {
            const apply = applyRecordFromExecution(exec, started_at, false);
            apply.status = "FAILED";
            apply.error = r.error;
            return { ok: false, plan, apply, execution: exec };
          }
          entry.error = r.error;
          failRecoverable(
            exec,
            r.error ?? "Reservation failed",
            [
              "Resolve catalogue collision",
              "Do not allocate alternate IDs",
              "Re-run apply to resume same catalogue IDs",
            ],
            roots,
          );
          const apply = applyRecordFromExecution(exec, started_at, true);
          return { ok: false, plan: readPlan(plan.plan_id, roots), apply, execution: exec };
        }
        if (input.mode !== "dry_run") {
          entry.reservation_id = r.reservation_id;
          entry.catalogue_id = r.catalogue_id;
          markStep(entry, "reserved");
        }
      }
      if (input.mode !== "dry_run") {
        writeExecution(exec, roots);
        if (
          input.crash_after_phase === "RESERVED" ||
          input.simulate_hooks?.crash_after_phase === "RESERVED"
        ) {
          throw new Error("CRASH_INJECTED:RESERVED");
        }
      }
    }

    // ---- EXPORTING ----
    if (!hasPhase(exec, "EXPORTING") || input.mode === "dry_run") {
      exec.status = input.mode === "dry_run" ? "DRY_RUN" : "EXPORTING";
      exec.current_phase = input.mode === "dry_run" ? "DRY_RUN" : "EXPORTING";
      for (let i = 0; i < exec.entries.length; i++) {
        const entry = exec.entries[i]!;
        if (entry.completed_steps.includes("exported") && input.mode !== "dry_run") {
          continue;
        }
        const exported = await adapters.exportEntry({ entry, execution: exec });
        if (!exported.ok) {
          if (input.mode === "dry_run") {
            const apply = applyRecordFromExecution(exec, started_at, false);
            apply.status = "FAILED";
            apply.error = exported.error;
            return { ok: false, plan, apply, execution: exec };
          }
          entry.error = exported.error;
          failRecoverable(
            exec,
            exported.error ?? "Export failed",
            [
              "Fix export failure",
              "Re-run apply — will resume without re-exporting completed entries",
              "Do not commit/push/publish",
            ],
            roots,
          );
          const apply = applyRecordFromExecution(exec, started_at, true);
          return { ok: false, plan: readPlan(plan.plan_id, roots), apply, execution: exec };
        }
        entry.export_package_id = exported.export_package_id;
        entry.generated_files = exported.generated_files;
        entry.file_checksums = exported.file_checksums;
        if (input.mode !== "dry_run") {
          markStep(entry, "exported");
          markStep(entry, "assets_ready");
          writeExecution(exec, roots);
          if (
            input.crash_after_phase === "EXPORT_PARTIAL" ||
            (input.simulate_hooks?.crash_after_phase === "EXPORT_PARTIAL" &&
              i === 0)
          ) {
            throw new Error("CRASH_INJECTED:EXPORT_PARTIAL");
          }
        }
      }
      // All entries exported — omit check
      const missing = exec.entries.filter(
        (e) =>
          input.mode === "dry_run"
            ? e.generated_files.length === 0
            : !e.completed_steps.includes("exported"),
      );
      if (missing.length) {
        failTerminal(
          exec,
          `Resume template omission after export: ${missing.map((m) => m.candidate_id).join(", ")}`,
          ["Never skip entries — investigate"],
          roots,
        );
        const apply = applyRecordFromExecution(exec, started_at, true);
        return { ok: false, plan: readPlan(plan.plan_id, roots), apply, execution: exec };
      }
      if (input.mode !== "dry_run") {
        if (!hasPhase(exec, "EXPORTING")) exec.phases_completed.push("EXPORTING");
        writeExecution(exec, roots);
        if (
          input.crash_after_phase === "EXPORTING" ||
          input.simulate_hooks?.crash_after_phase === "EXPORTING"
        ) {
          throw new Error("CRASH_INJECTED:EXPORTING");
        }
      }
    }

    // ---- WEBSITE_WRITES_PREPARED ----
    let prepared = await adapters.prepareWebsiteWrites({ execution: exec });
    if (!hasPhase(exec, "WEBSITE_WRITES_PREPARED") || input.mode === "dry_run") {
      if (!prepared.ok) {
        if (input.mode === "dry_run") {
          const apply = applyRecordFromExecution(exec, started_at, false);
          apply.status = "FAILED";
          apply.error = prepared.error;
          return { ok: false, plan, apply, execution: exec };
        }
        failRecoverable(exec, prepared.error ?? "Prepare failed", [
          "Inspect path allowlist",
          "Re-run apply",
        ], roots);
        const apply = applyRecordFromExecution(exec, started_at, true);
        return { ok: false, plan: readPlan(plan.plan_id, roots), apply, execution: exec };
      }
      const tree = await adapters.checkWorkingTree({
        intended_paths: prepared.intended_writes,
      });
      if (!tree.ok && input.mode !== "dry_run") {
        failRecoverable(exec, tree.error ?? "Dirty tree", [
          "Resolve conflicting working tree changes",
          "Re-run apply",
        ], roots);
        const apply = applyRecordFromExecution(exec, started_at, true);
        return { ok: false, plan: readPlan(plan.plan_id, roots), apply, execution: exec };
      }
      exec.generated_files_all = prepared.intended_writes;
      for (const e of exec.entries) markStep(e, "website_prepared");
      if (input.mode !== "dry_run") {
        if (!hasPhase(exec, "WEBSITE_WRITES_PREPARED")) {
          exec.phases_completed.push("WEBSITE_WRITES_PREPARED");
        }
        exec.status = "WEBSITE_WRITES_PREPARED";
        exec.current_phase = "WEBSITE_WRITES_PREPARED";
        writeExecution(exec, roots);
      }
    }

    if (input.mode === "dry_run") {
      // Dry-run stops here — report phases, no writes
      const dryExec = initExecution(plan, "dry_run", input.confirm_phrase);
      dryExec.status = "DRY_RUN";
      dryExec.current_phase = "DRY_RUN";
      dryExec.entries = exec.entries.map((e) => ({
        ...e,
        generated_files:
          e.generated_files.length > 0
            ? e.generated_files
            : expectedGeneratedFilesForCatalogue(e.catalogue_id),
      }));
      dryExec.generated_files_all = prepared.intended_writes;
      dryExec.phases_completed = [
        "PREPARED",
        "EXPORTING",
        "WEBSITE_WRITES_PREPARED",
      ];
      dryExec.recovery_instructions = [
        "DRY_RUN only — zero production writes",
        "To execute: SOS_AIOS_PUBLICATION_APPLY=1 --execute",
        `Entries: ${dryExec.entries.map((e) => `${e.catalogue_id} ${e.title}`).join("; ")}`,
      ];
      const apply = applyRecordFromExecution(dryExec, started_at, false);
      apply.status = "DRY_RUN";
      apply.steps_completed = [
        "confirm_phrase",
        "re_verify",
        "calculate_reservations",
        "calculate_exports",
        "calculate_git_diff",
        "dry_run_no_website_writes",
        "dry_run_no_reservations",
        "dry_run_no_commit",
        "dry_run_no_push",
        "dry_run_no_deploy",
        "dry_run_no_lifecycle",
      ];
      writePlan(
        {
          ...plan,
          status: "VERIFIED",
          updated_at: new Date().toISOString(),
          apply,
        },
        roots,
      );
      return {
        ok: true,
        plan: readPlan(plan.plan_id, roots),
        apply,
        execution: dryExec,
      };
    }

    // ---- WEBSITE_WRITES_APPLIED ----
    if (!hasPhase(exec, "WEBSITE_WRITES_APPLIED")) {
      prepared = await adapters.prepareWebsiteWrites({ execution: exec });
      const applied = await adapters.applyWebsiteWrites({
        execution: exec,
        prepared,
      });
      if (!applied.ok) {
        failRecoverable(
          exec,
          applied.error ?? "Website apply failed",
          applied.rolled_back
            ? [
                "Local files restored from rollback manifest",
                "Fix verification issue",
                "Re-run apply — will not commit",
              ]
            : [
                "Inspect rollback manifest",
                "Re-run apply",
              ],
          roots,
        );
        exec.rollback_manifest_path = applied.rollback_manifest_path;
        writeExecution(exec, roots);
        const apply = applyRecordFromExecution(exec, started_at, true);
        return { ok: false, plan: readPlan(plan.plan_id, roots), apply, execution: exec };
      }
      exec.rollback_manifest_path = applied.rollback_manifest_path;
      exec.generated_files_all = applied.applied_paths;
      for (const e of exec.entries) markStep(e, "website_applied");
      exec.phases_completed.push("WEBSITE_WRITES_APPLIED");
      exec.status = "WEBSITE_WRITES_APPLIED";
      exec.current_phase = "WEBSITE_WRITES_APPLIED";
      writeExecution(exec, roots);
      if (
        input.crash_after_phase === "WEBSITE_WRITES_APPLIED" ||
        input.simulate_hooks?.crash_after_phase === "WEBSITE_WRITES_APPLIED"
      ) {
        throw new Error("CRASH_INJECTED:WEBSITE_WRITES_APPLIED");
      }
    }

    // ---- COMMITTED ----
    if (!hasPhase(exec, "COMMITTED")) {
      const commit = await adapters.commit({
        execution: exec,
        paths: exec.generated_files_all,
      });
      if (!commit.ok) {
        failRecoverable(exec, commit.error ?? "Commit failed", [
          "Before push: local writes may be rolled back if needed",
          "Re-run apply — will not duplicate matching commit",
        ], roots);
        const apply = applyRecordFromExecution(exec, started_at, true);
        return { ok: false, plan: readPlan(plan.plan_id, roots), apply, execution: exec };
      }
      exec.git_commit_sha = commit.commit_sha;
      exec.phases_completed.push("COMMITTED");
      exec.status = "COMMITTED";
      exec.current_phase = "COMMITTED";
      writeExecution(exec, roots);
      if (
        input.crash_after_phase === "COMMITTED" ||
        input.simulate_hooks?.crash_after_phase === "COMMITTED"
      ) {
        throw new Error("CRASH_INJECTED:COMMITTED");
      }
    }

    // ---- PUSHED ----
    if (!hasPhase(exec, "PUSHED")) {
      const push = await adapters.push({ execution: exec });
      if (!push.ok) {
        failRecoverable(exec, push.error ?? "Push failed", [
          "Commit retained — do not create another commit",
          "Re-run apply to resume push",
        ], roots);
        const apply = applyRecordFromExecution(exec, started_at, true);
        return { ok: false, plan: readPlan(plan.plan_id, roots), apply, execution: exec };
      }
      exec.git_pushed = true;
      exec.push_remote = push.remote;
      exec.git_branch = push.branch;
      exec.phases_completed.push("PUSHED");
      exec.status = "PUSHED";
      exec.current_phase = "PUSHED";
      writeExecution(exec, roots);
    }

    // ---- DEPLOYMENT_VERIFIED ----
    if (!hasPhase(exec, "DEPLOYMENT_VERIFIED")) {
      const dep = await adapters.verifyDeployment({ execution: exec });
      if (!dep.ok) {
        failRecoverable(exec, dep.error ?? "Deployment verification failed", [
          "Do not rewrite git history",
          "Resume deployment verification on re-run",
          "Do not mark PUBLISHED yet",
        ], roots);
        exec.live_urls = dep.live_urls;
        for (const e of exec.entries) {
          const pe = dep.per_entry[e.catalogue_id];
          if (pe?.ok) {
            e.live_url = pe.url;
            markStep(e, "live_verified");
          }
        }
        writeExecution(exec, roots);
        const apply = applyRecordFromExecution(exec, started_at, true);
        return { ok: false, plan: readPlan(plan.plan_id, roots), apply, execution: exec };
      }
      exec.deployment_id = dep.deployment_id;
      exec.deployment_verified = true;
      exec.live_urls = dep.live_urls;
      for (const e of exec.entries) {
        e.live_url = dep.live_urls[e.catalogue_id] ?? null;
        markStep(e, "live_verified");
      }
      exec.phases_completed.push("DEPLOYMENT_VERIFIED");
      exec.status = "DEPLOYMENT_VERIFIED";
      exec.current_phase = "DEPLOYMENT_VERIFIED";
      writeExecution(exec, roots);
    }

    // ---- LIFECYCLE_RECONCILED (only after live verify) ----
    if (!hasPhase(exec, "LIFECYCLE_RECONCILED")) {
      const life = await adapters.updateLifecycle({ execution: exec });
      for (const e of exec.entries) {
        const pe = life.per_entry[e.catalogue_id];
        if (pe?.ok) {
          markStep(e, "lifecycle_published");
          e.lifecycle_status = "PUBLISHED";
          e.error = null;
        } else if (pe) {
          e.error = pe.error;
        }
      }
      if (!life.ok) {
        failRecoverable(exec, life.error ?? "Lifecycle partial failure", [
          "Do not republish website",
          "Re-run apply to finish lifecycle reconciliation idempotently",
          "Release history written once per catalogue+execution",
        ], roots);
        const apply = applyRecordFromExecution(exec, started_at, true);
        return { ok: false, plan: readPlan(plan.plan_id, roots), apply, execution: exec };
      }
      exec.lifecycle_reconciled = true;
      exec.phases_completed.push("LIFECYCLE_RECONCILED");
      exec.status = "LIFECYCLE_RECONCILED";
      exec.current_phase = "LIFECYCLE_RECONCILED";
      writeExecution(exec, roots);
    }

    // ---- COMPLETED ----
    if (!hasPhase(exec, "COMPLETED")) {
      const unfinished = exec.entries.filter(
        (e) => !e.completed_steps.includes("lifecycle_published"),
      );
      if (unfinished.length) {
        failRecoverable(
          exec,
          `Lifecycle incomplete: ${unfinished.map((u) => u.catalogue_id).join(", ")}`,
          ["Re-run apply for reconciliation only"],
          roots,
        );
        const apply = applyRecordFromExecution(exec, started_at, true);
        return { ok: false, plan: readPlan(plan.plan_id, roots), apply, execution: exec };
      }
      exec.phases_completed.push("COMPLETED");
      exec.status = "COMPLETED";
      exec.current_phase = "COMPLETED";
      exec.error = null;
      exec.recovery_instructions = [];
      writeExecution(exec, roots);
    }

    const apply = applyRecordFromExecution(exec, started_at, true);
    writePlan(
      {
        ...readPlan(plan.plan_id, roots)!,
        status: "COMPLETED",
        updated_at: new Date().toISOString(),
        apply,
      },
      roots,
    );
    releasePublicationLock(plan.plan_id, exec.execution_id, roots);
    return {
      ok: true,
      plan: readPlan(plan.plan_id, roots),
      apply,
      execution: exec,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.startsWith("CRASH_INJECTED:")) {
      // Leave journal as-is for resume tests
      const apply = applyRecordFromExecution(exec, started_at, true);
      apply.status = "FAILED";
      apply.error = msg;
      apply.recovery_instructions = [
        "Crash injected for test — re-run apply to resume",
      ];
      return { ok: false, plan: readPlan(plan.plan_id, roots), apply, execution: exec };
    }
    failRecoverable(exec, msg, ["Inspect journal", "Re-run apply to resume"], roots);
    const apply = applyRecordFromExecution(exec, started_at, true);
    return { ok: false, plan: readPlan(plan.plan_id, roots), apply, execution: exec };
  } finally {
    if (input.mode !== "dry_run" && exec.status !== "COMPLETED") {
      touchPublicationLock(plan.plan_id, exec.execution_id, roots);
    }
  }
}

export function getExecutionStatusProjection(
  planId: string,
  roots: PublicationRoots = defaultPublicationRoots(),
): {
  plan_id: string;
  execution: PublicationExecution | null;
  next_retry_action: string | null;
} {
  const exec = findExecutionForPlan(planId, roots);
  if (!exec) {
    return { plan_id: planId, execution: null, next_retry_action: null };
  }
  let next: string | null = null;
  if (exec.status === "COMPLETED") {
    next = "no-op — already completed";
  } else if (exec.status === "FAILED_RECOVERABLE" || exec.status === "FAILED_TERMINAL") {
    const last = exec.phases_completed[exec.phases_completed.length - 1];
    const idx = last ? PHASE_ORDER.indexOf(last) : -1;
    const nxt = idx >= 0 ? PHASE_ORDER[idx + 1] : "PREPARED";
    next = `Re-run aios:publication:apply --plan-id=${planId} --confirm=PUBLISH_PLAN_${planId} --execute (resume from ${nxt})`;
  } else {
    next = `Resume from ${exec.current_phase}`;
  }
  return { plan_id: planId, execution: exec, next_retry_action: next };
}

export { readExecution, findExecutionForPlan };
