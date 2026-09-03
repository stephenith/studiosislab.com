/**
 * Website Department run identity (not an AIOS agent number).
 */
import { randomBytes } from "node:crypto";
import { execSync } from "node:child_process";
import type { CoverageExecution, EvidenceKind, WebsiteRunIdentity } from "./types.js";

export function createWebsiteRunId(now = new Date()): string {
  const ts = now.toISOString().replace(/[:.]/g, "-");
  const suffix = randomBytes(4).toString("hex");
  return `webrun-${ts}-${suffix}`;
}

export function tryReadGitCommit(repoRoot: string): string | null {
  try {
    const out = execSync("git rev-parse HEAD", {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 3000,
    }).trim();
    return out || null;
  } catch {
    return null;
  }
}

export function beginWebsiteRunIdentity(input: {
  mode: WebsiteRunIdentity["mode"];
  evidence_kind: EvidenceKind;
  repo_root: string;
  browser_coverage?: CoverageExecution;
  auth_coverage?: CoverageExecution;
  mobile_coverage?: CoverageExecution;
  download_coverage?: CoverageExecution;
}): WebsiteRunIdentity {
  const started = new Date();
  return {
    run_id: createWebsiteRunId(started),
    mode: input.mode,
    started_at: started.toISOString(),
    completed_at: null,
    repository_commit: tryReadGitCommit(input.repo_root),
    evidence_kind: input.evidence_kind,
    browser_coverage: input.browser_coverage ?? "not_run",
    auth_coverage: input.auth_coverage ?? "not_run",
    mobile_coverage: input.mobile_coverage ?? "static_evidence_only",
    download_coverage: input.download_coverage ?? "static_evidence_only",
  };
}

export function completeWebsiteRunIdentity(
  run: WebsiteRunIdentity,
  patch?: Partial<Pick<WebsiteRunIdentity, "browser_coverage" | "auth_coverage" | "mobile_coverage" | "download_coverage" | "evidence_kind" | "mode">>,
): WebsiteRunIdentity {
  return {
    ...run,
    ...patch,
    completed_at: new Date().toISOString(),
  };
}
