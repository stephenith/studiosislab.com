/**
 * Agent #231 — Verification artifact scan + isolate (queue recovery).
 *
 * Classification uses multi-signal provenance (never title-only, never
 * broad role-name-only). Confirmed verification dirs are renamed into
 * candidates-verify/ — never deleted. Ambiguous candidates are left untouched.
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
  statSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import {
  CANDIDATES_DIR_PRODUCTION,
  CANDIDATES_DIR_VERIFICATION,
  type CandidateManifest,
  candidatesRoot,
} from "./CandidateStore.js";
import { countFounderReviewWaiting } from "../founder-review/FounderReviewProjection.js";
import { CYCLE_LOG } from "./runFirstProductionCycle.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const LOG_ROOT = join(CYCLE_LOG, "verification-artifact-recovery");
const HISTORY_ROOT = join(LOG_ROOT, "history");
const SCAN_LATEST = join(LOG_ROOT, "verification-artifact-scan-report.json");
const MIGRATE_LATEST = join(
  LOG_ROOT,
  "verification-artifact-migration-report.json",
);
const REPORTS_SCAN = join(
  REPO,
  "SOS/07_LOGS/saios/verification-artifact-scan-report.json",
);
const REPORTS_MIGRATE = join(
  REPO,
  "SOS/07_LOGS/saios/verification-artifact-migration-report.json",
);

export type Classification =
  | "confirmed_verification"
  | "real_production"
  | "ambiguous";

export type ClassifiedCandidate = {
  candidate_id: string;
  old_path: string;
  status: string | null;
  provider: string | null;
  title: string | null;
  objective: string | null;
  role_family: string | null;
  classification: Classification;
  verification_evidence: string[];
  production_evidence: string[];
  ambiguous_reason: string | null;
};

export type MigrationMapEntry = {
  candidate_id: string;
  old_path: string;
  new_path: string;
  verification_evidence: string[];
  original_status: string | null;
  migration_timestamp: string;
  result: "moved" | "skipped_exists" | "failed" | "dry_run";
  detail?: string;
};

function atomicWriteJson(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  renameSync(tmp, path);
}

function rel(p: string): string {
  return relative(REPO, p).split("\\").join("/");
}

/** Deterministic multi-signal verification provenance (not title-only). */
export function classifyCandidate(
  manifest: CandidateManifest,
  dirName: string,
): Omit<
  ClassifiedCandidate,
  "old_path" | "classification" | "ambiguous_reason"
