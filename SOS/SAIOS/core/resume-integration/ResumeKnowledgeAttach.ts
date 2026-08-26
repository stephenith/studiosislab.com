/**
 * Attach Minimal Knowledge Snapshot refs onto Resume SkillRequests — Agent #121.
 */
import type { KnowledgeSnapshot } from "../knowledge/KnowledgeSnapshot.js";
import { RESUME_PRE_SKILL_DOMAINS } from "../knowledge/KnowledgeContext.js";
import type { SkillRequest } from "../skills/Skill.js";

export function attachKnowledgeToSkillRequest(
  skillRequest: SkillRequest,
  snapshot: KnowledgeSnapshot,
): SkillRequest {
  if (snapshot.meta.unrestricted !== false) {
    throw new Error("Unrestricted knowledge snapshots are forbidden");
  }
  if (snapshot.meta.live !== false) {
    throw new Error("LIVE knowledge snapshots are forbidden in dry-run");
  }

  const refs = snapshot.references.map((r) => r.entry_id);
  if (!refs.length) {
    throw new Error("Knowledge snapshot must contain at least one reference");
  }

  const prior = skillRequest.context_references ?? [];
  const merged = [...new Set([...prior, ...refs])];

  return {
    ...skillRequest,
    context_references: merged,
    input: {
      ...skillRequest.input,
      knowledge_references: refs,
      knowledge_snapshot_id: snapshot.meta.snapshot_id,
      knowledge_domains: [...snapshot.meta.domains_requested],
      knowledge_entry_count: snapshot.meta.entry_count,
    },
  };
}

export function assertSkillRequestHasKnowledge(skillRequest: SkillRequest): {
  ok: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const refs = skillRequest.input.knowledge_references;
  if (!Array.isArray(refs) || refs.length === 0) {
    errors.push("SkillRequest.input.knowledge_references missing or empty");
  }
  if (!skillRequest.context_references?.length) {
    errors.push("SkillRequest.context_references missing knowledge refs");
  }
  if (typeof skillRequest.input.knowledge_snapshot_id !== "string") {
    errors.push("SkillRequest.input.knowledge_snapshot_id missing");
  }
  const domains = skillRequest.input.knowledge_domains;
  if (!Array.isArray(domains)) {
    errors.push("SkillRequest.input.knowledge_domains missing");
  } else {
    for (const d of RESUME_PRE_SKILL_DOMAINS) {
      if (!domains.includes(d)) {
        errors.push(`SkillRequest missing required knowledge domain: ${d}`);
      }
    }
  }
  return { ok: errors.length === 0, errors };
}
