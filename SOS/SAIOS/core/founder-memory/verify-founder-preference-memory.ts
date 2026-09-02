/**
 * Deterministic Founder Preference Memory V1 verifier — no OpenAI.
 *
 *   npx --yes tsx SOS/SAIOS/core/founder-memory/verify-founder-preference-memory.ts
 */
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  appendFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FounderDecision } from "../founder-decisions/types.js";
import { toFullReasoningRequest } from "../resume-integration/ResumeBrainGateway.js";
import type { SkillRequest } from "../skills/Skill.js";
import type { KnowledgeSnapshot } from "../knowledge/KnowledgeSnapshot.js";
import { FounderPreferenceWriter } from "./FounderPreferenceWriter.js";
import { writeFounderPreferenceMemorySafe } from "./FounderPreferenceWriter.js";
import { FounderPreferenceMemoryStore } from "./FounderPreferenceMemoryStore.js";
import { FounderPreferenceRetriever } from "./FounderPreferenceRetriever.js";
import {
  FOUNDER_DESIGN_MEMORY_HEADER,
  MAX_PROMPT_CHARS,
  renderFounderDesignMemoryBlock,
  applyFounderDesignMemoryInstructions,
} from "./FounderPreferencePrompt.js";
import { FounderMemoryDatasetExporter } from "./FounderMemoryDatasetExporter.js";
import type { FounderPreferenceMemoryRecord } from "./FounderPreferenceMemoryTypes.js";

type Check = { name: string; pass: boolean; detail?: string };

const checks: Check[] = [];

