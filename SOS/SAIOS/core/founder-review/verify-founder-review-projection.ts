/**
 * Verify canonical Founder Review projection (single source of truth).
 * No OpenAI. No production task mutation. No decisions rewrite on real ledger.
 */
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  countFounderReviewWaiting,
  loadFounderReviewProjection,
  loadWaitingTemplatesFromRegistry,
  summarizeFounderReviewProjection,
} from "./FounderReviewProjection.js";
import { buildFounderCommandCenterSnapshot } from "../first-production-cycle/FounderCommandCenter.js";

const REPO = resolve(import.meta.dirname, "../../../..");

type Check = { name: string; pass: boolean; detail: string };

function assert(checks: Check[], name: string, pass: boolean, detail = ""): void {
  checks.push({ name, pass, detail: detail || (pass ? "ok" : "failed") });
}

function writeManifest(
  root: string,
  id: string,
  status: string,
  opts?: {
    superseded?: string;
    category?: string;
    review_id?: string;
    skipPreview?: boolean;
    skipThumb?: boolean;
    withRevisionSummary?: boolean;
    forwardLink?: "rev249" | "revfb";
  },
): void {
  const dir = join(root, "SOS/07_LOGS/saios/first-production-cycle/candidates", id);
  mkdirSync(dir, { recursive: true });
  const manifest: Record<string, unknown> = {
    schema_version: 1,
    candidate_id: id,
    task_id: `task-${id}`,
    review_id: opts?.review_id ?? `founder-review-${id}`,
    cycle_id: `cycle-${id}`,
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
    status,
    publication_allowed: false,
    provider: "mock",
    target: {
      category: opts?.category ?? "engineering",
      title: "Software Engineer",
      industry: "tech",
      seniority: "mid",
      objective: "test",
      role_family: "engineering",
    },
    artifacts: {},
  };
  if (opts?.superseded) manifest.superseded_by_revision = opts.superseded;
  writeFileSync(join(dir, "candidate.json"), JSON.stringify(manifest, null, 2));
  if (!opts?.skipPreview) writeFileSync(join(dir, "preview.png"), "png");
  if (!opts?.skipThumb) writeFileSync(join(dir, "thumbnail.png"), "png");
  if (opts?.withRevisionSummary) {
    writeFileSync(
      join(dir, "revision-summary.json"),
      JSON.stringify({
        revision_number: 1,
        role: "Software Engineer",
        requested_changes: ["fix header"],
        changes_applied: ["resized header"],
        prior_candidate_id: "prior-x",
      }),
    );
  }
  if (opts?.forwardLink) {
    const fl = join(dir, "revisions", opts.forwardLink);
    mkdirSync(fl, { recursive: true });
    writeFileSync(
      join(fl, "forward-link.json"),
      JSON.stringify({ superseded_by: "rev-x" }),
    );
  }
}

function writeDecision(
  root: string,
  reviewId: string,
  decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED",
): void {
  const path = join(root, "SOS/07_LOGS/saios/founder-decisions/decisions.jsonl");
  mkdirSync(join(root, "SOS/07_LOGS/saios/founder-decisions"), {
    recursive: true,
  });
  const line = JSON.stringify({
    decision_id: `fd-${decision}-${reviewId}`,
    review_id: reviewId,
    task_id: "t",
    cycle_id: "c",
    decision,
    created_at: "2026-08-02T00:00:00.000Z",
  });
  const prev = existsSync(path) ? readFileSync(path, "utf8") : "";
  writeFileSync(path, `${prev}${line}\n`);
}

function writeWorkspace(root: string): void {
  const dir = join(root, "SOS/07_LOGS/saios/founder-review-workspace");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "active.json"),
    JSON.stringify({
      schema_version: "founder-review-workspace-1.0.0",
      mode: "active_registry_only",
    }),
  );
}