> & {
  verification_evidence: string[];
  production_evidence: string[];
} {
  const id = manifest.candidate_id || dirName;
  const title = manifest.target?.title ?? null;
  const objective = manifest.target?.objective ?? null;
  const role_family = manifest.target?.role_family ?? null;
  const provider = manifest.provider ?? null;
  const evidence: string[] = [];
  const production_evidence: string[] = [];

  if (manifest.verification_artifact === true) {
    evidence.push("manifest.verification_artifact=true");
  }
  if (manifest.verification_context) {
    evidence.push(
      `manifest.verification_context=${manifest.verification_context}`,
    );
  }

  const idPatterns: Array<[RegExp, string]> = [
    [/-budget-verify-/i, "candidate_id contains -budget-verify-"],
    [/-controller-verify-/i, "candidate_id contains -controller-verify-"],
    [/-revision-verify-/i, "candidate_id contains -revision-verify-"],
    [/-revision-batch-/i, "candidate_id contains -revision-batch-"],
    [/-health-gate-/i, "candidate_id contains -health-gate-"],
  ];
  for (const [re, label] of idPatterns) {
    if (re.test(id)) evidence.push(label);
  }

  const rolePatterns: Array<[RegExp, string]> = [
    [/^budget_verify_/i, "role_family budget_verify_*"],
    [/^controller_verify_/i, "role_family controller_verify_*"],
    [/^revision_verify_/i, "role_family revision_verify_*"],
    [/^revision_batch_/i, "role_family revision_batch_*"],
    [/^health_gate_/i, "role_family health_gate_*"],
  ];
  if (role_family) {
    for (const [re, label] of rolePatterns) {
      if (re.test(role_family)) evidence.push(label);
    }
  }

  const objPatterns: Array<[RegExp, string]> = [
    [/^budget-verify-/i, "objective prefix budget-verify-"],
    [/^controller-verify-/i, "objective prefix controller-verify-"],
    [/^health-gate-batch-/i, "objective prefix health-gate-batch-"],
    [/^revision-batch-/i, "objective prefix revision-batch-"],
    [/^Dup-verify\s/i, "objective prefix Dup-verify"],
    [/^Batch verify\s/i, "objective prefix Batch verify"],
    [/^Agent210-unique-/i, "objective prefix Agent210-unique-"],
    [/^Agent211 revision verify/i, "objective Agent211 revision verify"],
  ];
  if (objective) {
    for (const [re, label] of objPatterns) {
      if (re.test(objective)) evidence.push(label);
    }
  }

  // Known verify titles only count when paired with another signal (id/role/objective)
  const verifyTitles = new Set([
    "Budget Verify Role",
    "Controller Verify Role",
    "Revision Verify pass",
    "Revision Verify retry",
    "Revision Batch A",
    "Revision Batch B",
    "Health Gate Batch Check",
  ]);
  if (title && verifyTitles.has(title) && evidence.length > 0) {
    evidence.push(`title+corroboration=${title}`);
  } else if (title && verifyTitles.has(title)) {
    // title alone is insufficient — do not add as sole confirmation
  }

  if (provider === "openai") {
    production_evidence.push("provider=openai");
  }
  if (
    objective &&
    /resume construction cycle \(dry-run\)/i.test(objective) &&
    title === "Marketing Manager" &&
    evidence.length === 0
  ) {
    production_evidence.push(
      "marketing_manager dry-run without verify markers (ambiguous vs early prod)",
    );
  }
  if (
    evidence.length === 0 &&
    provider === "mock" &&
    objective &&
    /(premium|ATS|engineering|executive|healthcare|finance|student)/i.test(
      objective,
    ) &&
    !/verify/i.test(objective)
  ) {
    production_evidence.push("production-like mock objective without verify markers");
  }

  return {
    candidate_id: id,
    status: manifest.status ?? null,
    provider,
    title,
    objective,
    role_family,
    verification_evidence: evidence,
    production_evidence,
  };
}

export function decideClassification(
  c: ReturnType<typeof classifyCandidate>,
): { classification: Classification; ambiguous_reason: string | null } {
  if (c.verification_evidence.length >= 1) {
    // Never migrate openai-backed rows even if a weak marker matched
    if (c.provider === "openai") {
      return {
        classification: "ambiguous",
        ambiguous_reason:
          "openai provider with verification-like markers — leave for Founder",
      };
    }
    return { classification: "confirmed_verification", ambiguous_reason: null };
  }
  if (c.provider === "openai") {
    return { classification: "real_production", ambiguous_reason: null };
  }
  if (
    c.production_evidence.some((e) => e.includes("marketing_manager dry-run"))
  ) {
    return {
      classification: "ambiguous",
      ambiguous_reason:
        "Marketing Manager dry-run mock without deterministic verify provenance",
    };
  }
  if (c.production_evidence.length > 0) {
    return { classification: "real_production", ambiguous_reason: null };
  }
  return {
    classification: "ambiguous",
    ambiguous_reason: "insufficient provenance to classify safely",
  };
}

export function scanVerificationArtifacts(): {
  generated_at: string;
  agent: string;
  production_root: string;
  verification_root: string;
  waiting_before: number;
  totals: Record<Classification, number>;
  projected_waiting_after_isolation: number;
  candidates: ClassifiedCandidate[];
} {
  const prodRoot = candidatesRoot(CYCLE_LOG, "production");
  const verifyRoot = candidatesRoot(CYCLE_LOG, "verification");
  const waiting_before = countFounderReviewWaiting(REPO);
  const candidates: ClassifiedCandidate[] = [];

  if (existsSync(prodRoot)) {
    for (const name of readdirSync(prodRoot)) {
      const dir = join(prodRoot, name);
      if (!statSync(dir).isDirectory()) continue;
      const mp = join(dir, "candidate.json");
      if (!existsSync(mp)) continue;
      let manifest: CandidateManifest;
      try {
        manifest = JSON.parse(readFileSync(mp, "utf8")) as CandidateManifest;
      } catch {
        candidates.push({
          candidate_id: name,
          old_path: rel(dir),
          status: null,
          provider: null,
          title: null,
          objective: null,
          role_family: null,
          classification: "ambiguous",
          verification_evidence: [],
          production_evidence: [],
          ambiguous_reason: "unreadable candidate.json",
        });
        continue;
      }
      const base = classifyCandidate(manifest, name);
      const decision = decideClassification(base);
      candidates.push({
        ...base,
        old_path: rel(dir),
        classification: decision.classification,
        ambiguous_reason: decision.ambiguous_reason,
      });
    }
  }

  const totals: Record<Classification, number> = {
    confirmed_verification: 0,
    real_production: 0,
    ambiguous: 0,
  };
  for (const c of candidates) totals[c.classification] += 1;

  const confirmedWaiting = candidates.filter(
    (c) =>
      c.classification === "confirmed_verification" &&
      c.status === "WAITING_FOUNDER",
  ).length;

  return {
    generated_at: new Date().toISOString(),
    agent: "231",
    production_root: rel(prodRoot),
    verification_root: rel(verifyRoot),
    waiting_before,
    totals,
    projected_waiting_after_isolation: Math.max(
      0,
      waiting_before - confirmedWaiting,
    ),
    candidates: candidates.sort((a, b) =>
      a.candidate_id.localeCompare(b.candidate_id),
    ),
  };
}

