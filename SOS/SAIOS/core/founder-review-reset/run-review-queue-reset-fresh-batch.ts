/**
 * Agent #250 — Founder Review Queue Reset & Fresh Batch V1.
 * Archive review noise → generate 5 new OpenAI templates → queue ONLY those five.
 * LIVE OFF. No approve / stage / export / release.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import dotenv from "dotenv";
import { canUseFounderOpenAIOneTest } from "../resume-integration/FounderOpenAIOneTest.js";
import { runProduction } from "../first-production-cycle/ProductionController.js";
import { CYCLE_LOG } from "../first-production-cycle/runFirstProductionCycle.js";
import type {
  ProductionCategory,
  ProductionTarget,
} from "../first-production-cycle/ProductionTarget.js";
import { loadWaitingCandidatesFromRegistry } from "../../dashboard/src/data/buildFounderReviewQueue.js";
import { archiveReviewCandidates } from "./archiveReviewCandidates.js";
import {
  ACTIVE_BATCH_TAG,
  REVIEW_WORKSPACE_VERSION,
  type ReviewWorkspaceManifest,
} from "./types.js";

const REPO = resolve(import.meta.dirname, "../../../..");
dotenv.config({ path: resolve(REPO, ".env.local") });

const WORKSPACE_DIR = join(REPO, "SOS/07_LOGS/saios/founder-review-workspace");
const OUT_DIR = join(CYCLE_LOG, "review-queue-reset-fresh-batch-v1");
const REPORT = join(
  REPO,
  "SOS/09_REPORTS/AIOS_FOUNDER_REVIEW_QUEUE_RESET_FRESH_BATCH_V1_REPORT.md",
);

const BATCH_PLAN: Array<{
  title: string;
  role_family: string;
  category: ProductionCategory;
  industry: string;
  design_family: string;
}> = [
  {
    title: "HR Manager",
    role_family: "hr_manager",
    category: "ats",
    industry: "human_resources",
    design_family: "contemporary_accent",
  },
  {
    title: "Accountant",
    role_family: "accountant",
    category: "finance",
    industry: "accounting",
    design_family: "technical",
  },
  {
    title: "Graphic Designer",
    role_family: "graphic_designer",
    category: "creative",
    industry: "design",
    design_family: "editorial",
  },
  {
    title: "Software Engineer",
    role_family: "software_engineer",
    category: "engineering",
    industry: "software",
    design_family: "modern",
  },
  {
    title: "Marketing Manager",
    role_family: "marketing_manager",
    category: "marketing",
    industry: "marketing",
    design_family: "executive",
  },
];

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function writeJson(path: string, data: unknown): void {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function forceSafetyEnv(): void {
  process.env.SOS_AIOS_LIVE = "0";
  process.env.SOS_AI_FOUNDER_OPENAI_ONE_TEST = "1";
  assert(Boolean(process.env.OPENAI_API_KEY?.trim()), "OPENAI_API_KEY required");
  assert(process.env.SOS_AIOS_LIVE !== "1", "LIVE must be OFF");
  assert(
    canUseFounderOpenAIOneTest("INTERNAL"),
    "Founder OpenAI one-test gate closed",
  );
}

function promoteToReadyForFounderReview(candidateDir: string): void {
  const manifestPath = join(candidateDir, "candidate.json");
  const m = readJson<Record<string, unknown>>(manifestPath);
  m.status = "READY_FOR_FOUNDER_REVIEW";
  m.updated_at = new Date().toISOString();
  m.review_workspace = {
    agent: 250,
    batch_tag: ACTIVE_BATCH_TAG,
    ready_for_founder_review: true,
    approved: false,
  };
  writeJson(manifestPath, m);

  writeJson(join(candidateDir, "waiting-founder.json"), {
    state: "READY_FOR_FOUNDER_REVIEW",
    founder_review_status: "ready_for_review",
    message: "Fresh batch — awaiting explicit Founder review. No auto-decision.",
    publication_allowed: false,
    live: false,
    dry_run: true,
    candidate_id: m.candidate_id,
    review_id: m.review_id,
    batch_tag: ACTIVE_BATCH_TAG,
  });
}

async function main(): Promise<void> {
  forceSafetyEnv();
  mkdirSync(OUT_DIR, { recursive: true });
  mkdirSync(WORKSPACE_DIR, { recursive: true });

  const stamp = new Date().toISOString();
  const runId = `oai250_${Date.now().toString(36)}`;

  // 1) Archive current review registry (move, never delete)
  console.log("Agent #250 — archiving current review candidates…");
  const archive = archiveReviewCandidates("agent250-pre-reset");
  writeJson(join(OUT_DIR, "archive-result.json"), archive);
  console.log(
    `Archived ${archive.archived.length} dirs → ${archive.archived_to}`,
  );

  // 2) Generate five brand-new templates via latest OpenAI production pipeline
  const targets: ProductionTarget[] = BATCH_PLAN.map((row) => ({
    category: row.category,
    title: `${row.title} ${row.design_family} v0 ${runId}`,
    industry: `${row.industry}_${row.design_family}_${ACTIVE_BATCH_TAG}`,
    seniority: "mid",
    role_family: row.role_family,
    objective: [
      `Agent #250 Founder Review fresh batch ${stamp}`,
      `design_family:${row.design_family}`,
      `role_family:${row.role_family}`,
      `unique_seed:${runId}_${row.role_family}`,
      "Generate distinct fictional one-page ATS resume_content for this role only.",
      "Do not reuse prior revision content.",
    ].join(" "),
  }));

  console.log("Agent #250 — generating 5 OpenAI templates…");
  const result = await runProduction({
    batch_size: 5,
    max_openai_per_batch: 5,
    max_attempts: 12,
    force_mock: false,
    require_openai: true,
    select_target: false,
    verification: false,
    forced_targets: targets,
    queue_max: 80,
    budget_policy: {
      maximum_founder_queue: 80,
      maximum_batch_size: 10,
      maximum_daily_candidates: 500,
    },
  });

  assert(result.publication_allowed === false, "publication blocked");
  assert(result.live === false, "LIVE OFF");
  assert(result.batch !== null, `no batch: ${result.stop_reason}`);

  const waiting = result.batch!.candidates.filter(
    (c) => c.result === "WAITING_FOUNDER" && c.candidate_dir,
  );
  assert(waiting.length === 5, `expected 5 WAITING_FOUNDER, got ${waiting.length}`);

  const validation: Array<Record<string, unknown>> = [];
  const candidate_ids: string[] = [];

  for (let i = 0; i < waiting.length; i++) {
    const c = waiting[i]!;
    const dir = join(REPO, c.candidate_dir!);
    assert(!dir.includes("candidates-verify"), "must be production registry");
    assert(!dir.includes("candidates-archive"), "must not be archived");

    for (const f of [
      "preview.png",
      "thumbnail.png",
      "canvas.json",
      "critic.json",
      "candidate.json",
    ]) {
      assert(existsSync(join(dir, f)), `${f} missing for ${c.candidate_id}`);
    }

    promoteToReadyForFounderReview(dir);
    candidate_ids.push(c.candidate_id!);

    const critic = existsSync(join(dir, "critic.json"))
      ? readJson<{ scores?: Record<string, number>; readiness?: { ready?: boolean } }>(
          join(dir, "critic.json"),
        )
      : null;
    const manifest = readJson<{
      target?: { title?: string };
      provider?: string | null;
    }>(join(dir, "candidate.json"));
    const title = String(manifest.target?.title ?? c.candidate_id ?? "");
    const role =
      BATCH_PLAN.find((p) => title.toLowerCase().includes(p.title.toLowerCase()))
        ?.title ?? title.split(" ")[0] ?? "Unknown";
    validation.push({
      role,
      candidate_id: c.candidate_id,
      review_id: c.review_id,
      status: "READY_FOR_FOUNDER_REVIEW",
      provider: manifest.provider ?? c.provider ?? null,
      preview: true,
      thumbnail: true,
      critic_overall: critic?.scores?.overall ?? null,
      critic_ats: critic?.scores?.ats ?? null,
      ready: critic?.readiness?.ready ?? null,
    });
  }

  // 3) Active workspace gate — queue shows only registry waiting items
  const workspace: ReviewWorkspaceManifest = {
    schema_version: "founder-review-workspace-1.0.0",
    mode: "active_registry_only",
    batch_tag: ACTIVE_BATCH_TAG,
    batch_id: result.batch?.batch_id ?? runId,
    candidate_ids,
    archived_to: archive.archived_to.replace(`${REPO}/`, ""),
    archived_count: archive.archived.length,
    generated_at: new Date().toISOString(),
    live: false,
    publication_allowed: false,
    awaiting_founder_review: true,
    agent: 250,
  };
  writeJson(join(WORKSPACE_DIR, "active.json"), workspace);
  writeJson(join(OUT_DIR, "workspace.json"), workspace);
  writeJson(join(OUT_DIR, "validation.json"), { results: validation });
  writeJson(join(OUT_DIR, "run-result.json"), {
    ok: true,
    version: REVIEW_WORKSPACE_VERSION,
    run_id: runId,
    batch_id: result.batch?.batch_id ?? null,
    candidate_ids,
    archived_count: archive.archived.length,
    live: false,
    publication_allowed: false,
    stop: "awaiting_founder_review",
  });

  const queue = loadWaitingCandidatesFromRegistry(REPO);
  assert(
    queue.length === 5,
    `registry queue must be exactly 5, got ${queue.length}`,
  );
  for (const item of queue) {
    assert(
      item.status === "waiting_founder",
      `unexpected projected status ${item.status}`,
    );
  }

  const candNames = readdirSync(
    join(REPO, "SOS/07_LOGS/saios/first-production-cycle/candidates"),
  ).filter((n) => !n.startsWith("."));
  assert(candNames.length === 5, `candidates/ must have only 5 dirs, got ${candNames.length}`);

  const md = [
    `# AIOS Founder Review Queue Reset & Fresh Batch V1`,
    ``,
    `**Agent:** #250`,
    `**Overall:** PASS`,
    `**LIVE:** OFF`,
    `**Publication:** none`,
    `**Stop:** awaiting Founder review`,
    ``,
    `## 1. Review queue cleared`,
    ``,
    `Production registry emptied by archive (move). Legacy dry-run / FR packages / decision orphans suppressed via \`active_registry_only\` workspace mode.`,
    ``,
    `## 2. Archived entries`,
    ``,
    `- Path: \`${workspace.archived_to}\``,
    `- Count: **${archive.archived.length}**`,
    `- Method: rename (not delete)`,
    ``,
    `## 3. New templates generated`,
    ``,
    `| Role | Candidate | Status |`,
    `|---|---|---|`,
    ...validation.map(
      (v) =>
        `| ${v.role} | \`${String(v.candidate_id).slice(0, 48)}…\` | READY_FOR_FOUNDER_REVIEW |`,
    ),
    ``,
    `## 4. Validation results`,
    ``,
    `| Role | Overall | ATS | Preview | Thumb |`,
    `|---|---:|---:|:---:|:---:|`,
    ...validation.map(
      (v) =>
        `| ${v.role} | ${v.critic_overall ?? "—"} | ${v.critic_ats ?? "—"} | ✓ | ✓ |`,
    ),
    ``,
    `## 5. Founder queue`,
    ``,
    `Exactly **5** items · all \`READY_FOR_FOUNDER_REVIEW\` (UI: Ready for Review).`,
    `No fixtures · no demos · no revisions · no archived entries.`,
    ``,
    `## 6. Verification`,
    ``,
    `- ✓ registry candidates/ count = 5`,
    `- ✓ loadWaitingCandidatesFromRegistry = 5`,
    `- ✓ no approve / reject / stage / export / release`,
    `- ✓ LIVE OFF · publication_allowed=false`,
    ``,
    `## 7. Project State`,
    ``,
    `- latest_agent=250`,
    `- next_agent=251`,
    `- operations.review_queue_reset=complete`,
    `- operations.awaiting_founder_review=true`,
    ``,
    `## Exact next action`,
    ``,
    `Founder opens Templates Ready for Review and reviews the five new resume templates. Do not auto-decide.`,
    ``,
  ].join("\n");
  writeFileSync(REPORT, md, "utf8");

  console.log(
    JSON.stringify(
      {
        ok: true,
        archived: archive.archived.length,
        generated: candidate_ids.length,
        queue: queue.length,
        live: false,
        stop: "awaiting_founder_review",
        report: REPORT.replace(`${REPO}/`, ""),
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
