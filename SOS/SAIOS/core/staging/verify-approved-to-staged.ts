/**
 * Agent #242 — Approved→Staged workflow verification + controlled fixture demo.
 * Never publishes. Never writes StudiosisLab website files.
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { canTransition } from "./TemplateLifecycle.js";
import {
  backfillOpenAI240GenerationIds,
  findChecksumMismatches,
  getStagingStatus,
  recordFounderLifecycleDecision,
  recoverIncompleteStagingTemps,
  stageApprovedCandidate,
  STAGING_PACKAGES_ROOT,
} from "./StagingService.js";
import {
  ensureGenerationId,
  getGenerationIdForCandidate,
  contentFingerprint,
} from "./GenerationIdRegistry.js";
import { upsertLifecycle, readLifecycle } from "./CandidateLifecycleStore.js";
import { appendStagingAuditEvent } from "./StagingAuditLog.js";
import { readFileSync as readSrc } from "node:fs";

const REPO = resolve(import.meta.dirname, "../../../..");
const CYCLE = join(REPO, "SOS/07_LOGS/saios/first-production-cycle");
const OUT = join(
  REPO,
  "SOS/07_LOGS/saios/staging/verify-approved-to-staged.json",
);
const REPORT = join(
  REPO,
  "SOS/09_REPORTS/AIOS_APPROVED_TO_STAGED_WORKFLOW_V1_REPORT.md",
);
const FIXTURE_ID = "cand-fixture-aios-242-staging-demo";
const MANIFEST = join(REPO, "templates.manifest.json");
const PUBLIC_TEMPLATES = join(REPO, "public/templates");

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function dirSnapshot(path: string): string {
  if (!existsSync(path)) return "missing";
  const names = readdirSync(path).sort();
  const h = createHash("sha256");
  h.update(names.join("\n"));
  for (const n of names.slice(0, 200)) {
    const p = join(path, n);
    try {
      if (statSync(p).isFile()) h.update(sha256File(p));
    } catch {
      /* skip */
    }
  }
  return h.digest("hex");
}

function seedFixtureFromAccountant(): string {
  const srcId =
    "cand-finance-accountant-technical-v0-oai240-m-20260724T070816Z-98e7f6";
  const src = join(CYCLE, "candidates", srcId);
  assert(existsSync(src), "source accountant candidate missing");
  const dest = join(CYCLE, "candidates", FIXTURE_ID);
  if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  for (const f of [
    "canvas.json",
    "resume-template.json",
    "preview.png",
    "thumbnail.png",
    "critic.json",
    "editor-compatibility.json",
    "designbrief.json",
    "mock-provider.json",
    "research-context.json",
  ]) {
    copyFileSync(join(src, f), join(dest, f));
  }
  const base = JSON.parse(readFileSync(join(src, "candidate.json"), "utf8"));
  const fixtureManifest = {
    ...base,
    candidate_id: FIXTURE_ID,
    template_id: FIXTURE_ID,
    task_id: `cycle-${FIXTURE_ID}`,
    review_id: `founder-review-${FIXTURE_ID}`,
    cycle_id: `cycle-run-${FIXTURE_ID}`,
    run_id: FIXTURE_ID,
    status: "WAITING_FOUNDER",
    publication_allowed: false,
    verification_artifact: false,
    target: {
      ...base.target,
      title: "FIXTURE Staging Demo Accountant (Agent #242)",
    },
  };
  writeFileSync(
    join(dest, "candidate.json"),
    `${JSON.stringify(fixtureManifest, null, 2)}\n`,
  );
  // Ensure critic scores meet PUBLISHABLE floors
  const critic = JSON.parse(readFileSync(join(dest, "critic.json"), "utf8"));
  critic.scores = {
    ...(critic.scores ?? {}),
    ats: 100,
    visual: 99,
    typography: 100,
    layout: 100,
    thumbnail_appeal: 98,
    overall: 99,
  };
  writeFileSync(join(dest, "critic.json"), `${JSON.stringify(critic, null, 2)}\n`);
  return dest;
}

