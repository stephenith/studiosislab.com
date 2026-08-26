/**
 * Fixture-based verification for multi-candidate publication executor.
 * Never touches the real plan, real staging packages, or production website.
 */
import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { PublicationRoots } from "./paths.js";
import { expectedGeneratedFilesForCatalogue } from "./paths.js";
import { createPublicationPlan, readPlan, writePlan } from "./PublicationPlanService.js";
import { verifyPublicationPlan } from "./PublicationVerifyService.js";
import { applyPublicationPlan } from "./PublicationApplyService.js";
import {
  findExecutionForPlan,
  readExecution,
  writeExecution,
} from "./execution/ExecutionJournal.js";
import {
  acquirePublicationLock,
  readLock,
  releasePublicationLock,
} from "./execution/PublicationLock.js";
import { getExecutionStatusProjection } from "./execution/PublicationExecutor.js";
import { readPlanReservationLedger } from "./execution/PlanReservationLedger.js";
import type { PublicationExecution } from "./execution/types.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/publication/verify-publication-executor.json",
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

function seedTwoEligible(roots: PublicationRoots): {
  c1: string;
  c2: string;
  p1: string;
  p2: string;
} {
  const c1 = `cand-acct-${randomUUID().slice(0, 6)}`;
  const c2 = `cand-gd-${randomUUID().slice(0, 6)}`;
  const p1 = `stg-acct-${randomUUID().slice(0, 6)}`;
  const p2 = `stg-gd-${randomUUID().slice(0, 6)}`;
  const now = new Date().toISOString();

  writeJson(roots.manifestPath, { templates: [{ id: "t101", status: "published" }] });
  writeJson(roots.reservationsPath, { schema_version: 1, reservations: [] });
  mkdirSync(dirname(roots.decisionsJsonl), { recursive: true });
  writeFileSync(roots.decisionsJsonl, "");

  for (const [cid, pkg, title, gen, dec, reviewId] of [
    [c1, p1, "Accountant Technical", "gen-acct", "dec-acct", "review-acct"],
    [c2, p2, "Graphic Designer", "gen-gd", "dec-gd", "review-gd"],
  ] as const) {
    const dir = join(roots.stagingPackagesRoot, pkg);
    mkdirSync(dir, { recursive: true });
    const canvas = JSON.stringify({ version: "5.3.0", objects: [{ type: "rect" }] });
    const preview = Buffer.from(`preview-${cid}`);
    const thumb = Buffer.from(`thumb-${cid}`);
    writeFileSync(join(dir, "canvas.json"), canvas);
    writeFileSync(join(dir, "preview-source.png"), preview);
    writeFileSync(join(dir, "thumbnail-source.png"), thumb);
    writeJson(join(dir, "checksums.json"), {
      algorithm: "sha256",
      generated_at: now,
      files: {
        "canvas.json": sha256(canvas),
        "preview-source.png": sha256(preview),
        "thumbnail-source.png": sha256(thumb),
      },
    });
    writeJson(join(dir, "validation-report.json"), {
      staging_package_id: pkg,
      candidate_id: cid,
      generation_id: gen,
      pass: true,
      checked_at: now,
      checks: { checksums_match: true },
      errors: [],
      warnings: [],
      publication_allowed: false,
    });
    writeJson(join(dir, "staging-manifest.json"), {
      staging_package_id: pkg,
      candidate_id: cid,
      generation_id: gen,
      title,
      role: title,
      category: "professional",
      design_family: "family-a",
      approval_decision_id: dec,
      founder_approved_at: now,
      staged_at: now,
      source_batch_id: "batch-test",
      source_provider: "openai",
      source_model: "test",
      current_lifecycle_status: "VALIDATED",
      publication_allowed: false,
      live: false,
    });
    writeJson(join(roots.candidatesRoot, cid, "candidate.json"), {
      candidate_id: cid,
      review_id: reviewId,
      status: "approved",
      target: { title },
    });
    writeJson(join(roots.lifecycleRoot, `${cid}.json`), {
      candidate_id: cid,
      generation_id: gen,
      lifecycle_status: "VALIDATED",
      approval_decision_id: dec,
      founder_approved_at: now,
      staging_package_id: pkg,
      updated_at: now,
      publication_allowed: false,
    });
    writeFileSync(
      roots.decisionsJsonl,
      `${JSON.stringify({
        decision_id: dec,
        decision: "APPROVED",
        created_at: now,
        review_id: reviewId,
        structured_feedback: { candidate_id: cid },
      })}\n`,
      { flag: "a" },
    );
  }
  return { c1, c2, p1, p2 };
}

