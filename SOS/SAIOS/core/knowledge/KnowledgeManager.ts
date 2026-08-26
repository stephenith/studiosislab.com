/**
 * Knowledge Manager — department-facing facade — Agent #120/#125.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { KnowledgeEntry, KnowledgeRequest, KnowledgeWriterRole } from "./KnowledgeEntry.js";
import { KnowledgeContext, RESUME_PRE_SKILL_DOMAINS } from "./KnowledgeContext.js";
import { KnowledgeRegistry } from "./KnowledgeRegistry.js";
import { KnowledgeRetriever } from "./KnowledgeRetriever.js";
import type { KnowledgeSnapshot } from "./KnowledgeSnapshot.js";
import { assertWriteAllowed, validateKnowledgeRequest } from "./KnowledgeValidator.js";
import { DOMAIN_OWNERSHIP, RETRIEVAL_RULES } from "./KnowledgePolicies.js";

export interface ResumeKnowledgeLoadResult {
  context: KnowledgeContext;
  snapshot: KnowledgeSnapshot;
  domains_loaded: typeof RESUME_PRE_SKILL_DOMAINS;
  next_step: "request_skills";
  template_generated: false;
  published: false;
  live: false;
  learning_merged: number;
}

export class KnowledgeManager {
  readonly registry: KnowledgeRegistry;
  readonly retriever: KnowledgeRetriever;

  constructor(registry: KnowledgeRegistry = new KnowledgeRegistry()) {
    this.registry = registry;
    this.retriever = new KnowledgeRetriever(registry);
  }

  /**
   * Merge founder-approved learning snapshot into learning domain (upsert by id).
   */
  mergeFounderLearningFromDisk(repoRoot?: string): number {
    const repo = repoRoot ?? resolve(import.meta.dirname, "../../../..");
    const path = join(
      repo,
      "SOS/07_LOGS/saios/knowledge/learning/learning-snapshot.json",
    );
    if (!existsSync(path)) return 0;
    try {
      const snap = JSON.parse(readFileSync(path, "utf8")) as {
        entries?: Array<Record<string, unknown>>;
      };
      let n = 0;
      for (const e of snap.entries ?? []) {
        if (e.fixture) continue;
        const entry_id = `learning.founder.${String(e.learning_id)}`;
        const now = new Date().toISOString();
        this.registry.upsert({
          entry_id,
          domain: "learning",
          title: String(e.subject ?? e.category ?? "founder learning"),
          summary: String(e.observation ?? ""),
          content: {
            category: e.category,
            source_decision_id: e.source_decision_id,
            source_review_id: e.source_review_id,
            source_task_id: e.source_task_id,
            approved_by_founder: true,
            applicability: e.applicability,
          },
          tags: ["founder", String(e.category ?? "learning"), "approved_by_founder"],
          scope: "global",
          priority: "high",
          version: String(e.version ?? "1.0.0"),
          source: "approval_event",
          confidence: "confirmed",
          owner: "learning_pipeline",
          read_roles: ["department_owner", "executive_brain", "founder"],
          write_roles: ["learning_pipeline", "executive_brain"],
          created_at: String(e.created_at ?? now),
          updated_at: now,
          active: true,
        });
        n += 1;
      }
      return n;
    } catch {
      return 0;
    }
  }

  requestSnapshot(request: KnowledgeRequest): KnowledgeSnapshot {
    validateKnowledgeRequest(request);
    return this.retriever.retrieve(request);
  }

  requestFromContext(context: KnowledgeContext): KnowledgeSnapshot {
    return this.requestSnapshot(context.request);
  }

  loadResumePreSkillKnowledge(input: {
    purpose: string;
    task_id?: string;
    tags?: string[];
  }): ResumeKnowledgeLoadResult {
    const learning_merged = this.mergeFounderLearningFromDisk();
    const context = KnowledgeContext.forResumePreSkill(input);
    const snapshot = this.requestFromContext(context);
    return {
      context,
      snapshot,
      domains_loaded: [...RESUME_PRE_SKILL_DOMAINS],
      next_step: "request_skills",
      template_generated: false,
      published: false,
      live: false,
      learning_merged,
    };
  }

  writeEntry(entry: KnowledgeEntry, role: KnowledgeWriterRole): void {
    assertWriteAllowed(entry.domain, role);
    this.registry.upsert({
      ...entry,
      updated_at: new Date().toISOString(),
    });
  }

  describeOwnership() {
    return DOMAIN_OWNERSHIP;
  }

  describeRetrievalPolicy() {
    return RETRIEVAL_RULES;
  }

  readiness() {
    return {
      status: "ready" as const,
      domains: this.registry.listDomains(),
      domain_counts: this.registry.domainCounts(),
      entry_count: this.registry.count(),
      ownership_defined: DOMAIN_OWNERSHIP.length === 6,
      retrieval_rules: RETRIEVAL_RULES.length,
      resume_pre_skill_domains: [...RESUME_PRE_SKILL_DOMAINS],
      live: false as const,
      sdk: false as const,
      api_calls: 0,
      publication: false as const,
    };
  }
}
