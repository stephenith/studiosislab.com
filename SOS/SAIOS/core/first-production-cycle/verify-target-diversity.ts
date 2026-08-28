/**
 * Phase 5F offline verifier: production target diversity + exhaustion.
 * No OpenAI. No production registry mutation (uses temp dirs / in-memory manifests).
 */
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  createBatchLocalDuplicateState,
  evaluateDuplicate,
  fingerprintProductionTarget,
  recordBatchLocalAttempt,
  recordBatchLocalClusterExclusion,
  targetClusterKey,
} from "./DuplicateDetector.js";
import type { CandidateManifest } from "./CandidateStore.js";
import {
  PRODUCTION_ROLE_TAXONOMY,
  roleCountsByCategory,
  totalRoleTaxonomyCount,
  buildTargetFromRoleEntry,
} from "./ProductionRoleTaxonomy.js";
import {
  readTargetSelectionCursor,
  selectEligibleProductionTarget,
  writeTargetSelectionCursor,
} from "./selectProductionTarget.js";
import type { ProductionTarget } from "./ProductionTarget.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/first-production-cycle/verify-target-diversity.json",
);

type Check = { name: string; pass: boolean; detail: string };

function assert(cond: boolean, name: string, detail: string): Check {
  return { name, pass: cond, detail };
}

function manifestFor(
  id: string,
  target: ProductionTarget,
  status: CandidateManifest["status"] = "WAITING_FOUNDER",
): CandidateManifest {
  return {
    schema_version: 1,
    candidate_id: id,
    review_id: `founder-review-${id}`,
    task_id: `task-${id}`,
    cycle_id: "cycle-verify",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status,
    provider: "mock",
    target: {
      category: target.category,
      title: target.title,
      industry: target.industry,
      seniority: target.seniority,
      objective: target.objective,
      role_family: target.role_family,
    },
    artifacts: {},
  } as CandidateManifest;
}

function role(
  category: ProductionTarget["category"],
  title: string,
  seniority: ProductionTarget["seniority"] = "mid",
): ProductionTarget {
  const entry = PRODUCTION_ROLE_TAXONOMY.find(
    (r) => r.category === category && r.title === title,
  );
  if (entry) {
    const t = buildTargetFromRoleEntry(entry);
    return { ...t, seniority };
  }
  return {
    category,
    title,
    industry: category === "engineering" ? "engineering" : "software",
    seniority,
    objective: `${title} resume for ${category}`,
    role_family: title.toLowerCase().replace(/\s+/g, "_"),
  };
}

