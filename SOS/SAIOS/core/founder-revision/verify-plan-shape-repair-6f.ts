/**
 * Phase 6F — bounded primary-plan shape repair regression.
 *
 * Replays the sanitized production fixture from revtask-b5339d03-b67
 * (JSON nesting collapse: "confidence" emitted as standalone array entries).
 *
 * No OpenAI. No production task mutation. No Founder decisions.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import type { ReasoningRequest } from "../ai-brain/ReasoningRequest.js";
import type {
  CanvasInventoryObject,
  RevisionTask,
} from "./revision-task-types.js";
import {
  planFounderCanvasRevision,
  type PlannerExecuteFn,
} from "./RevisionPlanner.js";
import {
  buildRevisionShapeRepairPrompt,
  isPlanCoverageExemptRequestedChange,
  isRepairableShapeFailure,
  validateRevisionPlanShapeAndOperations,
} from "./RevisionPromptBuilder.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const FIX = join(REPO, ".cursor/debug-fixtures/revtask-b5339d03-b67-sanitized");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/founder-revision/verify-plan-shape-repair-6f.json",
);

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function assert(cond: boolean, name: string, detail: string): void {
  checks.push({ name, pass: !!cond, detail });
}

function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(join(FIX, name), "utf8")) as T;
}

type Meta = {
  source_task_id: string;
  source_candidate_id: string;
  decision_id: string;
  review_id: string;
  role_raw: string;
  canonical_role_expected: string;
  requested_changes: string[];
  founder_reason: string;
  expected_error: string;
};

function buildTask(meta: Meta): RevisionTask {
  return {
    schema_version: "founder-revision-task-1.0.0",
    task_id: "revtask-fixture-shape-6f",
    decision_id: meta.decision_id,
    review_id: meta.review_id,
    prior_candidate_id: meta.source_candidate_id,
    prior_canvas_path: join(FIX, "prior-canvas.json"),
    founder_reason: meta.founder_reason,
    requested_changes: [...meta.requested_changes],
    role: meta.role_raw,
    design_family: "professional_sidebar",
    status: "PLANNING",
    created_at: "2026-09-15T00:00:00.000Z",
    updated_at: "2026-09-15T00:00:00.000Z",
    revised_candidate_id: null,
    revised_review_id: null,
    revision_number: 1,
    error: null,
    openai_execution_path: null,
    publication_allowed: false,
    live: false,
  };
}

/**
 * Simulates what a correctly-structured model repair response looks like:
 * the fixture's well-formed operations, each closed properly with confidence,
 * carrying complete Founder attribution across the mutation-required lines.
 *
 * Nothing here is salvage — it stands in for the second provider response.
 */
function repairedPlanFromFixture(
  raw: Record<string, unknown>,
  requestedChanges: string[],
): {
  schema_version: string;
  summary: string;
  operations: Record<string, unknown>[];
} {
  const mutationItems = requestedChanges.filter(
    (c) => !isPlanCoverageExemptRequestedChange(c),
  );
  const mutationSet = new Set(mutationItems);

  const ops = (raw.operations as unknown[])
    .filter(
      (o): o is Record<string, unknown> =>
        !!o && typeof o === "object" && !Array.isArray(o),
    )
    .map((o) => {
      // A compliant repair response honours the prompt's attribution rule:
      // verification / preservation / layout-owned lines need zero operations,
      // so they never appear as attribution. The production response attributed
      // them; the repair drops those claims rather than inventing ops for them.
      const secondary = (
        Array.isArray(o.founder_feedback_items)
          ? (o.founder_feedback_items as unknown[])
          : []
      ).filter((s): s is string => typeof s === "string" && mutationSet.has(s));
      const primary =
        typeof o.founder_feedback_item === "string" &&
        mutationSet.has(o.founder_feedback_item)
          ? o.founder_feedback_item
          : (secondary.shift() ?? mutationItems[0]!);
      const next: Record<string, unknown> = {
        ...o,
        confidence: 0.9,
        founder_feedback_item: primary,
      };
      if (secondary.length > 0) next.founder_feedback_items = secondary;
      else delete next.founder_feedback_items;
      return next;
    });

  const claimed = new Set(
    ops.map((o) => String(o.founder_feedback_item ?? "")),
  );
  const unclaimed = mutationItems.filter((c) => !claimed.has(c));

  // Spread remaining mutation-required lines across ops as overlapping attributions.
  unclaimed.forEach((item, i) => {
    const op = ops[i % ops.length];
    const existing = Array.isArray(op.founder_feedback_items)
      ? (op.founder_feedback_items as string[])
      : [];
    op.founder_feedback_items = [...existing, item];
  });

  return {
    schema_version: "founder-canvas-revision-plan-1.0.0",
    summary: String(raw.summary ?? "repaired"),
    operations: ops,
  };
}

