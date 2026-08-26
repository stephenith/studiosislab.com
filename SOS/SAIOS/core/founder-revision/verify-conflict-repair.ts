/**
 * Deterministic ConflictPlanRepair verifier.
 * No OpenAI. No production task/evidence mutation.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  buildPrimaryConflictReport,
  operationInConflictScope,
  operationPreservationFingerprint,
  validateFrozenOperationPreservation,
} from "./ConflictPlanRepair.js";
import { detectInternalPlanMutationConflicts } from "./PlanMutationConflicts.js";
import {
  planFounderCanvasRevision,
  restoreMissingConfidenceFromPrimary,
} from "./RevisionPlanner.js";
import {
  buildRevisionConflictRepairPrompt,
  buildRevisionPlannerPrompt,
  validateRevisionPlanShapeAndOperations,
} from "./RevisionPromptBuilder.js";
import { CANONICAL_COLLISION_BOUNDS_QA } from "./RequestedChangeClassification.js";
import type { ReasoningRequest } from "../ai-brain/ReasoningRequest.js";
import type {
  CanvasInventoryObject,
  CanvasOperation,
  RevisionPlan,
  RevisionTask,
} from "./revision-task-types.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/founder-revision/verify-conflict-repair.json",
);

type Check = { name: string; pass: boolean; detail: string };

function assert(cond: boolean, name: string, detail: string): Check {
  return { name, pass: cond, detail };
}

const FB_A =
  "Rebalance the left sidebar so Skills, Projects, Certifications, and Languages stack cleanly without large empty gaps.";
const FB_B =
  "Improve the overall visual balance between the left and right columns after repositioning.";
const FB_C = "Tighten Experience entry spacing.";
const FB_VERIFY = CANONICAL_COLLISION_BOUNDS_QA;

function isConflictRepairReq(req: ReasoningRequest): boolean {
  return String(req.request_id).includes("conflict-repair");
}

function isCoverageRepairReq(req: ReasoningRequest): boolean {
  const id = String(req.request_id);
  return id.includes("revplan-repair") && !id.includes("conflict");
}

function baseOp(
  partial: Partial<CanvasOperation> &
    Pick<CanvasOperation, "op" | "founder_feedback_item" | "values">,
): CanvasOperation {
  return {
    before_summary: "prior object state",
    intended_change: "apply mutation",
    confidence: 0.9,
    target_id: partial.target_id ?? "block-skills-4-r0",
    ...partial,
  };
}

function plan(ops: CanvasOperation[]): RevisionPlan {
  return {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: "fixture",
    notes: [],
    operations: ops,
  };
}

function fixtureTask(changes: string[]): RevisionTask {
  return {
    schema_version: "founder-revision-task-1.0.0",
    task_id: "revtask-verify-conflict-repair",
    decision_id: "fd-verify-conflict-repair",
    review_id: "rev-verify-conflict-repair",
    prior_candidate_id: "cand-x",
    prior_canvas_path: "canvas.json",
    founder_reason: "conflict repair verify",
    requested_changes: changes,
    role: "Operations Analyst",
    design_family: null,
    status: "PENDING",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    revised_candidate_id: null,
    revised_review_id: null,
    revision_number: 1,
    error: null,
    openai_execution_path: null,
    publication_allowed: false,
    live: false,
  };
}

function inventory(): CanvasInventoryObject[] {
  const mk = (
    id: string,
    section: string,
    top: number,
    left = 48,
  ): CanvasInventoryObject => ({
    id,
    index: 0,
    type: "Rect",
    text: null,
    left,
    top,
    width: 140,
    height: 22,
    fill: "#1e3a8a",
    stroke: null,
    fontSize: null,
    fontFamily: null,
    fontWeight: null,
    lineHeight: null,
    role: "section-heading",
    section,
    locked: false,
    system: false,
    group_id: null,
  });
  return [
    mk("block-skills-4-r0", "skills", 154),
    mk("block-skills-4-t1", "skills", 154, 60),
    mk("block-header-0-t0", "header", 48, 64),
    mk("block-experience-2-t3", "experience", 300, 200),
  ];
}

function makeExecute(
  handlers: Array<
    | Record<string, unknown>
    | "fail"
    | "incomplete"
    | ((req: ReasoningRequest, call: number) => Record<string, unknown> | "fail" | "incomplete")
  >,
) {
  let calls = 0;
  const requests: ReasoningRequest[] = [];
  const execute = async (req: ReasoningRequest) => {
    calls += 1;
    requests.push(req);
    const next = handlers[calls - 1];
    if (next === undefined) {
      throw new Error(`unexpected planner call #${calls}`);
    }
    const resolved = typeof next === "function" ? next(req, calls) : next;
    if (resolved === "fail") {
      return {
        status: "FAILED",
        structured_output: null,
        error_details: { message: "injected provider failure" },
      };
    }
    if (resolved === "incomplete") {
      return {
        status: "COMPLETED",
        structured_output: {
          summary: "truncated",
          notes: ["revision_planning_incomplete_json"],
          operations: [],
        },
        provider_request_id: `req-incomplete-${calls}`,
        input_tokens: 1,
        output_tokens: 1,
      };
    }
    return {
      status: "COMPLETED",
      structured_output: resolved,
      provider_request_id: `req-test-${calls}`,
      model_identifier_internal: "test-model",
      input_tokens: 100,
      output_tokens: 50,
    };
  };
  return {
    execute,
    getCalls: () => calls,
    getRequests: () => requests,
    getConflictCalls: () => requests.filter(isConflictRepairReq).length,
    getCoverageCalls: () => requests.filter(isCoverageRepairReq).length,
  };
}

const frozenHeader = () =>
  baseOp({
    op: "set_position",
    target_id: "block-header-0-t0",
    values: { left: 64, top: 48 },
    founder_feedback_item: FB_C,
    intended_change: "keep header contact aligned",
    before_summary: "header contact line prior",
  });

async function main(): Promise<void> {
  const checks: Check[] = [];
  let liveOpenAI = 0;

  // --- Unit: scope is target+axis, not whole target ---
  const scopeReport = buildPrimaryConflictReport([
    baseOp({
      op: "set_position",
      target_id: "block-x",
      values: { top: 180 },
      founder_feedback_item: FB_A,
    }),
    baseOp({
      op: "move_object",
      target_id: "block-x",
      values: { delta_top: 50 },
      founder_feedback_item: FB_B,
    }),
    baseOp({
      op: "set_position",
      target_id: "block-x",
      values: { left: 40 },
      founder_feedback_item: FB_C,
    }),
  ]);
  checks.push(
    assert(
      scopeReport.conflict_scope_keys.includes("block-x::top") &&
        !scopeReport.conflict_scope_keys.includes("block-x::left") &&
        scopeReport.frozen_operation_indices.includes(2) &&
        !scopeReport.conflict_scope_operation_indices.includes(2),
      "unit_narrow_scope_top_not_left",
      JSON.stringify(scopeReport.conflict_scope_keys),
    ),
  );

  const multiAxisOp = baseOp({
    op: "set_position",
    target_id: "block-x",
    values: { left: 10, top: 20 },
    founder_feedback_item: FB_A,
  });
  checks.push(
    assert(
      operationInConflictScope(multiAxisOp, ["block-x::top"]) === true,
      "unit_multi_axis_wholly_in_scope",
      "ok",
    ),
  );

  // A — set_position top + move_object delta_top → one conflict repair call
  {
    const ex = makeExecute([
      plan([
        baseOp({
          op: "set_position",
          values: { top: 180 },
          founder_feedback_item: FB_A,
        }),
        baseOp({
          op: "move_object",
          values: { delta_top: 50 },
          founder_feedback_item: FB_B,
        }),
        frozenHeader(),
      ]) as unknown as Record<string, unknown>,
      plan([
        baseOp({
          op: "set_position",
          values: { top: 200 },
          founder_feedback_item: FB_A,
          founder_feedback_items: [FB_B],
          intended_change: "coherent sidebar top",
        }),
        frozenHeader(),
      ]) as unknown as Record<string, unknown>,
    ]);
    const result = await planFounderCanvasRevision({
      task: fixtureTask([FB_A, FB_B, FB_C]),
      inventory: inventory(),
      page_width: 794,
      page_height: 1123,
      execute: ex.execute,
    });
    checks.push(
      assert(
        result.ok === true &&
          ex.getCalls() === 2 &&
          ex.getConflictCalls() === 1 &&
          ex.getCoverageCalls() === 0 &&
          result.conflict_repair?.summary.accepted === true &&
          result.coverage_repair == null,
        "A_set_top_plus_delta_top_one_conflict_repair",
        JSON.stringify({
          ok: result.ok,
          calls: ex.getCalls(),
          conflict: ex.getConflictCalls(),
          coverage: ex.getCoverageCalls(),
          err: !result.ok ? result.error : null,
        }),
      ),
    );
  }

  // B — two absolute tops → conflict repair
  {
    const ex = makeExecute([
      plan([
        baseOp({
          op: "set_position",
          values: { top: 180 },
          founder_feedback_item: FB_A,
        }),
        baseOp({
          op: "set_position",
          values: { top: 220 },
          founder_feedback_item: FB_B,
        }),
        frozenHeader(),
      ]) as unknown as Record<string, unknown>,
      plan([
        baseOp({
          op: "set_position",
          values: { top: 200 },
          founder_feedback_item: FB_A,
          founder_feedback_items: [FB_B],
        }),
        frozenHeader(),
      ]) as unknown as Record<string, unknown>,
    ]);
    const result = await planFounderCanvasRevision({
      task: fixtureTask([FB_A, FB_B, FB_C]),
      inventory: inventory(),
      page_width: 794,
      page_height: 1123,
      execute: ex.execute,
    });
    checks.push(
      assert(
        result.ok === true &&
          ex.getConflictCalls() === 1 &&
          ex.getCoverageCalls() === 0,
        "B_two_absolute_tops_conflict_repair",
        JSON.stringify({ ok: result.ok, conflict: ex.getConflictCalls() }),
      ),
    );
  }

  // C — left-only + top-only → NO conflict repair
  {
    const ex = makeExecute([
      plan([
        baseOp({
          op: "set_position",
          values: { left: 40 },
          founder_feedback_item: FB_A,
        }),
        baseOp({
          op: "set_position",
          values: { top: 180 },
          founder_feedback_item: FB_B,
        }),
        frozenHeader(),
      ]) as unknown as Record<string, unknown>,
    ]);
    const result = await planFounderCanvasRevision({
      task: fixtureTask([FB_A, FB_B, FB_C]),
      inventory: inventory(),
      page_width: 794,
      page_height: 1123,
      execute: ex.execute,
    });
    checks.push(
      assert(
        result.ok === true &&
          ex.getCalls() === 1 &&
          ex.getConflictCalls() === 0 &&
          detectInternalPlanMutationConflicts([
            baseOp({
              op: "set_position",
              values: { left: 40 },
              founder_feedback_item: FB_A,
            }),
            baseOp({
              op: "set_position",
              values: { top: 180 },
              founder_feedback_item: FB_B,
            }),
          ]).ok === true,
        "C_left_plus_top_no_conflict_repair",
        JSON.stringify({
          ok: result.ok,
          calls: ex.getCalls(),
          conflict: ex.getConflictCalls(),
        }),
      ),
    );
  }

  // D covered by A (multi-attribution pass)

  // E — repair still conflicts → FAILED_PLAN, exactly 2 calls
  {
    const ex = makeExecute([
      plan([
        baseOp({
          op: "set_position",
          values: { top: 180 },
          founder_feedback_item: FB_A,
        }),
        baseOp({
          op: "move_object",
          values: { delta_top: 50 },
          founder_feedback_item: FB_B,
        }),
        frozenHeader(),
      ]) as unknown as Record<string, unknown>,
      plan([
        baseOp({
          op: "set_position",
          values: { top: 180 },
          founder_feedback_item: FB_A,
        }),
        baseOp({
          op: "set_position",
          values: { top: 220 },
          founder_feedback_item: FB_B,
        }),
        frozenHeader(),
      ]) as unknown as Record<string, unknown>,
      // third would throw if called
      plan([frozenHeader()]) as unknown as Record<string, unknown>,
    ]);
    const result = await planFounderCanvasRevision({
      task: fixtureTask([FB_A, FB_B, FB_C]),
      inventory: inventory(),
      page_width: 794,
      page_height: 1123,
      execute: ex.execute,
    });
    checks.push(
      assert(
        result.ok === false &&
          result.status === "FAILED_PLAN" &&
          ex.getCalls() === 2 &&
          ex.getConflictCalls() === 1 &&
          ex.getCoverageCalls() === 0 &&
          String(result.error ?? "").includes("still conflicts"),
        "E_repair_still_conflicts_fail_closed_max_2",
        JSON.stringify({
          ok: result.ok,
          status: !result.ok ? result.status : null,
          calls: ex.getCalls(),
          err: !result.ok ? result.error : null,
        }),
      ),
    );
  }

  // F — unknown Founder attribution
  {
    const ex = makeExecute([
      plan([
        baseOp({
          op: "set_position",
          values: { top: 180 },
          founder_feedback_item: FB_A,
        }),
        baseOp({
          op: "move_object",
          values: { delta_top: 50 },
          founder_feedback_item: FB_B,
        }),
        frozenHeader(),
      ]) as unknown as Record<string, unknown>,
      plan([
        baseOp({
          op: "set_position",
          values: { top: 200 },
          founder_feedback_item: "Not a real Founder request line.",
          founder_feedback_items: [FB_A, FB_B],
        }),
        frozenHeader(),
      ]) as unknown as Record<string, unknown>,
    ]);
    const result = await planFounderCanvasRevision({
      task: fixtureTask([FB_A, FB_B, FB_C]),
      inventory: inventory(),
      page_width: 794,
      page_height: 1123,
      execute: ex.execute,
    });
    checks.push(
      assert(
        result.ok === false &&
          result.status === "FAILED_PLAN" &&
          ex.getCalls() === 2 &&
          ex.getCoverageCalls() === 0,
        "F_unknown_attribution_fail_closed",
        JSON.stringify({ ok: result.ok, err: !result.ok ? result.error : null }),
      ),
    );
  }

  // G — VERIFICATION_ACCEPTANCE attribution
  {
    const ex = makeExecute([
      plan([
        baseOp({
          op: "set_position",
          values: { top: 180 },
          founder_feedback_item: FB_A,
        }),
        baseOp({
          op: "move_object",
          values: { delta_top: 50 },
          founder_feedback_item: FB_B,
        }),
        frozenHeader(),
      ]) as unknown as Record<string, unknown>,
      plan([
        baseOp({
          op: "set_position",
          values: { top: 200 },
          founder_feedback_item: FB_VERIFY,
          founder_feedback_items: [FB_A, FB_B],
        }),
        frozenHeader(),
      ]) as unknown as Record<string, unknown>,
    ]);
    const result = await planFounderCanvasRevision({
      task: fixtureTask([FB_A, FB_B, FB_C, FB_VERIFY]),
      inventory: inventory(),
      page_width: 794,
      page_height: 1123,
      execute: ex.execute,
    });
    checks.push(
      assert(
        result.ok === false &&
          result.status === "FAILED_PLAN" &&
          ex.getCoverageCalls() === 0 &&
          String(result.error ?? "")
            .toLowerCase()
            .includes("verification_acceptance"),
        "G_verification_acceptance_fail_closed",
        JSON.stringify({ ok: result.ok, err: !result.ok ? result.error : null }),
      ),
    );
  }

  // H — drops MUTATION coverage → no CoveragePlanRepair, calls=2
  {
    const ex = makeExecute([
      plan([
        baseOp({
          op: "set_position",
          values: { top: 180 },
          founder_feedback_item: FB_A,
        }),
        baseOp({
          op: "move_object",
          values: { delta_top: 50 },
          founder_feedback_item: FB_B,
        }),
        frozenHeader(),
      ]) as unknown as Record<string, unknown>,
      // Covers FB_A + FB_C only — drops FB_B
      plan([
        baseOp({
          op: "set_position",
          values: { top: 200 },
          founder_feedback_item: FB_A,
        }),
        frozenHeader(),
      ]) as unknown as Record<string, unknown>,
      plan([
        baseOp({
          op: "set_position",
          target_id: "block-experience-2-t3",
          values: { top: 310 },
          founder_feedback_item: FB_B,
        }),
      ]) as unknown as Record<string, unknown>,
    ]);
    const result = await planFounderCanvasRevision({
      task: fixtureTask([FB_A, FB_B, FB_C]),
      inventory: inventory(),
      page_width: 794,
      page_height: 1123,
      execute: ex.execute,
    });
    checks.push(
      assert(
        result.ok === false &&
          result.status === "FAILED_PLAN" &&
          ex.getCalls() === 2 &&
          ex.getConflictCalls() === 1 &&
          ex.getCoverageCalls() === 0 &&
          result.conflict_repair?.summary.failure_kind === "incomplete_coverage",
        "H_dropped_coverage_no_coverage_repair",
        JSON.stringify({
          ok: result.ok,
          calls: ex.getCalls(),
          coverage: ex.getCoverageCalls(),
          kind: result.ok
            ? null
            : result.conflict_repair?.summary.failure_kind,
          err: !result.ok ? result.error : null,
        }),
      ),
    );
  }

  // I — provider failure / incomplete JSON
  {
    const exFail = makeExecute([
      plan([
        baseOp({
          op: "set_position",
          values: { top: 180 },
          founder_feedback_item: FB_A,
        }),
        baseOp({
          op: "move_object",
          values: { delta_top: 50 },
          founder_feedback_item: FB_B,
        }),
        frozenHeader(),
      ]) as unknown as Record<string, unknown>,
      "fail",
    ]);
    const failResult = await planFounderCanvasRevision({
      task: fixtureTask([FB_A, FB_B, FB_C]),
      inventory: inventory(),
      page_width: 794,
      page_height: 1123,
      execute: exFail.execute,
    });
    checks.push(
      assert(
        failResult.ok === false &&
          failResult.status === "FAILED_PROVIDER" &&
          exFail.getCalls() === 2 &&
          exFail.getConflictCalls() === 1,
        "I_provider_fail_one_conflict_attempt",
        JSON.stringify({
          ok: failResult.ok,
          status: !failResult.ok ? failResult.status : null,
          calls: exFail.getCalls(),
        }),
      ),
    );

    const exInc = makeExecute([
      plan([
        baseOp({
          op: "set_position",
          values: { top: 180 },
          founder_feedback_item: FB_A,
        }),
        baseOp({
          op: "move_object",
          values: { delta_top: 50 },
          founder_feedback_item: FB_B,
        }),
        frozenHeader(),
      ]) as unknown as Record<string, unknown>,
      "incomplete",
    ]);
    const incResult = await planFounderCanvasRevision({
      task: fixtureTask([FB_A, FB_B, FB_C]),
      inventory: inventory(),
      page_width: 794,
      page_height: 1123,
      execute: exInc.execute,
    });
    checks.push(
      assert(
        incResult.ok === false &&
          incResult.status === "FAILED_PROVIDER" &&
          exInc.getCalls() === 2 &&
          exInc.getConflictCalls() === 1,
        "I_incomplete_json_one_conflict_attempt",
        JSON.stringify({
          ok: incResult.ok,
          status: !incResult.ok ? incResult.status : null,
        }),
      ),
    );
  }

  // J/K/L/M — frozen preservation failures
  const conflictingPrimary = plan([
    baseOp({
      op: "set_position",
      values: { top: 180 },
      founder_feedback_item: FB_A,
    }),
    baseOp({
      op: "move_object",
      values: { delta_top: 50 },
      founder_feedback_item: FB_B,
    }),
    frozenHeader(),
  ]);

  async function preservationCase(
    name: string,
    repaired: RevisionPlan,
  ): Promise<void> {
    const ex = makeExecute([
      conflictingPrimary as unknown as Record<string, unknown>,
      repaired as unknown as Record<string, unknown>,
    ]);
    const result = await planFounderCanvasRevision({
      task: fixtureTask([FB_A, FB_B, FB_C]),
      inventory: inventory(),
      page_width: 794,
      page_height: 1123,
      execute: ex.execute,
    });
    checks.push(
      assert(
        result.ok === false &&
          result.conflict_repair?.summary.failure_kind ===
            "preservation_failed" &&
          ex.getCoverageCalls() === 0,
        name,
        JSON.stringify({
          ok: result.ok,
          kind: result.ok
            ? null
            : result.conflict_repair?.summary.failure_kind,
          err: !result.ok ? result.error : null,
        }),
      ),
    );
  }

  await preservationCase(
    "J_frozen_removed_fail",
    plan([
      baseOp({
        op: "set_position",
        values: { top: 200 },
        founder_feedback_item: FB_A,
        founder_feedback_items: [FB_B],
      }),
      // frozenHeader removed; FB_C uncovered too but preservation fails first
    ]),
  );

  await preservationCase(
    "K_frozen_values_changed_fail",
    plan([
      baseOp({
        op: "set_position",
        values: { top: 200 },
        founder_feedback_item: FB_A,
        founder_feedback_items: [FB_B],
      }),
      baseOp({
        ...frozenHeader(),
        values: { left: 99, top: 48 },
      }),
    ]),
  );

  await preservationCase(
    "L_frozen_attribution_changed_fail",
    plan([
      baseOp({
        op: "set_position",
        values: { top: 200 },
        founder_feedback_item: FB_A,
        founder_feedback_items: [FB_B],
      }),
      baseOp({
        ...frozenHeader(),
        founder_feedback_item: FB_A,
      }),
    ]),
  );

  await preservationCase(
    "M_frozen_intended_change_fail",
    plan([
      baseOp({
        op: "set_position",
        values: { top: 200 },
        founder_feedback_item: FB_A,
        founder_feedback_items: [FB_B],
      }),
      baseOp({
        ...frozenHeader(),
        intended_change: "changed intent text",
      }),
    ]),
  );

  // N — independent left op is frozen; repair must not alter it
  {
    const leftOp = baseOp({
      op: "set_position",
      target_id: "block-skills-4-r0",
      values: { left: 40 },
      founder_feedback_item: FB_C,
      intended_change: "nudge skills marker left",
      before_summary: "skills marker left prior",
    });
    const primary = plan([
      baseOp({
        op: "set_position",
        target_id: "block-skills-4-r0",
        values: { top: 180 },
        founder_feedback_item: FB_A,
      }),
      baseOp({
        op: "move_object",
        target_id: "block-skills-4-r0",
        values: { delta_top: 50 },
        founder_feedback_item: FB_B,
      }),
      leftOp,
    ]);
    const report = buildPrimaryConflictReport(primary.operations);
    checks.push(
      assert(
        report.conflict_scope_keys.includes("block-skills-4-r0::top") &&
          !report.conflict_scope_keys.includes("block-skills-4-r0::left") &&
          report.frozen_operation_indices.includes(2),
        "N_unit_left_frozen_when_top_conflicts",
        JSON.stringify(report),
      ),
    );
    const ex = makeExecute([
      primary as unknown as Record<string, unknown>,
      plan([
        baseOp({
          op: "set_position",
          target_id: "block-skills-4-r0",
          values: { top: 200 },
          founder_feedback_item: FB_A,
          founder_feedback_items: [FB_B],
        }),
        // left changed → preservation fail
        baseOp({
          ...leftOp,
          values: { left: 99 },
        }),
      ]) as unknown as Record<string, unknown>,
    ]);
    const result = await planFounderCanvasRevision({
      task: fixtureTask([FB_A, FB_B, FB_C]),
      inventory: inventory(),
      page_width: 794,
      page_height: 1123,
      execute: ex.execute,
    });
    checks.push(
      assert(
        result.ok === false &&
          result.conflict_repair?.summary.failure_kind ===
            "preservation_failed",
        "N_repair_alters_independent_left_fail",
        JSON.stringify({
          ok: result.ok,
          kind: result.ok
            ? null
            : result.conflict_repair?.summary.failure_kind,
        }),
      ),
    );
  }

  // O — multi-axis op wholly repair-scope (unit already); planner success when rewritten
  {
    const primary = plan([
      baseOp({
        op: "set_position",
        target_id: "block-skills-4-r0",
        values: { left: 40, top: 180 },
        founder_feedback_item: FB_A,
      }),
      baseOp({
        op: "move_object",
        target_id: "block-skills-4-r0",
        values: { delta_top: 50 },
        founder_feedback_item: FB_B,
      }),
      frozenHeader(),
    ]);
    const report = buildPrimaryConflictReport(primary.operations);
    checks.push(
      assert(
        report.conflict_scope_operation_indices.includes(0) &&
          operationInConflictScope(primary.operations[0]!, report.conflict_scope_keys),
        "O_multi_axis_op_is_conflict_scope",
        JSON.stringify(report.conflict_scope_operation_indices),
      ),
    );
  }

  // P — coverage-only primary (no conflict) → CoveragePlanRepair, not ConflictPlanRepair
  {
    const ex = makeExecute([
      plan([
        baseOp({
          op: "set_position",
          values: { top: 180 },
          founder_feedback_item: FB_A,
        }),
        frozenHeader(),
      ]) as unknown as Record<string, unknown>,
      plan([
        baseOp({
          op: "set_position",
          target_id: "block-experience-2-t3",
          values: { top: 320 },
          founder_feedback_item: FB_B,
          before_summary: "experience prior",
          intended_change: "tighten experience",
        }),
      ]) as unknown as Record<string, unknown>,
    ]);
    const result = await planFounderCanvasRevision({
      task: fixtureTask([FB_A, FB_B, FB_C]),
      inventory: inventory(),
      page_width: 794,
      page_height: 1123,
      execute: ex.execute,
    });
    checks.push(
      assert(
        result.ok === true &&
          ex.getCalls() === 2 &&
          ex.getConflictCalls() === 0 &&
          ex.getCoverageCalls() === 1 &&
          result.coverage_repair?.summary.attempted === true &&
          result.conflict_repair == null,
        "P_coverage_branch_no_conflict_repair",
        JSON.stringify({
          ok: result.ok,
          calls: ex.getCalls(),
          conflict: ex.getConflictCalls(),
          coverage: ex.getCoverageCalls(),
          err: !result.ok ? result.error : null,
        }),
      ),
    );
  }

  // Q — complete conflict-free → exactly one provider call
  {
    const ex = makeExecute([
      plan([
        baseOp({
          op: "set_position",
          values: { top: 180 },
          founder_feedback_item: FB_A,
          founder_feedback_items: [FB_B],
        }),
        frozenHeader(),
      ]) as unknown as Record<string, unknown>,
    ]);
    const result = await planFounderCanvasRevision({
      task: fixtureTask([FB_A, FB_B, FB_C]),
      inventory: inventory(),
      page_width: 794,
      page_height: 1123,
      execute: ex.execute,
    });
    checks.push(
      assert(
        result.ok === true &&
          ex.getCalls() === 1 &&
          ex.getConflictCalls() === 0 &&
          ex.getCoverageCalls() === 0,
        "Q_complete_conflict_free_one_call",
        JSON.stringify({ ok: result.ok, calls: ex.getCalls() }),
      ),
    );
  }

  // R — conflict repair success → CoveragePlanRepair NOT called (covered by A)
  checks.push(
    assert(
      checks.some((c) => c.name === "A_set_top_plus_delta_top_one_conflict_repair" && c.pass),
      "R_conflict_success_no_coverage_repair",
      "depends on A",
    ),
  );

  // --- Confidence preservation (conflict-repair path) ---
  {
    const primary = plan([
      baseOp({
        op: "set_position",
        values: { top: 180 },
        founder_feedback_item: FB_A,
        confidence: 0.95,
      }),
    ]);
    const repairedRaw = {
      schema_version: "founder-canvas-revision-plan-1.0.0",
      summary: "repaired",
      notes: [] as string[],
      operations: [
        {
          op: "set_position",
          target_id: "block-skills-4-r0",
          values: { top: 200 },
          founder_feedback_item: FB_A,
          before_summary: "prior object state",
          intended_change: "apply mutation",
        },
      ],
    };
    const restored = restoreMissingConfidenceFromPrimary(primary, repairedRaw) as {
      operations: Array<{ confidence?: number }>;
    };
    const shape = validateRevisionPlanShapeAndOperations(restored, {
      requested_changes: [FB_A],
    });
    checks.push(
      assert(
        shape.ok === true &&
          restored.operations[0]?.confidence === 0.95,
        "MISSING_CONFIDENCE_SAFE_BACKFILL",
        JSON.stringify({
          shapeOk: shape.ok,
          confidence: restored.operations[0]?.confidence,
          errors: shape.errors,
        }),
      ),
    );
  }

  {
    const primary = plan([
      baseOp({
        op: "set_position",
        target_id: "block-skills-4-r0",
        values: { top: 180 },
        founder_feedback_item: FB_A,
        confidence: 0.95,
      }),
    ]);
    const repairedRaw = {
      schema_version: "founder-canvas-revision-plan-1.0.0",
      summary: "repaired",
      notes: [] as string[],
      operations: [
        {
          op: "set_position",
          target_id: "block-experience-2-t3",
          values: { top: 200 },
          founder_feedback_item: FB_A,
          before_summary: "prior object state",
          intended_change: "apply mutation",
        },
      ],
    };
    const restored = restoreMissingConfidenceFromPrimary(primary, repairedRaw) as {
      operations: Array<{ confidence?: number }>;
    };
    const shape = validateRevisionPlanShapeAndOperations(restored, {
      requested_changes: [FB_A],
    });
    checks.push(
      assert(
        restored.operations[0]?.confidence === undefined &&
          shape.ok === false &&
          (shape.errors ?? []).some((e) => e.includes("confidence required")),
        "MISSING_CONFIDENCE_WRONG_IDENTITY_REJECT",
        JSON.stringify({
          confidence: restored.operations[0]?.confidence,
          shapeOk: shape.ok,
          errors: shape.errors,
        }),
      ),
    );
  }

  {
    const primary = plan([
      baseOp({
        op: "set_position",
        values: { top: 180 },
        founder_feedback_item: FB_A,
        confidence: 0.95,
      }),
    ]);
    const repairedRaw = {
      schema_version: "founder-canvas-revision-plan-1.0.0",
      summary: "repaired",
      notes: [] as string[],
      operations: [
        {
          op: "set_position",
          target_id: "block-skills-4-r0",
          values: { top: 200 },
          founder_feedback_item: FB_A,
          before_summary: "prior object state",
          intended_change: "apply mutation",
          confidence: 0.88,
        },
      ],
    };
    const restored = restoreMissingConfidenceFromPrimary(primary, repairedRaw) as {
      operations: Array<{ confidence?: number }>;
    };
    checks.push(
      assert(
        restored.operations[0]?.confidence === 0.88,
        "EXISTING_CONFIDENCE_PRESERVED",
        String(restored.operations[0]?.confidence),
      ),
    );
  }

  {
    const alignFb =
      "Align section headings consistently within each existing column.";
    const primary = plan([
      baseOp({
        op: "align_objects",
        target_id: undefined,
        target_ids: ["block-skills-4-t1", "block-header-0-t0"],
        values: { align_left: 60 },
        founder_feedback_item: alignFb,
        confidence: 0.95,
      }),
    ]);
    const repairedRaw = {
      schema_version: "founder-canvas-revision-plan-1.0.0",
      summary: "repaired align",
      notes: [] as string[],
      operations: [
        {
          op: "align_objects",
          target_ids: ["block-skills-4-t1", "block-header-0-t0"],
          values: { align_left: 60 },
          founder_feedback_item: alignFb,
          before_summary: "mixed heading left positions",
          intended_change: "align heading left edges",
        },
      ],
    };
    const restored = restoreMissingConfidenceFromPrimary(primary, repairedRaw) as {
      operations: Array<{ confidence?: number }>;
    };
    const shape = validateRevisionPlanShapeAndOperations(restored, {
      requested_changes: [alignFb],
    });
    checks.push(
      assert(
        shape.ok === true &&
          restored.operations[0]?.confidence === 0.95,
        "ALIGN_OBJECTS_MISSING_CONFIDENCE",
        JSON.stringify({
          shapeOk: shape.ok,
          confidence: restored.operations[0]?.confidence,
        }),
      ),
    );
  }

  {
    const conflictPrompt = buildRevisionConflictRepairPrompt({
      task: fixtureTask([FB_A, FB_B]),
      inventory: inventory(),
      page_width: 794,
      page_height: 1123,
      primaryPlan: plan([
        baseOp({
          op: "set_position",
          values: { top: 180 },
          founder_feedback_item: FB_A,
        }),
      ]),
      conflictReport: buildPrimaryConflictReport([
        baseOp({
          op: "set_position",
          values: { top: 180 },
          founder_feedback_item: FB_A,
        }),
        baseOp({
          op: "move_object",
          values: { delta_top: 50 },
          founder_feedback_item: FB_B,
        }),
      ]),
    });
    checks.push(
      assert(
        conflictPrompt.instructions.includes("CONFIDENCE IS MANDATORY") &&
          conflictPrompt.instructions.includes(
            "NEVER OMIT confidence FROM A REPAIRED OPERATION",
          ) &&
          conflictPrompt.instructions.includes('"confidence":'),
        "PROMPT_CONTRACT_PROOF",
        conflictPrompt.instructions.slice(
          conflictPrompt.instructions.indexOf("MANDATORY FIELDS"),
          conflictPrompt.instructions.indexOf("MANDATORY FIELDS") + 400,
        ),
      ),
    );
  }

  {
    const primaryPrompt = buildRevisionPlannerPrompt({
      task: fixtureTask([FB_A, FB_B, FB_C]),
      inventory: inventory(),
      page_width: 794,
      page_height: 1123,
      preview_width: 794,
      preview_height: 1123,
    });
    checks.push(
      assert(
        primaryPrompt.instructions.includes("COLUMN / LANE OWNERSHIP") &&
          primaryPrompt.instructions.includes(
            "consistency WITHIN each existing column/lane",
          ),
        "LANE_GUIDANCE_PRIMARY_PROMPT",
        primaryPrompt.instructions.slice(
          primaryPrompt.instructions.indexOf("COLUMN / LANE"),
          primaryPrompt.instructions.indexOf("COLUMN / LANE") + 200,
        ),
      ),
    );
  }

  {
    const conflictPrompt = buildRevisionConflictRepairPrompt({
      task: fixtureTask([FB_A, FB_B]),
      inventory: inventory(),
      page_width: 794,
      page_height: 1123,
      primaryPlan: plan([
        baseOp({
          op: "set_position",
          values: { top: 180 },
          founder_feedback_item: FB_A,
        }),
      ]),
      conflictReport: buildPrimaryConflictReport([
        baseOp({
          op: "set_position",
          values: { top: 180 },
          founder_feedback_item: FB_A,
        }),
        baseOp({
          op: "move_object",
          values: { delta_top: 50 },
          founder_feedback_item: FB_B,
        }),
      ]),
    });
    checks.push(
      assert(
        conflictPrompt.instructions.includes("COLUMN / LANE OWNERSHIP") &&
          conflictPrompt.instructions.includes("same-lane operations"),
        "LANE_GUIDANCE_CONFLICT_REPAIR_PROMPT",
        conflictPrompt.instructions.slice(
          conflictPrompt.instructions.indexOf("COLUMN / LANE"),
          conflictPrompt.instructions.indexOf("COLUMN / LANE") + 200,
        ),
      ),
    );
  }

  {
    const primaryPrompt = buildRevisionPlannerPrompt({
      task: fixtureTask([FB_A, FB_B, FB_C]),
      inventory: inventory(),
      page_width: 794,
      page_height: 1123,
      preview_width: 794,
      preview_height: 1123,
    });
    const rule =
      "every align_objects operation must contain targets from exactly one lane";
    checks.push(
      assert(
        primaryPrompt.instructions.includes(rule) &&
          primaryPrompt.instructions.includes(
            "emit separate same-lane align_objects operations for each lane",
          ),
        "PRIMARY_SAME_LANE_RULE",
        primaryPrompt.instructions.slice(
          primaryPrompt.instructions.indexOf("COLUMN / LANE"),
          primaryPrompt.instructions.indexOf("COLUMN / LANE") + 500,
        ),
      ),
    );
    checks.push(
      assert(
        !primaryPrompt.instructions.includes(
          '"block-summary-1-t1",\n        "block-experience-2-t1",\n        "block-skills-4-t1"',
        ) &&
          !primaryPrompt.instructions.includes(
            "Align the left edges of the name, summary heading, experience heading, and skills heading.",
          ) &&
          primaryPrompt.instructions.includes("block-example-sidebar-t1") &&
          primaryPrompt.instructions.includes("block-example-main-t1") &&
          primaryPrompt.instructions.includes("SEPARATE align_objects operation"),
        "PRIMARY_NO_MIXED_COLUMN_ALIGN_EXAMPLE",
        "mixed-column cohort removed; same-lane examples present",
      ),
    );
  }

  {
    const conflictPrompt = buildRevisionConflictRepairPrompt({
      task: fixtureTask([FB_A, FB_B]),
      inventory: inventory(),
      page_width: 794,
      page_height: 1123,
      primaryPlan: plan([
        baseOp({
          op: "set_position",
          values: { top: 180 },
          founder_feedback_item: FB_A,
        }),
      ]),
      conflictReport: buildPrimaryConflictReport([
        baseOp({
          op: "set_position",
          values: { top: 180 },
          founder_feedback_item: FB_A,
        }),
        baseOp({
          op: "move_object",
          values: { delta_top: 50 },
          founder_feedback_item: FB_B,
        }),
      ]),
    });
    checks.push(
      assert(
        conflictPrompt.instructions.includes(
          "every align_objects operation must contain targets from exactly one lane",
        ) &&
          !conflictPrompt.instructions.includes(
            '"block-summary-1-t1",\n        "block-experience-2-t1",\n        "block-skills-4-t1"',
          ) &&
          conflictPrompt.instructions.includes("same-lane cohort only") &&
          conflictPrompt.instructions.includes("HORIZONTAL ALIGNMENT COHORTS") &&
          conflictPrompt.instructions.includes(
            "one-element target_ids array is invalid",
          ),
        "CONFLICT_REPAIR_SAME_LANE_RULE_NO_GLOBAL_EXAMPLE",
        "conflict-repair prompt clean",
      ),
    );
    checks.push(
      assert(
        conflictPrompt.instructions.includes("OPERATION CAPABILITY GRAMMAR") &&
          conflictPrompt.instructions.includes("POSITION-ONLY") &&
          conflictPrompt.instructions.includes(
            "Do not include an unchanged left in a set_position operation merely by copying inventory geometry",
          ) &&
          conflictPrompt.instructions.includes(
            "If align_objects legitimately owns a target's left axis",
          ) &&
          !conflictPrompt.instructions.includes(
            "Example values keys: left, top, width, height, fill, stroke, text, fontSize, lineHeight, delta_top, delta_left, delta_height, align_left.",
          ),
        "CONFLICT_REPAIR_SHARED_OPERATION_GRAMMAR",
        "shared grammar + identity-left ownership",
      ),
    );
    checks.push(
      assert(
        conflictPrompt.instructions.includes("CONFIDENCE IS MANDATORY") &&
          conflictPrompt.instructions.includes(
            "NEVER OMIT confidence FROM A REPAIRED OPERATION",
          ),
        "CONFLICT_REPAIR_CONFIDENCE_CONTRACT_UNCHANGED",
        "ok",
      ),
    );
    checks.push(
      assert(
        conflictPrompt.instructions.includes("ONE canonical representation") &&
          conflictPrompt.instructions.includes(
            "remove only the redundant left field",
          ) &&
          conflictPrompt.instructions.includes("Do NOT retain both") &&
          conflictPrompt.instructions.includes(
            "Do NOT collapse unequal horizontal intents",
          ) &&
          conflictPrompt.instructions.includes(
            "Do NOT use this rule for delta_left",
          ) &&
          conflictPrompt.instructions.includes("Do NOT bypass alignment safety"),
        "R3F_conflict_repair_one_owner_collapse_rule",
        conflictPrompt.instructions.slice(
          conflictPrompt.instructions.indexOf("CANONICAL HORIZONTAL"),
          conflictPrompt.instructions.indexOf("CANONICAL HORIZONTAL") + 500,
        ),
      ),
    );
  }

  {
    const ex = makeExecute([
      plan([
        baseOp({
          op: "set_position",
          values: { top: 180 },
          founder_feedback_item: FB_A,
        }),
        baseOp({
          op: "move_object",
          values: { delta_top: 50 },
          founder_feedback_item: FB_B,
        }),
        frozenHeader(),
      ]) as unknown as Record<string, unknown>,
      (() => {
        const repaired = plan([
          baseOp({
            op: "set_position",
            values: { top: 200 },
            founder_feedback_item: FB_A,
            founder_feedback_items: [FB_B],
            intended_change: "coherent sidebar top",
          }),
          frozenHeader(),
        ]);
        const ops = repaired.operations.map((op) => ({ ...op })) as Array<
          Record<string, unknown>
        >;
        delete ops[0]!.confidence;
        return {
          ...repaired,
          operations: ops,
        } as unknown as Record<string, unknown>;
      })(),
    ]);
    const result = await planFounderCanvasRevision({
      task: fixtureTask([FB_A, FB_B, FB_C]),
      inventory: inventory(),
      page_width: 794,
      page_height: 1123,
      execute: ex.execute,
    });
    checks.push(
      assert(
        ex.getCalls() === 2 &&
          ex.getConflictCalls() === 1 &&
          ex.getCoverageCalls() === 0 &&
          result.ok === true &&
          result.conflict_repair?.summary.accepted === true,
        "NO_EXTRA_PROVIDER_CALL",
        JSON.stringify({
          calls: ex.getCalls(),
          conflict: ex.getConflictCalls(),
          coverage: ex.getCoverageCalls(),
          ok: result.ok,
          err: !result.ok ? result.error : null,
        }),
      ),
    );
  }

  // Preservation helper unit
  {
    const primary = [
      baseOp({
        op: "set_position",
        values: { top: 1 },
        founder_feedback_item: FB_A,
      }),
      baseOp({
        op: "move_object",
        values: { delta_top: 2 },
        founder_feedback_item: FB_B,
      }),
      frozenHeader(),
    ];
    const report = buildPrimaryConflictReport(primary);
    const okPreserve = validateFrozenOperationPreservation(
      primary,
      [
        baseOp({
          op: "set_position",
          values: { top: 99 },
          founder_feedback_item: FB_A,
          founder_feedback_items: [FB_B],
        }),
        frozenHeader(),
      ],
      report,
    );
    const badPreserve = validateFrozenOperationPreservation(
      primary,
      [
        baseOp({
          op: "set_position",
          values: { top: 99 },
          founder_feedback_item: FB_A,
          founder_feedback_items: [FB_B],
        }),
      ],
      report,
    );
    checks.push(
      assert(
        okPreserve.ok && !badPreserve.ok,
        "unit_preservation_multiset",
        JSON.stringify({ okPreserve, badPreserve }),
      ),
    );
    checks.push(
      assert(
        operationPreservationFingerprint(frozenHeader()).includes(
          "founder_feedback_item",
        ),
        "unit_preservation_fingerprint_includes_attribution",
        operationPreservationFingerprint(frozenHeader()).slice(0, 80),
      ),
    );
  }

  const passed = checks.filter((c) => c.pass).length;
  const payload = {
    ok: passed === checks.length,
    passed,
    total: checks.length,
    live_openai_calls: liveOpenAI,
    checks,
    at: new Date().toISOString(),
  };
  mkdirSync(join(REPO, "SOS/07_LOGS/saios/founder-revision"), {
    recursive: true,
  });
  writeFileSync(OUT, JSON.stringify(payload, null, 2));
  if (!payload.ok) {
    const failed = checks.filter((c) => !c.pass);
    console.error(
      "verify-conflict-repair FAILED:\n",
      failed.map((f) => `${f.name}: ${f.detail}`).join("\n"),
    );
    process.exit(1);
  }
  console.log(`verify-conflict-repair OK (${passed}/${checks.length} checks)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
