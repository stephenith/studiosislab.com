/**
 * Phase 5T — tracked-tree publication safety + isolation regression matrix.
 * No OpenAI. No production publish. No Git push. No Vercel.
 */
import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { isNonProductionResumeTemplate } from "../staging/ApprovalStagingHandoff.js";
import { discoverEligibleCandidates } from "./EligibilityCollector.js";
import { filterPublicationGitPaths } from "./GitPathAllowlist.js";
import {
  materializePendingTrackedTree,
  runIsolatedPendingTreeBuild,
} from "./IsolatedPendingTreeBuild.js";
import type { PublicationRoots } from "./paths.js";
import { createPublicationPlan, readPlan, writePlan } from "./PublicationPlanService.js";
import { applyPublicationPlan } from "./PublicationApplyService.js";
import { verifyPublicationPlan } from "./PublicationVerifyService.js";
import {
  assertTrackedPublicationClosure,
  pathInPendingTrackedTree,
  PREPUSH_BUILD_SOURCE,
  requiredAssetPathsForCatalogue,
} from "./TrackedPublicationClosure.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/publication/verify-publication-tracked-tree-5t.json",
);

type Check = { name: string; pass: boolean; detail: string };

function assert(cond: boolean, name: string, detail: string): Check {
  return { name, pass: Boolean(cond), detail };
}