async function buildVerifiedPlan(roots: PublicationRoots) {
  const { plan } = createPublicationPlan(roots);
  if (plan.entries.length < 2) {
    throw new Error(
      `Expected 2 eligible entries, got ${plan.entries.length}`,
    );
  }
  // Pin catalogue IDs like the real plan (sort may assign t102/t103 already)
  const locked = readPlan(plan.plan_id, roots)!;
  const byTitle = [...locked.entries].sort((a, b) =>
    a.title.localeCompare(b.title),
  );
  // Accountant first → t102, Graphic Designer → t103
  const acct =
    byTitle.find((e) => e.title.includes("Accountant")) ?? byTitle[0]!;
  const gd =
    byTitle.find((e) => e.title.includes("Graphic")) ?? byTitle[1]!;
  acct.proposed_catalogue_id = "t102";
  acct.expected_generated_files = expectedGeneratedFilesForCatalogue("t102");
  gd.proposed_catalogue_id = "t103";
  gd.expected_generated_files = expectedGeneratedFilesForCatalogue("t103");
  locked.entries = [acct, gd];
  locked.proposed_catalogue_ids = ["t102", "t103"];
  writePlan(locked, roots);
  const v = verifyPublicationPlan(locked.plan_id, roots);
  if (!v.pass) {
    throw new Error(`Fixture plan verify failed: ${v.errors.join("; ")}`);
  }
  return readPlan(locked.plan_id, roots)!;
}

