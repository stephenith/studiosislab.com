/**
 * Phase 6B — Founder Memory consumption verifier (deterministic / no-network).
 */
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { FounderPreferenceMemoryStore } from "./FounderPreferenceMemoryStore.js";
import {
  conflictsWithCurrentFounderRequest,
  isLayoutDesignConstraintText,
  MAX_SELECTED_RULES,
  selectFounderMemory,
} from "./FounderMemoryConsumption.js";
import {
  appendFounderMemorySelectionToInstructions,
  FOUNDER_DESIGN_MEMORY_HEADER,
} from "./FounderPreferencePrompt.js";
import { buildRevisionPlannerPrompt } from "../founder-revision/RevisionPromptBuilder.js";
import type { RevisionTask } from "../founder-revision/revision-task-types.js";
import { toFullReasoningRequest } from "../resume-integration/ResumeBrainGateway.js";
import type { SkillRequest } from "../skills/Skill.js";
import type { KnowledgeSnapshot } from "../knowledge/KnowledgeSnapshot.js";
import { evaluateRoleTargetIntegrity } from "../role-integrity/RoleTargetIntegrity.js";

function assert(name: string, cond: boolean, detail = ""): void {
  if (!cond) throw new Error(`FAIL ${name}${detail ? `: ${detail}` : ""}`);
  console.log(`✔ ${name}`);
}

