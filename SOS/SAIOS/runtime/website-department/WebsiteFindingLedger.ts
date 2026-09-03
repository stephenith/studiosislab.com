/**
 * Website-specific finding ledger — deterministic fingerprint + lifecycle.
 * Operational path: <output_root>/findings/
 * Phase 2A tests use temporary roots only.
 *
 * Phase 2B: submit observations for fails + evaluated_checks for each journey/check
 * that was actually run (pass/fail/not_run/…). Absence advances only for dimensions
 * with evaluation === "pass" (or explicit applicable_fingerprints).
 */
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type {
  CheckSeverity,
  WebsiteFinding,
  WebsiteFindingIndex,
  WebsiteFindingStatus,
  WebsiteFindingViewport,
} from "./types.js";

export const FINDINGS_DIR_NAME = "findings";
export const RESOLVE_AFTER_CONSECUTIVE_ABSENT = 2;

/** Evaluation outcome for a check/journey that was attempted this run. */
export type FindingEvaluationStatus =
  | "pass"
  | "fail"
  | "not_run"
  | "unsupported"
  | "aborted"
  | "incomplete";

export type FindingCheckDimension = {
  environment: string;
  journey_id: string;
  route_pattern: string;
  viewport_class: WebsiteFindingViewport | string;
  check_type: string;
};

/** Explicit record of what was evaluated this run (Phase 2B-ready). */
export type EvaluatedFindingCheck = FindingCheckDimension & {
  evaluation: FindingEvaluationStatus;
};

export type FindingObservation = FindingCheckDimension & {
  message_or_selector: string;
  severity: CheckSeverity;
  evidence_ref: string;
  run_id: string;
  at?: string;
};

export type LedgerApplyResult = {
  created: number;
  recurring: number;
  resolved: number;
  reopened: number;
  suppressed_hits: number;
  findings: WebsiteFinding[];
};

function atomicWriteJson(path: string, value: unknown): void {
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 2), "utf8");
  renameSync(tmp, path);
}

/** Known volatile / sensitive query parameter names (lowercased). */
const VOLATILE_QUERY_KEYS = new Set([
  "token",
  "access_token",
  "refresh_token",
  "id_token",
  "auth",
  "authorization",
  "bearer",
  "code",
  "oauth_token",
  "api_key",
  "apikey",
  "key",
  "secret",
  "password",
  "passwd",
  "signature",
  "sig",
  "hmac",
  "nonce",
  "session",
  "sessionid",
  "session_id",
  "sid",
  "timestamp",
  "ts",
  "time",
  "_t",
  "cache",
  "cachebuster",
  "cache_buster",
  "cb",
  "_",
  "request_id",
  "requestid",
  "req_id",
  "trace_id",
  "traceid",
  "correlation_id",
  "x-request-id",
  "rand",
  "random",
  "r",
]);

function isVolatileQueryKey(key: string): boolean {
  const k = key.toLowerCase();
  if (VOLATILE_QUERY_KEYS.has(k)) return true;
  if (k.endsWith("_token") || k.endsWith("_secret") || k.endsWith("_sig")) return true;
  if (k.includes("signature") || k.includes("access_token")) return true;
  return false;
}

/**
 * Normalize a single query-string (without leading ?) into sorted material params.
 * Volatile values become <volatile> (never stored raw).
 */
export function normalizeQueryParams(query: string): string {
  const raw = String(query ?? "").replace(/^\?/, "");
  if (!raw) return "";
  try {
    const params = new URLSearchParams(raw);
    const pairs: Array<[string, string]> = [];
    for (const [name, value] of params.entries()) {
      const key = name.toLowerCase();
      if (isVolatileQueryKey(key)) {
        pairs.push([key, "<volatile>"]);
      } else {
        pairs.push([key, normalizeScalarFragment(value)]);
      }
    }
    pairs.sort((a, b) => {
      if (a[0] !== b[0]) return a[0].localeCompare(b[0]);
      return a[1].localeCompare(b[1]);
    });
    return pairs.map(([k, v]) => `${k}=${v}`).join("&");
  } catch {
    return "<unparseable_query>";
  }
}

function normalizeScalarFragment(value: string): string {
  let s = String(value ?? "");
  s = s.replace(
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,
    "<uuid>",
  );
  s = s.replace(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?\b/g, "<ts>");
  return s.toLowerCase();
}

function normalizeEmbeddedQueries(text: string): string {
  // path?query → path?<normalized>
  return text.replace(/(\/[^\s?]*)\?([^ \s)'"]*)/g, (_m, path: string, query: string) => {
    const normalized = normalizeQueryParams(query);
    return normalized ? `${path}?${normalized}` : path;
  });
}