async function main(): Promise<void> {
  process.env.SOS_AIOS_LIVE = "0";
  assert(process.env.SOS_AIOS_LIVE !== "1", "LIVE OFF");

  const checks: Record<string, boolean> = {};
  const manifestBefore = sha256File(MANIFEST);
  const publicBefore = dirSnapshot(PUBLIC_TEMPLATES);

  // 1–4 lifecycle matrix
  checks.ready_to_approved = canTransition("READY_FOR_REVIEW", "APPROVED");
  checks.approved_not_auto_staged = !canTransition("APPROVED", "STAGED");
  checks.approved_to_staging_requested = canTransition(
    "APPROVED",
    "STAGING_REQUESTED",
  );
  checks.staging_path =
    canTransition("STAGING_REQUESTED", "STAGING") &&
    canTransition("STAGING", "STAGED");
  checks.changes_cannot_stage_transition = !canTransition(
    "CHANGES_REQUESTED",
    "STAGING_REQUESTED",
  );
  checks.rejected_cannot_stage_transition = !canTransition(
    "REJECTED",
    "STAGING_REQUESTED",
  );

  // Backfill generation IDs
  const backfill = backfillOpenAI240GenerationIds();
  checks.generation_id_backfill =
    backfill.assigned.length + backfill.skipped.length >= 5;
  const sample240 =
    "cand-finance-accountant-technical-v0-oai240-m-20260724T070816Z-98e7f6";
  const gid = getGenerationIdForCandidate(sample240);
  checks.generation_id_stable = Boolean(gid && gid.startsWith("GEN-"));
  const gid2 = getGenerationIdForCandidate(sample240);
  checks.generation_id_non_repeating = gid === gid2;

  // Controlled fixture demo
  seedFixtureFromAccountant();
  const fp = contentFingerprint([
    readFileSync(join(CYCLE, "candidates", FIXTURE_ID, "canvas.json")),
    readFileSync(join(CYCLE, "candidates", FIXTURE_ID, "preview.png")),
  ]);
  ensureGenerationId({
    candidate_id: FIXTURE_ID,
    content_fingerprint: fp,
    backfilled: false,
  });

  // READY_FOR_REVIEW → APPROVED (lifecycle record; fixture decision)
  const decisionId = `decision-fixture-242-${Date.now().toString(36)}`;
  upsertLifecycle({
    candidate_id: FIXTURE_ID,
    generation_id: getGenerationIdForCandidate(FIXTURE_ID)!,
    lifecycle_status: "READY_FOR_REVIEW",
    approval_decision_id: null,
    founder_approved_at: null,
    staging_package_id: null,
    content_fingerprint: fp,
  });
  recordFounderLifecycleDecision({
    candidate_id: FIXTURE_ID,
    decision: "APPROVED",
    decision_id: decisionId,
    actor: "fixture",
  });
  checks.fixture_approved =
    readLifecycle(FIXTURE_ID)?.lifecycle_status === "APPROVED";

  // Non-approved cannot stage
  upsertLifecycle({
    candidate_id: FIXTURE_ID,
    generation_id: getGenerationIdForCandidate(FIXTURE_ID)!,
    lifecycle_status: "CHANGES_REQUESTED",
    approval_decision_id: null,
    founder_approved_at: null,
    staging_package_id: null,
    content_fingerprint: fp,
  });
  const blockedChanges = await stageApprovedCandidate({
    candidate_id: FIXTURE_ID,
    allow_fixture_approval: true,
  });
  checks.changes_requested_cannot_stage = blockedChanges.ok === false;

  upsertLifecycle({
    candidate_id: FIXTURE_ID,
    generation_id: getGenerationIdForCandidate(FIXTURE_ID)!,
    lifecycle_status: "REJECTED",
    approval_decision_id: null,
    founder_approved_at: null,
    staging_package_id: null,
    content_fingerprint: fp,
  });
  const blockedReject = await stageApprovedCandidate({
    candidate_id: FIXTURE_ID,
    allow_fixture_approval: true,
  });
  checks.rejected_cannot_stage = blockedReject.ok === false;

  // Re-approve and stage (REJECTED cannot transition via recordFounder — force APPROVED)
  upsertLifecycle({
    candidate_id: FIXTURE_ID,
    generation_id: getGenerationIdForCandidate(FIXTURE_ID)!,
    lifecycle_status: "APPROVED",
    approval_decision_id: decisionId,
    founder_approved_at: new Date().toISOString(),
    staging_package_id: null,
    content_fingerprint: fp,
  });

  const staged = await stageApprovedCandidate({
    candidate_id: FIXTURE_ID,
    decision_id: decisionId,
    actor: "fixture",
    allow_fixture_approval: true,
  });
  checks.staging_succeeded = staged.ok === true;
  checks.lifecycle_validated = staged.lifecycle_status === "VALIDATED";
  checks.package_exists = Boolean(
    staged.staging_package_id &&
      existsSync(
        join(STAGING_PACKAGES_ROOT, staged.staging_package_id!, "staging-manifest.json"),
      ),
  );
  checks.checksums_present = Boolean(
    staged.staging_package_id &&
      existsSync(
        join(STAGING_PACKAGES_ROOT, staged.staging_package_id!, "checksums.json"),
      ),
  );

  // Idempotent second request
  const again = await stageApprovedCandidate({
    candidate_id: FIXTURE_ID,
    decision_id: decisionId,
    actor: "fixture",
    allow_fixture_approval: true,
  });
  checks.idempotent =
    again.ok === true &&
    again.idempotent === true &&
    again.staging_package_id === staged.staging_package_id;

  // Missing preview fails safely
  const brokenId = `${FIXTURE_ID}-missing-preview`;
  const brokenDir = join(CYCLE, "candidates", brokenId);
  if (existsSync(brokenDir)) rmSync(brokenDir, { recursive: true, force: true });
  mkdirSync(brokenDir, { recursive: true });
  for (const f of [
    "canvas.json",
    "resume-template.json",
    "thumbnail.png",
    "critic.json",
    "editor-compatibility.json",
    "candidate.json",
  ]) {
    copyFileSync(
      join(CYCLE, "candidates", FIXTURE_ID, f),
      join(brokenDir, f),
    );
  }
  const bm = JSON.parse(
    readFileSync(join(brokenDir, "candidate.json"), "utf8"),
  );
  bm.candidate_id = brokenId;
  writeFileSync(join(brokenDir, "candidate.json"), JSON.stringify(bm, null, 2));
  const bfp = contentFingerprint([
    readFileSync(join(brokenDir, "canvas.json")),
  ]);
  ensureGenerationId({ candidate_id: brokenId, content_fingerprint: bfp });
  upsertLifecycle({
    candidate_id: brokenId,
    generation_id: getGenerationIdForCandidate(brokenId)!,
    lifecycle_status: "APPROVED",
    approval_decision_id: `decision-broken-${brokenId}`,
    founder_approved_at: new Date().toISOString(),
    staging_package_id: null,
    content_fingerprint: bfp,
  });
  const missingPreview = await stageApprovedCandidate({
    candidate_id: brokenId,
    decision_id: `decision-broken-${brokenId}`,
    allow_fixture_approval: true,
  });
  checks.missing_preview_fails = missingPreview.ok === false;

  // Missing thumbnail fails safely
  const noThumbId = `${FIXTURE_ID}-missing-thumb`;
  const noThumbDir = join(CYCLE, "candidates", noThumbId);
  if (existsSync(noThumbDir)) rmSync(noThumbDir, { recursive: true, force: true });
  mkdirSync(noThumbDir, { recursive: true });
  for (const f of [
    "canvas.json",
    "resume-template.json",
    "preview.png",
    "critic.json",
    "editor-compatibility.json",
    "candidate.json",
  ]) {
    copyFileSync(join(CYCLE, "candidates", FIXTURE_ID, f), join(noThumbDir, f));
  }
  const tm = JSON.parse(readFileSync(join(noThumbDir, "candidate.json"), "utf8"));
  tm.candidate_id = noThumbId;
  writeFileSync(join(noThumbDir, "candidate.json"), JSON.stringify(tm, null, 2));
  ensureGenerationId({
    candidate_id: noThumbId,
    content_fingerprint: contentFingerprint(["nothumb"]),
  });
  upsertLifecycle({
    candidate_id: noThumbId,
    generation_id: getGenerationIdForCandidate(noThumbId)!,
    lifecycle_status: "APPROVED",
    approval_decision_id: `decision-${noThumbId}`,
    founder_approved_at: new Date().toISOString(),
    staging_package_id: null,
    content_fingerprint: contentFingerprint(["nothumb"]),
  });
  const missingThumb = await stageApprovedCandidate({
    candidate_id: noThumbId,
    decision_id: `decision-${noThumbId}`,
    allow_fixture_approval: true,
  });
  checks.missing_thumbnail_fails = missingThumb.ok === false;

  // Invalid canvas
  const badCanvasId = `${FIXTURE_ID}-bad-canvas`;
  const badDir = join(CYCLE, "candidates", badCanvasId);
  if (existsSync(badDir)) rmSync(badDir, { recursive: true, force: true });
  mkdirSync(badDir, { recursive: true });
  for (const f of [
    "resume-template.json",
    "preview.png",
    "thumbnail.png",
    "critic.json",
    "editor-compatibility.json",
    "candidate.json",
  ]) {
    copyFileSync(join(CYCLE, "candidates", FIXTURE_ID, f), join(badDir, f));
  }
  writeFileSync(join(badDir, "canvas.json"), "{not-json");
  const bcm = JSON.parse(readFileSync(join(badDir, "candidate.json"), "utf8"));
  bcm.candidate_id = badCanvasId;
  writeFileSync(join(badDir, "candidate.json"), JSON.stringify(bcm, null, 2));
  ensureGenerationId({
    candidate_id: badCanvasId,
    content_fingerprint: contentFingerprint(["bad"]),
  });
  upsertLifecycle({
    candidate_id: badCanvasId,
    generation_id: getGenerationIdForCandidate(badCanvasId)!,
    lifecycle_status: "APPROVED",
    approval_decision_id: `decision-${badCanvasId}`,
    founder_approved_at: new Date().toISOString(),
    staging_package_id: null,
    content_fingerprint: contentFingerprint(["bad"]),
  });
  const badCanvas = await stageApprovedCandidate({
    candidate_id: badCanvasId,
    decision_id: `decision-${badCanvasId}`,
    allow_fixture_approval: true,
  });
  checks.invalid_canvas_fails = badCanvas.ok === false;

  // Checksum mismatch detection
  const mismatchDir = join(CYCLE, "candidates", FIXTURE_ID);
  const mismatch = findChecksumMismatches(mismatchDir, {
    "canvas.json": "0".repeat(64),
  });
  checks.checksum_mismatch_fails = mismatch.includes("canvas.json");

  // Restart recovery: incomplete temp never promoted
  mkdirSync(STAGING_PACKAGES_ROOT, { recursive: true });
  const staleTmp = join(STAGING_PACKAGES_ROOT, ".tmp-stale-recovery-test");
  mkdirSync(staleTmp, { recursive: true });
  writeFileSync(join(staleTmp, "partial.txt"), "incomplete");
  const recovered = recoverIncompleteStagingTemps();
  checks.restart_recovery_clears_tmp =
    recovered.includes(".tmp-stale-recovery-test") && !existsSync(staleTmp);

  // Website unchanged + ReleaseManager not in staging module
  checks.manifest_unchanged = sha256File(MANIFEST) === manifestBefore;
  checks.public_templates_unchanged = dirSnapshot(PUBLIC_TEMPLATES) === publicBefore;
  checks.publication_allowed_false = staged.publication_allowed === false;
  checks.live_off = process.env.SOS_AIOS_LIVE !== "1";
  checks.no_tmp_promoted = !readdirSync(STAGING_PACKAGES_ROOT).some((n) =>
    n.startsWith(".tmp-"),
  );
  const stagingSrc = readSrc(
    join(REPO, "SOS/SAIOS/core/staging/StagingService.ts"),
    "utf8",
  );
  checks.release_manager_not_invoked =
    !stagingSrc.includes("from ") ||
    (!/import\s+.*ReleaseManager/.test(stagingSrc) &&
      !/require\(.*ReleaseManager/.test(stagingSrc) &&
      staged.validation?.release_manager_invoked === false);
  checks.audit_append_only = existsSync(
    join(REPO, "SOS/07_LOGS/saios/staging/audit/events.jsonl"),
  );
  const auditBefore = readFileSync(
    join(REPO, "SOS/07_LOGS/saios/staging/audit/events.jsonl"),
    "utf8",
  );
  appendStagingAuditEvent({
    type: "DUPLICATE_IDEMPOTENT_REQUEST",
    candidate_id: FIXTURE_ID,
    generation_id: getGenerationIdForCandidate(FIXTURE_ID),
    reason: "audit append-only probe",
  });
  const auditAfter = readFileSync(
    join(REPO, "SOS/07_LOGS/saios/staging/audit/events.jsonl"),
    "utf8",
  );
  checks.audit_append_only =
    auditAfter.startsWith(auditBefore) && auditAfter.length > auditBefore.length;
  checks.vps_audit_persisted = existsSync(
    join(REPO, "SOS/09_REPORTS/AIOS_VPS_RELEASE_AND_ASSET_READINESS_AUDIT.md"),
  );
  checks.approved_does_not_auto_stage = checks.approved_not_auto_staged;

  // Status CLI path
  const status = getStagingStatus(FIXTURE_ID);
  checks.status_api =
    status.lifecycle_status === "VALIDATED" &&
    Boolean(status.staging_package_id);

  // Changed candidate invalidates approval
  const lifeBefore = readLifecycle(FIXTURE_ID)!;
  writeFileSync(
    join(CYCLE, "candidates", FIXTURE_ID, "preview.png"),
    Buffer.from("mutated-preview-bytes-for-invalidation-test"),
  );
  getStagingStatus(FIXTURE_ID); // triggers invalidate
  const afterMut = readLifecycle(FIXTURE_ID);
  checks.changed_invalidates_approval =
    afterMut?.lifecycle_status === "READY_FOR_REVIEW" &&
    afterMut.approval_decision_id == null;

  // Restore fixture preview from accountant for cleanliness
  copyFileSync(
    join(
      CYCLE,
      "candidates/cand-finance-accountant-technical-v0-oai240-m-20260724T070816Z-98e7f6/preview.png",
    ),
    join(CYCLE, "candidates", FIXTURE_ID, "preview.png"),
  );
  // Re-approve restored fixture so demo ends STAGED if desired — restore lifecycle from staged package
  if (lifeBefore.staging_package_id) {
    upsertLifecycle({
      ...lifeBefore,
      content_fingerprint: contentFingerprint([
        readFileSync(join(CYCLE, "candidates", FIXTURE_ID, "canvas.json")),
        readFileSync(join(CYCLE, "candidates", FIXTURE_ID, "preview.png")),
      ]),
    });
  }

  appendStagingAuditEvent({
    type: "STAGING_COMPLETED",
    candidate_id: FIXTURE_ID,
    generation_id: getGenerationIdForCandidate(FIXTURE_ID),
    reason: "verify harness completed controlled demonstration",
    staging_package_id: staged.staging_package_id,
  });

  const allPass = Object.values(checks).every(Boolean);
  const result = {
    generated_at: new Date().toISOString(),
    agent: 242,
    overall: allPass ? "PASS" : "FAIL",
    live: false,
    publication_allowed: false,
    checks,
    backfill,
    fixture: {
      candidate_id: FIXTURE_ID,
      staging_package_id: staged.staging_package_id,
      staging_path: staged.staging_path,
      lifecycle_status: staged.lifecycle_status,
    },
    sample_generation_id: gid,
  };
  mkdirSync(join(REPO, "SOS/07_LOGS/saios/staging"), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);

  const md = [
    `# AIOS Approved to Staged Workflow V1 Report`,
    ``,
    `**Agent:** #242`,
    `**Overall:** ${allPass ? "PASS" : "FAIL"}`,
    `**LIVE:** OFF`,
    `**publication_allowed:** false`,
    ``,
    `## 1. Current System Status`,
    ``,
    `- ProductionController canonical; LIVE OFF; publication blocked.`,
    `- Agent #240 five OpenAI templates remain in review (not auto-approved).`,
    `- Staging workflow implemented under \`SOS/SAIOS/core/staging/\`.`,
    `- VPS readiness audit persisted.`,
    ``,
    `## 2. Founder Review Findings`,
    ``,
    `- Approve (manual): Accountant/technical, Graphic Designer/editorial, Marketing Manager/executive.`,
    `- Request changes (manual): HR Manager/contemporary_accent; Software Engineer/modern.`,
    `- This agent does not auto-apply those decisions.`,
    ``,
    `## 3. Lifecycle Model`,
    ``,
    `- Central transitions in \`TemplateLifecycle.ts\`.`,
    `- APPROVED does not auto-stage; explicit STAGING_REQUESTED required.`,
    `- PUBLISHED unreachable from this workflow.`,
    ``,
    `## 4. Dashboard Changes`,
    ``,
    `- Approve / Reject / Request Changes retained.`,
    `- Added Stage for StudiosisLab action + confirmation for APPROVED items.`,
    `- Staging status labels exposed; no Publish button.`,
    ``,
    `## 5. Immutable Generation IDs`,
    ``,
    `- Format \`GEN-YYYYMMDD-NNNNNN\`.`,
    `- Agent #240 backfill: assigned=${backfill.assigned.length}, skipped=${backfill.skipped.length}.`,
    `- Sample: \`${gid}\`.`,
    ``,
    `## 6. Staging Package Contract`,
    ``,
    `- Root: \`SOS/07_LOGS/saios/staging/packages/{id}/\`.`,
    `- Includes staging-manifest, canvas, resume-template, preview/thumbnail sources, quality/, checksums, validation-report.`,
    `- Demo package: \`${staged.staging_package_id}\`.`,
    ``,
    `## 7. Validation Rules`,
    ``,
    `- APPROVED + decision + generation ID + canvas/resume parse + preview/thumbnail + ATS/editor/safe/contrast + PUBLISHABLE + checksum verify.`,
    ``,
    `## 8. Atomicity and Idempotency`,
    ``,
    `- tmp → rename; file lock per candidate; duplicate decision returns existing package.`,
    `- Idempotent check: ${checks.idempotent}`,
    ``,
    `## 9. Audit Trail`,
    ``,
    `- Append-only \`SOS/07_LOGS/saios/staging/audit/events.jsonl\`.`,
    ``,
    `## 10. API and CLI`,
    ``,
    `- \`GET /api/staging/approved\`, \`POST /api/staging/request\`, \`GET /api/staging/status\`, \`GET /api/staging/validation\``,
    `- \`npm run aios:stage-approved -- --candidate-id=\``,
    `- \`npm run aios:staging-status -- --candidate-id=\``,
    ``,
    `## 11. Test Results`,
    ``,
    `| Check | Result |`,
    `|-------|--------|`,
    ...Object.entries(checks).map(
      ([k, v]) => `| ${k} | ${v ? "PASS" : "FAIL"} |`,
    ),
    ``,
    `## 12. Controlled Demonstration`,
    ``,
    `- Fixture \`${FIXTURE_ID}\` (cloned accountant artifacts, non-production).`,
    `- READY_FOR_REVIEW → APPROVED → stage → VALIDATED.`,
    `- Path: \`${staged.staging_path}\`.`,
    `- Real Founder approvals untouched.`,
    ``,
    `## 13. Files Changed`,
    ``,
    `- \`SOS/SAIOS/core/staging/*\``,
    `- Dashboard server + FounderReviewView Stage action`,
    `- package.json scripts`,
    `- VPS audit report + this report`,
    ``,
    `## 14. Verification Results`,
    ``,
    `- Machine JSON: \`${OUT.replace(REPO + "/", "")}\``,
    `- Overall: **${allPass ? "PASS" : "FAIL"}**`,
    ``,
    `## 15. Remaining Gaps`,
    ``,
    `- Catalogue ID allocation deferred to Agent #243.`,
    `- WebP/AVIF optimization deferred.`,
    `- Real Founder dashboard approvals still manual.`,
    `- Dashboard remains localhost-only (no public auth yet).`,
    ``,
    `## 16. Exact Next Action`,
    ``,
    `- Agent #243: StudiosisLab export adapter allocating \`tNNN\` from STAGED packages (still no auto-publish).`,
    ``,
  ].join("\n");
  writeFileSync(REPORT, `${md}\n`);

  console.log(JSON.stringify({ ok: allPass, checks, fixture: result.fixture }, null, 2));
  if (!allPass) process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
