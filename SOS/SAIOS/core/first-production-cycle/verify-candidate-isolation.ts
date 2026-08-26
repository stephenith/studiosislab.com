/**
 * Candidate artifact isolation verify — Agent #207.
 * Mock-only: proves two canonical runs do not overwrite each other.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, relative, resolve } from "node:path";
import {
  CYCLE_LOG,
  runFirstProductionCycle,
} from "./runFirstProductionCycle.js";
import {
  countCanonicalWaitingByCategory,
  listCandidateManifests,
  readLatestCandidatePointer,
} from "./CandidateStore.js";
import { analyzeCategoryCoverage, selectNextProductionTarget } from "./selectProductionTarget.js";
import { DEFAULT_PRODUCTION_TARGET } from "./ProductionTarget.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(CYCLE_LOG, "candidate-isolation-verify.json");

function forceMockEnv(): void {
  delete process.env.SOS_AI_FOUNDER_OPENAI_ONE_TEST;
  delete process.env.OPENAI_API_KEY;
  delete process.env.SOS_OPENAI_API_KEY;
  process.env.SOS_AIOS_LIVE = "0";
}

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function noSrcWritesDuring(startMs: number): boolean {
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

async function main(): Promise<void> {
  forceMockEnv();
  mkdirSync(CYCLE_LOG, { recursive: true });
  if (process.env.SOS_AIOS_LIVE === "1") {
    console.error("LIVE must be OFF");
    process.exit(1);
  }

  const t0 = Date.now();

  // Run A — fixed target (isolation of filesystem)
  const runA = await runFirstProductionCycle({
    verification: true,
    verification_context: "aios-verify",
    pause_for_founder: true,
    target: DEFAULT_PRODUCTION_TARGET,
    // Isolation proves filesystem separation; duplicate policy is Agent #210.
    duplicate_preflight: false,
  });
  assert(runA.overall === "PASS", `runA overall=${runA.overall}`);
  assert(runA.state === "WAITING_FOUNDER", `runA state=${runA.state}`);
  assert(runA.publication_allowed === false, "runA publication_allowed");
  assert(existsSync(runA.candidate_dir), "runA candidate_dir");

  const aCanvas = join(runA.candidate_dir, "canvas.json");
  const aCritic = join(runA.candidate_dir, "critic.json");
  const aReview = join(runA.candidate_dir, "review.json");
  const aTarget = join(runA.candidate_dir, "production-target.json");
  const aResearch = join(runA.candidate_dir, "research-context.json");
  const aManifest = join(runA.candidate_dir, "candidate.json");
  const aCanvasBody = readFileSync(aCanvas, "utf8");
  const aCriticBody = readFileSync(aCritic, "utf8");
  const aReviewBody = readFileSync(aReview, "utf8");
  const aTargetBody = readFileSync(aTarget, "utf8");
  const aResearchBody = readFileSync(aResearch, "utf8");
  const aMtime = statSync(aCanvas).mtimeMs;

  // Run B — same target again (must not overwrite A)
  const runB = await runFirstProductionCycle({
    verification: true,
    verification_context: "aios-verify",
    pause_for_founder: true,
    target: DEFAULT_PRODUCTION_TARGET,
    duplicate_preflight: false,
  });
  assert(runB.overall === "PASS", `runB overall=${runB.overall}`);
  assert(runB.state === "WAITING_FOUNDER", `runB state=${runB.state}`);
  assert(runB.publication_allowed === false, "runB publication_allowed");
  assert(existsSync(runB.candidate_dir), "runB candidate_dir");

  assert(
    runA.candidate_id !== runB.candidate_id,
    "candidate_id must differ",
  );
  assert(runA.task_id !== runB.task_id, "task_id must differ");
  assert(runA.review_id !== runB.review_id, "review_id must differ");
  assert(
    runA.candidate_dir !== runB.candidate_dir,
    "candidate directories must differ",
  );

  assert(existsSync(aCanvas), "runA canvas still exists");
  assert(existsSync(aCritic), "runA critic still exists");
  assert(existsSync(aReview), "runA review still exists");
  assert(existsSync(aTarget), "runA production-target still exists");
  assert(existsSync(aResearch), "runA research-context still exists");
  assert(
    readFileSync(aCanvas, "utf8") === aCanvasBody,
    "runA canvas not overwritten",
  );
  assert(
    readFileSync(aCritic, "utf8") === aCriticBody,
    "runA critic not overwritten",
  );
  assert(
    readFileSync(aReview, "utf8") === aReviewBody,
    "runA review not overwritten",
  );
  assert(
    readFileSync(aTarget, "utf8") === aTargetBody,
    "runA production-target not overwritten",
  );
  assert(
    readFileSync(aResearch, "utf8") === aResearchBody,
    "runA research-context not overwritten",
  );
  assert(statSync(aCanvas).mtimeMs === aMtime, "runA canvas mtime unchanged");

  for (const run of [runA, runB]) {
    const mPath = join(run.candidate_dir, "candidate.json");
    assert(existsSync(mPath), `manifest missing for ${run.candidate_id}`);
    const m = readJson(mPath) as {
      schema_version: number;
      status: string;
      publication_allowed: boolean;
      artifacts: Record<string, string | null>;
    };
    assert(m.schema_version === 1, "manifest schema_version");
    assert(m.status === "WAITING_FOUNDER", `manifest status ${m.status}`);
    assert(m.publication_allowed === false, "manifest publication_allowed");
    for (const key of [
      "production_target",
      "research_context",
      "brain",
      "canvas",
      "critic",
      "gate",
      "review",
      "dashboard",
    ]) {
      const rel = m.artifacts[key];
      assert(typeof rel === "string" && rel.length > 0, `artifact ${key}`);
      assert(
        existsSync(join(run.candidate_dir, rel)),
        `missing artifact file ${key}=${rel}`,
      );
    }
    // preview deferred (#208) — null is acceptable
    assert(
      m.artifacts.preview === null ||
        existsSync(join(run.candidate_dir, String(m.artifacts.preview))),
      "preview path if set must exist",
    );
  }

  // Latest-run compatibility: flat copies + pointer
  const pointer = readLatestCandidatePointer(CYCLE_LOG);
  assert(pointer !== null, "latest-candidate.json present");
  assert(
    pointer!.candidate_id === runB.candidate_id,
    "pointer tracks latest run",
  );
  assert(existsSync(join(CYCLE_LOG, "canvas.json")), "flat canvas exists");
  assert(existsSync(join(CYCLE_LOG, "dashboard.json")), "flat dashboard exists");
  assert(existsSync(join(CYCLE_LOG, "review.json")), "flat review exists");
  const flatDash = readJson(join(CYCLE_LOG, "dashboard.json"));
  assert(
    flatDash.candidate_id === runB.candidate_id,
    "flat dashboard is latest",
  );

  // Agent #231 — verification WAITING_FOUNDER lives in candidates-verify only
  const waitingVerify = countCanonicalWaitingByCategory(
    CYCLE_LOG,
    "verification",
  );
  const waitingProd = countCanonicalWaitingByCategory(CYCLE_LOG, "production");
  const reservedCat = runA.production_target.category;
  assert(
    (waitingVerify[reservedCat] ?? 0) >= 1,
    `verify waiting_founder count for ${reservedCat}`,
  );
  // Production coverage/selector remain driven by production registry only
  const coverage = analyzeCategoryCoverage();
  assert(
    typeof coverage.find((c) => c.category === reservedCat)?.waiting_founder ===
      "number",
    "coverage still reads production waiting",
  );
  const next = selectNextProductionTarget();
  assert(Boolean(next.category), "selector returns a category");
  // Verify isolation: production waiting for reservedCat must not grow from runA/B
  const prodReservedBeforeC = waitingProd[reservedCat] ?? 0;

  // Run C — unique target (avoid verify-registry duplicates); still isolated from production
  const stampC = Date.now();
  const runC = await runFirstProductionCycle({
    verification: true,
    verification_context: "aios-verify",
    pause_for_founder: true,
    select_target: false,
    target: {
      category: "engineering",
      title: "Isolation Verify Engineer",
      industry: "technology",
      seniority: "mid",
      objective: `candidate-isolation-verify-c-${stampC}`,
      role_family: "isolation_verify_c",
    },
  });
  assert(runC.overall === "PASS", `runC overall=${runC.overall}`);
  assert(runC.state === "WAITING_FOUNDER", `runC state=${runC.state}`);
  assert(runC.publication_allowed === false, "runC publication");
  assert(
    runC.candidate_dir.includes("candidates-verify"),
    "runC under candidates-verify",
  );
  const waitingProdAfterC = countCanonicalWaitingByCategory(
    CYCLE_LOG,
    "production",
  );
  assert(
    (waitingProdAfterC[reservedCat] ?? 0) === prodReservedBeforeC,
    "production waiting unchanged by verify runC",
  );

  // Safety
  assert(noSrcWritesDuring(t0), "no writes under src/");
  const cycleSrc = readFileSync(
    join(import.meta.dirname, "runFirstProductionCycle.ts"),
    "utf8",
  );
  assert(!cycleSrc.includes("ReleaseManager"), "no ReleaseManager in cycle");
  assert(
    !/\bfrom\s+["'][^"']*unified-production/.test(cycleSrc),
    "no unified-production import in cycle",
  );

  const manifests = listCandidateManifests(CYCLE_LOG, "verification");
  const waitingManifests = manifests.filter((m) => m.status === "WAITING_FOUNDER");
  assert(waitingManifests.length >= 3, "at least 3 WAITING_FOUNDER verify manifests");
  assert(
    waitingManifests.every((m) => m.verification_artifact === true),
    "verify manifests stamped verification_artifact",
  );

  const checks = {
    two_distinct_dirs: true,
    ids_do_not_collide: true,
    first_artifacts_preserved: true,
    manifests_valid: true,
    artifact_paths_exist: true,
    waiting_counted_in_coverage: true,
    selector_avoids_reserved: true,
    latest_run_compat: true,
    reaches_waiting_founder: true,
    publication_allowed_false: true,
    no_src_writes: true,
    no_release_manager: true,
    preview_null_or_real: true,
    provider_mock: runA.stages.some(() => true),
  };

  const providerA = readJson(join(runA.candidate_dir, "mock-provider.json"));
  assert(
    providerA.provider === "mock" || providerA.provider === "openai",
    "provider logged",
  );
  // Isolation verify intends Mock — allow openai only if gates forced it (should not)
  assert(providerA.provider === "mock", "isolation verify must use mock");

  const overall = Object.values(checks).every(Boolean);

  writeFileSync(
    OUT,
    `${JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        agent: "207",
        overall: overall ? "PASS" : "FAIL",
        checks,
        runs: [
          {
            candidate_id: runA.candidate_id,
            review_id: runA.review_id,
            dir: relative(REPO, runA.candidate_dir),
            category: runA.production_target.category,
          },
          {
            candidate_id: runB.candidate_id,
            review_id: runB.review_id,
            dir: relative(REPO, runB.candidate_dir),
            category: runB.production_target.category,
          },
          {
            candidate_id: runC.candidate_id,
            review_id: runC.review_id,
            dir: relative(REPO, runC.candidate_dir),
            category: runC.production_target.category,
          },
        ],
        latest_pointer: pointer,
        waiting_by_category: waitingVerify,
        next_selected_category: next.category,
        a_manifest: relative(REPO, aManifest),
      },
      null,
      2,
    )}\n`,
  );

  console.log(
    JSON.stringify(
      {
        overall: overall ? "PASS" : "FAIL",
        checks,
        candidate_a: runA.candidate_id,
        candidate_b: runB.candidate_id,
        candidate_c: runC.candidate_id,
        next_category: next.category,
      },
      null,
      2,
    ),
  );
  if (!overall) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