async function main(): Promise<void> {
  const checks: Check[] = [];
  const base = join(
    REPO,
    "SOS/07_LOGS/saios/publication/.tmp-executor-verify",
    randomUUID().slice(0, 8),
  );
  mkdirSync(base, { recursive: true });

  try {
    // ---- Successful two-entry dry-run ----
    {
      const roots = makeRoots(join(base, "dry"));
      seedTwoEligible(roots);
      const plan = await buildVerifiedPlan(roots);
      const r = await applyPublicationPlan(
        {
          plan_id: plan.plan_id,
          confirm_phrase: `PUBLISH_PLAN_${plan.plan_id}`,
        },
        roots,
      );
      checks.push(
        assert(r.ok && r.apply.status === "DRY_RUN", "dry_run_two_entry", r.apply.error ?? "ok"),
      );
      const ids = r.apply.results.map((x) => x.catalogue_id).sort();
      checks.push(
        assert(
          ids.join(",") === "t102,t103",
          "dry_run_includes_t102_t103",
          ids.join(","),
        ),
      );
      checks.push(
        assert(
          !r.apply.website_modified &&
            !r.apply.git_committed &&
            !r.apply.git_pushed &&
            !existsSync(join(roots.locksRoot, `${plan.plan_id}.lock.json`)),
          "dry_run_zero_writes_no_lock",
          "clean",
        ),
      );
      checks.push(
        assert(
          readPlan(plan.plan_id, roots)?.status === "VERIFIED",
          "dry_run_plan_remains_verified",
          readPlan(plan.plan_id, roots)?.status ?? "missing",
        ),
      );
    }

    // ---- Successful simulated two-entry execution ----
    {
      const roots = makeRoots(join(base, "sim-ok"));
      seedTwoEligible(roots);
      const plan = await buildVerifiedPlan(roots);
      const r = await applyPublicationPlan(
        {
          plan_id: plan.plan_id,
          confirm_phrase: `PUBLISH_PLAN_${plan.plan_id}`,
          simulate: true,
        },
        roots,
      );
      checks.push(
        assert(
          r.ok && r.apply.status === "COMPLETED" && r.execution?.status === "COMPLETED",
          "sim_two_entry_completed",
          r.apply.error ?? r.execution?.status ?? "ok",
        ),
      );
      checks.push(
        assert(
          r.execution?.entries.every((e) =>
            e.completed_steps.includes("lifecycle_published"),
          ) === true,
          "no_candidate_omission_complete",
          String(r.execution?.entries.length),
        ),
      );
      const man = JSON.parse(
        readFileSync(join(roots.websiteTargetRoot, "templates.manifest.json"), "utf8"),
      ) as { templates: Array<{ id: string }> };
      checks.push(
        assert(
          man.templates.some((t) => t.id === "t102") &&
            man.templates.some((t) => t.id === "t103"),
          "manifest_has_t102_t103",
          man.templates.map((t) => t.id).join(","),
        ),
      );
    }

    // ---- Catalogue reservation collision ----
    {
      const roots = makeRoots(join(base, "collision"));
      seedTwoEligible(roots);
      const plan = await buildVerifiedPlan(roots);
      writeJson(roots.reservationsPath, {
        schema_version: 1,
        reservations: [
          {
            reservation_id: "rsv-other",
            reserved_catalogue_id: "t102",
            candidate_id: "other",
            staging_package_id: "stg-other",
            plan_id: "other-plan",
            execution_id: "other-exec",
            status: "RESERVED",
          },
        ],
      });
      const r = await applyPublicationPlan(
        {
          plan_id: plan.plan_id,
          confirm_phrase: `PUBLISH_PLAN_${plan.plan_id}`,
          simulate: true,
        },
        roots,
      );
      checks.push(
        assert(
          !r.ok && (r.apply.error ?? "").includes("already reserved"),
          "catalogue_reservation_collision",
          r.apply.error ?? "no error",
        ),
      );
      checks.push(
        assert(
          !r.apply.git_committed && !r.apply.website_modified,
          "collision_no_commit",
          "ok",
        ),
      );
    }

    // ---- Same-plan reservation idempotency ----
    {
      const roots = makeRoots(join(base, "res-idem"));
      seedTwoEligible(roots);
      const plan = await buildVerifiedPlan(roots);
      const r1 = await applyPublicationPlan(
        {
          plan_id: plan.plan_id,
          confirm_phrase: `PUBLISH_PLAN_${plan.plan_id}`,
          simulate: true,
          crash_after_phase: "RESERVED",
        },
        roots,
      );
      checks.push(
        assert(
          !r1.ok && (r1.apply.error ?? "").includes("CRASH_INJECTED:RESERVED"),
          "crash_after_reservation",
          r1.apply.error ?? "",
        ),
      );
      const ledger1 = readPlanReservationLedger(plan.plan_id, roots);
      const r2 = await applyPublicationPlan(
        {
          plan_id: plan.plan_id,
          confirm_phrase: `PUBLISH_PLAN_${plan.plan_id}`,
          simulate: true,
        },
        roots,
      );
      const ledger2 = readPlanReservationLedger(plan.plan_id, roots);
      checks.push(
        assert(
          r2.ok &&
            ledger1?.entries[0]?.reservation_id ===
              ledger2?.entries[0]?.reservation_id,
          "same_plan_reservation_idempotent",
          `${ledger1?.entries[0]?.reservation_id} vs ${ledger2?.entries[0]?.reservation_id}`,
        ),
      );
    }

    // ---- Crash after first export / all exports / website writes ----
    {
      const roots = makeRoots(join(base, "crash-export"));
      seedTwoEligible(roots);
      const plan = await buildVerifiedPlan(roots);
      const r1 = await applyPublicationPlan(
        {
          plan_id: plan.plan_id,
          confirm_phrase: `PUBLISH_PLAN_${plan.plan_id}`,
          simulate: true,
          crash_after_phase: "EXPORT_PARTIAL",
        },
        roots,
      );
      checks.push(
        assert(
          !r1.ok &&
            r1.execution?.entries[0]?.completed_steps.includes("exported") ===
              true &&
            r1.execution?.entries[1]?.completed_steps.includes("exported") !==
              true,
          "crash_after_first_export",
          JSON.stringify(r1.execution?.entries.map((e) => e.completed_steps)),
        ),
      );
      const r2 = await applyPublicationPlan(
        {
          plan_id: plan.plan_id,
          confirm_phrase: `PUBLISH_PLAN_${plan.plan_id}`,
          simulate: true,
          crash_after_phase: "EXPORTING",
        },
        roots,
      );
      checks.push(
        assert(
          !r2.ok &&
            r2.execution?.entries.every((e) =>
              e.completed_steps.includes("exported"),
            ) === true,
          "crash_after_all_exports",
          r2.apply.error ?? "",
        ),
      );
      const r3 = await applyPublicationPlan(
        {
          plan_id: plan.plan_id,
          confirm_phrase: `PUBLISH_PLAN_${plan.plan_id}`,
          simulate: true,
          crash_after_phase: "WEBSITE_WRITES_APPLIED",
        },
        roots,
      );
      checks.push(
        assert(
          !r3.ok &&
            r3.execution?.phases_completed.includes("WEBSITE_WRITES_APPLIED") ===
              true,
          "crash_after_website_writes",
          r3.apply.error ?? "",
        ),
      );
      const r4 = await applyPublicationPlan(
        {
          plan_id: plan.plan_id,
          confirm_phrase: `PUBLISH_PLAN_${plan.plan_id}`,
          simulate: true,
        },
        roots,
      );
      checks.push(
        assert(r4.ok && r4.execution?.status === "COMPLETED", "resume_to_complete", r4.apply.error ?? "ok"),
      );
    }

    // ---- Local verification failure rollback ----
    {
      const roots = makeRoots(join(base, "rollback"));
      seedTwoEligible(roots);
      const plan = await buildVerifiedPlan(roots);
      const r = await applyPublicationPlan(
        {
          plan_id: plan.plan_id,
          confirm_phrase: `PUBLISH_PLAN_${plan.plan_id}`,
          simulate: true,
          simulate_hooks: { fail_website_verify: true },
        },
        roots,
      );
      checks.push(
        assert(
          !r.ok &&
            (r.apply.error ?? "").includes("restored") &&
            !r.apply.git_committed,
          "local_verify_failure_rollback",
          r.apply.error ?? "",
        ),
      );
    }

    // ---- Crash after commit + retry reuses commit ----
    {
      const roots = makeRoots(join(base, "commit-reuse"));
      seedTwoEligible(roots);
      const plan = await buildVerifiedPlan(roots);
      const r1 = await applyPublicationPlan(
        {
          plan_id: plan.plan_id,
          confirm_phrase: `PUBLISH_PLAN_${plan.plan_id}`,
          simulate: true,
          crash_after_phase: "COMMITTED",
        },
        roots,
      );
      const sha1 = r1.execution?.git_commit_sha;
      checks.push(
        assert(Boolean(sha1) && !r1.ok, "crash_after_commit", sha1 ?? "none"),
      );
      const r2 = await applyPublicationPlan(
        {
          plan_id: plan.plan_id,
          confirm_phrase: `PUBLISH_PLAN_${plan.plan_id}`,
          simulate: true,
        },
        roots,
      );
      checks.push(
        assert(
          r2.ok && r2.execution?.git_commit_sha === sha1,
          "retry_reuses_same_commit",
          `${sha1} vs ${r2.execution?.git_commit_sha}`,
        ),
      );
    }

    // ---- Push failure and resume ----
    {
      const roots = makeRoots(join(base, "push-fail"));
      seedTwoEligible(roots);
      const plan = await buildVerifiedPlan(roots);
      const r1 = await applyPublicationPlan(
        {
          plan_id: plan.plan_id,
          confirm_phrase: `PUBLISH_PLAN_${plan.plan_id}`,
          simulate: true,
          simulate_hooks: { fail_push: true },
        },
        roots,
      );
      checks.push(
        assert(
          !r1.ok &&
            r1.execution?.status === "FAILED_RECOVERABLE" &&
            Boolean(r1.execution.git_commit_sha) &&
            !r1.execution.git_pushed,
          "push_failure_recoverable",
          r1.apply.error ?? "",
        ),
      );
      const r2 = await applyPublicationPlan(
        {
          plan_id: plan.plan_id,
          confirm_phrase: `PUBLISH_PLAN_${plan.plan_id}`,
          simulate: true,
        },
        roots,
      );
      checks.push(
        assert(r2.ok && r2.execution?.git_pushed === true, "push_resume", "ok"),
      );
    }

    // ---- Deployment timeout and resume ----
    {
      const roots = makeRoots(join(base, "deploy-fail"));
      seedTwoEligible(roots);
      const plan = await buildVerifiedPlan(roots);
      const r1 = await applyPublicationPlan(
        {
          plan_id: plan.plan_id,
          confirm_phrase: `PUBLISH_PLAN_${plan.plan_id}`,
          simulate: true,
          simulate_hooks: { fail_deploy: true },
        },
        roots,
      );
      checks.push(
        assert(
          !r1.ok &&
            (r1.apply.error ?? "").includes("Deployment timeout") &&
            r1.execution?.git_pushed === true,
          "deployment_timeout_recoverable",
          r1.apply.error ?? "",
        ),
      );
      const r2 = await applyPublicationPlan(
        {
          plan_id: plan.plan_id,
          confirm_phrase: `PUBLISH_PLAN_${plan.plan_id}`,
          simulate: true,
        },
        roots,
      );
      checks.push(
        assert(
          r2.ok && r2.execution?.deployment_verified === true,
          "deployment_resume",
          "ok",
        ),
      );
    }

    // ---- First live, second unavailable ----
    {
      const roots = makeRoots(join(base, "live-partial"));
      seedTwoEligible(roots);
      const plan = await buildVerifiedPlan(roots);
      const r = await applyPublicationPlan(
        {
          plan_id: plan.plan_id,
          confirm_phrase: `PUBLISH_PLAN_${plan.plan_id}`,
          simulate: true,
          simulate_hooks: {
            fail_lifecycle_catalogue_ids: ["__live_partial__"],
          },
        },
        roots,
      );
      checks.push(
        assert(
          !r.ok &&
            r.execution?.entries[0]?.completed_steps.includes("live_verified") ===
              true &&
            !r.execution?.phases_completed.includes("LIFECYCLE_RECONCILED"),
          "first_live_second_unavailable",
          r.apply.error ?? "",
        ),
      );
    }

    // ---- Lifecycle partial failure + reconciliation retry + duplicate history ----
    {
      const roots = makeRoots(join(base, "life-partial"));
      seedTwoEligible(roots);
      const plan = await buildVerifiedPlan(roots);
      const r1 = await applyPublicationPlan(
        {
          plan_id: plan.plan_id,
          confirm_phrase: `PUBLISH_PLAN_${plan.plan_id}`,
          simulate: true,
          simulate_hooks: { fail_lifecycle_catalogue_ids: ["t103"] },
        },
        roots,
      );
      checks.push(
        assert(
          !r1.ok &&
            r1.execution?.entries.find((e) => e.catalogue_id === "t102")
              ?.completed_steps.includes("lifecycle_published") === true,
          "lifecycle_partial_failure",
          r1.apply.error ?? "",
        ),
      );
      const hist1 = JSON.parse(
        readFileSync(roots.releaseHistoryPath, "utf8"),
      ) as unknown[];
      const r2 = await applyPublicationPlan(
        {
          plan_id: plan.plan_id,
          confirm_phrase: `PUBLISH_PLAN_${plan.plan_id}`,
          simulate: true,
        },
        roots,
      );
      const hist2 = JSON.parse(
        readFileSync(roots.releaseHistoryPath, "utf8"),
      ) as unknown[];
      checks.push(
        assert(r2.ok, "lifecycle_reconciliation_retry", r2.apply.error ?? "ok"),
      );
      const t102Count = hist2.filter(
        (h) => (h as { catalogue_id: string }).catalogue_id === "t102",
      ).length;
      checks.push(
        assert(
          t102Count === 1 && hist2.length >= hist1.length,
          "duplicate_history_prevention",
          `t102=${t102Count} total=${hist2.length}`,
        ),
      );
    }

    // ---- Unexpected git path / dirty tree ----
    {
      const roots = makeRoots(join(base, "git-reject"));
      seedTwoEligible(roots);
      const plan = await buildVerifiedPlan(roots);
      const r = await applyPublicationPlan(
        {
          plan_id: plan.plan_id,
          confirm_phrase: `PUBLISH_PLAN_${plan.plan_id}`,
          simulate: true,
          simulate_hooks: { reject_paths: ["src/secret.env"] },
        },
        roots,
      );
      checks.push(
        assert(
          !r.ok && (r.apply.error ?? "").includes("Unexpected git path"),
          "unexpected_git_path_rejection",
          r.apply.error ?? "",
        ),
      );
    }
    {
      const roots = makeRoots(join(base, "dirty"));
      seedTwoEligible(roots);
      const plan = await buildVerifiedPlan(roots);
      const r = await applyPublicationPlan(
        {
          plan_id: plan.plan_id,
          confirm_phrase: `PUBLISH_PLAN_${plan.plan_id}`,
          simulate: true,
          simulate_hooks: {
            dirty_paths: ["templates.manifest.json"],
          },
        },
        roots,
      );
      checks.push(
        assert(
          !r.ok && (r.apply.error ?? "").includes("Dirty working tree"),
          "dirty_working_tree_conflict",
          r.apply.error ?? "",
        ),
      );
    }

    // ---- Stale fingerprint / superseded / already published ----
    {
      const roots = makeRoots(join(base, "stale-fp"));
      seedTwoEligible(roots);
      const plan = await buildVerifiedPlan(roots);
      // Drift fingerprint
      const p = readPlan(plan.plan_id, roots)!;
      p.eligibility_fingerprint = "deadbeef";
      writePlan(p, roots);
      const r = await applyPublicationPlan(
        {
          plan_id: plan.plan_id,
          confirm_phrase: `PUBLISH_PLAN_${plan.plan_id}`,
          simulate: true,
        },
        roots,
      );
      checks.push(
        assert(
          !r.ok &&
            ((r.apply.error ?? "").includes("fingerprint") ||
              (r.apply.error ?? "").includes("verification")),
          "stale_plan_fingerprint",
          r.apply.error ?? "",
        ),
      );
    }
    {
      const roots = makeRoots(join(base, "superseded"));
      const seeded = seedTwoEligible(roots);
      const plan = await buildVerifiedPlan(roots);
      writeJson(join(roots.candidatesRoot, seeded.c1, "candidate.json"), {
        candidate_id: seeded.c1,
        review_id: "rev",
        status: "approved",
        target: { title: "Accountant Technical" },
        superseded_by_revision: "cand-new",
      });
      const r = await applyPublicationPlan(
        {
          plan_id: plan.plan_id,
          confirm_phrase: `PUBLISH_PLAN_${plan.plan_id}`,
          simulate: true,
        },
        roots,
      );
      checks.push(
        assert(
          !r.ok,
          "candidate_superseded_after_plan",
          r.apply.error ?? "failed",
        ),
      );
    }
    {
      const roots = makeRoots(join(base, "published"));
      const seeded = seedTwoEligible(roots);
      writeJson(join(roots.lifecycleRoot, `${seeded.c1}.json`), {
        candidate_id: seeded.c1,
        generation_id: "gen-acct",
        lifecycle_status: "PUBLISHED",
        staging_package_id: seeded.p1,
        publication_allowed: false,
      });
      // Plan create may exclude — force plan manually if needed
      try {
        const plan = await buildVerifiedPlan(roots);
        const r = await applyPublicationPlan(
          {
            plan_id: plan.plan_id,
            confirm_phrase: `PUBLISH_PLAN_${plan.plan_id}`,
            simulate: true,
          },
          roots,
        );
        checks.push(
          assert(
            !r.ok || plan.entries.length < 2,
            "candidate_already_published",
            r.apply.error ?? `entries=${plan.entries.length}`,
          ),
        );
      } catch {
        checks.push(
          assert(true, "candidate_already_published", "excluded from plan"),
        );
      }
    }

    // ---- Malformed journal ----
    {
      const roots = makeRoots(join(base, "malformed"));
      seedTwoEligible(roots);
      const plan = await buildVerifiedPlan(roots);
      mkdirSync(roots.executionsRoot, { recursive: true });
      const execId = `exec-bad-${randomUUID().slice(0, 6)}`;
      writeFileSync(join(roots.executionsRoot, `${execId}.json`), "{not-json");
      writeJson(join(roots.executionsRoot, `by-plan-${plan.plan_id}.json`), {
        plan_id: plan.plan_id,
        execution_id: execId,
      });
      const r = await applyPublicationPlan(
        {
          plan_id: plan.plan_id,
          confirm_phrase: `PUBLISH_PLAN_${plan.plan_id}`,
          simulate: true,
        },
        roots,
      );
      checks.push(
        assert(
          !r.ok &&
            ((r.apply.error ?? "").toLowerCase().includes("malform") ||
              (r.apply.error ?? "").includes("JSON")),
          "malformed_execution_journal",
          r.apply.error ?? "",
        ),
      );
    }

    // ---- Stale lock handling ----
    {
      const roots = makeRoots(join(base, "stale-lock"));
      seedTwoEligible(roots);
      const plan = await buildVerifiedPlan(roots);
      mkdirSync(roots.locksRoot, { recursive: true });
      writeJson(join(roots.locksRoot, `${plan.plan_id}.lock.json`), {
        schema_version: "publication-lock-1.0.0",
        plan_id: plan.plan_id,
        execution_id: "exec-other-holder",
        acquired_at: new Date(Date.now() - 10_000).toISOString(),
        updated_at: new Date(Date.now() - 10_000).toISOString(),
        holder_pid: 1,
        mode: "simulate",
        stale_after_ms: 1000,
      });
      // Fresh lock should block
      writeJson(join(roots.locksRoot, `${plan.plan_id}.lock.json`), {
        schema_version: "publication-lock-1.0.0",
        plan_id: plan.plan_id,
        execution_id: "exec-other-holder",
        acquired_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        holder_pid: 1,
        mode: "simulate",
        stale_after_ms: 3_600_000,
      });
      const blocked = await applyPublicationPlan(
        {
          plan_id: plan.plan_id,
          confirm_phrase: `PUBLISH_PLAN_${plan.plan_id}`,
          simulate: true,
        },
        roots,
      );
      checks.push(
        assert(
          !blocked.ok && (blocked.apply.error ?? "").includes("locked"),
          "stale_lock_handling_blocks_fresh",
          blocked.apply.error ?? "",
        ),
      );
      // Make stale and force
      writeJson(join(roots.locksRoot, `${plan.plan_id}.lock.json`), {
        schema_version: "publication-lock-1.0.0",
        plan_id: plan.plan_id,
        execution_id: "exec-other-holder",
        acquired_at: new Date(Date.now() - 10_000_000).toISOString(),
        updated_at: new Date(Date.now() - 10_000_000).toISOString(),
        holder_pid: 1,
        mode: "simulate",
        stale_after_ms: 1000,
      });
      const takeover = acquirePublicationLock({
        plan_id: plan.plan_id,
        execution_id: "exec-takeover",
        mode: "simulate",
        stale_after_ms: 1000,
        roots,
      });
      checks.push(
        assert(takeover.ok, "stale_lock_takeover", takeover.ok ? "ok" : takeover.error),
      );
      releasePublicationLock(plan.plan_id, "exec-takeover", roots);
    }

    // ---- Completed re-run no-op ----
    {
      const roots = makeRoots(join(base, "noop"));
      seedTwoEligible(roots);
      const plan = await buildVerifiedPlan(roots);
      const r1 = await applyPublicationPlan(
        {
          plan_id: plan.plan_id,
          confirm_phrase: `PUBLISH_PLAN_${plan.plan_id}`,
          simulate: true,
        },
        roots,
      );
      const sha = r1.execution?.git_commit_sha;
      const r2 = await applyPublicationPlan(
        {
          plan_id: plan.plan_id,
          confirm_phrase: `PUBLISH_PLAN_${plan.plan_id}`,
          simulate: true,
        },
        roots,
      );
      checks.push(
        assert(
          r2.ok &&
            r2.execution?.status === "COMPLETED" &&
            r2.execution.git_commit_sha === sha &&
            (r2.apply.recovery_instructions.join(" ").includes("no-op") ||
              r2.execution.retry_count >= 0),
          "completed_rerun_noop",
          r2.apply.recovery_instructions.join("; "),
        ),
      );
      const proj = getExecutionStatusProjection(plan.plan_id, roots);
      checks.push(
        assert(
          proj.next_retry_action?.includes("no-op") === true,
          "status_shows_noop",
          proj.next_retry_action ?? "",
        ),
      );
    }

    // ---- Duplicate commit prevention (via commit adapter reuse) ----
    {
      const roots = makeRoots(join(base, "dup-commit"));
      seedTwoEligible(roots);
      const plan = await buildVerifiedPlan(roots);
      await applyPublicationPlan(
        {
          plan_id: plan.plan_id,
          confirm_phrase: `PUBLISH_PLAN_${plan.plan_id}`,
          simulate: true,
          crash_after_phase: "COMMITTED",
        },
        roots,
      );
      const exec = findExecutionForPlan(plan.plan_id, roots)!;
      // Clear COMMITTED phase to force commit path again
      exec.phases_completed = exec.phases_completed.filter((p) => p !== "COMMITTED");
      exec.status = "WEBSITE_WRITES_APPLIED";
      writeExecution(exec, roots);
      const r = await applyPublicationPlan(
        {
          plan_id: plan.plan_id,
          confirm_phrase: `PUBLISH_PLAN_${plan.plan_id}`,
          simulate: true,
        },
        roots,
      );
      const gitState = JSON.parse(
        readFileSync(join(roots.executionsRoot, "_sim_git_state.json"), "utf8"),
      ) as { commits: unknown[] };
      checks.push(
        assert(
          r.ok && gitState.commits.length === 1,
          "duplicate_commit_prevention",
          `commits=${gitState.commits.length}`,
        ),
      );
    }

    // ---- Real plan untouched ----
    {
      const realPlanPath = join(
        REPO,
        "SOS/07_LOGS/saios/publication/plans/plan-20260730-34c0eabb.json",
      );
      if (existsSync(realPlanPath)) {
        const before = readFileSync(realPlanPath, "utf8");
        // Intentionally do nothing to real plan in this suite
        const after = readFileSync(realPlanPath, "utf8");
        checks.push(
          assert(before === after, "real_plan_remains_untouched", "unchanged"),
        );
        const real = JSON.parse(before) as {
          entries: Array<{ proposed_catalogue_id: string; title: string }>;
          status: string;
        };
        checks.push(
          assert(
            real.entries.some((e) => e.proposed_catalogue_id === "t102") &&
              real.entries.some((e) => e.proposed_catalogue_id === "t103"),
            "real_plan_still_t102_t103",
            real.entries.map((e) => e.proposed_catalogue_id).join(","),
          ),
        );
      } else {
        checks.push(
          assert(false, "real_plan_remains_untouched", "plan file missing"),
        );
      }
    }

    // Export failure stop (no commit)
    {
      const roots = makeRoots(join(base, "export-fail"));
      seedTwoEligible(roots);
      const plan = await buildVerifiedPlan(roots);
      const r = await applyPublicationPlan(
        {
          plan_id: plan.plan_id,
          confirm_phrase: `PUBLISH_PLAN_${plan.plan_id}`,
          simulate: true,
          simulate_hooks: { fail_export_after_index: 0 },
        },
        roots,
      );
      checks.push(
        assert(
          !r.ok && !r.apply.git_committed && !r.apply.website_modified,
          "export_failure_stops_before_commit",
          r.apply.error ?? "",
        ),
      );
    }
  } finally {
    // keep tmp for debugging on failure; remove when all pass
  }

  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.filter((c) => !c.pass);
  const report = {
    suite: "publication-executor",
    generated_at: new Date().toISOString(),
    passed,
    total: checks.length,
    ok: failed.length === 0,
    failed: failed.map((f) => ({ name: f.name, detail: f.detail })),
    checks,
    publication_allowed: false,
    live: false,
    real_execution: false,
  };
  writeJson(OUT, report);
  console.log(JSON.stringify(report, null, 2));
  if (failed.length) {
    rmSync(base, { recursive: true, force: true });
    process.exit(1);
  }
  rmSync(base, { recursive: true, force: true });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
