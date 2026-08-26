/**
 * Knowledge System validators — Agent #120.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { KnowledgeRequest, KnowledgeWriterRole } from "./KnowledgeEntry.js";
import { KNOWLEDGE_DOMAINS } from "./KnowledgeRegistry.js";
import { canWrite, DOMAIN_OWNERSHIP, RETRIEVAL_RULES } from "./KnowledgePolicies.js";
import { RESUME_PRE_SKILL_DOMAINS } from "./KnowledgeContext.js";

export function validateKnowledgeRequest(request: KnowledgeRequest): void {
  if (!request.domains.length) {
    throw new Error("KnowledgeRequest.domains must not be empty");
  }
  for (const d of request.domains) {
    if (!KNOWLEDGE_DOMAINS.includes(d)) {
      throw new Error(`Unknown domain in KnowledgeRequest: ${d}`);
    }
  }
  if (request.max_entries !== undefined && request.max_entries < 1) {
    throw new Error("KnowledgeRequest.max_entries must be >= 1");
  }
}

export function assertWriteAllowed(
  domain: KnowledgeRequest["domains"][number],
  role: KnowledgeWriterRole,
): void {
  if (!canWrite(domain, role)) {
    throw new Error(`Role ${role} cannot write domain ${domain}`);
  }
}

export function assertDomainsExist(): boolean {
  return KNOWLEDGE_DOMAINS.length === 6;
}

export function assertOwnershipDefined(): boolean {
  return (
    DOMAIN_OWNERSHIP.length === 6 &&
    DOMAIN_OWNERSHIP.every((o) => o.write_by.length > 0 && o.read_by.length > 0)
  );
}

export function assertRetrievalRulesExist(): boolean {
  return RETRIEVAL_RULES.length >= 6;
}

export function assertResumeIntegrationDocumented(archPath: string): boolean {
  if (!existsSync(archPath)) return false;
  const text = readFileSync(archPath, "utf8");
  const needed = [
    "Founder Knowledge",
    "Company Knowledge",
    "Resume Department",
    "Learning Knowledge",
    "before requesting Skills",
    ...RESUME_PRE_SKILL_DOMAINS,
  ];
  return needed.every((n) => text.includes(n));
}

export function assertLiveOff(): boolean {
  return process.env.SOS_AIOS_LIVE !== "1";
}

export function assertNoSdk(repoPackageJson: string): boolean {
  const pkg = JSON.parse(readFileSync(repoPackageJson, "utf8"));
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  return !("openai" in deps) && !("@anthropic-ai/sdk" in deps);
}

export function assertKnowledgeSourcesClean(coreDir: string): {
  ok: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  const files = readdirSync(coreDir).filter((f) => f.endsWith(".ts"));
  for (const f of files) {
    const text = readFileSync(join(coreDir, f), "utf8");
    if (/\bfrom ["']openai["']/.test(text)) {
      issues.push(`${f} imports openai`);
    }
    if (/\bfetch\s*\(/.test(text) && !f.includes("verify")) {
      issues.push(`${f} uses fetch`);
    }
  }
  return { ok: issues.length === 0, issues };
}
