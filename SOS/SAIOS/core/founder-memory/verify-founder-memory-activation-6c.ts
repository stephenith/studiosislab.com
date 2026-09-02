/**
 * Phase 6C — Context propagation + outcome-aware maturation verifier.
 * Deterministic / no-network. Does not mutate production memory.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { FounderPreferenceMemoryStore } from "./FounderPreferenceMemoryStore.js";
import {
  selectFounderMemory,
  isLayoutDesignConstraintText,
} from "./FounderMemoryConsumption.js";
import {
  architectureForFamily,
  buildMemorySelectionContext,
  deriveRevisionMemoryContext,
  resolveGenerationDesignContext,
  toSelectionContext,
} from "./FounderMemoryContext.js";
import {
  classifyHistoricalMemory,
  evaluateMemoryMaturation,
  isFactualOrOneOffContent,
  sameIssuePersists,
} from "./FounderMemoryMaturation.js";
import { FounderPreferenceWriter } from "./FounderPreferenceWriter.js";
import { deriveGenerationTargetContext } from "./FounderPreferencePrompt.js";
import { buildRevisionPlannerPrompt } from "../founder-revision/RevisionPromptBuilder.js";
import type { RevisionTask } from "../founder-revision/revision-task-types.js";
import type { FounderPreferenceMemoryRecord } from "./FounderPreferenceMemoryTypes.js";
import type { FounderDecision } from "../founder-decisions/types.js";
import type { SkillRequest } from "../skills/Skill.js";
import { evaluateRoleTargetIntegrity } from "../role-integrity/RoleTargetIntegrity.js";

const REPO = resolve(import.meta.dirname, "../../../..");

function assert(name: string, cond: boolean, detail = ""): void {
  if (!cond) throw new Error(`FAIL ${name}${detail ? `: ${detail}` : ""}`);
  console.log(`✔ ${name}`);
}

function seedLayoutRule(
  store: FounderPreferenceMemoryStore,
  patch: Partial<FounderPreferenceMemoryRecord> & {
    normalized_rule: string;
    scope: FounderPreferenceMemoryRecord["scope"];
  },
): FounderPreferenceMemoryRecord {
  return store.upsertActive({
    issue_type: "SPACING",
    raw_founder_feedback: patch.normalized_rule,
    signal_type: "CONSTRAINT",
    confidence: "high",
    status: "CONFIRMED",
    candidate_id: "cand-6c-1",
    review_id: "rev-6c-1",
    decision_id: "fd-6c-1",
    revision_task_id: null,
    role: null,
    category: null,
    role_family: null,
    design_family: "executive",
    architecture: "wide_header_single",
    section: null,
    component: null,
    positive_or_negative: "negative",
    source_decision: "CHANGES_REQUESTED",
    acceptance_result: "accepted",
    active: true,
    confidence_merge: false,
    ...patch,
  });
}

function decision(partial: Partial<FounderDecision> & { decision: FounderDecision["decision"] }): FounderDecision {
  return {
    decision_id: "fd-6c",
    review_id: "rev-6c",
    task_id: "task-6c",
    cycle_id: "cyc-6c",
    department: "resume",
    founder_actor: "founder",
    reason: "layout",
    structured_feedback: {},
    quality_scores: {},
    requested_changes: [],
    reviewed_artifacts: [],
    provider: "mock",
    dry_run: true,
    created_at: new Date().toISOString(),
    source_interface: "aios_dashboard",
    publication_allowed: false,
    next_action: "none",
    supersedes: null,
    ...partial,
  };
}

function revisionTask(partial: Partial<RevisionTask> = {}): RevisionTask {
  return {
    schema_version: "founder-revision-task-1.0.0",
    task_id: "revtask-6c",
    decision_id: "fd-6c",
    review_id: "rev-6c",
    prior_candidate_id: "cand-6c-prior",
    prior_canvas_path:
      "SOS/07_LOGS/saios/first-production-cycle/candidates/cand-6c-prior/canvas.json",
    founder_reason: "Layout polish",
    requested_changes: ["Tighten Experience bullet spacing"],
    role: "Chief Marketing Officer",
    design_family: "executive",
    status: "PLANNING",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    revised_candidate_id: null,
    revised_review_id: null,
    revision_number: 1,
    error: null,
    openai_execution_path: null,
    publication_allowed: false,
    live: false,
    ...partial,
  };
}

function classifyCorpus(records: FounderPreferenceMemoryRecord[]): Record<string, number> {
  const counts = {
    LAYOUT_CONSTRAINT: 0,
    LAYOUT_PREFERENCE: 0,
    POSITIVE_EXEMPLAR: 0,
    FACTUAL_CONTENT: 0,
    ONE_OFF_TEMPLATE_INSTRUCTION: 0,
    OTHER: 0,
  };
  for (const rec of records) {
    const text = rec.normalized_rule || rec.raw_founder_feedback || "";
    if (rec.signal_type === "POSITIVE_EXEMPLAR") counts.POSITIVE_EXEMPLAR += 1;
    else if (isFactualOrOneOffContent(text) && !isLayoutDesignConstraintText(text)) {
      counts.FACTUAL_CONTENT += 1;
    } else if (/\b(this template|this resume only)\b/i.test(text)) {
      counts.ONE_OFF_TEMPLATE_INSTRUCTION += 1;
    } else if (rec.signal_type === "CONSTRAINT") counts.LAYOUT_CONSTRAINT += 1;
    else if (rec.signal_type === "PREFERENCE") counts.LAYOUT_PREFERENCE += 1;
    else counts.OTHER += 1;
  }
  return counts;
}

function main(): void {
  const root = mkdtempSync(join(tmpdir(), "fpm-6c-"));
  mkdirSync(join(root, "SOS/07_LOGS/saios/knowledge/founder-memory"), {
    recursive: true,
  });
  const store = new FounderPreferenceMemoryStore(root);

  const execRule = seedLayoutRule(store, {
    scope: "DESIGN_FAMILY",
    design_family: "executive",
    architecture: "wide_header_single",
    normalized_rule:
      "Keep executive hierarchy compact with a premium header band and tight section rhythm.",
  });
  seedLayoutRule(store, {
    scope: "DESIGN_FAMILY",
    design_family: "modern",
    architecture: "header_band",
    normalized_rule: "Modern family should keep a calm header band rhythm.",
    candidate_id: "cand-6c-modern",
  });
  seedLayoutRule(store, {
    scope: "ARCHITECTURE",
    design_family: "professional_sidebar",
    architecture: "narrow_ats_sidebar",
    normalized_rule: "Keep the sidebar compact and ATS-safe.",
    candidate_id: "cand-6c-side",
  });
  seedLayoutRule(store, {
    scope: "SECTION",
    section: "languages",
    design_family: "professional_sidebar",
    architecture: "narrow_ats_sidebar",
    normalized_rule: "Tighten Languages spacing in the sidebar.",
    candidate_id: "cand-6c-lang",
  });
  seedLayoutRule(store, {
    scope: "DESIGN_FAMILY",
    design_family: "executive",
    status: "PROVISIONAL",
    confidence: "low",
    acceptance_result: "pending",
    normalized_rule: "Candidate has AWS certification and 12 years at Acme.",
    issue_type: "CONTENT_INTEGRITY",
    signal_type: "PREFERENCE",
    candidate_id: "cand-6c-fact",
  });

  // --- PART 2 reconfirm: null design context → IRRELEVANT for family/arch ---
  const nullSel = selectFounderMemory({
    store,
    repoRoot: root,
    channel: "generation",
    ctx: buildMemorySelectionContext({
      role: "Chief Marketing Officer",
      role_family: "chief_marketing_officer",
      category: "executive",
      design_family: null,
      architecture: null,
    }),
  });
  assert("ZERO_CONTEXT_NO_FAMILY_HIT", !nullSel.FOUNDER_MEMORY_CONSUMED);
  assert(
    "ZERO_CONTEXT_IRRELEVANT",
    nullSel.counts.irrelevant >= 3 && nullSel.counts.selected === 0,
  );
  assert(
    "NULL_DESIGN_RECORDED",
    nullSel.context.design_family == null && nullSel.context.architecture == null,
  );

  // --- PART 13 design_family propagation ---
  const execCtx = resolveGenerationDesignContext({
    objective: "Premium CMO resume design_family:executive",
    role_family: "chief_marketing_officer",
    category: "executive",
    title: "Chief Marketing Officer",
  });
  assert("RESOLVED_EXECUTIVE_FAMILY", execCtx.design_family === "executive");
  assert(
    "RESOLVED_EXECUTIVE_ARCH",
    execCtx.architecture === "wide_header_single",
  );
  const execSel = selectFounderMemory({
    store,
    repoRoot: root,
    channel: "generation",
    ctx: toSelectionContext(execCtx),
  });
  assert("DESIGN_FAMILY_SELECTED", execSel.FOUNDER_MEMORY_CONSUMED);
  assert(
    "DESIGN_FAMILY_RULE_ID",
    execSel.memory_ids.includes(execRule.memory_id),
  );
  assert(
    "CONTROL_MODERN_EXCLUDED",
    !execSel.selected.some((s) => /Modern family/i.test(s.injectable_text)),
  );
  assert("PROMPT_BOUNDED", execSel.prompt_block.length <= 600);
  assert(
    "CONTEXT_RECORDED",
    execSel.context.design_family === "executive" &&
      execSel.context.architecture === "wide_header_single",
  );

  const modernSel = selectFounderMemory({
    store,
    repoRoot: root,
    channel: "generation",
    ctx: buildMemorySelectionContext({
      design_family: "modern",
      architecture: "header_band",
    }),
  });
  assert(
    "CONTROL_EXECUTIVE_EXCLUDED_ON_MODERN",
    !modernSel.memory_ids.includes(execRule.memory_id),
  );

  // --- PART 14 architecture ---
  const archMatch = selectFounderMemory({
    store,
    repoRoot: root,
    channel: "generation",
    ctx: buildMemorySelectionContext({
      architecture: "narrow_ats_sidebar",
      design_family: "professional_sidebar",
    }),
  });
  assert(
    "ARCHITECTURE_MATCH",
    archMatch.selected.some((s) => /sidebar compact/i.test(s.injectable_text)),
  );
  const archNull = selectFounderMemory({
    store,
    repoRoot: root,
    channel: "generation",
    ctx: buildMemorySelectionContext({
      design_family: "professional_sidebar",
      architecture: null,
    }),
  });
  assert(
    "ARCHITECTURE_NULL_NOT_FALSE_HIT",
    !archNull.selected.some((s) => /sidebar compact/i.test(s.injectable_text)),
  );

  // --- PART 15–20 maturation ---
  const provisionalLayout: FounderPreferenceMemoryRecord = {
    ...execRule,
    memory_id: "fpm-6c-prov-layout",
    status: "PROVISIONAL",
    confidence: "low",
    acceptance_result: "pending",
    signal_type: "CONSTRAINT",
    normalized_rule:
      "Reduce excessive Skills internal gap and keep Experience bullets compact.",
    raw_founder_feedback:
      "Reduce excessive Skills internal gap and keep Experience bullets compact.",
  };
  const pos = evaluateMemoryMaturation(provisionalLayout, {
    revision_outcome: "SUCCESS",
    later_founder_outcome: "APPROVE",
    same_issue_persists: false,
    attribution_certain: true,
  });
  assert("MATURATION_POSITIVE", pos.verdict === "PROMOTABLE");

  const failRev = evaluateMemoryMaturation(provisionalLayout, {
    revision_outcome: "FAIL",
    later_founder_outcome: "NONE",
    same_issue_persists: false,
    attribution_certain: true,
  });
  assert("FAILED_REVISION_NOT_CONFIRMED", failRev.verdict === "KEEP_PROVISIONAL");

  const repeat = evaluateMemoryMaturation(provisionalLayout, {
    revision_outcome: "SUCCESS",
    later_founder_outcome: "REQUEST_CHANGES",
    same_issue_persists: true,
    attribution_certain: true,
  });
  assert(
    "REPEATED_REQUEST_CHANGES_NOT_CONFIRMED",
    repeat.verdict === "KEEP_PROVISIONAL",
  );
  assert(
    "SAME_ISSUE_HELPER",
    sameIssuePersists(provisionalLayout, [
      "Skills internal gap is still too large; Experience bullets still loose",
    ]),
  );

  const rejectEv = evaluateMemoryMaturation(provisionalLayout, {
    revision_outcome: "SUCCESS",
    later_founder_outcome: "REJECT",
    same_issue_persists: false,
    attribution_certain: true,
  });
  assert("REJECT_SUPERSEDES", rejectEv.verdict === "SUPERSEDE");

  const factual = evaluateMemoryMaturation(
    {
      ...provisionalLayout,
      normalized_rule: "Add AWS certification and 12 years at Acme Corp",
      raw_founder_feedback: "Add AWS certification and 12 years at Acme Corp",
    },
    {
      revision_outcome: "SUCCESS",
      later_founder_outcome: "APPROVE",
      same_issue_persists: false,
      attribution_certain: true,
    },
  );
  assert("FACTUAL_CANNOT_MATURE", factual.verdict === "KEEP_PROVISIONAL");
  assert(
    "FACTUAL_CLASSIFIER",
    isFactualOrOneOffContent("Candidate has AWS certification"),
  );

  // Writer: APPROVE revised promotes layout rule only
  const writer = new FounderPreferenceWriter(root);
  const parentId = "cand-6c-writer-parent";
  const revisedId = `${parentId}-revfb-ok`;
  mkdirSync(
    join(root, "SOS/07_LOGS/saios/first-production-cycle/candidates", parentId),
    { recursive: true },
  );
  mkdirSync(
    join(root, "SOS/07_LOGS/saios/first-production-cycle/candidates", revisedId),
    { recursive: true },
  );
  writeFileSync(
    join(
      root,
      "SOS/07_LOGS/saios/first-production-cycle/candidates",
      parentId,
      "production-target.json",
    ),
    JSON.stringify({
      title: "Chief Marketing Officer",
      category: "executive",
      role_family: "chief_marketing_officer",
      design_family: "executive",
      architecture: "wide_header_single",
    }),
  );
  writeFileSync(
    join(
      root,
      "SOS/07_LOGS/saios/first-production-cycle/candidates",
      revisedId,
      "production-target.json",
    ),
    JSON.stringify({
      title: "Chief Marketing Officer",
      category: "executive",
      role_family: "chief_marketing_officer",
      design_family: "executive",
      architecture: "wide_header_single",
    }),
  );
  writer.writeFromDecision(
    decision({
      decision_id: "fd-6c-chg",
      review_id: "rev-6c-chg",
      decision: "CHANGES_REQUESTED",
      requested_changes: [
        "Reduce excessive Skills internal gap and keep compact visual rhythm",
      ],
      structured_feedback: { candidate_id: parentId },
    }),
  );
  const afterApprove = writer.writeFromDecision(
    decision({
      decision_id: "fd-6c-apr",
      review_id: "rev-6c-apr",
      decision: "APPROVED",
      reason: "Looks correct after the spacing revision",
      structured_feedback: { candidate_id: revisedId },
    }),
  );
  assert(
    "WRITER_PROMOTES_LAYOUT_ON_APPROVE",
    afterApprove.written.some(
      (r) =>
        r.status === "CONFIRMED" &&
        r.signal_type !== "POSITIVE_EXEMPLAR" &&
        /Skills internal gap/i.test(r.normalized_rule),
    ),
  );

  // Conflict precedence still wins
  seedLayoutRule(store, {
    scope: "DESIGN_FAMILY",
    design_family: "executive",
    normalized_rule: "Keep contact line in its current position",
    issue_type: "HIERARCHY",
    candidate_id: "cand-6c-contact",
  });
  const conflictSel2 = selectFounderMemory({
    store,
    repoRoot: root,
    channel: "revision",
    currentFounderRequests: ["move contact line downward by 8px"],
    ctx: buildMemorySelectionContext({
      design_family: "executive",
      architecture: "wide_header_single",
    }),
  });
  assert(
    "CURRENT_REQUEST_WINS",
    !conflictSel2.selected.some((s) =>
      /Keep contact line in its current position/i.test(s.injectable_text),
    ),
  );
  // No false globalization
  const sidebarSel = selectFounderMemory({
    store,
    repoRoot: root,
    channel: "generation",
    ctx: buildMemorySelectionContext({
      design_family: "executive",
      architecture: "wide_header_single",
      section: null,
    }),
  });
  assert(
    "SIDEBAR_SECTION_STAYS_SCOPED",
    !sidebarSel.selected.some((s) => /Languages spacing/i.test(s.injectable_text)),
  );
  assert("NO_FAKE_GLOBAL", architectureForFamily("executive") === "wide_header_single");

  // Skill-request derive uses only known values
  const derived = deriveGenerationTargetContext({
    input: {
      title: "Chief Marketing Officer",
      role_family: "chief_marketing_officer",
      category: "executive",
      design_family: "executive",
      architecture: "wide_header_single",
      objective: "Executive CMO resume",
    },
  } as SkillRequest);
  assert(
    "CANONICAL_CONTEXT_KNOWN_ONLY",
    derived.design_family === "executive" &&
      derived.architecture === "wide_header_single",
  );

  // Revision context complete from family contract when artifacts missing
  const revCtx = deriveRevisionMemoryContext({
    task: revisionTask(),
    enrichment: {
      design_family: "executive",
      architecture: "wide_header_single",
      role: "Chief Marketing Officer",
      role_family: "chief_marketing_officer",
      category: "executive",
    },
  });
  assert("REVISION_CONTEXT_COMPLETE", revCtx.REVISION_MEMORY_CONTEXT_COMPLETE);
  const revPrompt = buildRevisionPlannerPrompt({
    task: revisionTask({
      requested_changes: ["move contact line downward by 8px"],
    }),
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
    "REVISION_CURRENT_WINS",
    revPrompt.instructions.includes("CURRENT FOUNDER REQUEST") &&
      revPrompt.instructions.indexOf("CURRENT FOUNDER REQUEST") <
        revPrompt.instructions.indexOf("RELEVANT FOUNDER MEMORY"),
  );
  assert(
    "REVISION_SELECTED_MEMORY",
    revPrompt.founder_memory_selection.context.design_family === "executive",
  );

  // Role integrity untouched
  const roleGate = evaluateRoleTargetIntegrity({
    target_title: "Chief Marketing Officer",
    target_role_family: "chief_marketing_officer",
    structured_role: "Chief Marketing Officer",
    rendered_role: "Chief Marketing Officer",
  });
  assert("ROLE_INTEGRITY_UNCHANGED", roleGate.pass);

  // --- Natural generation simulation (production pipeline shape, no-network) ---
  // Local SOS/07_LOGS/saios is gitignored; use the same selector + Family Engine
  // path production will use, against a production-shaped corpus fixture.
  const naturalTarget = {
    title: "Chief Marketing Officer",
    role_family: "chief_marketing_officer",
    category: "executive",
    objective:
      "Executive Chief Marketing Officer resume with premium hierarchy for senior leader design_family:executive",
  };
  const naturalDesign = resolveGenerationDesignContext(naturalTarget);
  const naturalSel = selectFounderMemory({
    store,
    repoRoot: root,
    channel: "generation",
    ctx: toSelectionContext({
      ...naturalDesign,
      role: naturalTarget.title,
      role_family: naturalTarget.role_family,
      category: naturalTarget.category,
    }),
  });
  assert(
    "NATURAL_GEN_HAS_DESIGN",
    naturalDesign.design_family === "executive" &&
      Boolean(naturalDesign.architecture),
  );
  assert(
    "NATURAL_GENERATION_CAN_SELECT",
    naturalSel.FOUNDER_MEMORY_CONSUMED && naturalSel.selected.length >= 1,
    `selected=${naturalSel.selected.length} family=${naturalDesign.design_family}`,
  );

  const seedOnly = resolveGenerationDesignContext({
    title: "Chief Marketing Officer",
    role_family: "chief_marketing_officer",
    category: "executive",
    objective:
      "Executive Chief Marketing Officer resume with premium hierarchy for senior leader",
  });
  assert(
    "SEED_PATH_HAS_ACTUAL_FAMILY",
    Boolean(seedOnly.design_family) && Boolean(seedOnly.architecture),
  );
  const seedSel = selectFounderMemory({
    store,
    repoRoot: root,
    channel: "generation",
    ctx: toSelectionContext({
      ...seedOnly,
      role: "Chief Marketing Officer",
      role_family: "chief_marketing_officer",
      category: "executive",
    }),
  });

  const revNat = selectFounderMemory({
    store,
    repoRoot: root,
    channel: "revision",
    currentFounderRequests: ["Tighten Experience bullet spacing"],
    ctx: toSelectionContext(
      deriveRevisionMemoryContext({
        task: revisionTask(),
        enrichment: {
          design_family: "executive",
          architecture: "wide_header_single",
          role: "Chief Marketing Officer",
          role_family: "chief_marketing_officer",
          category: "executive",
        },
      }),
    ),
  });
  assert(
    "NATURAL_REVISION_CAN_SELECT",
    revNat.FOUNDER_MEMORY_CONSUMED && revNat.selected.length >= 1,
  );

  // Historical reconciliation — classify only, do not mutate production.
  const prodStore = new FounderPreferenceMemoryStore(REPO);
  const active = prodStore.listActive();
  const historical = {
    PROMOTABLE: 0,
    KEEP_PROVISIONAL: 0,
    SUPERSEDE: 0,
    INSUFFICIENT_EVIDENCE: 0,
  };
  for (const rec of active.filter((r) => r.status === "PROVISIONAL")) {
    historical[classifyHistoricalMemory(rec).verdict] += 1;
  }
  assert(
    "HISTORICAL_NOT_SAFE_TO_MUTATE",
    historical.PROMOTABLE === 0,
    JSON.stringify(historical),
  );

  const provisional = active.filter((r) => r.status === "PROVISIONAL");
  const confirmed = active.filter((r) => r.status === "CONFIRMED");
  const corpusClass = classifyCorpus(provisional);
  const spacingHits = active.filter((r) =>
    /skills|experience bullet|compact|gap|rhythm|wrap/i.test(
      `${r.normalized_rule} ${r.raw_founder_feedback}`,
    ),
  );

  console.log(
    "PASS verify-founder-memory-activation-6c",
    JSON.stringify(
      {
        natural_generation: {
          target: naturalTarget.title,
          design_family: naturalDesign.design_family,
          architecture: naturalDesign.architecture,
          considered: naturalSel.counts.considered,
          selected: naturalSel.selected.length,
          selected_ids: naturalSel.memory_ids,
          prompt_chars: naturalSel.prompt_block.length,
          FOUNDER_MEMORY_CONSUMED: naturalSel.FOUNDER_MEMORY_CONSUMED,
        },
        seed_only_generation: {
          design_family: seedOnly.design_family,
          architecture: seedOnly.architecture,
          selected: seedSel.selected.length,
          FOUNDER_MEMORY_CONSUMED: seedSel.FOUNDER_MEMORY_CONSUMED,
        },
        natural_revision: {
          selected: revNat.selected.length,
          selected_ids: revNat.memory_ids,
          FOUNDER_MEMORY_CONSUMED: revNat.FOUNDER_MEMORY_CONSUMED,
        },
        corpus: {
          active: active.length,
          confirmed: confirmed.length,
          provisional: provisional.length,
          provisional_class: corpusClass,
        },
        historical,
        spacing_trace_count: spacingHits.length,
        spacing_ids: spacingHits.slice(0, 12).map((r) => ({
          id: r.memory_id,
          status: r.status,
          confidence: r.confidence,
          scope: r.scope,
          issue: r.issue_type,
        })),
      },
      null,
      2,
    ),
  );

  rmSync(root, { recursive: true, force: true });
}

main();
