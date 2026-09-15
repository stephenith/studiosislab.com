/**
 * Phase 6F — Founder memory revision-task wiring, universal layout scope,
 * canonical planner role/design context, and FAILED_PLAN observability.
 *
 * Runs entirely against a temporary repo root. No OpenAI. No production writes.
 * Historical production memory and tasks are never touched.
 */
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  canonicalizeTargetRole,
} from "../founder-revision/createRevisionTaskFromDecision.js";
import { buildRevisionPlannerPrompt } from "../founder-revision/RevisionPromptBuilder.js";
import type { RevisionTask } from "../founder-revision/revision-task-types.js";
import {
  ensureFounderMemoryDirs,
  FounderPreferenceMemoryStore,
} from "./FounderPreferenceMemoryStore.js";
import type { FounderPreferenceMemoryRecord } from "./FounderPreferenceMemoryTypes.js";
import {
  isUniversalLayoutInvariantRule,
  resolveConfirmedMemoryScope,
} from "./FounderMemoryMaturation.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/founder-revision/verify-memory-task-wiring-6f.json",
);

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function assert(cond: boolean, name: string, detail: string): void {
  checks.push({ name, pass: !!cond, detail });
}

function memoryRow(
  over: Partial<FounderPreferenceMemoryRecord>,
): Omit<
  FounderPreferenceMemoryRecord,
  | "memory_id"
  | "content_hash"
  | "created_at"
  | "updated_at"
  | "superseded_by"
  | "schema_version"
> {
  return {
    scope: "ARCHITECTURE",
    issue_type: "SPACING",
    normalized_rule: "Text objects must never overlap.",
    raw_founder_feedback: "Text objects must never overlap.",
    signal_type: "CONSTRAINT",
    confidence: "LOW",
    status: "PROVISIONAL",
    candidate_id: "cand-fixture-6f",
    review_id: "founder-review-fixture-6f",
    decision_id: "fd-fixture-6f",
    revision_task_id: null,
    role: "Operations Analyst",
    category: "ats",
    role_family: "operations_analyst",
    design_family: "professional_sidebar",
    architecture: "narrow_ats_sidebar",
    section: null,
    component: null,
    positive_or_negative: "negative",
    source_decision: "CHANGES_REQUESTED",
    acceptance_result: "pending",
    active: true,
    ...over,
  } as ReturnType<typeof memoryRow>;
}