async function main(): Promise<void> {
  if (!existsSync(join(FIX, "meta.json"))) {
    assert(false, "fixture_present", `missing sanitized fixture at ${FIX}`);
    return;
  }

  const meta = readJson<Meta>("meta.json");
  const rawStructured = readJson<Record<string, unknown>>("raw-structured.json");
  const inventory = readJson<CanvasInventoryObject[]>("inventory.json");
  const task = buildTask(meta);

  // 1. Production failure reproduces exactly before any repair.
  const primaryShape = validateRevisionPlanShapeAndOperations(rawStructured, {
    requested_changes: task.requested_changes,
  });
  const reproducedError = `invalid revision plan: ${primaryShape.errors.join("; ")}`;
  assert(
    !primaryShape.ok && primaryShape.plan === null,
    "production_plan_fails_shape_validation",
    `ok=${primaryShape.ok}`,
  );
  assert(
    reproducedError === meta.expected_error,
    "production_error_reproduced_exactly",
    reproducedError,
  );

  // 2. Failure is classified as a repairable shape failure.
  assert(
    isRepairableShapeFailure(primaryShape.errors),
    "failure_classified_repairable_shape",
    primaryShape.errors.join("; ").slice(0, 160),
  );

  // 3. Non-shape failures (coverage/attribution) are NOT repairable here.
  assert(
    !isRepairableShapeFailure([
      "operations[0] founder attribution is not an exact requested_changes match: x",
    ]),
    "attribution_failure_not_shape_repairable",
    "attribution errors excluded",
  );
  assert(
    !isRepairableShapeFailure([]),
    "empty_errors_not_repairable",
    "no errors → nothing to repair",
  );
  assert(
    !isRepairableShapeFailure(["operations[0].op not allowlisted"]),
    "unsupported_op_type_not_shape_repairable",
    "unsupported operation types fail closed on the first call",
  );
  assert(
    !isRepairableShapeFailure([
      "operations[2].confidence required",
      "operations[0].op not allowlisted",
    ]),
    "mixed_shape_and_unsupported_op_not_repairable",
    "a single non-shape error disqualifies the whole plan",
  );

  // 4. Repair prompt carries validator errors + Founder items + inventory.
  const repairPrompt = buildRevisionShapeRepairPrompt({
    task,
    inventory,
    page_width: 794,
    page_height: 1123,
    shapeErrors: primaryShape.errors,
    rawPlan: rawStructured,
  });
  assert(
    repairPrompt.instructions.includes("operations[3] invalid"),
    "repair_prompt_contains_validator_errors",
    "exact validator errors echoed",
  );
  assert(
    task.requested_changes.every((c) => repairPrompt.instructions.includes(c)),
    "repair_prompt_contains_all_founder_items",
    `${task.requested_changes.length} items`,
  );
  assert(
    repairPrompt.instructions.includes("block-certifications-6-t2"),
    "repair_prompt_contains_inventory",
    "inventory ids present",
  );
  assert(
    repairPrompt.instructions.includes("COMPLETE replacement plan"),
    "repair_prompt_demands_complete_replacement",
    "complete replacement demanded",
  );

  // 5. Exactly ONE bounded repair converts the malformed plan to a valid plan.
  let calls = 0;
  const executeRepairOk: PlannerExecuteFn = async (req: ReasoningRequest) => {
    calls += 1;
    const structured =
      calls === 1
        ? rawStructured
        : (repairedPlanFromFixture(
            rawStructured,
            task.requested_changes,
          ) as unknown as Record<string, unknown>);
    return {
      status: "COMPLETED",
      structured_output: structured,
      provider_request_id: `resp-fixture-${calls}`,
      model_identifier_internal: "gpt-4.1-mini",
      input_tokens: 17236,
      output_tokens: 1957,
      error_details: null,
      safety_flags: null,
    };
  };

  {
    const ok = await planFounderCanvasRevision({
      task,
      inventory,
      page_width: 794,
      page_height: 1123,
      execute: executeRepairOk,
      repoRoot: REPO,
    });
    assert(calls === 2, "max_one_additional_provider_call", `calls=${calls}`);
    assert(
      ok.ok === true,
      "bounded_repair_produced_valid_plan",
      ok.ok ? `ops=${ok.plan.operations.length}` : `error=${ok.error}`,
    );
    if (ok.ok) {
      assert(
        ok.plan.operations.every(
          (o) => typeof o.confidence === "number" && o.confidence >= 0 && o.confidence <= 1,
        ),
        "repaired_ops_carry_model_confidence",
        "all confidences within 0..1",
      );
      assert(
        ok.shape_repair?.attempted === true &&
          ok.shape_repair?.accepted === true,
        "shape_repair_evidence_recorded",
        JSON.stringify(ok.shape_repair?.failure_kind ?? null),
      );
    }

    // 6. A still-malformed repair response fails closed.
    let calls2 = 0;
    const executeRepairBad: PlannerExecuteFn = async () => {
      calls2 += 1;
      return {
        status: "COMPLETED",
        structured_output: rawStructured,
        provider_request_id: `resp-bad-${calls2}`,
        model_identifier_internal: "gpt-4.1-mini",
        input_tokens: 10,
        output_tokens: 10,
        error_details: null,
        safety_flags: null,
      };
    };
    const bad = await planFounderCanvasRevision({
      task,
      inventory,
      page_width: 794,
      page_height: 1123,
      execute: executeRepairBad,
      repoRoot: REPO,
    });
    assert(bad.ok === false, "still_invalid_repair_fails_closed", bad.ok ? "UNEXPECTED OK" : bad.error);
    assert(calls2 === 2, "failed_repair_still_bounded_to_two_calls", `calls=${calls2}`);
    assert(
      bad.ok === false && bad.status === "FAILED_PLAN",
      "failed_repair_status_failed_plan",
      bad.ok ? "n/a" : String(bad.status),
    );

    // 7. Confidence is never defaulted: repair response missing confidence fails.
    let calls3 = 0;
    const executeNoConfidence: PlannerExecuteFn = async () => {
      calls3 += 1;
      if (calls3 === 1) {
        return {
          status: "COMPLETED",
          structured_output: rawStructured,
          provider_request_id: "resp-nc-1",
          model_identifier_internal: "gpt-4.1-mini",
          input_tokens: 10,
          output_tokens: 10,
          error_details: null,
          safety_flags: null,
        };
      }
      const plan = repairedPlanFromFixture(rawStructured, task.requested_changes);
      for (const op of plan.operations) delete op.confidence;
      return {
        status: "COMPLETED",
        structured_output: plan as unknown as Record<string, unknown>,
        provider_request_id: "resp-nc-2",
        model_identifier_internal: "gpt-4.1-mini",
        input_tokens: 10,
        output_tokens: 10,
        error_details: null,
        safety_flags: null,
      };
    };
    const nc = await planFounderCanvasRevision({
      task,
      inventory,
      page_width: 794,
      page_height: 1123,
      execute: executeNoConfidence,
      repoRoot: REPO,
    });
    assert(
      nc.ok === false && /confidence required/.test(nc.error),
      "confidence_never_defaulted",
      nc.ok ? "UNEXPECTED OK" : nc.error.slice(0, 120),
    );

    // 8. Unsupported operation types are never admitted by the repair path.
    let calls4 = 0;
    const executeBadOp: PlannerExecuteFn = async () => {
      calls4 += 1;
      if (calls4 === 1) {
        return {
          status: "COMPLETED",
          structured_output: rawStructured,
          provider_request_id: "resp-bo-1",
          model_identifier_internal: "gpt-4.1-mini",
          input_tokens: 10,
          output_tokens: 10,
          error_details: null,
          safety_flags: null,
        };
      }
      const plan = repairedPlanFromFixture(rawStructured, task.requested_changes);
      plan.operations[0] = { ...plan.operations[0], op: "rewrite_section" };
      return {
        status: "COMPLETED",
        structured_output: plan as unknown as Record<string, unknown>,
        provider_request_id: "resp-bo-2",
        model_identifier_internal: "gpt-4.1-mini",
        input_tokens: 10,
        output_tokens: 10,
        error_details: null,
        safety_flags: null,
      };
    };
    const bo = await planFounderCanvasRevision({
      task,
      inventory,
      page_width: 794,
      page_height: 1123,
      execute: executeBadOp,
      repoRoot: REPO,
    });
    assert(
      bo.ok === false && /not allowlisted/.test(bo.error),
      "unsupported_operation_never_executes",
      bo.ok ? "UNEXPECTED OK" : bo.error.slice(0, 120),
    );

    // 9. Malformed entries are never salvaged into the accepted plan.
    if (ok.ok) {
      const targets = ok.plan.operations.map((o) => o.target_id);
      assert(
        targets.every((t) => typeof t === "string" && t.length > 0),
        "no_malformed_entry_salvaged",
        `targets=${targets.length}`,
      );
      assert(
        ok.plan.operations.length === 5,
        "only_wellformed_operations_survive",
        `ops=${ok.plan.operations.length} (5 object entries in fixture)`,
      );
    }
  }
}

function finish(): void {
  const pass = checks.every((c) => c.pass);
  const report = {
    schema_version: "plan-shape-repair-6f-1.0.0",
    generated_at: new Date().toISOString(),
    fixture: ".cursor/debug-fixtures/revtask-b5339d03-b67-sanitized",
    source_task_id: "revtask-b5339d03-b67",
    pass,
    checks,
    publication_allowed: false,
    live: false,
  };
  mkdirSync(join(OUT, ".."), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
  for (const c of checks) {
    console.log(`${c.pass ? "PASS" : "FAIL"}  ${c.name}  ${c.detail}`);
  }
  console.log(pass ? "\nPLAN_SHAPE_REPAIR_6F=PASS" : "\nPLAN_SHAPE_REPAIR_6F=FAIL");
  if (!pass) process.exit(1);
}

main()
  .then(finish)
  .catch((e: unknown) => {
    assert(false, "verifier_threw", e instanceof Error ? e.message : String(e));
    finish();
  });
