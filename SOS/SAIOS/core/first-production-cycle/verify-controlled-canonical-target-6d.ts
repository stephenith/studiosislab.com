/**
 * Phase 6D — Controlled canonical target proof path.
 * Deterministic / no-network. Does not run production OpenAI or live generation.
 */
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  CONFIRMED_MEMORY_DESIGN_FAMILIES,
  CONFIRMED_MEMORY_RULE_BY_FAMILY,
  listCanonicalTaxonomyEntries,
  naturalDesignForCanonicalTarget,
  recommendControlledProofTarget,
  resolveCanonicalProductionTarget,
} from "./CanonicalTargetResolver.js";
import {
  DEFAULT_BATCH_SIZE,
  DEFAULT_MAX_OPENAI_PER_BATCH,
  DEFAULT_QUEUE_MAX,
} from "./BatchRunner.js";
import { planControllerExecution } from "./ControllerCliPlan.js";
import { runProduction } from "./ProductionController.js";
import { CYCLE_LOG } from "./runFirstProductionCycle.js";
import { countFounderReviewWaiting } from "../founder-review/FounderReviewProjection.js";
import { FounderPreferenceMemoryStore } from "../founder-memory/FounderPreferenceMemoryStore.js";
import { selectFounderMemory } from "../founder-memory/FounderMemoryConsumption.js";
import { toSelectionContext } from "../founder-memory/FounderMemoryContext.js";
import { evaluateRoleTargetIntegrity } from "../role-integrity/RoleTargetIntegrity.js";
import type { FounderPreferenceMemoryRecord } from "../founder-memory/FounderPreferenceMemoryTypes.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(CYCLE_LOG, "controlled-canonical-target-6d-verify.json");
const RUN_CONTROLLER = join(import.meta.dirname, "run-controller.ts");
const RUN_AUTONOMOUS = join(import.meta.dirname, "run-autonomous.ts");
const AUTONOMOUS_SVC = join(
  import.meta.dirname,
  "AutonomousProductionService.ts",
);

function assert(name: string, cond: boolean, detail = ""): void {
  if (!cond) throw new Error(`FAIL ${name}${detail ? `: ${detail}` : ""}`);
  console.log(`✔ ${name}`);
}

function forceMockEnv(): void {
  delete process.env.SOS_AI_FOUNDER_OPENAI_ONE_TEST;
  delete process.env.OPENAI_API_KEY;
  delete process.env.SOS_OPENAI_API_KEY;
  process.env.SOS_AIOS_LIVE = "0";
}

function seedFamilyRule(
  store: FounderPreferenceMemoryStore,
  design_family: string,
  architecture: string,
): FounderPreferenceMemoryRecord {
  return store.upsertActive({
    issue_type: "SPACING",
    raw_founder_feedback: `Keep ${design_family} spacing compact and premium.`,
    normalized_rule: `Keep ${design_family} spacing compact and premium.`,
    signal_type: "CONSTRAINT",
    confidence: "high",
    status: "CONFIRMED",
    candidate_id: "cand-6d-1",
    review_id: "rev-6d-1",
    decision_id: "fd-6d-1",
    revision_task_id: null,
    role: null,
    category: null,
    role_family: null,
    design_family,
    architecture,
    section: null,
    component: null,
    positive_or_negative: "negative",
    source_decision: "CHANGES_REQUESTED",
    acceptance_result: "accepted",
    active: true,
    confidence_merge: false,
    scope: "DESIGN_FAMILY",
  });
}

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