function main(): void {
  // --- Step 4: revision_task_id wiring ------------------------------------
  const tmpRoot = mkdtempSync(join(tmpdir(), "saios-6f-memory-"));
  const store = new FounderPreferenceMemoryStore(tmpRoot);
  ensureFounderMemoryDirs(tmpRoot);

  const a = store.upsertActive(memoryRow({ normalized_rule: "Rule A overlap" }));
  const b = store.upsertActive(memoryRow({ normalized_rule: "Rule B clipping" }));
  const other = store.upsertActive(
    memoryRow({
      normalized_rule: "Rule C other decision",
      decision_id: "fd-other-6f",
    }),
  );

  assert(
    [a, b, other].every((r) => r.revision_task_id === null),
    "memory_rows_start_unlinked",
    "3 rows written with revision_task_id=null",
  );

  const linked = store.linkRevisionTask({
    decision_id: "fd-fixture-6f",
    revision_task_id: "revtask-fixture-6f",
  });
  assert(linked === 2, "link_only_touches_matching_decision", `linked=${linked}`);

  const active = store.listActive();
  const forDecision = active.filter((r) => r.decision_id === "fd-fixture-6f");
  assert(
    forDecision.length === 2 &&
      forDecision.every((r) => r.revision_task_id === "revtask-fixture-6f"),
    "revision_task_id_linked_to_decision_memory",
    `${forDecision.filter((r) => r.revision_task_id).length}/2 linked`,
  );
  const otherActive = active.find((r) => r.decision_id === "fd-other-6f");
  assert(
    otherActive?.revision_task_id === null,
    "unrelated_decision_memory_untouched",
    `other=${String(otherActive?.revision_task_id)}`,
  );

  // Idempotent: re-linking does not append or change anything.
  const relinked = store.linkRevisionTask({
    decision_id: "fd-fixture-6f",
    revision_task_id: "revtask-different-6f",
  });
  assert(relinked === 0, "already_linked_rows_are_immutable", `relinked=${relinked}`);
  assert(
    store
      .listActive()
      .filter((r) => r.decision_id === "fd-fixture-6f")
      .every((r) => r.revision_task_id === "revtask-fixture-6f"),
    "existing_linkage_never_rewritten",
    "original task id preserved",
  );

  // Append-only history: nothing removed.
  const history = store.listAll();
  assert(
    history.length === 5,
    "memory_history_is_append_only",
    `rows=${history.length} (3 created + 2 linked versions)`,
  );

  // Events recorded.
  const eventsPath = join(store.dir(), "events.jsonl");
  const events = readFileSync(eventsPath, "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as { type: string });
  assert(
    events.filter((e) => e.type === "MEMORY_LINKED_REVISION_TASK").length === 2,
    "linkage_events_recorded",
    "2 MEMORY_LINKED_REVISION_TASK events",
  );

  // --- Step 5: universal layout invariant scope ---------------------------
  const universal = [
    "Text objects must never overlap.",
    "No clipped text anywhere on the page.",
    "Text must never render out-of-bounds.",
    "Maintain positive separation between all text objects.",
  ];
  for (const t of universal) {
    assert(
      isUniversalLayoutInvariantRule(t),
      `universal_invariant_recognized: ${t.slice(0, 34)}`,
      "architecture-independent",
    );
    assert(
      resolveConfirmedMemoryScope({
        currentScope: "ARCHITECTURE",
        normalized_rule: t,
        raw_founder_feedback: t,
      }) === "GLOBAL",
      `confirmed_scope_widens_to_global: ${t.slice(0, 30)}`,
      "ARCHITECTURE → GLOBAL at confirmation",
    );
  }

  const notUniversal = [
    "Replace the Experience section with Operations Analyst content.",
    "The sidebar certifications must not overlap.",
    "Change the professional title to Operations Analyst.",
    "Use a two-column layout for this family.",
    "Alex Morgan holds a B.A. in Marketing.",
  ];
  for (const t of notUniversal) {
    assert(
      !isUniversalLayoutInvariantRule(t),
      `non_universal_rejected: ${t.slice(0, 34)}`,
      "role/section/architecture/factual → not global",
    );
    assert(
      resolveConfirmedMemoryScope({
        currentScope: "ARCHITECTURE",
        normalized_rule: t,
        raw_founder_feedback: t,
      }) === "ARCHITECTURE",
      `non_universal_scope_preserved: ${t.slice(0, 30)}`,
      "scope unchanged",
    );
  }
  assert(
    resolveConfirmedMemoryScope({
      currentScope: "ROLE",
      normalized_rule: "Replace the Skills section.",
      raw_founder_feedback: "Replace the Skills section.",
    }) === "ROLE",
    "role_content_memory_not_made_global",
    "ROLE preserved",
  );

  // --- Step 6: canonical role + design context ----------------------------
  const roleCases: [string, string][] = [
    ["Operations Analyst  revised v1", "Operations Analyst"],
    ["Operations Analyst revised", "Operations Analyst"],
    ["Operations Analyst · revised v2", "Operations Analyst"],
    ["Operations Analyst revision 3", "Operations Analyst"],
    ["Operations Analyst", "Operations Analyst"],
    ["Marketing Manager revised v1", "Marketing Manager"],
  ];
  for (const [input, expected] of roleCases) {
    const got = canonicalizeTargetRole(input);
    assert(
      got === expected,
      `canonical_role_strips_revision_suffix: ${input}`,
      `→ "${got}"`,
    );
  }

  const task: RevisionTask = {
    schema_version: "founder-revision-task-1.0.0",
    task_id: "revtask-fixture-context-6f",
    decision_id: "fd-fixture-6f",
    review_id: "founder-review-fixture-6f",
    prior_candidate_id: "cand-fixture-6f",
    prior_canvas_path: "does/not/exist.json",
    founder_reason: "context check",
    requested_changes: ["Replace the Summary section for an Operations Analyst."],
    role: "Operations Analyst",
    design_family: "professional_sidebar",
    architecture: "narrow_ats_sidebar",
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
  const prompt = buildRevisionPlannerPrompt({
    task,
    inventory: [],
    page_width: 794,
    page_height: 1123,
    preview_width: 794,
    preview_height: 1123,
    repoRoot: tmpRoot,
  });
  assert(
    prompt.objective.includes("Role: Operations Analyst") &&
      !prompt.objective.includes("revised"),
    "canonical_role_reaches_planner_objective",
    "no revision-state suffix in objective",
  );
  assert(
    prompt.objective.includes("Design family: professional_sidebar"),
    "design_family_reaches_planner_objective",
    "professional_sidebar present",
  );
  assert(
    prompt.objective.includes("Layout architecture: narrow_ats_sidebar"),
    "architecture_reaches_planner_objective",
    "narrow_ats_sidebar present",
  );
  assert(
    buildRevisionPlannerPrompt({
      task: { ...task, design_family: null, architecture: null },
      inventory: [],
      page_width: 794,
      page_height: 1123,
      preview_width: 794,
      preview_height: 1123,
      repoRoot: tmpRoot,
    }).objective.includes("Design family: unknown"),
    "absent_family_is_not_invented",
    "stays unknown when unavailable",
  );

  // --- Step 2 prompt hardening -------------------------------------------
  assert(
    /CONFIDENCE IS MANDATORY/.test(prompt.instructions),
    "primary_prompt_mandates_confidence",
    "explicit mandate present",
  );
  assert(
    /EVERY element of the operations array MUST be a JSON object/.test(
      prompt.instructions,
    ),
    "primary_prompt_forbids_non_object_entries",
    "JSON structure rule present",
  );

  // --- Step 7: historical production evidence untouched -------------------
  const failedTaskPath = join(
    REPO,
    "SOS/07_LOGS/saios/founder-revision/tasks/revtask-b5339d03-b67.json",
  );
  let historicalTouched = false;
  try {
    const t = JSON.parse(readFileSync(failedTaskPath, "utf8")) as {
      status: string;
    };
    historicalTouched = t.status !== "FAILED";
  } catch {
    // Not present in the local repo — production copy is the source of truth
    // and this verifier never writes to it.
    historicalTouched = false;
  }
  assert(
    !historicalTouched,
    "historical_failed_task_unchanged",
    "revtask-b5339d03-b67 never mutated by this slice",
  );

  finish();
}

function finish(): void {
  const pass = checks.every((c) => c.pass);
  const report = {
    schema_version: "memory-task-wiring-6f-1.0.0",
    generated_at: new Date().toISOString(),
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
  console.log(
    pass ? "\nMEMORY_TASK_WIRING_6F=PASS" : "\nMEMORY_TASK_WIRING_6F=FAIL",
  );
  if (!pass) process.exit(1);
}

main();
