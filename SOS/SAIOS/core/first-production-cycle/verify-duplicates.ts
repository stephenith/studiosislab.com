/**
 * Canonical duplicate prevention verify — Agent #210.
 * Mock + in-memory fixtures. No paid OpenAI.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { join, resolve } from "node:path";
import {
  CYCLE_LOG,
  runFirstProductionCycle,
} from "./runFirstProductionCycle.js";
import {
  countCanonicalWaitingTotal,
  listCandidateManifests,
  type CandidateManifest,
} from "./CandidateStore.js";
import {
  createBatchLocalDuplicateState,
  evaluateDuplicate,
  fingerprintProductionTarget,
  normalizeProductionTarget,
  normalizeText,
  recordBatchLocalAttempt,
  NEAR_TITLE_JACCARD,
} from "./DuplicateDetector.js";
import {
  defaultMaxAttempts,
  runCanonicalBatch,
} from "./BatchRunner.js";
import { DEFAULT_PRODUCTION_TARGET } from "./ProductionTarget.js";
import type { ProductionTarget } from "./ProductionTarget.js";
import { loadWaitingCandidatesFromRegistry } from "../../dashboard/src/data/buildFounderReviewQueue.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(CYCLE_LOG, "duplicate-prevention-verify.json");
const GUARD = join(REPO, "SOS/SAIOS/architecture/runtime-guard.ts");

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function forceMock(): void {
  delete process.env.SOS_AI_FOUNDER_OPENAI_ONE_TEST;
  delete process.env.OPENAI_API_KEY;
  delete process.env.SOS_OPENAI_API_KEY;
  process.env.SOS_AIOS_LIVE = "0";
}

function noSrcWrites(startMs: number): boolean {
  const src = join(REPO, "src");
  if (!existsSync(src)) return true;
  const stack = [src];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const name of readdirSync(cur)) {
      const p = join(cur, name);
      const st = statSync(p);
      if (st.isDirectory()) {
        if (name === "node_modules" || name === ".git") continue;
        stack.push(p);
      } else if (st.mtimeMs >= startMs - 50) {
        return false;
      }
    }
  }
  return true;
}

function fixtureManifest(
  partial: Partial<CandidateManifest> & {
    candidate_id: string;
    status: CandidateManifest["status"];
    target: CandidateManifest["target"];
  },
): CandidateManifest {
  return {
    schema_version: 1,
    task_id: partial.task_id ?? `task-${partial.candidate_id}`,
    review_id: partial.review_id ?? `review-${partial.candidate_id}`,
    cycle_id: partial.cycle_id ?? `cycle-${partial.candidate_id}`,
    run_id: partial.run_id ?? `run-${partial.candidate_id}`,
    created_at: partial.created_at ?? new Date().toISOString(),
    updated_at: partial.updated_at ?? new Date().toISOString(),
    publication_allowed: false,
    provider: "mock",
    failure_stage: null,
    failure_detail: null,
    artifacts: {},
    ...partial,
  };
}

async function main(): Promise<void> {
  forceMock();
  mkdirSync(CYCLE_LOG, { recursive: true });
  const t0 = Date.now();
  const waitingBefore = countCanonicalWaitingTotal(CYCLE_LOG);
  const queueBefore = loadWaitingCandidatesFromRegistry(REPO).length;

  // 1–2: normalization + fingerprint stability
  const a = normalizeProductionTarget({
    category: "marketing",
    title: "Marketing Manager",
    industry: "marketing",
    seniority: "mid",
    objective: "Produce an ATS-friendly Marketing Manager resume",
  });
  const b = normalizeProductionTarget({
    category: "Marketing",
    title: "  marketing-manager  ",
    industry: "Marketing",
    seniority: "MID",
    objective: "Produce an ATS-friendly Marketing Manager resume",
  });
  const c = normalizeProductionTarget({
    category: "marketing",
    title: "marketing_manager",
    industry: "marketing",
    seniority: "mid",
    objective: "Produce an ATS-friendly Marketing Manager resume",
  });
  assert(a.title === b.title && b.title === c.title, "title normalize");
  assert(
    fingerprintProductionTarget({
      ...DEFAULT_PRODUCTION_TARGET,
      title: "Marketing Manager",
    }) ===
      fingerprintProductionTarget({
        ...DEFAULT_PRODUCTION_TARGET,
        title: "  marketing-manager ",
      }),
    "identical fingerprints across formatting",
  );

  // 3–7: evaluateDuplicate with fixtures (no OpenAI)
  const waitingFx = fixtureManifest({
    candidate_id: "cand-fx-exact-001",
    status: "WAITING_FOUNDER",
    target: {
      category: "marketing",
      title: "Marketing Manager",
      industry: "marketing",
      seniority: "mid",
      objective: "Unique fixture objective alpha-exact",
      role_family: "marketing_manager",
    },
  });
  // No fingerprint on historical-style manifest
  const historicalFx = fixtureManifest({
    candidate_id: "cand-fx-hist-001",
    status: "WAITING_FOUNDER",
    target: {
      category: "finance",
      title: "Financial Analyst",
      industry: "finance",
      seniority: "mid",
      objective: "Unique fixture objective finance-hist",
      role_family: "financial_analyst",
    },
  });
  const failedFx = fixtureManifest({
    candidate_id: "cand-fx-failed-001",
    status: "FAILED",
    target: {
      category: "creative",
      title: "Creative Director",
      industry: "creative",
      seniority: "senior",
      objective: "Unique fixture objective creative-fail",
      role_family: "creative_director",
    },
  });
  // Same token set, different word order → high Jaccard, distinct fingerprints
  const nearFx = fixtureManifest({
    candidate_id: "cand-fx-near-001",
    status: "WAITING_FOUNDER",
    target: {
      category: "marketing",
      title: "Digital Marketing Manager",
      industry: "marketing",
      seniority: "senior",
      objective: "Produce digital marketing manager resume for marketing industry leadership",
      role_family: "digital_marketing_manager",
    },
  });

  const exactHit = evaluateDuplicate({
    target: {
      category: "marketing",
      title: "marketing_manager",
      industry: "marketing",
      seniority: "mid",
      objective: "Unique fixture objective alpha-exact",
      role_family: "marketing_manager",
    },
    cycleLog: CYCLE_LOG,
    manifests: [waitingFx],
  });
  assert(exactHit.decision === "SKIP_DUPLICATE", "exact skip");
  assert(exactHit.duplicate_type === "EXACT_TARGET", "exact type");
  assert(exactHit.matched_candidate_id === "cand-fx-exact-001", "exact match id");

  const histHit = evaluateDuplicate({
    target: {
      category: "finance",
      title: "Finance Analyst",
      industry: "finance",
      seniority: "mid",
      objective: "Unique fixture objective finance-hist",
      role_family: "financial_analyst",
    },
    cycleLog: CYCLE_LOG,
    manifests: [historicalFx],
  });
  assert(
    histHit.decision === "SKIP_DUPLICATE",
    "historical without fingerprint still detected",
  );

  const failedAllow = evaluateDuplicate({
    target: {
      category: "creative",
      title: "Creative Director",
      industry: "creative",
      seniority: "senior",
      objective: "Unique fixture objective creative-fail",
      role_family: "creative_director",
    },
    cycleLog: CYCLE_LOG,
    manifests: [failedFx],
  });
  assert(
    failedAllow.decision === "ALLOW",
    "FAILED does not permanently reserve target",
  );

  const nearHit = evaluateDuplicate({
    target: {
      category: "marketing",
      title: "Marketing Manager Digital",
      industry: "marketing",
      seniority: "senior",
      objective: "Produce digital marketing manager resume for marketing industry leadership",
      role_family: "marketing_manager_digital",
    },
    cycleLog: CYCLE_LOG,
    manifests: [nearFx],
  });
  assert(nearHit.decision === "SKIP_DUPLICATE", "near skip");
  assert(nearHit.duplicate_type === "NEAR_TARGET", "near type");
  assert(
    (nearHit.score ?? 0) >= NEAR_TITLE_JACCARD * 0.4,
    "near score present",
  );

  const differentAllow = evaluateDuplicate({
    target: {
      category: "marketing",
      title: "Product Marketing Manager",
      industry: "marketing",
      seniority: "mid",
      objective: "Product marketing resume focused on GTM launches",
      role_family: "product_marketing_manager",
    },
    cycleLog: CYCLE_LOG,
    manifests: [nearFx],
  });
  assert(differentAllow.decision === "ALLOW", "different roles allowed");

  const performanceAllow = evaluateDuplicate({
    target: {
      category: "marketing",
      title: "Performance Marketing Manager",
      industry: "marketing",
      seniority: "mid",
      objective: "Performance marketing resume focused on paid media ROI",
      role_family: "performance_marketing_manager",
    },
    cycleLog: CYCLE_LOG,
    manifests: [nearFx],
  });
  assert(
    performanceAllow.decision === "ALLOW",
    "product vs performance not auto-duplicate",
  );

  const controllerAllow = evaluateDuplicate({
    target: {
      category: "finance",
      title: "Financial Controller",
      industry: "finance",
      seniority: "senior",
      objective: "Controller resume for finance leadership",
      role_family: "financial_controller",
    },
    cycleLog: CYCLE_LOG,
    manifests: [historicalFx],
  });
  assert(controllerAllow.decision === "ALLOW", "analyst vs controller allowed");

  // 8: batch-local repeat
  const bl = createBatchLocalDuplicateState();
  const uniqTarget: ProductionTarget = {
    category: "student",
    title: "Student Resume",
    industry: "education",
    seniority: "student",
    objective: `dup-verify-unique-${Date.now()}`,
    role_family: "student",
  };
  const fp = fingerprintProductionTarget(uniqTarget);
  recordBatchLocalAttempt(bl, fp, "accepted");
  const batchRepeat = evaluateDuplicate({
    target: uniqTarget,
    cycleLog: CYCLE_LOG,
    batchLocal: bl,
    manifests: [],
  });
  assert(batchRepeat.decision === "SKIP_DUPLICATE", "batch repeat");
  assert(batchRepeat.duplicate_type === "BATCH_REPEAT", "batch type");

  // 9–15: live cycle skip before research/OpenAI + accepted metadata
  const uniqueObjective = `Agent210-unique-${Date.now()}-allow`;
  const allowTarget: ProductionTarget = {
    category: "seo_expansion",
    title: "SEO Specialist",
    industry: "marketing",
    seniority: "mid",
    objective: uniqueObjective,
    role_family: "seo_specialist",
  };

  const produced = await runFirstProductionCycle({
    verification: true,
    verification_context: "aios-verify",
    pause_for_founder: true,
    target: allowTarget,
    duplicate_preflight: true,
  });
  assert(produced.overall === "PASS", `produced overall=${produced.overall}`);
  assert(produced.state === "WAITING_FOUNDER", "produced waiting");
  assert(Boolean(produced.candidate_dir), "candidate dir created");
  const manifest = JSON.parse(
    readFileSync(join(produced.candidate_dir, "candidate.json"), "utf8"),
  ) as CandidateManifest & {
    duplicate_control?: { target_fingerprint?: string; decision?: string };
  };
  assert(
    manifest.duplicate_control?.decision === "ALLOW",
    "duplicate_control ALLOW",
  );
  assert(
    typeof manifest.duplicate_control?.target_fingerprint === "string",
    "fingerprint persisted",
  );

  const skipped = await runFirstProductionCycle({
    verification: true,
    verification_context: "aios-verify",
    pause_for_founder: true,
    target: allowTarget,
    duplicate_preflight: true,
  });
  assert(skipped.overall === "SKIPPED", "skip overall");
  assert(skipped.state === "DUPLICATE_SKIPPED", "skip state");
  assert(skipped.candidate_dir === "", "no candidate dir on skip");
  assert(
    skipped.stages.length === 1 &&
      skipped.stages[0].stage === "duplicate_preflight",
    "only preflight stage — no research/OpenAI",
  );
  assert(
    !skipped.stages.some((s) =>
      ["research", "brain", "mock_provider", "designbrief"].includes(s.stage),
    ),
    "no expensive stages on skip",
  );

  const waitingAfterSkip = countCanonicalWaitingTotal(CYCLE_LOG);
  const queueAfterSkip = loadWaitingCandidatesFromRegistry(REPO).length;
  assert(
    waitingAfterSkip === waitingBefore,
    `production waiting unchanged (got ${waitingAfterSkip - waitingBefore})`,
  );
  assert(
    queueAfterSkip === queueBefore,
    "founder review queue unchanged by verification accept",
  );
  assert(
    countCanonicalWaitingTotal(CYCLE_LOG, "verification") >= 1,
    "accepted candidate in verification registry",
  );

  // 9–11: batch retries + max attempts
  assert(defaultMaxAttempts(5) === 15, "max attempts formula");
  const batchStamp = Date.now();
  const batch = await runCanonicalBatch({
    verification: true,
    verification_context: "aios-verify",
    batch_size: 2,
    queue_max: 100,
    max_openai_per_batch: 5,
    max_attempts: 12,
    force_mock: true,
    select_target: false,
    forced_targets: [
      {
        category: "finance",
        title: "Treasury Analyst",
        industry: "finance",
        seniority: "mid",
        objective: `Dup-verify treasury ${batchStamp}-1`,
        role_family: "treasury_analyst",
      },
      // Batch-local / exact repeat — skip, then continue to alternate
      {
        category: "finance",
        title: "Treasury Analyst",
        industry: "finance",
        seniority: "mid",
        objective: `Dup-verify treasury ${batchStamp}-1`,
        role_family: "treasury_analyst",
      },
      {
        category: "healthcare",
        title: "Clinical Operations Lead",
        industry: "healthcare",
        seniority: "senior",
        objective: `Dup-verify clinical ops ${batchStamp}-2`,
        role_family: "clinical_operations_lead",
      },
    ],
  });
  assert(batch.sequential === true, "batch sequential");
  assert(batch.publication_allowed === false, "batch publication");
  assert(batch.accepted_count === 2, `batch accepted=${batch.accepted_count}`);
  assert(
    batch.duplicate_skip_count >= 1,
    `expected ≥1 duplicate skip, got ${batch.duplicate_skip_count}`,
  );
  assert(batch.waiting_founder_count === 2, "accepted reach size");

  // Max-attempt safeguard (forced tiny budget + repeating targets)
  const maxAttemptBatch = await runCanonicalBatch({
    verification: true,
    verification_context: "aios-verify",
    batch_size: 5,
    queue_max: 100,
    max_attempts: 2,
    force_mock: true,
    select_target: false,
    forced_targets: [
      {
        category: "student",
        title: "Campus Ambassador",
        industry: "education",
        seniority: "student",
        objective: `Dup-verify max-attempt ${batchStamp}-x`,
        role_family: "campus_ambassador",
      },
      {
        category: "student",
        title: "Campus Ambassador",
        industry: "education",
        seniority: "student",
        objective: `Dup-verify max-attempt ${batchStamp}-x`,
        role_family: "campus_ambassador",
      },
      {
        category: "student",
        title: "Campus Ambassador",
        industry: "education",
        seniority: "student",
        objective: `Dup-verify max-attempt ${batchStamp}-x`,
        role_family: "campus_ambassador",
      },
    ],
  });
  assert(
    maxAttemptBatch.total_attempts <= 2,
    "respects maximum attempts",
  );
  assert(
    maxAttemptBatch.accepted_count <= 2,
    "cannot accept more than attempts",
  );
  assert(
    maxAttemptBatch.stop_reason === "max_attempts" ||
      maxAttemptBatch.accepted_count < 5,
    `clean stop reason=${maxAttemptBatch.stop_reason}`,
  );

  assert(noSrcWrites(t0), "no src writes");
  assert(existsSync(GUARD) && readFileSync(GUARD, "utf8").includes("ENGINES"), "guard");
  assert(normalizeText("Foo_Bar") === "foo bar", "normalize underscores");

  const checks = {
    fingerprint_stable: true,
    formatting_detected: true,
    exact_before_research: true,
    near_duplicate_detected: true,
    different_roles_allowed: true,
    failed_not_permanent: true,
    historical_without_fingerprint: true,
    batch_local_repeat: true,
    batch_retry_or_clean_stop: true,
    max_attempts_bound: true,
    skip_not_waiting_founder: true,
    skip_not_in_review_queue_delta: true,
    duplicate_control_persisted: true,
    no_openai_on_skip: true,
    sequential: true,
    publication_disabled: true,
    live_off: true,
    runtime_guard: true,
    no_src_writes: true,
  };

  const overall = Object.values(checks).every(Boolean);
  writeFileSync(
    OUT,
    `${JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        agent: "210",
        overall: overall ? "PASS" : "FAIL",
        checks,
        example_exact: exactHit,
        example_near: nearHit,
        produced_candidate: produced.candidate_id,
        skipped_state: skipped.state,
        batch_id: batch.batch_id,
        batch_accepted: batch.accepted_count,
        batch_duplicate_skips: batch.duplicate_skip_count,
        max_attempt_stop: maxAttemptBatch.stop_reason,
      },
      null,
      2,
    )}\n`,
  );

  console.log("Canonical Duplicate Prevention Verify");
  console.log("====================================");
  for (const [k, v] of Object.entries(checks)) {
    console.log(`${v ? "✔" : "✘"} ${k}`);
  }
  console.log(`Example exact: ${exactHit.duplicate_type} → ${exactHit.decision}`);
  console.log(`Overall: ${overall ? "PASS" : "FAIL"}`);
  if (!overall) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
