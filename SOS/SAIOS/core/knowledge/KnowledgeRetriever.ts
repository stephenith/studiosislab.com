/**
 * Knowledge Retriever — minimal scoped snapshots only — Agent #120.
 */
import type { KnowledgeEntry, KnowledgeRequest } from "./KnowledgeEntry.js";
import { KnowledgeRegistry } from "./KnowledgeRegistry.js";
import {
  PRIORITY_RANK,
  isGlobalReadable,
} from "./KnowledgePolicies.js";
import {
  buildSnapshotMeta,
  toReference,
  type KnowledgeSnapshot,
} from "./KnowledgeSnapshot.js";
import { validateKnowledgeRequest } from "./KnowledgeValidator.js";

export class KnowledgeRetriever {
  constructor(private readonly registry: KnowledgeRegistry) {}

  retrieve(request: KnowledgeRequest): KnowledgeSnapshot {
    validateKnowledgeRequest(request);

    const floor = PRIORITY_RANK[request.priority_floor ?? "low"];
    const tags = (request.tags ?? []).map((t) => t.toLowerCase());
    const privileged =
      request.requester === "executive_brain" ||
      request.requester === "founder";

    let candidates: KnowledgeEntry[] = [];
    for (const domain of request.domains) {
      for (const entry of this.registry.byDomain(domain)) {
        if (PRIORITY_RANK[entry.priority] < floor) continue;

        if (domain === "department" && !privileged) {
          if (entry.department_id && entry.department_id !== request.department_id) {
            continue;
          }
        }

        if (
          !isGlobalReadable(domain) &&
          domain !== "department" &&
          !privileged &&
          request.department_id !== "resume" &&
          domain === "learning"
        ) {
          // learning readable by department owners requesting for their work
        }

        if (tags.length) {
          const entryTags = entry.tags.map((t) => t.toLowerCase());
          if (!tags.some((t) => entryTags.includes(t))) continue;
        }

        candidates.push(entry);
      }
    }

    candidates.sort(
      (a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority],
    );

    const max = request.max_entries ?? 12;
    candidates = candidates.slice(0, max);

    const references = candidates.map(toReference);
    const entries = request.include_references_only
      ? []
      : candidates.map((e) => structuredClone(e));

    return {
      meta: buildSnapshotMeta(request, candidates.length),
      references,
      entries,
    };
  }
}