/**
 * Normalize noisy dynamic fragments without collapsing materially different errors.
 * Query strings: strip volatile/sensitive params; keep + sort material params.
 */
export function normalizeFindingMessage(raw: string): string {
  let s = String(raw ?? "");
  // Redact bare token/signature assignments before query parsing so raw secrets
  // never remain in the normalized message even outside URL queries.
  s = s.replace(
    /\b((?:access_)?token|refresh_token|id_token|signature|sig|api[_-]?key|secret|authorization|bearer|hmac)\s*[=:]\s*[^\s&'")]+/gi,
    "$1=<volatile>",
  );
  s = normalizeEmbeddedQueries(s);
  s = s.replace(
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,
    "<uuid>",
  );
  s = s.replace(/\bwebrun-[A-Za-z0-9._-]+\b/g, "<run_id>");
  s = s.replace(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?\b/g, "<ts>");
  s = s.replace(/\b(?:req|request|trace)[_-]?id[=: ]+[A-Za-z0-9_-]+\b/gi, "<req_id>");
  s = s.replace(/\bid[=:][0-9a-f-]{8,}\b/gi, "id=<id>");
  s = s.replace(/\bport[=: ]*\d{2,5}\b/gi, "port=<port>");
  s = s.replace(/:\d{2,5}\b/g, ":<port>");
  s = s.replace(/localhost:\d+/gi, "localhost:<port>");
  s = s.replace(/127\.0\.0\.1:\d+/g, "127.0.0.1:<port>");
  s = s.replace(/(?:\/Users\/|\/home\/|\/var\/|\/tmp\/)[^\s)'"]+/g, (m) => {
    const base = m.split("/").filter(Boolean).pop() ?? "<path>";
    return `<path:/${base}>`;
  });
  s = s.replace(/\s+/g, " ").trim().toLowerCase();
  return s;
}

export function findingDimensionKey(dim: FindingCheckDimension): string {
  return [
    dim.environment,
    dim.journey_id,
    dim.route_pattern,
    dim.check_type,
    dim.viewport_class,
  ]
    .map((p) => String(p ?? "").trim().toLowerCase())
    .join("|");
}

export function buildFindingFingerprint(input: {
  environment: string;
  journey_id: string;
  route_pattern: string;
  check_type: string;
  normalized_message_or_selector: string;
  viewport_class: string;
}): string {
  const parts = [
    input.environment.trim().toLowerCase(),
    input.journey_id.trim().toLowerCase(),
    input.route_pattern.trim().toLowerCase(),
    input.check_type.trim().toLowerCase(),
    input.normalized_message_or_selector.trim().toLowerCase(),
    input.viewport_class.trim().toLowerCase(),
  ];
  return createHash("sha256").update(parts.join("|"), "utf8").digest("hex");
}

export function findingIdFromFingerprint(fingerprint: string): string {
  return `wfind-${fingerprint.slice(0, 16)}`;
}

function findingsRoot(outputRoot: string): string {
  return join(outputRoot, FINDINGS_DIR_NAME);
}

function indexPath(outputRoot: string): string {
  return join(findingsRoot(outputRoot), "index.json");
}

function byIdPath(outputRoot: string, findingId: string): string {
  return join(findingsRoot(outputRoot), "by-id", `${findingId}.json`);
}

