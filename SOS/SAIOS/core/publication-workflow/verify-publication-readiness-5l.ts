/**
 * Phase 5L — offline publication readiness regression matrix.
 * No OpenAI. No production publish. No Git push. No Vercel.
 */
import { createHash, randomUUID } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  autoStageAfterFounderApproval,
  isNonProductionResumeTemplate,
  reconcileApprovedNotStaged,
} from "../staging/ApprovalStagingHandoff.js";
import type { StageApprovedResult } from "../staging/types.js";
import { discoverEligibleCandidates } from "./EligibilityCollector.js";
import { filterPublicationGitPaths } from "./GitPathAllowlist.js";
import type { PublicationRoots } from "./paths.js";
import {
  createPublicationPlan,
  readPlan,
  writePlan,
} from "./PublicationPlanService.js";
import { applyPublicationPlan } from "./PublicationApplyService.js";
import { verifyPublicationPlan } from "./PublicationVerifyService.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/publication/verify-publication-readiness-5l.json",
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

function seedEmptyWebsite(roots: PublicationRoots): void {
  mkdirSync(roots.websiteTargetRoot, { recursive: true });
  writeJson(roots.manifestPath, {
    templates: [{ id: "t101", title: "Existing" }],
  });
  writeJson(roots.reservationsPath, { schema_version: 1, reservations: [] });
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
    target: { title: "Phase5L", category: "marketing" },
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
    title: "Phase5L",
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

async function main(): Promise<void> {
  process.env.SOS_AIOS_LIVE = "0";
  delete process.env.SOS_AIOS_PUBLICATION_APPLY;
  delete process.env.SOS_AIOS_PUBLICATION_AUTO_APPLY;

  const checks: Check[] = [];
  const base = join(
    REPO,
    "SOS/07_LOGS/saios/publication/.tmp-phase5l-verify",
    randomUUID().slice(0, 8),
  );
  mkdirSync(base, { recursive: true });

  try {
    // 1+2 zero eligible / empty fingerprint
    {
      const roots = makeRoots(join(base, "zero"));
      seedEmptyWebsite(roots);
      mkdirSync(roots.lifecycleRoot, { recursive: true });
      mkdirSync(roots.candidatesRoot, { recursive: true });
      writeFileSync(roots.decisionsJsonl, "");
      const { plan } = createPublicationPlan(roots);
      checks.push(
        assert(
          plan.entries.length === 0,
          "zero_eligible_plan_created",
          String(plan.entries.length),
        ),
      );
      const report = verifyPublicationPlan(plan.plan_id, roots);
      checks.push(
        assert(
          report.pass &&
            report.checks.some((c) => c.name === "zero_eligible_no_work"),
          "zero_eligible_verify_pass",
          JSON.stringify(report.errors),
        ),
      );
      const mutated = readPlan(plan.plan_id, roots)!;
      (mutated as { eligibility_fingerprint?: string }).eligibility_fingerprint =
        undefined as unknown as string;
      writePlan(mutated, roots);
      const report2 = verifyPublicationPlan(plan.plan_id, roots);
      checks.push(
        assert(report2.pass, "empty_fingerprint_zero_eligible_safe", "ok"),
      );
    }

    // 3 fingerprint mismatch fail-closed
    {
      const roots = makeRoots(join(base, "fp-mismatch"));
      seedEmptyWebsite(roots);
      seedEligible(roots, {
        candId: "cand-marketing-phase5l-fp",
        pkgId: "stg-phase5l-fp",
        decisionId: "fd-phase5l-fp",
        genId: "GEN-phase5l-fp",
      });
      const { plan } = createPublicationPlan(roots);
      const bad = readPlan(plan.plan_id, roots)!;
      bad.eligibility_fingerprint = "deadbeef".repeat(8);
      writePlan(bad, roots);
      const report = verifyPublicationPlan(plan.plan_id, roots);
      checks.push(
        assert(
          !report.pass &&
            report.checks.some(
              (c) => c.name === "eligibility_fingerprint_stable" && !c.pass,
            ),
          "nonempty_fingerprint_mismatch_fails",
          "ok",
        ),
      );
    }

    // 4+5 future APPROVE auto-stage once + duplicate
    {
      const candRoot = join(base, "handoff-cands");
      const cand = "cand-marketing-phase5l-future-approve";
      mkdirSync(join(candRoot, cand), { recursive: true });
      writeJson(join(candRoot, cand, "candidate.json"), {
        candidate_id: cand,
        publication_allowed: false,
        target: { title: "Future Approve" },
      });
      let calls = 0;
      const packages: string[] = [];
      const stageFn = async (input: {
        candidate_id: string;
        decision_id?: string | null;
      }): Promise<StageApprovedResult> => {
        calls += 1;
        const pkg = `stg-from-${input.decision_id}`;
        if (!packages.includes(pkg)) packages.push(pkg);
        return {
          ok: true,
          idempotent: calls > 1,
          candidate_id: input.candidate_id,
          generation_id: "GEN-future",
          staging_package_id: pkg,
          staging_path: `packages/${pkg}`,
          lifecycle_status: "VALIDATED",
          validation: { pass: true } as StageApprovedResult["validation"],
          error: null,
          publication_allowed: false,
        };
      };
      const r1 = await autoStageAfterFounderApproval(
        {
          candidate_id: cand,
          decision: "APPROVED",
          decision_id: "fd-future-1",
        },
        {
          candidatesRoot: candRoot,
          stageFn,
          readLife: () => null,
        },
      );
      checks.push(
        assert(
          r1.attempted &&
            r1.staging?.ok === true &&
            r1.staging.staging_package_id === "stg-from-fd-future-1",
          "future_approve_auto_stages_once",
          r1.staging?.staging_package_id ?? "none",
        ),
      );
      const r2 = await autoStageAfterFounderApproval(
        {
          candidate_id: cand,
          decision: "APPROVED",
          decision_id: "fd-future-1",
        },
        {
          candidatesRoot: candRoot,
          stageFn,
          readLife: () => ({
            candidate_id: cand,
            generation_id: "GEN-future",
            lifecycle_status: "VALIDATED",
            approval_decision_id: "fd-future-1",
            founder_approved_at: new Date().toISOString(),
            staging_package_id: "stg-from-fd-future-1",
            content_fingerprint: "x",
            publication_allowed: false,
            updated_at: new Date().toISOString(),
          }),
        },
      );
      checks.push(
        assert(
          r2.skipped &&
            r2.skip_reason === "already_staged_or_validated" &&
            packages.length === 1,
          "duplicate_approve_no_duplicate_package",
          `calls=${calls} pkgs=${packages.length} skip=${r2.skip_reason}`,
        ),
      );
    }

    // 6+7+10+11 non-approval / fixture / published
    {
      checks.push(
        assert(
          (
            await autoStageAfterFounderApproval({
              candidate_id: "cand-marketing-x",
              decision: "CHANGES_REQUESTED",
              decision_id: "d1",
            })
          ).skip_reason === "not_approved",
          "changes_requested_not_staged",
          "ok",
        ),
      );
      checks.push(
        assert(
          (
            await autoStageAfterFounderApproval({
              candidate_id: "cand-marketing-x",
              decision: "REJECTED",
              decision_id: "d2",
            })
          ).skip_reason === "not_approved",
          "rejected_not_staged",
          "ok",
        ),
      );
      checks.push(
        assert(
          isNonProductionResumeTemplate("cand-fixture-aios-242-staging-demo"),
          "fixture_id_excluded",
          "ok",
        ),
      );
      checks.push(
        assert(
          (
            await autoStageAfterFounderApproval({
              candidate_id: "cand-fixture-aios-243-not-validated",
              decision: "APPROVED",
              decision_id: "d3",
            })
          ).skip_reason === "fixture_or_debug",
          "fixture_not_auto_staged",
          "ok",
        ),
      );
      const published = await autoStageAfterFounderApproval(
        {
          candidate_id: "cand-marketing-phase5l-published",
          decision: "APPROVED",
          decision_id: "d4",
        },
        {
          candidatesRoot: join(base, "pub-cands"),
          readLife: () => ({
            candidate_id: "cand-marketing-phase5l-published",
            generation_id: "G",
            lifecycle_status: "PUBLISHED",
            approval_decision_id: "d4",
            founder_approved_at: new Date().toISOString(),
            staging_package_id: "stg-old",
            content_fingerprint: "x",
            publication_allowed: false,
            updated_at: new Date().toISOString(),
          }),
          stageFn: async () => {
            throw new Error("should not stage published");
          },
        },
      );
      // need candidate.json for missing check order — published checked before missing
      mkdirSync(
        join(base, "pub-cands", "cand-marketing-phase5l-published"),
        { recursive: true },
      );
      writeJson(
        join(base, "pub-cands", "cand-marketing-phase5l-published", "candidate.json"),
        { candidate_id: "cand-marketing-phase5l-published", publication_allowed: false },
      );
      const published2 = await autoStageAfterFounderApproval(
        {
          candidate_id: "cand-marketing-phase5l-published",
          decision: "APPROVED",
          decision_id: "d4",
        },
        {
          candidatesRoot: join(base, "pub-cands"),
          readLife: () => ({
            candidate_id: "cand-marketing-phase5l-published",
            generation_id: "G",
            lifecycle_status: "PUBLISHED",
            approval_decision_id: "d4",
            founder_approved_at: new Date().toISOString(),
            staging_package_id: "stg-old",
            content_fingerprint: "x",
            publication_allowed: false,
            updated_at: new Date().toISOString(),
          }),
          stageFn: async () => {
            throw new Error("should not stage published");
          },
        },
      );
      void published;
      checks.push(
        assert(
          published2.skip_reason === "already_published",
          "published_not_restaged",
          String(published2.skip_reason),
        ),
      );
    }

    // 8+12 superseded + revision approval + staging failure keeps approval
    {
      const candRoot = join(base, "rev-cands");
      const original = "cand-creative-phase5l-original";
      const revised = "cand-creative-phase5l-original-revfb-aaaa11";
      mkdirSync(join(candRoot, original), { recursive: true });
      mkdirSync(join(candRoot, revised), { recursive: true });
      writeJson(join(candRoot, original, "candidate.json"), {
        candidate_id: original,
        publication_allowed: false,
        superseded_by_revision: revised,
      });
      writeJson(join(candRoot, revised, "candidate.json"), {
        candidate_id: revised,
        publication_allowed: false,
      });
      const skipSuper = await autoStageAfterFounderApproval(
        {
          candidate_id: original,
          decision: "APPROVED",
          decision_id: "d-super",
        },
        { candidatesRoot: candRoot },
      );
      checks.push(
        assert(
          skipSuper.skip_reason === "superseded",
          "superseded_not_staged",
          String(skipSuper.skip_reason),
        ),
      );
      let revisedStaged = false;
      const stageRev = await autoStageAfterFounderApproval(
        {
          candidate_id: revised,
          decision: "APPROVED",
          decision_id: "d-rev",
        },
        {
          candidatesRoot: candRoot,
          readLife: () => null,
          stageFn: async () => {
            revisedStaged = true;
            return {
              ok: true,
              idempotent: false,
              candidate_id: revised,
              generation_id: "G",
              staging_package_id: "stg-rev",
              staging_path: "packages/stg-rev",
              lifecycle_status: "VALIDATED",
              validation: { pass: true } as StageApprovedResult["validation"],
              error: null,
              publication_allowed: false,
            };
          },
        },
      );
      checks.push(
        assert(
          stageRev.attempted && revisedStaged && stageRev.staging?.ok === true,
          "revised_approved_stages",
          stageRev.staging?.staging_package_id ?? "none",
        ),
      );

      const failStage = await autoStageAfterFounderApproval(
        {
          candidate_id: revised,
          decision: "APPROVED",
          decision_id: "d-fail",
        },
        {
          candidatesRoot: candRoot,
          readLife: () => ({
            candidate_id: revised,
            generation_id: "G",
            lifecycle_status: "APPROVED",
            approval_decision_id: "d-fail",
            founder_approved_at: new Date().toISOString(),
            staging_package_id: null,
            content_fingerprint: "x",
            publication_allowed: false,
            updated_at: new Date().toISOString(),
          }),
          stageFn: async () => ({
            ok: false,
            idempotent: false,
            candidate_id: revised,
            generation_id: "G",
            staging_package_id: null,
            staging_path: null,
            lifecycle_status: "STAGING_FAILED",
            validation: null,
            error: "validation failed offline",
            publication_allowed: false,
          }),
        },
      );
      checks.push(
        assert(
          failStage.attempted &&
            failStage.staging?.ok === false &&
            failStage.staging.lifecycle_status === "STAGING_FAILED",
          "stage_failure_leaves_approval_path",
          failStage.staging?.error ?? "ok",
        ),
      );
    }

    // 13–17 build pass/fail + unrelated dirty + git allowlist
    {
      const { allowed, rejected } = filterPublicationGitPaths([
        "templates.manifest.json",
        "public/templates/t105.json",
        "SOS/07_LOGS/saios/foo.json",
        ".env",
        "package.json",
      ]);
      checks.push(
        assert(
          allowed.length === 2 &&
            rejected.some((r) => r.path.startsWith("SOS/")) &&
            rejected.some((r) => r.path === ".env") &&
            rejected.some((r) => r.path === "package.json"),
          "explicit_git_allowlist_regression",
          `a=${allowed.length} r=${rejected.length}`,
        ),
      );
    }

    {
      const roots = makeRoots(join(base, "build-pass"));
      seedEmptyWebsite(roots);
      seedEligible(roots, {
        candId: "cand-marketing-phase5l-buildok",
        pkgId: "stg-phase5l-buildok",
        decisionId: "fd-phase5l-buildok",
        genId: "GEN-phase5l-buildok",
      });
      const { plan } = createPublicationPlan(roots);
      checks.push(
        assert(
          verifyPublicationPlan(plan.plan_id, roots).pass,
          "build_pass_plan_verified",
          "ok",
        ),
      );
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
          "successful_build_allows_execution",
          passRun.apply.error ?? "ok",
        ),
      );
    }

    {
      const roots = makeRoots(join(base, "build-fail"));
      seedEmptyWebsite(roots);
      seedEligible(roots, {
        candId: "cand-marketing-phase5l-buildfail",
        pkgId: "stg-phase5l-buildfail",
        decisionId: "fd-phase5l-buildfail",
        genId: "GEN-phase5l-buildfail",
      });
      const { plan } = createPublicationPlan(roots);
      verifyPublicationPlan(plan.plan_id, roots);
      const locked = readPlan(plan.plan_id, roots)!;
      locked.status = "LOCKED";
      writePlan(locked, roots);
      mkdirSync(roots.websiteTargetRoot, { recursive: true });
      const unrelated = join(roots.websiteTargetRoot, "keep-dirty.txt");
      writeFileSync(unrelated, "preserve");
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
          "failed_build_blocks_commit_push",
          failRun.apply.error ?? "",
        ),
      );
      checks.push(
        assert(
          readFileSync(unrelated, "utf8") === "preserve",
          "failed_build_preserves_unrelated_dirty",
          "ok",
        ),
      );
      checks.push(
        assert(
          !(failRun.execution?.phases_completed ?? []).includes("COMMITTED") &&
            !(failRun.execution?.phases_completed ?? []).includes(
              "WEBSITE_WRITES_APPLIED",
            ),
          "failed_build_rolls_back_before_commit_phase",
          (failRun.execution?.phases_completed ?? []).join(","),
        ),
      );
    }

    // 19 confirm gates
    {
      const roots = makeRoots(join(base, "confirm"));
      seedEmptyWebsite(roots);
      mkdirSync(roots.lifecycleRoot, { recursive: true });
      writeFileSync(roots.decisionsJsonl, "");
      const { plan } = createPublicationPlan(roots);
      const refused = await applyPublicationPlan(
        {
          plan_id: plan.plan_id,
          confirm_phrase: "WRONG",
          execute_writes: true,
        },
        roots,
      );
      checks.push(
        assert(!refused.ok, "apply_confirm_gates_unchanged", refused.apply.error ?? "ok"),
      );
    }

    // 20 nightly PLAN_AND_VERIFY
    {
      const nightly = readFileSync(
        join(REPO, "SOS/SAIOS/infra/scripts/aios-publication-nightly.sh"),
        "utf8",
      );
      const unit = readFileSync(
        join(REPO, "SOS/SAIOS/infra/systemd/aios-publication-nightly.service"),
        "utf8",
      );
      checks.push(
        assert(
          nightly.includes("aios:publication:plan") &&
            nightly.includes("aios:publication:verify") &&
            nightly.includes("refusing silent apply") &&
            !/npm run aios:publication:apply/.test(nightly) &&
            unit.includes("SOS_AIOS_PUBLICATION_AUTO_APPLY=0") &&
            nightly.includes("grep -v") &&
            nightly.includes(".verification.json"),
          "nightly_remains_plan_and_verify",
          "ok",
        ),
      );
    }

    {
      const dry = await reconcileApprovedNotStaged({ execute: false });
      checks.push(
        assert(
          dry.dry_run &&
            dry.watched_command.includes("aios:staging:reconcile-approved"),
          "historical_backlog_reconcile_command",
          dry.watched_command,
        ),
      );
    }

    {
      const roots = makeRoots(join(base, "disc"));
      seedEmptyWebsite(roots);
      mkdirSync(roots.lifecycleRoot, { recursive: true });
      writeFileSync(roots.decisionsJsonl, "");
      const d = discoverEligibleCandidates(roots);
      checks.push(
        assert(
          d.eligibility_fingerprint.length === 64 && d.eligible.length === 0,
          "canonical_empty_set_fingerprint",
          d.eligibility_fingerprint.slice(0, 12),
        ),
      );
    }
  } finally {
    rmSync(base, { recursive: true, force: true });
  }

  const allPass = checks.every((c) => c.pass);
  const result = {
    generated_at: new Date().toISOString(),
    phase: "5L",
    overall: allPass ? "PASS" : "FAIL",
    live: false,
    publication_allowed: false,
    openai: false,
    ZERO_ELIGIBLE_VERIFY: checks.find((c) => c.name === "zero_eligible_verify_pass")
      ?.pass
      ? "PASS"
      : "FAIL",
    checks,
    failed: checks.filter((c) => !c.pass).map((c) => c.name),
  };
  writeJson(OUT, result);
  console.log(JSON.stringify(result, null, 2));
  if (!allPass) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