async function main(): Promise<void> {
  forceMockEnv();
  mkdirSync(CYCLE_LOG, { recursive: true });
  const waiting = countFounderReviewWaiting(REPO);
  const queueMax = Math.max(waiting + 10, 50);

  // A. valid canonical target
  const byId = resolveCanonicalProductionTarget(
    "executive:chief-marketing-officer",
  );
  assert("A_valid_id", byId.ok && byId.entry.id === "executive:chief-marketing-officer");
  const byTitle = resolveCanonicalProductionTarget("Chief Marketing Officer");
  assert(
    "A_valid_title",
    byTitle.ok && byTitle.entry.id === "executive:chief-marketing-officer",
  );
  const bySlug = resolveCanonicalProductionTarget("chief-marketing-officer");
  assert(
    "A_valid_slug",
    bySlug.ok && bySlug.entry.id === "executive:chief-marketing-officer",
  );
  const byRole = resolveCanonicalProductionTarget("chief_marketing_officer");
  assert(
    "A_valid_role_family",
    byRole.ok && byRole.entry.id === "executive:chief-marketing-officer",
  );

  // B. unknown target
  const unknown = resolveCanonicalProductionTarget("astronaut-in-chief");
  assert("B_unknown", !unknown.ok && unknown.reason === "unknown");
  const unknownPlan = planControllerExecution([
    "--target",
    "astronaut-in-chief",
  ]);
  assert(
    "B_unknown_before_provider",
    !unknownPlan.ok && unknownPlan.code === "unknown",
  );

  // C. ambiguous
  const amb = resolveCanonicalProductionTarget("executive");
  assert("C_ambiguous_category", !amb.ok && amb.reason === "ambiguous");
  const ambPlan = planControllerExecution(["--target", "executive"]);
  assert("C_ambiguous_cli", !ambPlan.ok && ambPlan.code === "ambiguous");

  const pinPlan = planControllerExecution([
    "--target",
    "executive:chief-marketing-officer",
    "--design-family",
    "editorial",
  ]);
  assert("C_design_family_flag_rejected", !pinPlan.ok && pinPlan.code === "design_pin_rejected");

  const mockCombo = planControllerExecution([
    "--target",
    "executive:chief-marketing-officer",
    "--mock",
  ]);
  assert("C_target_plus_mock_rejected", !mockCombo.ok && mockCombo.code === "invalid_combo");

  const sizeCombo = planControllerExecution([
    "--target",
    "executive:chief-marketing-officer",
    "--size",
    "3",
  ]);
  assert("C_target_plus_size3_rejected", !sizeCombo.ok && sizeCombo.code === "invalid_size");

  // D + E. Family Engine / memory selector remain natural
  const cmo = byId.ok ? byId.target : null;
  assert("D_cmo_target", Boolean(cmo));
  const natural = naturalDesignForCanonicalTarget(cmo!);
  assert(
    "D_family_engine_independent",
    Boolean(natural.design_family) && Boolean(natural.architecture),
  );
  assert(
    "D_family_not_from_cli",
    natural.design_family !== "forced" &&
      CONFIRMED_MEMORY_DESIGN_FAMILIES.has(natural.design_family ?? ""),
  );

  const fixtureRoot = mkdtempSync(join(tmpdir(), "fpm-6d-"));
  mkdirSync(join(fixtureRoot, "SOS/07_LOGS/saios/knowledge/founder-memory"), {
    recursive: true,
  });
  const store = new FounderPreferenceMemoryStore(fixtureRoot);
  const fixtureRule = seedFamilyRule(
    store,
    natural.design_family!,
    natural.architecture!,
  );
  const memSel = selectFounderMemory({
    store,
    repoRoot: fixtureRoot,
    channel: "generation",
    ctx: toSelectionContext({
      ...natural,
      role: cmo!.title,
      role_family: cmo!.role_family,
      category: cmo!.category,
    }),
  });
  assert(
    "E_memory_selector_natural_context",
    memSel.context.design_family === natural.design_family &&
      memSel.context.architecture === natural.architecture,
  );
  assert(
    "E_selected_memory_count",
    memSel.FOUNDER_MEMORY_CONSUMED && memSel.selected.length >= 1,
    `selected=${memSel.selected.length}`,
  );

  // F. Phase 6A still active
  const roleOk = evaluateRoleTargetIntegrity({
    target_title: "Chief Marketing Officer",
    target_role_family: "chief_marketing_officer",
    structured_role: "Chief Marketing Officer",
    rendered_role: "Chief Marketing Officer",
  });
  const roleBad = evaluateRoleTargetIntegrity({
    target_title: "Operations Analyst",
    target_role_family: "operations_analyst",
    structured_role: "Marketing Manager",
    rendered_role: "Marketing Manager",
    content_source: "deterministic_pack",
    pack_family: "marketing_manager",
  });
  assert("F_role_integrity_match_still_passes", roleOk.pass);
  assert("F_role_integrity_mismatch_still_fails", !roleBad.pass);

  // G. default no-target invocation
  const defaultPlan = planControllerExecution(["--size", "1"]);
  assert("G_default_ok", defaultPlan.ok && defaultPlan.mode === "default");
  if (defaultPlan.ok) {
    assert("G_select_target_true", defaultPlan.production.select_target === true);
    assert(
      "G_no_forced_targets",
      defaultPlan.production.forced_targets == null,
    );
    assert("G_batch_size_1", defaultPlan.production.batch_size === 1);
    assert(
      "G_target_selection_natural",
      defaultPlan.target_selection === "natural_strategy",
    );
  }
  const defaultBare = planControllerExecution([]);
  assert(
    "G_bare_default_size",
    defaultBare.ok && defaultBare.production.batch_size === DEFAULT_BATCH_SIZE,
  );
  assert(
    "G_bare_queue_max",
    defaultBare.ok && defaultBare.production.queue_max === DEFAULT_QUEUE_MAX,
  );
  assert(
    "G_bare_max_openai",
    defaultBare.ok &&
      defaultBare.production.max_openai_per_batch ===
        DEFAULT_MAX_OPENAI_PER_BATCH,
  );
  assert(
    "G_bare_select_target",
    defaultBare.ok && defaultBare.production.select_target === true,
  );

  // H. autonomous unchanged
  const autoCli = readFileSync(RUN_AUTONOMOUS, "utf8");
  const autoSvc = readFileSync(AUTONOMOUS_SVC, "utf8");
  const ctrlCli = readFileSync(RUN_CONTROLLER, "utf8");
  assert("H_autonomous_cli_no_target_flag", !/--target/.test(autoCli));
  assert(
    "H_autonomous_no_forced_targets_default",
    !/forced_targets/.test(autoSvc),
  );
  assert(
    "H_autonomous_select_target_default",
    /select_target:\s*this\.opts\.select_target !== false/.test(autoSvc),
  );
  assert("H_controller_uses_runProduction", /runProduction\(/.test(ctrlCli));
  assert(
    "H_controller_no_direct_batchrunner",
    !/runCanonicalBatch/.test(ctrlCli),
  );

  const controlledPlan = planControllerExecution([
    "--target",
    "executive:chief-marketing-officer",
  ]);
  assert("H_controlled_ok", controlledPlan.ok && controlledPlan.mode === "controlled");
  if (controlledPlan.ok) {
    assert("H_controlled_select_target_false", controlledPlan.production.select_target === false);
    assert("H_controlled_size_1", controlledPlan.production.batch_size === 1);
    assert("H_controlled_max_attempts_1", controlledPlan.production.max_attempts === 1);
    assert("H_controlled_not_mock", controlledPlan.production.force_mock === false);
    assert(
      "H_controlled_forced_one",
      controlledPlan.production.forced_targets?.length === 1 &&
        controlledPlan.production.forced_targets[0]?.title ===
          "Chief Marketing Officer",
    );
    assert(
      "H_controlled_no_design_fields",
      !("design_family" in (controlledPlan.production.forced_targets?.[0] ?? {})),
    );
  }

  // I. queue capacity full
  const queueFull = await runProduction({
    ...controlledPlan.ok ? controlledPlan.production : {},
    verification: true,
    verification_context: "aios-verify-6d",
    force_mock: true,
    health_simulate: { queue_over_limit: true },
    budget_simulate: { disk_free_percent: 40 },
  });
  assert(
    "I_queue_full_stops",
    queueFull.stop_reason === "health_unhealthy" && queueFull.batch === null,
  );
  assert("I_queue_full_no_candidates", queueFull.candidate_count === 0);

  // J. budget deny
  const budgetDeny = await runProduction({
    ...(controlledPlan.ok ? controlledPlan.production : {}),
    verification: true,
    verification_context: "aios-verify-6d",
    force_mock: true,
    budget_simulate: { daily_cycles: 999 },
    budget_policy: { maximum_daily_cycles: 1 },
  });
  assert(
    "J_budget_deny_stops",
    budgetDeny.stop_reason === "budget_denied" && budgetDeny.batch === null,
  );
  assert("J_budget_deny_no_candidates", budgetDeny.candidate_count === 0);

  // K. provider failure → no Founder admission
  const providerFail = await runProduction({
    ...(controlledPlan.ok ? controlledPlan.production : {}),
    verification: true,
    verification_context: "aios-verify-6d",
    force_mock: true,
    require_openai: true,
    budget_simulate: { disk_free_percent: 40 },
    queue_max: queueMax,
  });
  const providerAdmitted = (providerFail.batch?.candidates ?? []).some(
    (c) => c.result === "WAITING_FOUNDER",
  );
  assert(
    "K_provider_failure_no_admission",
    !providerAdmitted &&
      (providerFail.batch?.stop_reason === "require_openai_violated" ||
        providerFail.candidate_count === 0 ||
        (providerFail.batch?.candidates ?? []).every(
          (c) => c.result !== "WAITING_FOUNDER",
        )),
    `stop=${providerFail.batch?.stop_reason ?? providerFail.stop_reason}`,
  );

  // L. role mismatch → ROLE_INTEGRITY_FAILED, no queue slot
  const admit = (pass: boolean) =>
    pass ? "WAITING_FOUNDER" : "ROLE_INTEGRITY_FAILED";
  assert(
    "L_mismatch_contract",
    admit(roleBad.pass) === "ROLE_INTEGRITY_FAILED" && !roleBad.pass,
  );
  const cycleSrc = readFileSync(
    join(import.meta.dirname, "runFirstProductionCycle.ts"),
    "utf8",
  );
  assert(
    "L_cycle_gate_wired",
    /markRoleIntegrityFailed/.test(cycleSrc) &&
      /ROLE_INTEGRITY_FAILED/.test(cycleSrc) &&
      /if \(!roleIntegrity\.pass\)/.test(cycleSrc),
  );
  const oa = resolveCanonicalProductionTarget("ats:operations-analyst");
  assert("L_oa_canonical", oa.ok);
  const roleFail = await runProduction({
    verification: true,
    verification_context: "aios-verify-6d",
    batch_size: 1,
    queue_max: queueMax,
    max_attempts: 1,
    force_mock: true,
    select_target: false,
    forced_targets: oa.ok ? [oa.target] : [],
    budget_simulate: { disk_free_percent: 40 },
  });
  const roleRec = roleFail.batch?.candidates?.[0];
  const roleDir = roleRec?.candidate_dir
    ? join(REPO, roleRec.candidate_dir)
    : "";
  const roleArtPath = join(roleDir, "role-target-integrity.json");
  if (existsSync(roleArtPath)) {
    const persistedRole = readJson(roleArtPath);
    if (persistedRole.pass === false) {
      assert(
        "L_role_integrity_failed",
        roleRec?.result === "ROLE_INTEGRITY_FAILED",
        `result=${roleRec?.result}`,
      );
    }
  }
  assert(
    "L_no_queue_slot",
    roleRec?.result !== "WAITING_FOUNDER" &&
      (roleFail.batch?.accepted_count ?? 0) === 0,
    `result=${roleRec?.result}`,
  );

  // Part 12 — no-network full spine with exact taxonomy target
  const mm = resolveCanonicalProductionTarget("marketing:marketing-manager");
  assert("SPINE_mm_canonical", mm.ok);
  const mmDesign = naturalDesignForCanonicalTarget(mm.ok ? mm.target : cmo!);
  const spine = await runProduction({
    verification: true,
    verification_context: "aios-verify-6d",
    batch_size: 1,
    queue_max: queueMax,
    max_attempts: 1,
    force_mock: true,
    select_target: false,
    forced_targets: mm.ok ? [mm.target] : [],
    budget_simulate: { disk_free_percent: 40 },
  });
  assert(
    "SPINE_controller",
    spine.entrypoint === "ProductionController" && spine.batch !== null,
  );
  const candDirRel = spine.batch?.candidates?.[0]?.candidate_dir;
  assert("SPINE_candidate_dir", Boolean(candDirRel));
  const candDir = join(REPO, candDirRel ?? "");
  const targetArt = join(candDir, "production-target.json");
  const memArt = join(candDir, "founder-memory-selection.json");
  const roleArt = join(candDir, "role-target-integrity.json");
  assert("CANONICAL_TARGET_RESOLVED", existsSync(targetArt));
  const persistedTarget = existsSync(targetArt) ? readJson(targetArt) : {};
  const designCtx = (persistedTarget.design_context ?? {}) as {
    design_family?: string | null;
    architecture?: string | null;
    design_family_source?: string;
  };
  assert(
    "FAMILY_ENGINE_EXECUTED",
    designCtx.design_family === mmDesign.design_family &&
      designCtx.architecture === mmDesign.architecture &&
      designCtx.design_family_source === "family_engine",
    `family=${designCtx.design_family} src=${designCtx.design_family_source}`,
  );
  assert("MEMORY_SELECTOR_EXECUTED", existsSync(memArt));
  if (existsSync(memArt)) {
    const cycleSel = readJson(memArt);
    const ctx = (cycleSel.context ?? {}) as {
      design_family?: string | null;
      architecture?: string | null;
    };
    assert(
      "MEMORY_SELECTOR_NATURAL_CONTEXT",
      ctx.design_family === mmDesign.design_family &&
        ctx.architecture === mmDesign.architecture,
    );
  }
  if (
    mmDesign.design_family &&
    mmDesign.design_family !== natural.design_family
  ) {
    seedFamilyRule(store, mmDesign.design_family, mmDesign.architecture ?? "");
  }
  const spineSel = selectFounderMemory({
    store,
    repoRoot: fixtureRoot,
    channel: "generation",
    ctx: toSelectionContext({
      ...mmDesign,
      role: mm.ok ? mm.target.title : null,
      role_family: mm.ok ? mm.target.role_family : null,
      category: mm.ok ? mm.target.category : null,
    }),
  });
  assert(
    "SELECTED_MEMORY_COUNT",
    spineSel.selected.length >= 1,
    `mmFamily=${mmDesign.design_family} n=${spineSel.selected.length}`,
  );
  assert("ROLE_INTEGRITY_EXECUTED", existsSync(roleArt));

  const proof = recommendControlledProofTarget();
  assert("PROOF_TARGET_FOUND", Boolean(proof));
  const expectedRule =
    proof?.design_family
      ? CONFIRMED_MEMORY_RULE_BY_FAMILY[proof.design_family] ?? null
      : null;

  const taxonomyCount = listCanonicalTaxonomyEntries().length;
  assert("TAXONOMY_PRESENT", taxonomyCount >= 90);
  assert("FIXTURE_RULE_SEEDED", Boolean(fixtureRule.memory_id));

  const report = {
    schema_version: "controlled-canonical-target-6d-1.0.0",
    ok: true,
    openai_called: false,
    production_generation: false,
    default_target_selection_changed: false,
    queue_waiting_local: waiting,
    queue_max_default: DEFAULT_QUEUE_MAX,
    taxonomy_count: taxonomyCount,
    cmo_natural_design: natural,
    cmo_fixture_selected: memSel.memory_ids,
    proof_target: proof
      ? {
          id: proof.id,
          title: proof.title,
          role_family: proof.role_family,
          category: proof.category,
          design_family: proof.design_family,
          architecture: proof.architecture,
          eligible: proof.eligible,
          skip_reason: proof.skip_reason,
          expected_memory_rule_ids: expectedRule ? [expectedRule] : [],
        }
      : null,
    spine: {
      execution_id: spine.execution_id,
      stop_reason: spine.stop_reason,
      candidate_dir: candDirRel ?? null,
      family_engine: designCtx,
      role_integrity_present: existsSync(roleArt),
      memory_selector_present: existsSync(memArt),
    },
  };
  writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
  console.log("PASS verify-controlled-canonical-target-6d", {
    proof: proof?.id,
    family: proof?.design_family,
    waiting,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