export function loadFindingIndex(outputRoot: string): WebsiteFindingIndex {
  const path = indexPath(outputRoot);
  if (!existsSync(path)) {
    return { version: 1, updated_at: new Date().toISOString(), findings: [] };
  }
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as WebsiteFindingIndex;
    if (raw.version !== 1 || !Array.isArray(raw.findings)) {
      throw new Error("malformed index");
    }
    return raw;
  } catch (err) {
    throw new Error(
      `Website finding ledger index unreadable/malformed at ${path}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export function loadFinding(
  outputRoot: string,
  findingId: string,
): WebsiteFinding | null {
  const path = byIdPath(outputRoot, findingId);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as WebsiteFinding;
  } catch (err) {
    throw new Error(
      `Website finding record malformed at ${path}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

function persistFinding(outputRoot: string, finding: WebsiteFinding): void {
  const dir = join(findingsRoot(outputRoot), "by-id");
  mkdirSync(dir, { recursive: true });
  atomicWriteJson(byIdPath(outputRoot, finding.finding_id), finding);
}

function persistIndex(outputRoot: string, index: WebsiteFindingIndex): void {
  mkdirSync(findingsRoot(outputRoot), { recursive: true });
  atomicWriteJson(indexPath(outputRoot), index);
}

function rebuildIndex(
  findings: WebsiteFinding[],
  at: string,
): WebsiteFindingIndex {
  return {
    version: 1,
    updated_at: at,
    findings: findings.map((f) => ({
      finding_id: f.finding_id,
      fingerprint: f.fingerprint,
      status: f.status,
      last_seen_at: f.last_seen_at,
      occurrence_count: f.occurrence_count,
    })),
  };
}

function suppressionActive(f: WebsiteFinding, at: string): boolean {
  if (f.status !== "SUPPRESSED" || !f.suppression) return false;
  if (!f.suppression.expires_at) return true;
  return f.suppression.expires_at > at;
}

/**
 * Apply observations for a run, then mark absent findings toward resolution.
 *
 * Absence advances only when the finding's check dimensions were successfully
 * evaluated this run (evaluation === "pass") or its fingerprint is listed in
 * applicable_fingerprints. not_run / unsupported / aborted / incomplete do not
 * count. Blanket all-active applicability is not supported.
 */
export function applyFindingObservations(input: {
  output_root: string;
  run_id: string;
  observations: FindingObservation[];
  /**
   * Checks/journeys actually evaluated this run. Only evaluation "pass"
   * makes matching active findings eligible for absence → resolution.
   */
  evaluated_checks?: EvaluatedFindingCheck[];
  /** Explicit fingerprints known to have been successfully evaluated clean. */
  applicable_fingerprints?: string[];
}): LedgerApplyResult {
  const at = new Date().toISOString();
  const outputRoot = input.output_root;
  mkdirSync(join(findingsRoot(outputRoot), "by-id"), { recursive: true });

  let index: WebsiteFindingIndex;
  try {
    index = loadFindingIndex(outputRoot);
  } catch (err) {
    throw err;
  }

  const byId = new Map<string, WebsiteFinding>();
  for (const entry of index.findings) {
    const loaded = loadFinding(outputRoot, entry.finding_id);
    if (loaded) byId.set(loaded.finding_id, loaded);
  }

  const result: LedgerApplyResult = {
    created: 0,
    recurring: 0,
    resolved: 0,
    reopened: 0,
    suppressed_hits: 0,
    findings: [],
  };

  const seenFingerprints = new Set<string>();

  for (const obs of input.observations) {
    const normalized = normalizeFindingMessage(obs.message_or_selector);
    const fingerprint = buildFindingFingerprint({
      environment: obs.environment,
      journey_id: obs.journey_id,
      route_pattern: obs.route_pattern,
      check_type: obs.check_type,
      normalized_message_or_selector: normalized,
      viewport_class: String(obs.viewport_class),
    });
    seenFingerprints.add(fingerprint);
    const findingId = findingIdFromFingerprint(fingerprint);
    const existing = byId.get(findingId) ?? null;
    const ts = obs.at ?? at;

    if (!existing) {
      const created: WebsiteFinding = {
        finding_id: findingId,
        fingerprint,
        environment: obs.environment,
        journey_id: obs.journey_id,
        route_pattern: obs.route_pattern,
        viewport_class: obs.viewport_class as WebsiteFindingViewport,
        check_type: obs.check_type,
        normalized_message: normalized,
        severity: obs.severity,
        status: "OPEN",
        ownership: "website-department",
        first_seen_at: ts,
        first_seen_run_id: obs.run_id,
        last_seen_at: ts,
        last_seen_run_id: obs.run_id,
        occurrence_count: 1,
        consecutive_absent_applicable_runs: 0,
        evidence_refs: [obs.evidence_ref],
        reopen_count: 0,
        suppression: null,
        resolution: null,
      };
      byId.set(findingId, created);
      result.created += 1;
      continue;
    }

    const evidence = existing.evidence_refs.includes(obs.evidence_ref)
      ? existing.evidence_refs
      : [...existing.evidence_refs, obs.evidence_ref];

    if (suppressionActive(existing, ts)) {
      byId.set(findingId, {
        ...existing,
        last_seen_at: ts,
        last_seen_run_id: obs.run_id,
        occurrence_count: existing.occurrence_count + 1,
        evidence_refs: evidence,
        consecutive_absent_applicable_runs: 0,
        status: "SUPPRESSED",
      });
      result.suppressed_hits += 1;
      continue;
    }

    if (existing.status === "RESOLVED") {
      byId.set(findingId, {
        ...existing,
        status: "OPEN",
        last_seen_at: ts,
        last_seen_run_id: obs.run_id,
        occurrence_count: existing.occurrence_count + 1,
        evidence_refs: evidence,
        consecutive_absent_applicable_runs: 0,
        reopen_count: existing.reopen_count + 1,
        resolution: null,
        severity: obs.severity,
      });
      result.reopened += 1;
      continue;
    }

    const nextStatus: WebsiteFindingStatus =
      existing.status === "OPEN" || existing.status === "RECURRING"
        ? "RECURRING"
        : "OPEN";
    byId.set(findingId, {
      ...existing,
      status: nextStatus,
      last_seen_at: ts,
      last_seen_run_id: obs.run_id,
      occurrence_count: existing.occurrence_count + 1,
      evidence_refs: evidence,
      consecutive_absent_applicable_runs: 0,
      severity: obs.severity,
      suppression:
        existing.status === "SUPPRESSED" && !suppressionActive(existing, ts)
          ? null
          : existing.suppression,
    });
    if (nextStatus === "RECURRING") result.recurring += 1;
    else result.created += 1;
  }

  const applicableDimensionKeys = new Set<string>();
  for (const check of input.evaluated_checks ?? []) {
    if (check.evaluation === "pass") {
      applicableDimensionKeys.add(findingDimensionKey(check));
    }
  }

  const applicableFingerprints = new Set(input.applicable_fingerprints ?? []);

  for (const finding of byId.values()) {
    if (finding.status !== "OPEN" && finding.status !== "RECURRING") continue;
    if (seenFingerprints.has(finding.fingerprint)) continue;

    const dimApplicable = applicableDimensionKeys.has(
      findingDimensionKey({
        environment: finding.environment,
        journey_id: finding.journey_id,
        route_pattern: finding.route_pattern,
        viewport_class: finding.viewport_class,
        check_type: finding.check_type,
      }),
    );
    const fpApplicable = applicableFingerprints.has(finding.fingerprint);
    if (!dimApplicable && !fpApplicable) continue;

    const absent = finding.consecutive_absent_applicable_runs + 1;
    if (absent >= RESOLVE_AFTER_CONSECUTIVE_ABSENT) {
      byId.set(finding.finding_id, {
        ...finding,
        status: "RESOLVED",
        consecutive_absent_applicable_runs: absent,
        resolution: {
          resolved_at: at,
          resolved_after_run_id: input.run_id,
          note: `Absent for ${absent} consecutive applicable successful runs`,
        },
      });
      result.resolved += 1;
    } else {
      byId.set(finding.finding_id, {
        ...finding,
        consecutive_absent_applicable_runs: absent,
      });
    }
  }

  const all = [...byId.values()];
  for (const f of all) persistFinding(outputRoot, f);
  persistIndex(outputRoot, rebuildIndex(all, at));
  result.findings = all;
  return result;
}

export function suppressFinding(input: {
  output_root: string;
  finding_id: string;
  actor: string;
  reason: string;
  expires_at?: string | null;
}): WebsiteFinding {
  const existing = loadFinding(input.output_root, input.finding_id);
  if (!existing) {
    throw new Error(`finding not found: ${input.finding_id}`);
  }
  const at = new Date().toISOString();
  const updated: WebsiteFinding = {
    ...existing,
    status: "SUPPRESSED",
    suppression: {
      actor: input.actor,
      reason: input.reason,
      suppressed_at: at,
      expires_at: input.expires_at ?? null,
    },
  };
  persistFinding(input.output_root, updated);
  const index = loadFindingIndex(input.output_root);
  const findings = index.findings.map((e) =>
    e.finding_id === updated.finding_id
      ? {
          finding_id: updated.finding_id,
          fingerprint: updated.fingerprint,
          status: updated.status,
          last_seen_at: updated.last_seen_at,
          occurrence_count: updated.occurrence_count,
        }
      : e,
  );
  persistIndex(input.output_root, {
    version: 1,
    updated_at: at,
    findings,
  });
  return updated;
}

/** Active (alerting) findings — excludes SUPPRESSED and RESOLVED. */
export function listActiveFindings(outputRoot: string): WebsiteFinding[] {
  const index = loadFindingIndex(outputRoot);
  const out: WebsiteFinding[] = [];
  for (const e of index.findings) {
    if (e.status === "RESOLVED" || e.status === "SUPPRESSED") continue;
    const f = loadFinding(outputRoot, e.finding_id);
    if (f && (f.status === "OPEN" || f.status === "RECURRING")) out.push(f);
  }
  return out;
}