function seedStore(root: string): FounderPreferenceMemoryStore {
  mkdirSync(join(root, "SOS/07_LOGS/saios/knowledge/founder-memory"), {
    recursive: true,
  });
  const store = new FounderPreferenceMemoryStore(root);
  const base = {
    revision_task_id: null as string | null,
    role: null as string | null,
    category: null as string | null,
    role_family: null as string | null,
    design_family: "modern" as string | null,
    architecture: "header_band" as string | null,
    section: null as string | null,
    component: null as string | null,
    positive_or_negative: "negative" as const,
    source_decision: "CHANGES_REQUESTED" as const,
    acceptance_result: "accepted" as const,
    active: true,
    confidence_merge: false,
  };

  store.upsertActive({
    ...base,
    scope: "GLOBAL",
    issue_type: "SPACING",
    normalized_rule:
      "Maintain compact, consistent internal Skills rhythm without large blank gaps.",
    raw_founder_feedback:
      "Maintain compact, consistent internal Skills rhythm without large blank gaps.",
    signal_type: "CONSTRAINT",
    confidence: "high",
    status: "CONFIRMED",
    candidate_id: "cand-fixture-1",
    review_id: "rev-fix-1",
    decision_id: "fd-fix-1",
  });
  store.upsertActive({
    ...base,
    scope: "GLOBAL",
    issue_type: "SPACING",
    normalized_rule: "Preserve balanced Experience bullet spacing.",
    raw_founder_feedback: "Preserve balanced Experience bullet spacing.",
    signal_type: "PREFERENCE",
    confidence: "medium",
    status: "CONFIRMED",
    candidate_id: "cand-fixture-2",
    review_id: "rev-fix-2",
    decision_id: "fd-fix-2",
  });
  store.upsertActive({
    ...base,
    scope: "GLOBAL",
    issue_type: "SPACING",
    normalized_rule: "Avoid unnecessarily large blank vertical gaps.",
    raw_founder_feedback: "Avoid unnecessarily large blank vertical gaps.",
    signal_type: "CONSTRAINT",
    confidence: "high",
    status: "CONFIRMED",
    candidate_id: "cand-fixture-3",
    review_id: "rev-fix-3",
    decision_id: "fd-fix-3",
  });
  // superseded
  store.upsertActive({
    ...base,
    scope: "GLOBAL",
    issue_type: "SPACING",
    normalized_rule: "Old gap rule",
    raw_founder_feedback: "Old gap rule",
    signal_type: "CONSTRAINT",
    confidence: "low",
    status: "SUPERSEDED",
    candidate_id: "cand-fixture-old",
    review_id: "rev-fix-old",
    decision_id: "fd-fix-old",
    superseded_by: "fpm-newer",
  });
  // low provisional ambiguous
  store.upsertActive({
    ...base,
    scope: "GLOBAL",
    issue_type: "SPACING",
    normalized_rule: "Maybe tighten Skills spacing later",
    raw_founder_feedback: "Maybe tighten Skills spacing later",
    signal_type: "CONSTRAINT",
    confidence: "low",
    status: "PROVISIONAL",
    candidate_id: "cand-fixture-prov",
    review_id: "rev-fix-prov",
    decision_id: "fd-fix-prov",
    acceptance_result: "pending",
  });
  // factual contamination
  store.upsertActive({
    ...base,
    scope: "GLOBAL",
    issue_type: "CONTENT_INTEGRITY",
    normalized_rule: "Candidate has AWS certification",
    raw_founder_feedback: "Candidate has AWS certification",
    signal_type: "PREFERENCE",
    confidence: "high",
    status: "CONFIRMED",
    candidate_id: "cand-fixture-fact",
    review_id: "rev-fix-fact",
    decision_id: "fd-fix-fact",
  });
  // sidebar section scoped
  store.upsertActive({
    ...base,
    scope: "SECTION",
    section: "languages",
    issue_type: "SPACING",
    normalized_rule: "Tighten Languages spacing in the sidebar.",
    raw_founder_feedback: "Tighten Languages spacing in the sidebar.",
    signal_type: "CONSTRAINT",
    confidence: "high",
    status: "CONFIRMED",
    candidate_id: "cand-fixture-side",
    review_id: "rev-fix-side",
    decision_id: "fd-fix-side",
  });
  // contact preserve for conflict test
  store.upsertActive({
    ...base,
    scope: "GLOBAL",
    issue_type: "HIERARCHY",
    normalized_rule: "Keep contact line in its current position",
    raw_founder_feedback: "Keep contact line in its current position",
    signal_type: "CONSTRAINT",
    confidence: "high",
    status: "CONFIRMED",
    candidate_id: "cand-fixture-contact",
    review_id: "rev-fix-contact",
    decision_id: "fd-fix-contact",
  });
  // duplicate semantic
  store.upsertActive({
    ...base,
    scope: "GLOBAL",
    issue_type: "SPACING",
    normalized_rule:
      "Maintain compact, consistent internal Skills rhythm without large blank gaps.",
    raw_founder_feedback:
      "Maintain compact, consistent internal Skills rhythm without large blank gaps.",
    signal_type: "CONSTRAINT",
    confidence: "medium",
    status: "CONFIRMED",
    candidate_id: "cand-fixture-dup",
    review_id: "rev-fix-dup",
    decision_id: "fd-fix-dup",
  });
  // many extras for bound test (lower confidence so primary rules win)
  for (let i = 0; i < 12; i++) {
    store.upsertActive({
      ...base,
      scope: "GLOBAL",
      issue_type: "SPACING",
      normalized_rule: `Keep positive padding between section blocks variant ${i}.`,
      raw_founder_feedback: `Keep positive padding between section blocks variant ${i}.`,
      signal_type: "PREFERENCE",
      confidence: "low",
      status: "CONFIRMED",
      candidate_id: `cand-fixture-bound-${i}`,
      review_id: `rev-fix-bound-${i}`,
      decision_id: `fd-fix-bound-${i}`,
    });
  }
  return store;
}