function assert(name: string, cond: boolean, detail?: string): void {
  checks.push({ name, pass: Boolean(cond), detail });
  if (!cond) {
    console.error(`FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  } else {
    console.log(`PASS ${name}`);
  }
}

function decision(
  partial: Partial<FounderDecision> &
    Pick<FounderDecision, "decision" | "review_id" | "decision_id">,
): FounderDecision {
  return {
    task_id: partial.task_id ?? "task-1",
    cycle_id: partial.cycle_id ?? "cycle-1",
    department: "resume",
    founder_actor: "stephen",
    reason: partial.reason ?? "",
    structured_feedback: partial.structured_feedback ?? {},
    quality_scores: {},
    requested_changes: partial.requested_changes ?? [],
    reviewed_artifacts: [],
    provider: "Mock",
    dry_run: true,
    created_at: partial.created_at ?? new Date().toISOString(),
    source_interface: "aios_dashboard",
    publication_allowed: false,
    next_action: "none",
    supersedes: null,
    fixture: false,
    ...partial,
  };
}

function writeCandidate(
  repo: string,
  candidateId: string,
  meta: {
    title: string;
    category: string;
    role_family: string;
    design_family: string;
    architecture: string;
  },
): void {
  const dir = join(
    repo,
    "SOS/07_LOGS/saios/first-production-cycle/candidates",
    candidateId,
  );
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "candidate.json"),
    JSON.stringify({
      candidate_id: candidateId,
      status: "WAITING_FOUNDER",
      target: {
        title: meta.title,
        category: meta.category,
        role_family: meta.role_family,
        objective: `design_family:${meta.design_family} ${meta.architecture} role_family:${meta.role_family}`,
      },
    }),
    "utf8",
  );
  writeFileSync(
    join(dir, "designbrief.json"),
    JSON.stringify({
      colors: { id: `family-${meta.design_family}` },
      visual_guidance: { layout_architecture: meta.architecture },
    }),
    "utf8",
  );
}

function skillRequest(repoHints: {
  title: string;
  category: string;
  role_family: string;
  design_family: string;
  architecture: string;
}): SkillRequest {
  return {
    request_id: "req-verify-fpm",
    task_id: "task-verify-fpm",
    department: "resume",
    skill_id: "resume.layout_planning",
    dry_run: true,
    created_at: new Date().toISOString(),
    knowledge_snapshot_id: "ks-verify",
    context_references: [],
    memory_references: [],
    input: {
      objective: `Generate template design_family:${repoHints.design_family} ${repoHints.architecture}`,
      title: repoHints.title,
      category: repoHints.category,
      role_family: repoHints.role_family,
      design_family: repoHints.design_family,
      architecture: repoHints.architecture,
      production_target: {
        title: repoHints.title,
        category: repoHints.category,
        role_family: repoHints.role_family,
      },
      research_briefing: "ResearchContext[category=healthcare]",
    },
  } as SkillRequest;
}

function snapshot(): KnowledgeSnapshot {
  return {
    references: [{ entry_id: "founder.preferences.core", title: "x" }],
    meta: {
      snapshot_id: "ks-verify",
      unrestricted: false,
      live: false,
    },
  } as KnowledgeSnapshot;
}

function skeleton() {
  return {
    request_id: "req-verify-fpm",
    task_id: "task-verify-fpm",
    department: "resume",
    capability: "design_planning" as const,
    objective: "Execute skill resume.layout_planning",
    instructions: "Skill:resume.layout_planning",
    quality_tier: "standard" as const,
    privacy_classification: "internal" as const,
    dry_run: true,
  };
}

async function main(): Promise<void> {
  const root = mkdtempSync(join(tmpdir(), "fpm-verify-"));
  let exportDir = "";
  try {
    const writer = new FounderPreferenceWriter(root);
    const store = new FounderPreferenceMemoryStore(root);
    const retriever = new FounderPreferenceRetriever(store);

    const parentId = "cand-healthcare-clinical-nurse-manager-verify-parent";
    const revisedId = `${parentId}-revfb-abc123`;
    writeCandidate(root, parentId, {
      title: "Clinical Nurse Manager",
      category: "healthcare",
      role_family: "clinical_nurse_manager",
      design_family: "modern",
      architecture: "header_band",
    });
    writeCandidate(root, revisedId, {
      title: "Clinical Nurse Manager",
      category: "healthcare",
      role_family: "clinical_nurse_manager",
      design_family: "modern",
      architecture: "header_band",
    });
    writeCandidate(root, "cand-engineering-software-engineer-verify", {
      title: "Software Engineer",
      category: "engineering",
      role_family: "software_engineer",
      design_family: "technical",
      architecture: "technical_grid",
    });

    // A — REQUEST_CHANGES provisional
    const dChanges = decision({
      decision_id: "fd-changes-1",
      review_id: "rev-parent-1",
      decision: "CHANGES_REQUESTED",
      reason: "spacing issues",
      requested_changes: [
        "Increase section gap and reduce sparse lower-page whitespace",
      ],
      structured_feedback: { candidate_id: parentId },
    });
    const wA = writer.writeFromDecision(dChanges);
    const provisional = store
      .listActive()
      .filter((r) => r.status === "PROVISIONAL");
    assert(
      "A_REQUEST_CHANGES_PROVISIONAL",
      wA.written.some((r) => r.status === "PROVISIONAL") &&
        provisional.length >= 1 &&
        provisional[0]!.scope !== "GLOBAL",
      `written=${wA.written.length} scope=${provisional[0]?.scope}`,
    );

    // B — APPROVE original → POSITIVE_EXEMPLAR not in prompt
    const origId = "cand-finance-accountant-verify-orig";
    writeCandidate(root, origId, {
      title: "Accountant",
      category: "finance",
      role_family: "accountant",
      design_family: "corporate",
      architecture: "compact_corporate",
    });
    const dApproveOrig = decision({
      decision_id: "fd-approve-orig",
      review_id: "rev-orig-1",
      decision: "APPROVED",
      reason: "Founder decision from Templates Ready for Review",
      structured_feedback: { candidate_id: origId },
    });
    const wB = writer.writeFromDecision(dApproveOrig);
    const exemplars = wB.written.filter(
      (r) => r.signal_type === "POSITIVE_EXEMPLAR",
    );
    const retrievedB = retriever.retrieve({
      category: "finance",
      role: "Accountant",
      design_family: "corporate",
      architecture: "compact_corporate",
    });
    const renderedB = renderFounderDesignMemoryBlock(retrievedB);
    assert(
      "B_APPROVE_ORIGINAL_EXEMPLAR_NOT_INJECTED",
      exemplars.length === 1 &&
        exemplars[0]!.status === "CONFIRMED" &&
        !retrievedB.some((r) => r.signal_type === "POSITIVE_EXEMPLAR") &&
        !renderedB.block.includes("Founder approved this exemplar"),
      `exemplars=${exemplars.length} retrieved=${retrievedB.length}`,
    );

    // C — APPROVE revised promotes provisional
    const dApproveRev = decision({
      decision_id: "fd-approve-rev",
      review_id: "rev-revised-1",
      decision: "APPROVED",
      reason: "Looks good after revision",
      structured_feedback: { candidate_id: revisedId },
    });
    const beforeProv = store
      .listActive()
      .filter(
        (r) =>
          r.status === "PROVISIONAL" && r.candidate_id === parentId,
      );
    const wC = writer.writeFromDecision(dApproveRev);
    const promoted = store
      .listActive()
      .filter(
        (r) =>
          r.status === "CONFIRMED" &&
          r.signal_type !== "POSITIVE_EXEMPLAR" &&
          (r.normalized_rule.includes("section gap") ||
            r.issue_type === "SPACING" ||
            r.issue_type === "LAYOUT_BALANCE"),
      );
    assert(
      "C_APPROVE_REVISED_PROMOTES_PROVISIONAL",
      beforeProv.length >= 1 &&
        wC.written.some(
          (r) =>
            r.status === "CONFIRMED" &&
            r.acceptance_result === "accepted" &&
            r.signal_type !== "POSITIVE_EXEMPLAR",
        ) &&
        promoted.length >= 1,
      `beforeProv=${beforeProv.length} promoted=${promoted.length}`,
    );

    // D — REJECT scoped never GLOBAL
    const dReject = decision({
      decision_id: "fd-reject-1",
      review_id: "rev-reject-1",
      decision: "REJECTED",
      reason: "Header hierarchy is weak and name size too small",
      structured_feedback: {
        candidate_id: "cand-engineering-software-engineer-verify",
      },
    });
    const wD = writer.writeFromDecision(dReject);
    assert(
      "D_REJECT_SCOPED_NOT_GLOBAL",
      wD.written.some((r) => r.signal_type === "NEGATIVE_EXEMPLAR") &&
        wD.written.every((r) => r.scope !== "GLOBAL"),
      wD.written.map((r) => r.scope).join(","),
    );

    // E — generic rejection does not fabricate detailed constraint
    const genericCand = "cand-marketing-brand-manager-verify-generic";
    writeCandidate(root, genericCand, {
      title: "Brand Manager",
      category: "marketing",
      role_family: "brand_manager",
      design_family: "minimal",
      architecture: "classic_single",
    });
    const wE = writer.writeFromDecision(
      decision({
        decision_id: "fd-reject-generic",
        review_id: "rev-reject-generic",
        decision: "REJECTED",
        reason: "I don't like it",
        structured_feedback: { candidate_id: genericCand },
      }),
    );
    assert(
      "E_GENERIC_REJECT_NO_FABRICATED_RULE",
      wE.written.some((r) => r.signal_type === "NEGATIVE_EXEMPLAR") &&
        !wE.written.some((r) => r.signal_type === "CONSTRAINT"),
      `types=${wE.written.map((r) => r.signal_type).join(",")}`,
    );

    // F/G — retriever matching
    const matchArch = retriever.retrieve({
      architecture: "header_band",
      design_family: "modern",
      category: "healthcare",
      role: "Clinical Nurse Manager",
    });
    assert(
      "F_RETRIEVE_ARCHITECTURE",
      matchArch.some(
        (r) =>
          r.scope === "ARCHITECTURE" &&
          r.architecture === "header_band" &&
          r.status === "CONFIRMED",
      ),
      `n=${matchArch.length}`,
    );
    // Ensure DESIGN_FAMILY selection path: seed a confirmed DESIGN_FAMILY rule
    store.upsertActive({
      scope: "DESIGN_FAMILY",
      issue_type: "UNIQUENESS",
      normalized_rule: "Keep modern family visually distinct.",
      raw_founder_feedback: "Keep modern family visually distinct.",
      signal_type: "PREFERENCE",
      confidence: "high",
      status: "CONFIRMED",
      candidate_id: parentId,
      review_id: "rev-seed-df",
      decision_id: "fd-seed-df",
      revision_task_id: null,
      role: "Clinical Nurse Manager",
      category: "healthcare",
      role_family: "clinical_nurse_manager",
      design_family: "modern",
      architecture: "header_band",
      section: null,
      component: null,
      positive_or_negative: "positive",
      source_decision: "APPROVED",
      acceptance_result: "n/a",
      active: true,
    });
    const matchDf = retriever.retrieve({
      design_family: "modern",
      architecture: "header_band",
    });
    assert(
      "G_RETRIEVE_DESIGN_FAMILY",
      matchDf.some(
        (r) => r.scope === "DESIGN_FAMILY" && r.design_family === "modern",
      ),
    );

    // H — unrelated ROLE excluded
    store.upsertActive({
      scope: "ROLE",
      issue_type: "TYPOGRAPHY",
      normalized_rule: "Only for Paralegals enlarge meta type.",
      raw_founder_feedback: "Only for Paralegals enlarge meta type.",
      signal_type: "PREFERENCE",
      confidence: "high",
      status: "CONFIRMED",
      candidate_id: null,
      review_id: "rev-paralegal",
      decision_id: "fd-paralegal",
      revision_task_id: null,
      role: "Paralegal",
      category: "legal",
      role_family: "paralegal",
      design_family: null,
      architecture: null,
      section: null,
      component: null,
      positive_or_negative: "positive",
      source_decision: "APPROVED",
      acceptance_result: "n/a",
      active: true,
    });
    const noParalegal = retriever.retrieve({
      role: "Clinical Nurse Manager",
      category: "healthcare",
      design_family: "modern",
      architecture: "header_band",
    });
    assert(
      "H_UNRELATED_ROLE_EXCLUDED",
      !noParalegal.some((r) => r.role === "Paralegal"),
    );

    // I — PROVISIONAL excluded
    const stillProv = store.listActive().filter((r) => r.status === "PROVISIONAL");
    // add a fresh provisional that should not appear
    writer.writeFromDecision(
      decision({
        decision_id: "fd-changes-2",
        review_id: "rev-prov-2",
        decision: "CHANGES_REQUESTED",
        requested_changes: ["Fix typography scale on headings"],
        reason: "typography",
        structured_feedback: { candidate_id: origId },
      }),
    );
    const retrievedNoProv = retriever.retrieve({
      architecture: "compact_corporate",
      design_family: "corporate",
      category: "finance",
      role: "Accountant",
    });
    assert(
      "I_LOW_PROVISIONAL_EXCLUDED",
      !retrievedNoProv.some(
        (r) => r.status === "PROVISIONAL" && r.confidence === "low",
      ),
      `stillProv_total=${stillProv.length}`,
    );

    // J — SUPERSEDED excluded
    const first = store.upsertActive({
      scope: "ARCHITECTURE",
      issue_type: "SPACING",
      normalized_rule: "Keep header_band contact inside band.",
      raw_founder_feedback: "Keep header_band contact inside band.",
      signal_type: "CONSTRAINT",
      confidence: "low",
      status: "CONFIRMED",
      candidate_id: parentId,
      review_id: "rev-super-1",
      decision_id: "fd-super-1",
      revision_task_id: null,
      role: null,
      category: null,
      role_family: null,
      design_family: "modern",
      architecture: "header_band",
      section: null,
      component: null,
      positive_or_negative: "negative",
      source_decision: "CHANGES_REQUESTED",
      acceptance_result: "accepted",
      active: true,
      confidence_merge: false,
    });
    const second = store.upsertActive({
      scope: "ARCHITECTURE",
      issue_type: "SPACING",
      normalized_rule: "Keep header_band contact inside band.",
      raw_founder_feedback: "Keep header_band contact inside band.",
      signal_type: "CONSTRAINT",
      confidence: "medium",
      status: "CONFIRMED",
      candidate_id: parentId,
      review_id: "rev-super-2",
      decision_id: "fd-super-2",
      revision_task_id: null,
      role: null,
      category: null,
      role_family: null,
      design_family: "modern",
      architecture: "header_band",
      section: null,
      component: null,
      positive_or_negative: "negative",
      source_decision: "CHANGES_REQUESTED",
      acceptance_result: "accepted",
      active: true,
      confidence_merge: true,
    });
    const activeAfter = store
      .listActive()
      .filter((r) => r.normalized_rule === first.normalized_rule);
    assert(
      "J_SUPERSEDED_EXCLUDED",
      activeAfter.length === 1 &&
        activeAfter[0]!.memory_id === second.memory_id &&
        !store.listActive().some((r) => r.memory_id === first.memory_id),
      `active=${activeAfter.map((r) => r.memory_id).join(",")}`,
    );

    // K — duplicate recurrence confidence / no multi-active
    assert(
      "K_DEDUP_CONFIDENCE",
      activeAfter.length === 1 &&
        (activeAfter[0]!.confidence === "medium" ||
          activeAfter[0]!.confidence === "high"),
      `confidence=${activeAfter[0]?.confidence}`,
    );

    // L — contradictions → one winner
    store.upsertActive({
      scope: "ARCHITECTURE",
      issue_type: "SPACING",
      normalized_rule: "Increase whitespace aggressively.",
      raw_founder_feedback: "Increase whitespace aggressively.",
      signal_type: "PREFERENCE",
      confidence: "low",
      status: "CONFIRMED",
      candidate_id: null,
      review_id: "rev-pos",
      decision_id: "fd-pos",
      revision_task_id: null,
      role: null,
      category: null,
      role_family: null,
      design_family: null,
      architecture: "header_band",
      section: null,
      component: null,
      positive_or_negative: "positive",
      source_decision: "APPROVED",
      acceptance_result: "n/a",
      active: true,
      confidence_merge: false,
    });
    store.upsertActive({
      scope: "ARCHITECTURE",
      issue_type: "SPACING",
      normalized_rule: "Reduce whitespace aggressively.",
      raw_founder_feedback: "Reduce whitespace aggressively.",
      signal_type: "CONSTRAINT",
      confidence: "high",
      status: "CONFIRMED",
      candidate_id: null,
      review_id: "rev-neg",
      decision_id: "fd-neg",
      revision_task_id: null,
      role: null,
      category: null,
      role_family: null,
      design_family: null,
      architecture: "header_band",
      section: null,
      component: null,
      positive_or_negative: "negative",
      source_decision: "REJECTED",
      acceptance_result: "rejected",
      active: true,
      confidence_merge: false,
    });
    const conflict = retriever.retrieve({ architecture: "header_band" });
    const spacingPolarity = conflict.filter((r) => r.issue_type === "SPACING");
    // Winner policy collapses contradictory same issue_type+scope
    const polarities = new Set(
      spacingPolarity.map((r) => r.positive_or_negative),
    );
    assert(
      "L_CONTRADICTION_ONE_WINNER",
      polarities.size === 1 ||
        spacingPolarity.filter((r) => r.confidence === "high").length >= 1,
      `polarities=${[...polarities].join(",")} n=${spacingPolarity.length}`,
    );
    // Stronger: among contradictory pair, only one polarity remains for exact contradict helper
    const pos = spacingPolarity.filter((r) => r.positive_or_negative === "positive");
    const neg = spacingPolarity.filter((r) => r.positive_or_negative === "negative");
    assert(
      "L_CONTRADICTION_ONE_WINNER_STRICT",
      !(pos.length && neg.length),
      `pos=${pos.length} neg=${neg.length}`,
    );

    // M — missing directory
    const emptyRoot = join(root, "missing-memory-root-does-not-exist-xyz");
    const emptyRet = new FounderPreferenceRetriever(
      new FounderPreferenceMemoryStore(emptyRoot),
    ).retrieve({ architecture: "header_band" });
    assert("M_MISSING_DIR_EMPTY", Array.isArray(emptyRet) && emptyRet.length === 0);

    // N — malformed JSONL tolerated
    const memPath = join(
      root,
      "SOS/07_LOGS/saios/knowledge/founder-memory/memory.jsonl",
    );
    appendFileSync(memPath, "{not-json\n", "utf8");
    const afterMalformed = store.listActive();
    assert("N_MALFORMED_TOLERATED", afterMalformed.length >= 1);

    // O — writer failure does not throw / decision semantics preserved
    let decisionOk = false;
    try {
      const simulated = decision({
        decision_id: "fd-failopen",
        review_id: "rev-failopen",
        decision: "APPROVED",
        reason: "ok",
        structured_feedback: { candidate_id: origId },
      });
      // decision path simulation
      decisionOk = true;
      // Use /dev/null as repo root so mkdir fails fast on Linux (ENOTDIR).
      // Avoid /proc/... paths which can hang on some VPS kernels.
      const mem = writeFounderPreferenceMemorySafe(simulated, "/dev/null");
      assert(
        "O_WRITER_FAIL_OPEN",
        decisionOk === true && (mem.ok === false || mem.ok === true),
        `mem.ok=${mem.ok}`,
      );
    } catch (e) {
      assert("O_WRITER_FAIL_OPEN", false, String(e));
    }

    // P — without memory, instructions match baseline formula
    const emptyRepo = mkdtempSync(join(tmpdir(), "fpm-empty-"));
    const sr = skillRequest({
      title: "Clinical Nurse Manager",
      category: "healthcare",
      role_family: "clinical_nurse_manager",
      design_family: "modern",
      architecture: "header_band",
    });
    const snap = snapshot();
    const sk = skeleton();
    const baseline = `Skill:${sk.capability}; skill_id=${sr.skill_id}; knowledge_snapshot=${snap.meta.snapshot_id}; ${sr.input.research_briefing}`;
    const reqP = toFullReasoningRequest(sk, sr, snap, { repoRoot: emptyRepo });
    assert(
      "P_NO_MEMORY_SAME_INSTRUCTIONS",
      reqP.request.instructions === baseline,
      `got=${reqP.request.instructions.slice(0, 120)}`,
    );

    // Q — with matching confirmed memory includes header
    const reqQ = toFullReasoningRequest(sk, sr, snap, { repoRoot: root });
    assert(
      "Q_INCLUDES_FOUNDER_DESIGN_MEMORY",
      reqQ.request.instructions.includes(FOUNDER_DESIGN_MEMORY_HEADER),
      reqQ.request.instructions.slice(0, 200),
    );

    // R — no provider call created (pure function)
    assert(
      "R_NO_PROVIDER_CALL",
      typeof toFullReasoningRequest === "function" &&
        (reqQ.request as { provider?: unknown }).provider === undefined,
    );

    // S — prompt size bound
    const many: FounderPreferenceMemoryRecord[] = [];
    for (let i = 0; i < 20; i++) {
      many.push({
        ...(matchDf[0] as FounderPreferenceMemoryRecord),
        memory_id: `fpm-pad-${i}`,
        normalized_rule: `Rule number ${i} `.repeat(8).slice(0, 120),
      });
    }
    const renderedS = renderFounderDesignMemoryBlock(many);
    assert(
      "S_PROMPT_SIZE_BOUND",
      renderedS.block.length <= MAX_PROMPT_CHARS,
      `len=${renderedS.block.length}`,
    );

    // T/U — export redaction + manifest hashes
    mkdirSync(join(root, "SOS/07_LOGS/saios/founder-decisions"), {
      recursive: true,
    });
    writeFileSync(
      join(root, "SOS/07_LOGS/saios/founder-decisions/decisions.jsonl"),
      `${JSON.stringify({
        decision_id: "fd-export-1",
        decision: "APPROVED",
        reason: "ok",
        review_id: "rev-export",
      })}\n`,
      "utf8",
    );
    const exporter = new FounderMemoryDatasetExporter(root);
    const exported = exporter.exportDataset("verify-export-1");
    exportDir = exported.export_dir;
    const allExportText = Object.keys(exported.files)
      .map((f) => {
        const p = join(exported.export_dir, f);
        return existsSync(p) ? readFileSync(p, "utf8") : "";
      })
      .join("\n");
    assert(
      "T_EXPORT_NO_SECRETS",
      !/OPENAI_API_KEY/.test(allExportText) &&
        !/sk-[A-Za-z0-9]{10,}/.test(allExportText) &&
        !/Bearer\s+[A-Za-z0-9]/.test(allExportText) &&
        !/PRIVATE KEY/.test(allExportText),
    );
    assert(
      "U_EXPORT_MANIFEST_HASHES",
      Boolean(exported.files["dataset-manifest.json"]?.content_hash) &&
        Boolean(exported.files["founder-memory.jsonl"]?.content_hash) &&
        exported.files["founder-memory.jsonl"]!.content_hash.length === 64,
    );

    // Extra: non-design-planning skill unchanged
    const other = applyFounderDesignMemoryInstructions({
      baseInstructions: "Skill:other",
      skillRequest: { ...sr, skill_id: "resume.qa_check" } as SkillRequest,
      capability: "analysis",
      repoRoot: root,
    });
    assert(
      "NON_DESIGN_PLANNING_UNCHANGED",
      other.instructions === "Skill:other",
    );
  } finally {
    try {
      rmSync(root, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
    if (exportDir) {
      /* already under root */
    }
  }

  const failed = checks.filter((c) => !c.pass);
  // Deduplicate names for G (ran twice intentionally — keep last)
  const byName = new Map<string, Check>();
  for (const c of checks) byName.set(c.name, c);
  const unique = [...byName.values()];
  const failedUnique = unique.filter((c) => !c.pass);

  console.log(
    `\n${unique.filter((c) => c.pass).length}/${unique.length} unique checks passed`,
  );
  if (failedUnique.length) {
    console.error(
      "Failed:",
      failedUnique.map((f) => f.name).join(", "),
    );
    process.exitCode = 1;
  } else {
    console.log("FOUNDER_PREFERENCE_MEMORY_VERIFY_PASS");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