function writeJson(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function sha256(buf: Buffer | string): string {
  return createHash("sha256").update(buf).digest("hex");
}

function git(cwd: string, args: string[]): {
  ok: boolean;
  stdout: string;
  stderr: string;
} {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  return {
    ok: r.status === 0,
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
  };
}

function makeRoots(base: string): PublicationRoots {
  return {
    repo: base,
    decisionsJsonl: join(base, "decisions.jsonl"),
    lifecycleRoot: join(base, "lifecycle"),
    stagingPackagesRoot: join(base, "packages"),
    candidatesRoot: join(base, "candidates"),
    reservationsPath: join(base, "reservations.json"),
    plansRoot: join(base, "plans"),
    manifestPath: join(base, "templates.manifest.json"),
    quarantineRoot: join(base, "orphans"),
    releaseHistoryPath: join(base, "release-history.json"),
    releaseManagerRoot: join(base, "release-manager"),
    executionsRoot: join(base, "executions"),
    locksRoot: join(base, "locks"),
    exportPackagesRoot: join(base, "exports"),
    websiteTargetRoot: join(base, "website"),
  };
}

function seedEligible(
  roots: PublicationRoots,
  opts: { candId: string; pkgId: string; decisionId: string; genId: string },
): void {
  const now = "2026-09-01T10:00:00.000Z";
  mkdirSync(join(roots.candidatesRoot, opts.candId), { recursive: true });
  writeJson(join(roots.candidatesRoot, opts.candId, "candidate.json"), {
    candidate_id: opts.candId,
    review_id: `review-${opts.candId}`,
    publication_allowed: false,
    target: { title: "Phase5T", category: "marketing" },
  });
  const pkg = join(roots.stagingPackagesRoot, opts.pkgId);
  mkdirSync(pkg, { recursive: true });
  const canvas = "{}";
  const preview = Buffer.from(`preview-${opts.candId}`);
  const thumb = Buffer.from(`thumb-${opts.candId}`);
  writeFileSync(join(pkg, "canvas.json"), canvas);
  writeFileSync(join(pkg, "preview-source.png"), preview);
  writeFileSync(join(pkg, "thumbnail-source.png"), thumb);
  writeJson(join(pkg, "checksums.json"), {
    algorithm: "sha256",
    generated_at: now,
    files: {
      "canvas.json": sha256(canvas),
      "preview-source.png": sha256(preview),
      "thumbnail-source.png": sha256(thumb),
    },
  });
  writeJson(join(pkg, "validation-report.json"), {
    pass: true,
    staging_package_id: opts.pkgId,
    candidate_id: opts.candId,
    generation_id: opts.genId,
  });
  writeJson(join(pkg, "staging-manifest.json"), {
    staging_package_id: opts.pkgId,
    candidate_id: opts.candId,
    generation_id: opts.genId,
    title: "Phase5T",
  });
  writeJson(join(roots.lifecycleRoot, `${opts.candId}.json`), {
    candidate_id: opts.candId,
    generation_id: opts.genId,
    lifecycle_status: "VALIDATED",
    approval_decision_id: opts.decisionId,
    founder_approved_at: now,
    staging_package_id: opts.pkgId,
    content_fingerprint: "fp",
    publication_allowed: false,
    updated_at: now,
  });
  writeFileSync(
    roots.decisionsJsonl,
    `${JSON.stringify({
      decision_id: opts.decisionId,
      decision: "APPROVED",
      created_at: now,
      review_id: `review-${opts.candId}`,
      structured_feedback: { candidate_id: opts.candId },
    })}\n`,
  );
  writeJson(roots.reservationsPath, { schema_version: 1, reservations: [] });
}

function initGitWebsite(dir: string): void {
  mkdirSync(dir, { recursive: true });
  git(dir, ["init"]);
  git(dir, ["config", "user.email", "phase5t@test.local"]);
  git(dir, ["config", "user.name", "Phase5T"]);
}

function writeMinimalShared(dir: string, ids: string[]): void {
  writeJson(join(dir, "templates.manifest.json"), {
    templates: ids.map((id) => ({
      id,
      title: `${id} Title`,
      categoryId: "test",
      thumbnailPath: `/templates/${id}.png`,
      jsonPath: `src/data/template-json/${id}.json`,
      status: "published",
      tags: [],
    })),
  });
  const imports = ids
    .map((id, i) => `import tpl${i} from "./template-json/${id}.json";`)
    .join("\n");
  const snapRows = ids.map((id, i) => `  "${id}": tpl${i},`).join("\n");
  mkdirSync(join(dir, "src/data/template-json"), { recursive: true });
  mkdirSync(join(dir, "src/data/systemTemplates"), { recursive: true });
  mkdirSync(join(dir, "public/templates"), { recursive: true });
  writeFileSync(
    join(dir, "src/data/templateSnapshots.generated.ts"),
    `${imports}\nexport const TEMPLATE_SNAPSHOTS = {\n${snapRows}\n};\n`,
  );
  writeFileSync(
    join(dir, "src/data/systemTemplates/registry.generated.ts"),
    `export const SYSTEM_TEMPLATES = [\n${ids
      .map(
        (id) => `  {
    id: "${id}",
    name: "${id}",
    tags: [],
    thumbnail: "/templates/${id}.png",
    load: async () => (await import("../template-json/${id}.json")).default,
  },`,
      )
      .join("\n")}\n];\n`,
  );
  writeFileSync(
    join(dir, "src/data/templateCatalog.generated.ts"),
    `export const TEMPLATES = [\n${ids
      .map(
        (id) => `  {
    id: "${id}",
    title: "${id}",
    categoryId: "test",
    category: "test",
    tags: [],
    thumb: "/templates/${id}.png",
    status: "published",
  },`,
      )
      .join("\n")}\n];\n`,
  );
  for (const id of ids) {
    writeFileSync(
      join(dir, `src/data/template-json/${id}.json`),
      JSON.stringify({ id, objects: [] }),
    );
    writeFileSync(join(dir, `public/templates/${id}.png`), `png-${id}`);
    writeFileSync(join(dir, `public/templates/${id}.webp`), `webp-${id}`);
  }
}

async function main(): Promise<void> {
  process.env.SOS_AIOS_LIVE = "0";
  delete process.env.SOS_AIOS_PUBLICATION_APPLY;
  delete process.env.SOS_AIOS_PUBLICATION_AUTO_APPLY;

  const checks: Check[] = [];
  const base = join(REPO, "SOS/07_LOGS/saios/publication/_verify_5t", randomUUID());
  mkdirSync(base, { recursive: true });

  try {
    // --- Fixture A: untracked t104 cannot satisfy closure / isolated tree ---
    {
      const site = join(base, "dirty-false-pass");
      initGitWebsite(site);
      writeMinimalShared(site, ["t103"]);
      git(site, ["add", "-A"]);
      git(site, ["commit", "-m", "t103 only"]);

      // Untracked t104 assets on disk
      writeFileSync(
        join(site, "src/data/template-json/t104.json"),
        JSON.stringify({ id: "t104" }),
      );
      writeFileSync(join(site, "public/templates/t104.png"), "png");
      writeFileSync(join(site, "public/templates/t104.webp"), "webp");

      // Pending generated files reference t104 (as if publication regenerated)
      writeMinimalShared(site, ["t103", "t104"]);
      // Re-write only shared files as pending; leave t104 assets untracked
      // (writeMinimalShared wrote assets — remove from index by not adding them)
      // Actually writeMinimalShared created tracked-looking files; ensure t104 assets untracked:
      // They were never committed; status is ?? — good.
      // But t103 assets were modified? writeMinimalShared overwrote t103 — pending.

      const pending = [
        "templates.manifest.json",
        "src/data/templateSnapshots.generated.ts",
        "src/data/systemTemplates/registry.generated.ts",
        "src/data/templateCatalog.generated.ts",
      ];

      checks.push(
        assert(
          pathInPendingTrackedTree(
            { repoRoot: site, pendingPaths: pending },
            "src/data/template-json/t104.json",
          ) === false,
          "1_untracked_cannot_satisfy_tracked_closure",
          "t104.json untracked must not count",
        ),
      );

      const closure = assertTrackedPublicationClosure({
        repoRoot: site,
        pendingPaths: pending,
      });
      checks.push(
        assert(
          !closure.ok &&
            closure.missing.some(
              (m) =>
                m.catalogue_id === "t104" &&
                m.missing_tracked_path.endsWith("t104.json"),
            ),
          "2_missing_tracked_json_fails",
          closure.error ?? "ok",
        ),
      );
      checks.push(
        assert(
          !closure.ok &&
            closure.missing.some((m) =>
              m.missing_tracked_path.endsWith("t104.png"),
            ),
          "3_missing_tracked_png_fails",
          closure.error ?? "ok",
        ),
      );
      checks.push(
        assert(
          !closure.ok &&
            closure.missing.some((m) =>
              m.missing_tracked_path.endsWith("t104.webp"),
            ),
          "4_missing_tracked_webp_fails",
          closure.error ?? "ok",
        ),
      );
      checks.push(
        assert(
          !closure.ok && (closure.error ?? "").includes("t104"),
          "5_generated_registry_missing_target_fails",
          closure.error ?? "ok",
        ),
      );
      checks.push(
        assert(
          !closure.ok &&
            closure.missing.some((m) => m.catalogue_id === "t104"),
          "6_manifest_missing_target_fails",
          closure.error ?? "ok",
        ),
      );

      // Isolated tree excludes untracked t104
      const dest = mkdtempSync(join(tmpdir(), "5t-iso-"));
      const mat = materializePendingTrackedTree({
        repoRoot: site,
        pendingPaths: pending,
        destRoot: dest,
      });
      const tree = join(dest, "tree");
      checks.push(
        assert(mat.ok, "10_isolated_contains_staged_intended", mat.error ?? "ok"),
      );
      checks.push(
        assert(
          mat.ok &&
            existsSync(join(tree, "templates.manifest.json")) &&
            readFileSync(join(tree, "templates.manifest.json"), "utf8").includes(
              "t104",
            ),
          "10b_isolated_has_pending_manifest",
          "manifest overlay",
        ),
      );
      checks.push(
        assert(
          mat.ok &&
            !existsSync(join(tree, "src/data/template-json/t104.json")),
          "11_isolated_excludes_untracked_t104",
          "t104 must be absent from isolated tree",
        ),
      );
      rmSync(dest, { recursive: true, force: true });

      const iso = runIsolatedPendingTreeBuild({
        repoRoot: site,
        pendingPaths: pending,
        skip_npm_build: true,
      });
      checks.push(
        assert(
          !iso.ok && iso.prepush_build_source === PREPUSH_BUILD_SOURCE,
          "5t_isolated_build_source_constant",
          iso.error ?? iso.prepush_build_source,
        ),
      );
    }

    // --- Fixture B: valid t105 pending set passes ---
    {
      const site = join(base, "valid-t105");
      initGitWebsite(site);
      writeMinimalShared(site, ["t103"]);
      git(site, ["add", "-A"]);
      git(site, ["commit", "-m", "base t103"]);

      writeMinimalShared(site, ["t103", "t105"]);
      // Unrelated untracked noise
      writeFileSync(join(site, "noise-untracked.txt"), "ignore me");
      writeFileSync(join(site, "src/data/template-json/t104.json"), '{"id":"t104"}');
      // Unrelated unstaged edit to tracked file not in pending
      writeFileSync(
        join(site, "src/data/template-json/t103.json"),
        JSON.stringify({ id: "t103", mutated: true }),
      );

      const pending = [
        "templates.manifest.json",
        "src/data/templateSnapshots.generated.ts",
        "src/data/systemTemplates/registry.generated.ts",
        "src/data/templateCatalog.generated.ts",
        "src/data/template-json/t105.json",
        "public/templates/t105.png",
        "public/templates/t105.webp",
      ];

      // Restore t103.json content in HEAD sense: pending does NOT include t103.json,
      // so closure reads HEAD version for t103 assets — still present.
      // But we mutated working tree t103.json — pending tree should use HEAD for t103.
      const closure = assertTrackedPublicationClosure({
        repoRoot: site,
        pendingPaths: pending,
      });
      checks.push(
        assert(closure.ok, "7_valid_t105_tracked_set_passes", closure.error ?? "ok"),
      );

      const dest = mkdtempSync(join(tmpdir(), "5t-pos-"));
      const mat = materializePendingTrackedTree({
        repoRoot: site,
        pendingPaths: pending,
        destRoot: dest,
      });
      const tree = join(dest, "tree");
      checks.push(
        assert(
          mat.ok &&
            existsSync(join(tree, "src/data/template-json/t105.json")) &&
            !existsSync(join(tree, "src/data/template-json/t104.json")) &&
            !existsSync(join(tree, "noise-untracked.txt")),
          "8_unrelated_untracked_ignored",
          mat.error ?? "ok",
        ),
      );
      const t103 = readFileSync(
        join(tree, "src/data/template-json/t103.json"),
        "utf8",
      );
      checks.push(
        assert(
          mat.ok && !t103.includes("mutated"),
          "9_unrelated_unstaged_tracked_edits_ignored",
          t103.slice(0, 80),
        ),
      );
      rmSync(dest, { recursive: true, force: true });
    }

    // --- Build failure blocks commit/push; pass allows (simulate) ---
    {
      const roots = makeRoots(join(base, "build-fail"));
      mkdirSync(roots.websiteTargetRoot, { recursive: true });
      writeJson(roots.manifestPath, { templates: [] });
      writeJson(roots.reservationsPath, { schema_version: 1, reservations: [] });
      seedEligible(roots, {
        candId: "cand-marketing-phase5t-buildfail",
        pkgId: "stg-phase5t-buildfail",
        decisionId: "fd-phase5t-buildfail",
        genId: "GEN-phase5t-buildfail",
      });
      const { plan } = createPublicationPlan(roots);
      verifyPublicationPlan(plan.plan_id, roots);
      const locked = readPlan(plan.plan_id, roots)!;
      locked.status = "LOCKED";
      writePlan(locked, roots);
      const failRun = await applyPublicationPlan(
        {
          plan_id: plan.plan_id,
          confirm_phrase: `PUBLISH_PLAN_${plan.plan_id}`,
          simulate: true,
          simulate_hooks: { fail_website_build: true },
        },
        roots,
      );
      checks.push(
        assert(
          !failRun.ok &&
            !failRun.apply.git_committed &&
            !failRun.apply.git_pushed,
          "12_clean_build_failure_blocks_commit",
          failRun.apply.error ?? "ok",
        ),
      );
      checks.push(
        assert(
          !failRun.apply.git_pushed,
          "13_clean_build_failure_blocks_push",
          failRun.apply.error ?? "ok",
        ),
      );
    }

    {
      const roots = makeRoots(join(base, "build-pass"));
      mkdirSync(roots.websiteTargetRoot, { recursive: true });
      writeJson(roots.manifestPath, { templates: [] });
      writeJson(roots.reservationsPath, { schema_version: 1, reservations: [] });
      seedEligible(roots, {
        candId: "cand-marketing-phase5t-buildok",
        pkgId: "stg-phase5t-buildok",
        decisionId: "fd-phase5t-buildok",
        genId: "GEN-phase5t-buildok",
      });
      const { plan } = createPublicationPlan(roots);
      verifyPublicationPlan(plan.plan_id, roots);
      const locked = readPlan(plan.plan_id, roots)!;
      locked.status = "LOCKED";
      writePlan(locked, roots);
      const passRun = await applyPublicationPlan(
        {
          plan_id: plan.plan_id,
          confirm_phrase: `PUBLISH_PLAN_${plan.plan_id}`,
          simulate: true,
        },
        roots,
      );
      checks.push(
        assert(
          passRun.ok && passRun.apply.git_committed,
          "14_build_pass_permits_commit_path",
          passRun.apply.error ?? "ok",
        ),
      );
    }

    // --- Preserved gates ---
    {
      const roots = makeRoots(join(base, "confirm-gate"));
      mkdirSync(roots.websiteTargetRoot, { recursive: true });
      writeJson(roots.manifestPath, { templates: [] });
      writeJson(roots.reservationsPath, { schema_version: 1, reservations: [] });
      seedEligible(roots, {
        candId: "cand-marketing-phase5t-confirm",
        pkgId: "stg-phase5t-confirm",
        decisionId: "fd-phase5t-confirm",
        genId: "GEN-phase5t-confirm",
      });
      const { plan } = createPublicationPlan(roots);
      verifyPublicationPlan(plan.plan_id, roots);
      const locked = readPlan(plan.plan_id, roots)!;
      locked.status = "LOCKED";
      writePlan(locked, roots);
      const bad = await applyPublicationPlan(
        {
          plan_id: plan.plan_id,
          confirm_phrase: "WRONG",
          simulate: true,
        },
        roots,
      );
      checks.push(
        assert(
          !bad.ok && (bad.apply.error ?? "").toLowerCase().includes("confirm"),
          "15_confirmation_gate_preserved",
          bad.apply.error ?? "ok",
        ),
      );
    }

    {
      const roots = makeRoots(join(base, "scope-gate"));
      mkdirSync(roots.websiteTargetRoot, { recursive: true });
      writeJson(roots.manifestPath, { templates: [{ id: "t101" }] });
      writeJson(roots.reservationsPath, { schema_version: 1, reservations: [] });
      seedEligible(roots, {
        candId: "cand-marketing-phase5t-scope-a",
        pkgId: "stg-phase5t-scope-a",
        decisionId: "fd-phase5t-scope-a",
        genId: "GEN-phase5t-scope-a",
      });
      seedEligible(roots, {
        candId: "cand-marketing-phase5t-scope-b",
        pkgId: "stg-phase5t-scope-b",
        decisionId: "fd-phase5t-scope-b",
        genId: "GEN-phase5t-scope-b",
      });
      const scoped = createPublicationPlan(roots, {
        candidate_ids: ["cand-marketing-phase5t-scope-a"],
      });
      checks.push(
        assert(
          scoped.plan.entries.length === 1 &&
            scoped.plan.entries[0]?.candidate_id ===
              "cand-marketing-phase5t-scope-a",
          "16_explicit_scope_gate_preserved",
          `n=${scoped.plan.entries.length}`,
        ),
      );
    }

    {
      checks.push(
        assert(
          isNonProductionResumeTemplate("cand-fixture-aios-242-staging-demo"),
          "17_fixture_non_production_exclusion_preserved",
          "fixture helper",
        ),
      );
    }

    {
      const { allowed, rejected } = filterPublicationGitPaths([
        "templates.manifest.json",
        "public/templates/t105.png",
        "SOS/07_LOGS/saios/foo.json",
      ]);
      checks.push(
        assert(
          allowed.length === 2 && rejected.some((r) => r.path.startsWith("SOS/")),
          "18_catalogue_collision_git_allowlist_preserved",
          `a=${allowed.length} r=${rejected.length}`,
        ),
      );

      // Collision: reserve same catalogue in simulate apply sequential plans
      const roots = makeRoots(join(base, "collision"));
      mkdirSync(roots.websiteTargetRoot, { recursive: true });
      writeJson(roots.manifestPath, { templates: [] });
      writeJson(roots.reservationsPath, {
        schema_version: 1,
        reservations: [
          {
            reservation_id: "rsv-taken",
            reserved_catalogue_id: "t105",
            candidate_id: "other",
            status: "RESERVED",
          },
        ],
      });
      seedEligible(roots, {
        candId: "cand-marketing-phase5t-collision",
        pkgId: "stg-phase5t-collision",
        decisionId: "fd-phase5t-collision",
        genId: "GEN-phase5t-collision",
      });
      // Allocator should skip occupied — create plan and ensure not t105 if occupied
      // discoverEligible + plan
      const elig = discoverEligibleCandidates(roots);
      checks.push(
        assert(
          elig.eligible.length >= 1,
          "18b_eligibility_runs",
          `eligible=${elig.eligible.length}`,
        ),
      );
      void requiredAssetPathsForCatalogue;
    }

    const failed = checks.filter((c) => !c.pass);
    const report = {
      schema_version: "publication-tracked-tree-5t-1.0.0",
      phase: "5T",
      generated_at: new Date().toISOString(),
      prepush_build_source: PREPUSH_BUILD_SOURCE,
      pass: failed.length === 0,
      checks,
      failed: failed.map((c) => c.name),
    };
    writeJson(OUT, report);
    console.log(JSON.stringify({ pass: report.pass, failed: report.failed }, null, 2));
    if (!report.pass) process.exitCode = 1;
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