export function isolateConfirmedArtifacts(opts: {
  confirm: boolean;
}): {
  generated_at: string;
  agent: string;
  dry_run: boolean;
  confirmed: number;
  moved: number;
  skipped: number;
  failed: number;
  waiting_before: number;
  waiting_after: number | null;
  migration_map: MigrationMapEntry[];
  ambiguous_left: ClassifiedCandidate[];
  real_production_left: ClassifiedCandidate[];
} {
  const scan = scanVerificationArtifacts();
  const confirm = opts.confirm === true;
  const ts = new Date().toISOString();
  const verifyRoot = candidatesRoot(CYCLE_LOG, "verification");
  mkdirSync(verifyRoot, { recursive: true });

  const migration_map: MigrationMapEntry[] = [];
  let moved = 0;
  let skipped = 0;
  let failed = 0;

  for (const c of scan.candidates) {
    if (c.classification !== "confirmed_verification") continue;
    const oldAbs = join(REPO, c.old_path);
    const newAbs = join(verifyRoot, c.candidate_id);
    const new_path = rel(newAbs);

    if (!confirm) {
      migration_map.push({
        candidate_id: c.candidate_id,
        old_path: c.old_path,
        new_path,
        verification_evidence: c.verification_evidence,
        original_status: c.status,
        migration_timestamp: ts,
        result: "dry_run",
      });
      continue;
    }

    if (!existsSync(oldAbs)) {
      failed += 1;
      migration_map.push({
        candidate_id: c.candidate_id,
        old_path: c.old_path,
        new_path,
        verification_evidence: c.verification_evidence,
        original_status: c.status,
        migration_timestamp: ts,
        result: "failed",
        detail: "source missing",
      });
      continue;
    }
    if (existsSync(newAbs)) {
      skipped += 1;
      migration_map.push({
        candidate_id: c.candidate_id,
        old_path: c.old_path,
        new_path,
        verification_evidence: c.verification_evidence,
        original_status: c.status,
        migration_timestamp: ts,
        result: "skipped_exists",
        detail: "destination already exists — left source untouched",
      });
      continue;
    }

    try {
      renameSync(oldAbs, newAbs);
      // Stamp provenance on migrated manifest (additive; preserve history)
      const mp = join(newAbs, "candidate.json");
      if (existsSync(mp)) {
        const m = JSON.parse(readFileSync(mp, "utf8")) as CandidateManifest & {
          verification_recovery?: Record<string, unknown>;
        };
        m.verification_artifact = true;
        m.verification_context =
          m.verification_context ?? "aios-verification-recovery-231";
        m.verification_recovery = {
          migrated_at: ts,
          agent: "231",
          from: c.old_path,
          evidence: c.verification_evidence,
        };
        atomicWriteJson(mp, m);
      }
      moved += 1;
      migration_map.push({
        candidate_id: c.candidate_id,
        old_path: c.old_path,
        new_path,
        verification_evidence: c.verification_evidence,
        original_status: c.status,
        migration_timestamp: ts,
        result: "moved",
      });
    } catch (err) {
      failed += 1;
      migration_map.push({
        candidate_id: c.candidate_id,
        old_path: c.old_path,
        new_path,
        verification_evidence: c.verification_evidence,
        original_status: c.status,
        migration_timestamp: ts,
        result: "failed",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const waiting_after = confirm ? countFounderReviewWaiting(REPO) : null;

  return {
    generated_at: ts,
    agent: "231",
    dry_run: !confirm,
    confirmed: scan.totals.confirmed_verification,
    moved,
    skipped,
    failed,
    waiting_before: scan.waiting_before,
    waiting_after,
    migration_map,
    ambiguous_left: scan.candidates.filter(
      (c) => c.classification === "ambiguous",
    ),
    real_production_left: scan.candidates.filter(
      (c) => c.classification === "real_production",
    ),
  };
}

function writeScanReport(scan: ReturnType<typeof scanVerificationArtifacts>): void {
  mkdirSync(HISTORY_ROOT, { recursive: true });
  const stamp = scan.generated_at.replace(/[:.]/g, "-");
  atomicWriteJson(SCAN_LATEST, scan);
  atomicWriteJson(join(HISTORY_ROOT, `scan-${stamp}.json`), scan);
  atomicWriteJson(REPORTS_SCAN, scan);
}

function writeMigrateReport(
  report: ReturnType<typeof isolateConfirmedArtifacts>,
): void {
  mkdirSync(HISTORY_ROOT, { recursive: true });
  const stamp = report.generated_at.replace(/[:.]/g, "-");
  atomicWriteJson(MIGRATE_LATEST, report);
  atomicWriteJson(join(HISTORY_ROOT, `migration-${stamp}.json`), report);
  atomicWriteJson(REPORTS_MIGRATE, report);
}

function main(): void {
  const args = process.argv.slice(2);
  const mode = args.includes("isolate") ? "isolate" : "scan";
  const confirm = args.includes("--confirm");

  if (mode === "scan") {
    const scan = scanVerificationArtifacts();
    writeScanReport(scan);
    console.log("Verification Artifact Scan (read-only)");
    console.log("======================================");
    console.log(`production_root: ${scan.production_root}`);
    console.log(`verification_root: ${scan.verification_root}`);
    console.log(`waiting_before: ${scan.waiting_before}`);
    console.log(`confirmed_verification: ${scan.totals.confirmed_verification}`);
    console.log(`real_production: ${scan.totals.real_production}`);
    console.log(`ambiguous: ${scan.totals.ambiguous}`);
    console.log(
      `projected_waiting_after_isolation: ${scan.projected_waiting_after_isolation}`,
    );
    console.log(`report: ${rel(SCAN_LATEST)}`);
    return;
  }

  if (!confirm) {
    const dry = isolateConfirmedArtifacts({ confirm: false });
    writeMigrateReport(dry);
    console.log("Verification Artifact Isolate — DRY RUN (no moves)");
    console.log("==================================================");
    console.log(`confirmed: ${dry.confirmed}`);
    console.log(`would_move: ${dry.migration_map.length}`);
    console.log(`ambiguous_left: ${dry.ambiguous_left.length}`);
    console.log(`real_production_left: ${dry.real_production_left.length}`);
    console.log("Re-run with --confirm to apply renames.");
    console.log(`report: ${rel(MIGRATE_LATEST)}`);
    return;
  }

  const result = isolateConfirmedArtifacts({ confirm: true });
  writeMigrateReport(result);
  // Refresh scan snapshot after move
  writeScanReport(scanVerificationArtifacts());
  console.log("Verification Artifact Isolate — CONFIRMED");
  console.log("=========================================");
  console.log(`moved: ${result.moved}`);
  console.log(`skipped: ${result.skipped}`);
  console.log(`failed: ${result.failed}`);
  console.log(`waiting_before: ${result.waiting_before}`);
  console.log(`waiting_after: ${result.waiting_after}`);
  console.log(`ambiguous_left: ${result.ambiguous_left.length}`);
  console.log(`report: ${rel(MIGRATE_LATEST)}`);
  if (result.failed > 0) process.exit(1);
}

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(import.meta.dirname, "verificationArtifactRecovery.ts");
if (isMain || process.argv[1]?.endsWith("verificationArtifactRecovery.ts")) {
  main();
}

// silence unused import when imported as module
void CANDIDATES_DIR_PRODUCTION;
void CANDIDATES_DIR_VERIFICATION;