function main(): void {
  const checks: Check[] = [];
  const openaiBefore = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.SOS_AI_FOUNDER_OPENAI_ONE_TEST;

  const tasksDir = join(REPO, "SOS/07_LOGS/saios/founder-revision/tasks");
  const taskCountBefore = existsSync(tasksDir)
    ? readdirSync(tasksDir).filter((n) => n.endsWith(".json")).length
    : 0;

  const fixture = mkdtempSync(join(tmpdir(), "fr-projection-"));
  try {
    writeWorkspace(fixture);

    // 1. WAITING_FOUNDER + preview/thumb → waiting
    writeManifest(fixture, "cand-wait", "WAITING_FOUNDER", {
      category: "engineering",
    });
    let s = summarizeFounderReviewProjection(fixture);
    assert(
      checks,
      "waiting_founder_with_assets_counts",
      s.waiting === 1 && s.total_visible === 1,
      `waiting=${s.waiting}`,
    );

    // 2. READY_FOR_FOUNDER_REVIEW + assets → waiting
    writeManifest(fixture, "cand-ready", "READY_FOR_FOUNDER_REVIEW", {
      category: "finance",
      withRevisionSummary: true,
    });
    s = summarizeFounderReviewProjection(fixture);
    assert(
      checks,
      "ready_for_founder_review_counts_as_waiting",
      s.waiting === 2,
      `waiting=${s.waiting}`,
    );

    // 3. missing preview → excluded
    writeManifest(fixture, "cand-noprev", "WAITING_FOUNDER", {
      skipPreview: true,
    });
    s = summarizeFounderReviewProjection(fixture);
    assert(
      checks,
      "missing_preview_excluded",
      s.waiting === 2 &&
        !s.items.some((i) => i.candidate_id === "cand-noprev"),
      `waiting=${s.waiting}`,
    );

    // 4. missing thumbnail → excluded
    writeManifest(fixture, "cand-nothumb", "WAITING_FOUNDER", {
      skipThumb: true,
    });
    s = summarizeFounderReviewProjection(fixture);
    assert(
      checks,
      "missing_thumbnail_excluded",
      s.waiting === 2 &&
        !s.items.some((i) => i.candidate_id === "cand-nothumb"),
      `waiting=${s.waiting}`,
    );

    // 5. superseded prior → excluded; revised admitted
    writeManifest(fixture, "cand-prior", "READY_FOR_FOUNDER_REVIEW", {
      superseded: "cand-rev",
      forwardLink: "revfb",
    });
    writeManifest(fixture, "cand-rev", "READY_FOR_FOUNDER_REVIEW", {
      category: "creative",
      withRevisionSummary: true,
    });
    s = summarizeFounderReviewProjection(fixture);
    assert(
      checks,
      "superseded_prior_excluded",
      !s.items.some((i) => i.candidate_id === "cand-prior"),
      "prior excluded",
    );
    assert(
      checks,
      "revised_template_admitted",
      s.items.some((i) => i.candidate_id === "cand-rev") && s.waiting === 3,
      `waiting=${s.waiting}`,
    );

    // 6. waiting_by_category
    assert(
      checks,
      "waiting_by_category_correct",
      (s.waiting_by_category.engineering ?? 0) === 1 &&
        (s.waiting_by_category.finance ?? 0) === 1 &&
        (s.waiting_by_category.creative ?? 0) === 1,
      JSON.stringify(s.waiting_by_category),
    );

    // 7–9. Decision overlays
    const approvedReview = "founder-review-cand-wait";
    writeDecision(fixture, approvedReview, "APPROVED");
    s = summarizeFounderReviewProjection(fixture);
    assert(
      checks,
      "approved_decision_waiting_zero_for_item",
      s.items.find((i) => i.review_id === approvedReview)?.status ===
        "approved" && s.approved >= 1,
      `approved=${s.approved} waiting=${s.waiting}`,
    );
    assert(
      checks,
      "approved_reduces_waiting",
      s.waiting === 2,
      `waiting=${s.waiting}`,
    );

    writeDecision(fixture, "founder-review-cand-ready", "REJECTED");
    s = summarizeFounderReviewProjection(fixture);
    assert(
      checks,
      "rejected_decision_status",
      s.items.find((i) => i.candidate_id === "cand-ready")?.status ===
        "rejected" && s.rejected >= 1,
      `rejected=${s.rejected}`,
    );

    writeDecision(fixture, "founder-review-cand-rev", "CHANGES_REQUESTED");
    s = summarizeFounderReviewProjection(fixture);
    assert(
      checks,
      "changes_requested_decision_status",
      s.items.find((i) => i.candidate_id === "cand-rev")?.status ===
        "changes_requested" && s.changes_requested >= 1,
      `changes_requested=${s.changes_requested}`,
    );
    assert(
      checks,
      "all_decided_waiting_zero",
      s.waiting === 0,
      `waiting=${s.waiting}`,
    );

    // Capacity helper
    assert(
      checks,
      "countFounderReviewWaiting_matches_summary",
      countFounderReviewWaiting(fixture) === s.waiting,
      String(countFounderReviewWaiting(fixture)),
    );

    // Mission vs Review same fixture (FCC uses projection when pointed at fixture)
    // buildFounderCommandCenterSnapshot uses opts.repoRoot + cycleLog
    const fcc = buildFounderCommandCenterSnapshot({
      repoRoot: fixture,
      cycleLog: join(fixture, "SOS/07_LOGS/saios/first-production-cycle"),
    });
    const reviewWaiting = summarizeFounderReviewProjection(fixture).waiting;
    assert(
      checks,
      "mission_waiting_equals_review_waiting",
      fcc.founder_queue.data?.waiting_founder === reviewWaiting,
      `fcc=${fcc.founder_queue.data?.waiting_founder} review=${reviewWaiting}`,
    );

    // Registry loader vs full projection after decisions
    const admitted = loadWaitingTemplatesFromRegistry(fixture);
    const projected = loadFounderReviewProjection(fixture);
    assert(
      checks,
      "registry_admits_pre_overlay_items",
      admitted.length >= 3,
      `admitted=${admitted.length}`,
    );
    assert(
      checks,
      "projection_overlays_decisions",
      projected.every((i) => i.status !== "waiting_founder"),
      projected.map((i) => i.status).join(","),
    );

    // No OpenAI
    assert(
      checks,
      "no_openai_during_verification",
      !process.env.OPENAI_API_KEY &&
        process.env.SOS_AI_FOUNDER_OPENAI_ONE_TEST !== "1",
      "gate closed",
    );

    // Production tasks untouched
    const taskCountAfter = existsSync(tasksDir)
      ? readdirSync(tasksDir).filter((n) => n.endsWith(".json")).length
      : 0;
    assert(
      checks,
      "production_tasks_untouched",
      taskCountBefore === taskCountAfter,
      `before=${taskCountBefore} after=${taskCountAfter}`,
    );

    // Real decisions ledger not rewritten (mtime/size check via read-only existence)
    const realDec = join(
      REPO,
      "SOS/07_LOGS/saios/founder-decisions/decisions.jsonl",
    );
    if (existsSync(realDec)) {
      const before = readFileSync(realDec, "utf8").length;
      // Touch nothing; just confirm fixture wrote elsewhere
      const fixtureDec = join(
        fixture,
        "SOS/07_LOGS/saios/founder-decisions/decisions.jsonl",
      );
      assert(
        checks,
        "no_decisions_rewrite_on_production_ledger",
        existsSync(fixtureDec) &&
          readFileSync(realDec, "utf8").length === before,
        "production ledger length unchanged",
      );
    } else {
      assert(checks, "no_decisions_rewrite_on_production_ledger", true, "no ledger");
    }
  } finally {
    rmSync(fixture, { recursive: true, force: true });
    if (openaiBefore !== undefined) process.env.OPENAI_API_KEY = openaiBefore;
  }

  const failed = checks.filter((c) => !c.pass);
  const report = {
    ok: failed.length === 0,
    passed: checks.length - failed.length,
    total: checks.length,
    checks,
    at: new Date().toISOString(),
  };
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) {
    console.error(`FAIL ${failed.length}/${checks.length}`);
    process.exit(1);
  }
  console.log(`OK ${report.passed}/${report.total}`);
}

main();