function main(): void {
  const checks: Check[] = [];
  const tmp = mkdtempSync(join(tmpdir(), "aios-target-diversity-"));
  const cursorPath = join(tmp, "cursor.json");

  try {
    const counts = roleCountsByCategory();
    const total = totalRoleTaxonomyCount();
    checks.push(
      assert(total >= 80, "taxonomy_size_gte_80", `total=${total}`),
    );
    checks.push(
      assert(
        (counts.engineering ?? 0) >= 8 && (counts.marketing ?? 0) >= 8,
        "taxonomy_per_category_depth",
        JSON.stringify(counts),
      ),
    );

    // --- Five distinct eligible targets ---
    const fiveTaxonomy = PRODUCTION_ROLE_TAXONOMY.filter((r) =>
      [
        "Cloud Architect",
        "Brand Manager",
        "UX Designer",
        "Accountant",
        "Registered Nurse",
      ].includes(r.title),
    );
    writeTargetSelectionCursor(
      { schema_version: 1, taxonomy_index: 0, updated_at: new Date().toISOString() },
      cursorPath,
    );
    const selected: ProductionTarget[] = [];
    const batchLocal = createBatchLocalDuplicateState();
    for (let i = 0; i < 5; i++) {
      const r = selectEligibleProductionTarget({
        taxonomy: fiveTaxonomy,
        manifests: [],
        batchLocal,
        disable_strategy: true,
        commitCursor: true,
        cursorPath,
        persist_intake_report: false,
      });
      checks.push(
        assert(
          r.target != null && !r.exhausted,
          `five_select_${i}_ok`,
          r.telemetry.exhaustion_reason ?? "ok",
        ),
      );
      if (r.target) {
        selected.push(r.target);
        recordBatchLocalAttempt(
          batchLocal,
          fingerprintProductionTarget(r.target),
          "accepted",
        );
        recordBatchLocalClusterExclusion(batchLocal, r.target);
      }
    }
    const clusters = new Set(selected.map((t) => targetClusterKey(t)));
    checks.push(
      assert(
        clusters.size === 5,
        "five_distinct_clusters",
        [...clusters].join(", "),
      ),
    );

    // --- COO duplicate cluster regression ---
    // A) Registry-reserved COO must not be selected at all.
    const reservedCoo = role("executive", "Chief Operating Officer", "mid");
    const manifests = [
      manifestFor("cand-coo-reserved", reservedCoo, "WAITING_FOUNDER"),
    ];
    const afterReserved = selectEligibleProductionTarget({
      manifests,
      taxonomy: PRODUCTION_ROLE_TAXONOMY.filter(
        (x) =>
          x.title === "Chief Operating Officer" ||
          x.title === "Cloud Architect" ||
          x.title === "Brand Manager",
      ),
      disable_strategy: true,
      commitCursor: false,
      cursorPath: join(tmp, "coo-cursor.json"),
      persist_intake_report: false,
    });
    checks.push(
      assert(
        afterReserved.target != null &&
          afterReserved.target.title !== "Chief Operating Officer",
        "coo_reserved_not_selected",
        afterReserved.target?.title ?? "null",
      ),
    );

    // B) After EXACT/NEAR cluster exclusion, seniority variants are not reselected.
    const cooBatch = createBatchLocalDuplicateState();
    const cooMid = role("executive", "Chief Operating Officer", "mid");
    recordBatchLocalAttempt(
      cooBatch,
      fingerprintProductionTarget(cooMid),
      "skipped",
    );
    recordBatchLocalClusterExclusion(cooBatch, cooMid);
    const afterCluster = selectEligibleProductionTarget({
      manifests: [],
      batchLocal: cooBatch,
      taxonomy: PRODUCTION_ROLE_TAXONOMY.filter(
        (x) =>
          x.title === "Chief Operating Officer" ||
          x.title === "Cloud Architect" ||
          x.title === "Brand Manager",
      ),
      disable_strategy: true,
      commitCursor: false,
      cursorPath: join(tmp, "coo-cursor2.json"),
      persist_intake_report: false,
    });
    checks.push(
      assert(
        afterCluster.target != null &&
          afterCluster.target.title !== "Chief Operating Officer",
        "coo_cluster_skip_moves_on",
        afterCluster.target?.title ?? "null",
      ),
    );

    // --- Busy category: Software Engineer reserved, Cloud Architect eligible ---
    const se = role("engineering", "Software Engineer", "mid");
    const busyManifests = [manifestFor("cand-se", se)];
    const busy = selectEligibleProductionTarget({
      manifests: busyManifests,
      taxonomy: PRODUCTION_ROLE_TAXONOMY.filter((r) => r.category === "engineering"),
      disable_strategy: true,
      commitCursor: false,
      cursorPath: join(tmp, "busy-cursor.json"),
      persist_intake_report: false,
    });
    checks.push(
      assert(
        busy.target != null && busy.target.title !== "Software Engineer",
        "busy_category_other_roles_eligible",
        busy.target?.title ?? "null",
      ),
    );
    checks.push(
      assert(
        busy.target?.title === "Cloud Architect" ||
          busy.target?.title === "DevOps Engineer" ||
          busy.target?.title === "Backend Engineer" ||
          (busy.target != null && busy.target.title !== "Software Engineer"),
        "busy_category_picks_sibling_role",
        busy.target?.title ?? "null",
      ),
    );

    // --- True exhaustion: all taxonomy reserved ---
    const allReserved = PRODUCTION_ROLE_TAXONOMY.slice(0, 12).map((r, i) =>
      manifestFor(`cand-ex-${i}`, buildTargetFromRoleEntry(r)),
    );
    const exhausted = selectEligibleProductionTarget({
      manifests: allReserved,
      taxonomy: PRODUCTION_ROLE_TAXONOMY.slice(0, 12),
      disable_strategy: true,
      commitCursor: false,
      cursorPath: join(tmp, "ex-cursor.json"),
      persist_intake_report: false,
    });
    checks.push(
      assert(
        exhausted.exhausted && exhausted.target == null,
        "true_exhaustion_no_default",
        exhausted.telemetry.exhaustion_reason ?? "null",
      ),
    );
    checks.push(
      assert(
        exhausted.telemetry.exhaustion_reason != null,
        "exhaustion_reason_present",
        String(exhausted.telemetry.exhaustion_reason),
      ),
    );

    // --- Restart persistence ---
    writeTargetSelectionCursor(
      {
        schema_version: 1,
        taxonomy_index: 3,
        updated_at: new Date().toISOString(),
      },
      cursorPath,
    );
    const before = readTargetSelectionCursor(cursorPath);
    const pick1 = selectEligibleProductionTarget({
      taxonomy: fiveTaxonomy,
      manifests: [],
      disable_strategy: true,
      commitCursor: true,
      cursorPath,
      persist_intake_report: false,
    });
    const mid = readTargetSelectionCursor(cursorPath);
    // simulate restart: re-read cursor file
    const afterRestart = readTargetSelectionCursor(cursorPath);
    checks.push(
      assert(
        before.taxonomy_index === 3 &&
          afterRestart.taxonomy_index === mid.taxonomy_index &&
          mid.taxonomy_index !== 3,
        "cursor_persists_and_advances",
        `before=${before.taxonomy_index} mid=${mid.taxonomy_index} pick=${pick1.target?.title}`,
      ),
    );

    // --- No DEFAULT when empty taxonomy ---
    const empty = selectEligibleProductionTarget({
      taxonomy: [],
      manifests: [],
      disable_strategy: true,
      persist_intake_report: false,
      cursorPath: join(tmp, "empty-cursor.json"),
    });
    checks.push(
      assert(
        empty.target == null && empty.exhausted,
        "empty_taxonomy_no_default_marketing",
        empty.target?.title ?? "null",
      ),
    );

    // Telemetry fields present on five-select path
    const tel = selectEligibleProductionTarget({
      taxonomy: fiveTaxonomy,
      manifests: [],
      disable_strategy: true,
      persist_intake_report: false,
      cursorPath: join(tmp, "tel-cursor.json"),
    });
    checks.push(
      assert(
        tel.telemetry.coverage_targets_scanned >= 5 &&
          tel.telemetry.eligible_targets_scanned >= 5,
        "telemetry_scan_counts",
        JSON.stringify(tel.telemetry),
      ),
    );

    const failed = checks.filter((c) => !c.pass);
    const report = {
      schema_version: "verify-target-diversity-1.0.0",
      ok: failed.length === 0,
      passed: checks.filter((c) => c.pass).length,
      total: checks.length,
      role_counts_by_category: counts,
      total_roles: total,
      checks,
      failed: failed.map((c) => c.name),
    };
    mkdirSync(join(REPO, "SOS/07_LOGS/saios/first-production-cycle"), {
      recursive: true,
    });
    writeFileSync(OUT, JSON.stringify(report, null, 2));
    for (const c of failed) console.error(`FAIL ${c.name}: ${c.detail}`);
    if (failed.length) {
      console.error(`verify-target-diversity: ${failed.length}/${checks.length} failed`);
      process.exit(1);
    }
    console.log(
      `verify-target-diversity: PASS ${checks.length}/${checks.length} roles=${total}`,
    );
  } finally {
    if (existsSync(tmp)) rmSync(tmp, { recursive: true, force: true });
  }
}

main();