function main(): void {
  const root = mkdtempSync(join(tmpdir(), "fpm-6b-"));
  try {
    const store = seedStore(root);
    const ctx = {
      role: "Marketing Manager",
      role_family: "marketing_manager",
      category: "marketing",
      design_family: "modern",
      architecture: "header_band",
    };

    // A — eligible injected
    const selA = selectFounderMemory({
      ctx,
      channel: "generation",
      store,
      repoRoot: root,
    });
    assert("A_ELIGIBLE_INJECTED", selA.FOUNDER_MEMORY_CONSUMED);
    assert(
      "A_HAS_LAYOUT_PREFERENCE",
      selA.selected.some((s) =>
        /Skills rhythm|Experience bullet|blank vertical gaps|positive padding/i.test(
          s.injectable_text,
        ),
      ),
      selA.selected.map((s) => s.injectable_text).join(" | "),
    );

    // B — superseded excluded
    assert(
      "B_SUPERSEDED_EXCLUDED",
      selA.excluded.some((e) => e.kind === "SUPERSEDED"),
    );

    // C — low provisional ambiguous excluded
    assert(
      "C_AMBIGUOUS_PROVISIONAL_EXCLUDED",
      !selA.selected.some((s) =>
        /Maybe tighten Skills spacing later/i.test(s.injectable_text),
      ) &&
        selA.excluded.some((e) => e.kind === "AMBIGUOUS"),
    );

    // D — factual contamination
    assert(
      "D_FACTUAL_EXCLUDED",
      !selA.selected.some((s) => /AWS certification/i.test(s.injectable_text)),
    );
    assert(
      "D_FACTUAL_CLASSIFIER",
      !isLayoutDesignConstraintText("Candidate has AWS certification"),
    );

    // E — conflict with current founder request
    const selConflict = selectFounderMemory({
      ctx,
      channel: "revision",
      store,
      repoRoot: root,
      currentFounderRequests: ["move contact line downward by 8px"],
    });
    assert(
      "E_CONFLICT_EXCLUDED",
      !selConflict.selected.some((s) =>
        /Keep contact line in its current position/i.test(s.injectable_text),
      ),
    );
    assert(
      "E_CONFLICT_HELPER",
      conflictsWithCurrentFounderRequest(
        "Keep contact line in its current position",
        ["move contact line downward by 8px"],
      ),
    );

    // F — irrelevant section scope
    const selNoSection = selectFounderMemory({
      ctx: { ...ctx, section: null },
      channel: "revision",
      store,
      repoRoot: root,
    });
    assert(
      "F_IRRELEVANT_SIDEBAR_EXCLUDED",
      !selNoSection.selected.some((s) => /Languages spacing/i.test(s.injectable_text)),
    );
    assert(
      "F_IRRELEVANT_KIND",
      selNoSection.excluded.some((e) => e.kind === "IRRELEVANT"),
    );

    // G — dedupe
    const skillsHits = selA.selected.filter((s) =>
      /Skills rhythm/i.test(s.injectable_text),
    );
    assert("G_DEDUPE", skillsHits.length === 1);

    // H — bounded
    assert(
      "H_BOUNDED",
      selA.selected.length <= MAX_SELECTED_RULES &&
        selA.excluded.some((e) => /budget|max selected/i.test(e.reason)),
    );

    // I — generation prompt integration
    const { instructions, memory_ids } =
      appendFounderMemorySelectionToInstructions(
        "Skill:design_planning; baseline",
        selA,
      );
    assert(
      "I_GENERATION_PROMPT_HAS_MEMORY",
      instructions.includes(FOUNDER_DESIGN_MEMORY_HEADER) &&
        memory_ids.length > 0,
    );
    assert(
      "I_NO_FACTUAL_IN_PROMPT",
      !/AWS certification/i.test(instructions),
    );

    // J — revision prompt precedence
    const task = {
      schema_version: "founder-revision-task-1.0.0" as const,
      task_id: "revtask-6b-test",
      decision_id: "fd-6b",
      review_id: "rev-6b",
      prior_candidate_id: "cand-prior-6b",
      prior_canvas_path:
        "SOS/07_LOGS/saios/first-production-cycle/candidates/cand-prior-6b/canvas.json",
      founder_reason: "Layout polish",
      requested_changes: ["move contact line downward by 8px"],
      role: "Marketing Manager",
      design_family: "modern",
      status: "PLANNING" as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      revised_candidate_id: null,
      revised_review_id: null,
      revision_number: 1,
      error: null,
      openai_execution_path: null,
      publication_allowed: false as const,
      live: false as const,
    };
    // Isolate revision selection to fixture store via repoRoot
    const revPrompt = buildRevisionPlannerPrompt({
      task,
      inventory: [
        {
          id: "t-contact",
          type: "textbox",
          role: "contact",
          section: "header",
          text: "a@b.com",
          left: 48,
          top: 120,
          width: 400,
          height: 14,
          fontSize: 10,
        } as never,
      ],
      page_width: 612,
      page_height: 792,
      preview_width: 612,
      preview_height: 792,
      repoRoot: root,
    });
    assert(
      "J_REVISION_HAS_CURRENT_REQUEST",
      revPrompt.instructions.includes("CURRENT FOUNDER REQUEST") &&
        revPrompt.instructions.includes("move contact line downward by 8px"),
    );
    assert(
      "J_REVISION_MEMORY_SUBORDINATE",
      revPrompt.instructions.includes("RELEVANT FOUNDER MEMORY") &&
        revPrompt.instructions.indexOf("CURRENT FOUNDER REQUEST") <
          revPrompt.instructions.indexOf("RELEVANT FOUNDER MEMORY"),
    );
    assert(
      "J_MEMORY_NOT_AS_FEEDBACK_ITEM",
      !revPrompt.instructions.includes(
        'founder_feedback_item":"Keep contact line',
      ),
    );
    assert(
      "J_CONFLICT_MEMORY_NOT_INJECTED",
      !/Keep contact line in its current position/i.test(
        revPrompt.founder_memory_selection.prompt_block,
      ),
    );

    // K — role integrity unaffected by memory
    const roleGate = evaluateRoleTargetIntegrity({
      target_title: "Chief Marketing Officer",
      target_role_family: "chief_marketing_officer",
      structured_role: "Chief Marketing Officer",
      rendered_role: "Chief Marketing Officer",
    });
    assert("K_ROLE_INTEGRITY_PASS", roleGate.pass);

    // L — gateway helper preserves target objective
    const snap = {
      meta: {
        snapshot_id: "snap-6b",
        unrestricted: false,
        live: false,
      },
      references: [{ entry_id: "k1" }],
    } as KnowledgeSnapshot;
    const sr = {
      request_id: "req-6b",
      task_id: "task-6b",
      department: "resume",
      skill_id: "resume.layout_planning",
      dry_run: true,
      created_at: new Date().toISOString(),
      memory_references: [],
      context_references: [],
      input: {
        objective: "Premium Marketing Manager resume",
        title: "Marketing Manager",
        role_family: "marketing_manager",
        category: "marketing",
        design_family: "modern",
        architecture: "header_band",
        production_target: {
          title: "Marketing Manager",
          role_family: "marketing_manager",
          category: "marketing",
        },
      },
    } as SkillRequest;
    const sk = {
      capability: "design_planning",
      objective: "layout",
      privacy_classification: "INTERNAL",
    } as never;
    const built = toFullReasoningRequest(sk, sr, snap, { repoRoot: root });
    assert(
      "L_GENERATION_MEMORY_IN_REQUEST",
      built.request.instructions.includes(FOUNDER_DESIGN_MEMORY_HEADER),
    );
    assert(
      "L_TARGET_ROLE_PRESERVED",
      built.request.objective.includes("Marketing Manager"),
    );
    assert(
      "L_SELECTION_EVIDENCE",
      Boolean(built.founder_memory_selection?.FOUNDER_MEMORY_CONSUMED),
    );

    console.log(
      "PASS verify-founder-memory-consumption-6b",
      JSON.stringify({
        selected: selA.memory_ids.length,
        excluded: selA.excluded.length,
        prompt_hash: selA.prompt_hash,
      }),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

main();
