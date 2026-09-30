/**
 * C3 — Founder Memory selection discipline offline proof.
 * Does not mutate production memory.jsonl. No OpenAI / LIVE / generation / revision.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { compileFounderFeedbackIR } from "../founder-revision/FounderFeedbackIR.js";
import { evaluateSharedGeometryAdmission } from "../geometry-admission/SharedGeometryAdmission.js";
import type { FabricCanvasDoc } from "../founder-revision/CanvasInventory.js";
import type { FounderDecision } from "../founder-decisions/types.js";
import { FounderPreferenceMemoryStore } from "./FounderPreferenceMemoryStore.js";
import { FounderPreferenceWriter } from "./FounderPreferenceWriter.js";
import {
  classifyMemoryLearningClass,
  isDeterministicSafetyText,
  isTaskSpecificInstruction,
} from "./FounderMemoryLearningClass.js";
import { evaluateMemoryMaturation } from "./FounderMemoryMaturation.js";
import { selectFounderMemory } from "./FounderMemoryConsumption.js";
import { toSelectionContext } from "./FounderMemoryContext.js";
import type { FounderPreferenceMemoryRecord } from "./FounderPreferenceMemoryTypes.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/founder-memory/verify-memory-selection-discipline-c3.json",
);

const MM_OA_RULE =
  "Change the professional title from Marketing Manager to Operations Analyst while preserving the current header design, candidate name, contact layout, colors, and typography.";

const CONFIRMED_FAMILY_SPACING =
  "Keep compact Skills-to-Projects sidebar rhythm without large blank gaps.";

const IRRELEVANT_FAMILY_SPACING =
  "Modern family uses a wide header band with extra name tracking.";

const SAFETY_RULE = "Text objects must never overlap.";

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function assert(ok: boolean, name: string, detail = ""): void {
  checks.push({ name, pass: Boolean(ok), detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  " + detail : ""}`);
}

function seed(
  store: FounderPreferenceMemoryStore,
  patch: Partial<FounderPreferenceMemoryRecord> & {
    normalized_rule: string;
    scope: FounderPreferenceMemoryRecord["scope"];
    status: FounderPreferenceMemoryRecord["status"];
  },
): FounderPreferenceMemoryRecord {
  return store.upsertActive({
    issue_type: "SPACING",
    raw_founder_feedback: patch.normalized_rule,
    signal_type: "CONSTRAINT",
    confidence: "high",
    candidate_id: "cand-c3",
    review_id: "rev-c3",
    decision_id: "fd-c3",
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

function execCtx() {
  return toSelectionContext({
    schema_version: "founder-memory-context-1.0.0",
    role: "Operations Analyst",
    role_family: "operations_analyst",
    category: "operations",
    design_family: "executive",
    architecture: "wide_header_single",
    design_variant: 0,
    section: null,
    component: null,
    design_family_source: "explicit",
    architecture_source: "explicit",
  });
}

function overlapCanvas(): FabricCanvasDoc {
  return {
    version: "5.3.0",
    width: 794,
    height: 1123,
    objects: [
      {
        type: "textbox",
        id: "a",
        left: 48,
        top: 100,
        width: 220,
        height: 40,
        text: "First wrapped line that is tall",
        fontSize: 12,
        lineHeight: 1.4,
        data: { section: "skills" },
      },
      {
        type: "textbox",
        id: "b",
        left: 48,
        top: 120,
        width: 220,
        height: 20,
        text: "Overlaps first",
        fontSize: 12,
        lineHeight: 1.4,
        data: { section: "skills" },
      },
    ],
  };
}

function decision(
  partial: Partial<FounderDecision> & { decision: FounderDecision["decision"] },
): FounderDecision {
  return {
    decision_id: "fd-c3",
    review_id: "rev-c3",
    task_id: "task-c3",
    cycle_id: "cyc-c3",
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

function main(): void {
  if (process.env.SOS_AIOS_LIVE === "1") {
    throw new Error("C3 verifier refuses SOS_AIOS_LIVE=1");
  }

  const root = mkdtempSync(join(tmpdir(), "fpm-c3-"));
  mkdirSync(join(root, "SOS/07_LOGS/saios/knowledge/founder-memory"), {
    recursive: true,
  });
  const store = new FounderPreferenceMemoryStore(root);

  const mmOa = seed(store, {
    memory_id: "fpm-6c083f5f-35f",
    scope: "ARCHITECTURE",
    issue_type: "HIERARCHY",
    status: "PROVISIONAL",
    confidence: "high",
    acceptance_result: "pending",
    normalized_rule: MM_OA_RULE,
    raw_founder_feedback: MM_OA_RULE,
    design_family: "professional_sidebar",
    architecture: "narrow_ats_sidebar",
  });
  const confirmedFamily = seed(store, {
    scope: "DESIGN_FAMILY",
    status: "CONFIRMED",
    normalized_rule: CONFIRMED_FAMILY_SPACING,
    design_family: "executive",
    architecture: "wide_header_single",
  });
  seed(store, {
    scope: "DESIGN_FAMILY",
    status: "CONFIRMED",
    normalized_rule: IRRELEVANT_FAMILY_SPACING,
    design_family: "modern",
    architecture: "header_band",
  });
  seed(store, {
    scope: "GLOBAL",
    status: "CONFIRMED",
    normalized_rule: SAFETY_RULE,
    issue_type: "SPACING",
  });
  seed(store, {
    scope: "DESIGN_FAMILY",
    status: "PROVISIONAL",
    confidence: "medium",
    acceptance_result: "pending",
    normalized_rule: "Maybe tighten Skills spacing later after this revision",
    design_family: "executive",
  });
  seed(store, {
    scope: "DESIGN_FAMILY",
    status: "SUPERSEDED",
    superseded_by: "fpm-newer",
    active: false,
    normalized_rule: "Old superseded sidebar gap rule",
    design_family: "executive",
  });
  seed(store, {
    scope: "DESIGN_FAMILY",
    status: "REJECTED",
    acceptance_result: "rejected",
    active: false,
    normalized_rule: "Rejected sidebar experiment",
    design_family: "executive",
  });

  const layoutPacket = [
    "Tighten Skills to Projects spacing in the sidebar",
    "Preserve the current Summary content",
    "Verify there are no overlaps",
  ];
  const ir = compileFounderFeedbackIR(layoutPacket);
  const ctx = execCtx();

  assert(
    isTaskSpecificInstruction(MM_OA_RULE) &&
      classifyMemoryLearningClass(MM_OA_RULE, mmOa) === "TASK_SPECIFIC",
    "task_specific_classifier",
    classifyMemoryLearningClass(MM_OA_RULE, mmOa),
  );
  assert(
    isDeterministicSafetyText(SAFETY_RULE) &&
      classifyMemoryLearningClass(SAFETY_RULE) === "DETERMINISTIC_SAFETY",
    "deterministic_safety_classifier",
  );

  const revSel = selectFounderMemory({
    store,
    repoRoot: root,
    channel: "revision",
    currentFounderRequests: layoutPacket,
    founderFeedbackIR: ir,
    ctx,
  });
  const genSel = selectFounderMemory({
    store,
    repoRoot: root,
    channel: "generation",
    ctx,
  });

  assert(
    !revSel.selected.some((s) => s.memory_id === mmOa.memory_id) &&
      revSel.excluded.some(
        (e) =>
          e.memory_id === mmOa.memory_id && e.learning_class === "TASK_SPECIFIC",
      ),
    "task_specific_exclusion",
    JSON.stringify(revSel.excluded.find((e) => e.memory_id === mmOa.memory_id)),
  );
  assert(
    !revSel.memory_ids.includes("fpm-6c083f5f-35f"),
    "5d933072_irrelevant_mm_oa_not_selected",
    revSel.memory_ids.join(","),
  );

  const geom = evaluateSharedGeometryAdmission(overlapCanvas());
  assert(
    geom.pass === false &&
      geom.fail_codes.includes("TEXT_OVERLAP") &&
      !revSel.selected.some((s) => /never overlap/i.test(s.injectable_text)),
    "deterministic_safety_not_required_as_preference",
    JSON.stringify({ geom: geom.fail_codes, mem: revSel.memory_ids }),
  );

  assert(
    revSel.selected.some((s) => s.memory_id === confirmedFamily.memory_id),
    "relevant_confirmed_preference_retrieved",
    revSel.selected.map((s) => s.memory_id).join(","),
  );
  assert(
    !revSel.selected.some((s) => /Modern family/i.test(s.injectable_text)),
    "irrelevant_confirmed_excluded",
  );
  assert(
    !revSel.selected.some((s) => /Maybe tighten Skills/i.test(s.injectable_text)),
    "provisional_not_reusable",
  );
  assert(
    !revSel.selected.some((s) => /Old superseded|Rejected sidebar/i.test(s.injectable_text)),
    "superseded_rejected_excluded",
  );

  const emptyRoot = mkdtempSync(join(tmpdir(), "fpm-c3-empty-"));
  mkdirSync(join(emptyRoot, "SOS/07_LOGS/saios/knowledge/founder-memory"), {
    recursive: true,
  });
  const emptySel = selectFounderMemory({
    store: new FounderPreferenceMemoryStore(emptyRoot),
    repoRoot: emptyRoot,
    channel: "generation",
    ctx,
  });
  assert(
    emptySel.FOUNDER_MEMORY_CONSUMED === false &&
      emptySel.selected.length === 0 &&
      emptySel.prompt_block === "",
    "no_eligible_memory_valid",
  );

  assert(
    genSel.selected.some((s) => s.memory_id === confirmedFamily.memory_id) &&
      revSel.selected.some((s) => s.memory_id === confirmedFamily.memory_id) &&
      genSel.taxonomy_version === revSel.taxonomy_version,
    "generation_revision_selection_agreement",
  );

  const matureTask = evaluateMemoryMaturation(mmOa, {
    revision_outcome: "SUCCESS",
    later_founder_outcome: "APPROVE",
    same_issue_persists: false,
    attribution_certain: true,
  });
  assert(
    matureTask.verdict === "KEEP_PROVISIONAL",
    "approval_does_not_globalize_task_instruction",
    matureTask.reason,
  );

  const writerRoot = mkdtempSync(join(tmpdir(), "fpm-c3-w-"));
  const parentId = "cand-c3-parent";
  const revisedId = `${parentId}-revfb-ok`;
  for (const id of [parentId, revisedId]) {
    mkdirSync(
      join(writerRoot, "SOS/07_LOGS/saios/first-production-cycle/candidates", id),
      { recursive: true },
    );
    writeFileSync(
      join(
        writerRoot,
        "SOS/07_LOGS/saios/first-production-cycle/candidates",
        id,
        "production-target.json",
      ),
      JSON.stringify({
        title: "Operations Analyst",
        category: "operations",
        role_family: "operations_analyst",
        design_family: "executive",
        architecture: "wide_header_single",
      }),
    );
  }
  const writer = new FounderPreferenceWriter(writerRoot);
  writer.writeFromDecision(
    decision({
      decision_id: "fd-c3-chg",
      review_id: "rev-c3-chg",
      decision: "CHANGES_REQUESTED",
      requested_changes: [MM_OA_RULE],
      structured_feedback: { candidate_id: parentId },
    }),
  );
  const afterApprove = writer.writeFromDecision(
    decision({
      decision_id: "fd-c3-apr",
      review_id: "rev-c3-apr",
      decision: "APPROVED",
      reason: "Looks fine",
      structured_feedback: { candidate_id: revisedId },
    }),
  );
  assert(
    !afterApprove.written.some(
      (r) =>
        r.status === "CONFIRMED" &&
        r.signal_type !== "POSITIVE_EXEMPLAR" &&
        /Marketing Manager/i.test(r.normalized_rule),
    ),
    "writer_approve_does_not_confirm_task_specific",
    afterApprove.written.map((r) => `${r.status}:${r.normalized_rule}`).join(" | "),
  );

  assert(
    revSel.selected.every((s) => Boolean(s.learning_class && s.selection_why)) &&
      revSel.excluded.some((e) => Boolean(e.learning_class && e.reason)),
    "memory_selection_evidence_explains_why",
  );

  const irStill = compileFounderFeedbackIR(layoutPacket);
  assert(
    irStill.schema_version.startsWith("founder-feedback-ir-") &&
      irStill.completeness_sections.length === 0,
    "c1_ir_unaffected",
  );

  const validCanvas: FabricCanvasDoc = {
    version: "5.3.0",
    width: 794,
    height: 1123,
    objects: [
      {
        type: "textbox",
        id: "ok",
        left: 48,
        top: 40,
        width: 400,
        height: 24,
        text: "Jane Example",
        data: { section: "header" },
      },
    ],
  };
  const validGeom = evaluateSharedGeometryAdmission(validCanvas);
  assert(validGeom.pass === true, "c2_valid_geometry_still_passes");
  assert(geom.pass === false, "c2_invalid_geometry_still_fails");

  rmSync(root, { recursive: true, force: true });
  rmSync(emptyRoot, { recursive: true, force: true });
  rmSync(writerRoot, { recursive: true, force: true });

  const failed = checks.filter((c) => !c.pass);
  const report = {
    schema_version: "memory-selection-discipline-c3-verify-1.0.0",
    at: new Date().toISOString(),
    pass: failed.length === 0,
    checks,
    failed: failed.map((c) => c.name),
    production_openai_called: false,
    historical_memory_deleted: false,
    live: false,
  };
  mkdirSync(join(REPO, "SOS/07_LOGS/saios/founder-memory"), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(failed.length === 0 ? "\nC3 VERIFY PASS" : "\nC3 VERIFY FAIL");
  if (failed.length) process.exit(1);
}

main();
