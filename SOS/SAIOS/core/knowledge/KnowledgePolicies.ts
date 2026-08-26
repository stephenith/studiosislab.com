/**
 * Ownership + retrieval policies for the Knowledge System — Agent #120.
 */
import type {
  KnowledgeDomain,
  KnowledgeWriterRole,
  KnowledgePriority,
} from "./KnowledgeEntry.js";

export interface DomainOwnershipPolicy {
  domain: KnowledgeDomain;
  description: string;
  read_by: string[];
  write_by: KnowledgeWriterRole[];
  notes: string;
}

export interface RetrievalPolicyRule {
  id: string;
  rule: string;
}

export const DOMAIN_OWNERSHIP: DomainOwnershipPolicy[] = [
  {
    domain: "founder",
    description: "Founder preferences, permanent decisions, product/design philosophy",
    read_by: ["everyone"],
    write_by: ["founder", "executive_brain"],
    notes: "Read by everyone. Written only by Founder or Executive Brain.",
  },
  {
    domain: "company",
    description: "StudiosisLab architecture, coding standards, JSON specs, publication, infra",
    read_by: ["everyone"],
    write_by: ["architecture"],
    notes: "Read by everyone. Updated only through approved architectural changes.",
  },
  {
    domain: "project",
    description: "Active roadmap, milestones, completed/pending work, project state",
    read_by: ["everyone"],
    write_by: ["executive_brain", "architecture"],
    notes: "Project-wide status; curated by Executive Brain / approved agents.",
  },
  {
    domain: "department",
    description: "Per-department operational knowledge (Resume, Website, future)",
    read_by: ["department_owner", "executive_brain", "founder"],
    write_by: ["department_owner"],
    notes: "Owned by the department. Cross-department reads require Executive Brain.",
  },
  {
    domain: "learning",
    description: "Approved/rejected outputs, revisions, quality observations, improvements",
    read_by: ["department_owner", "executive_brain", "founder"],
    write_by: ["learning_pipeline", "executive_brain"],
    notes: "Written after approvals/rejections.",
  },
  {
    domain: "runtime",
    description: "Active tasks, queue, scheduler, health, heartbeat, current cycle",
    read_by: ["executive_brain", "department_owner", "founder"],
    write_by: ["runtime"],
    notes: "Generated automatically. No manual department writes.",
  },
];

export const RETRIEVAL_RULES: RetrievalPolicyRule[] = [
  {
    id: "no_unrestricted_reads",
    rule: "Departments never read all knowledge. They request a Knowledge Context only.",
  },
  {
    id: "minimal_snapshot",
    rule: "Knowledge Retriever returns a Minimal Knowledge Snapshot, not the full corpus.",
  },
  {
    id: "domain_scoped",
    rule: "Each KnowledgeRequest must declare explicit domains; empty domain lists are rejected.",
  },
  {
    id: "entry_cap",
    rule: "Snapshots are capped (default max_entries=12) to keep Skill prompts lean.",
  },
  {
    id: "priority_floor",
    rule: "Entries below the request priority_floor are excluded.",
  },
  {
    id: "department_isolation",
    rule: "Department-domain entries are filtered to the requesting department_id unless requester is executive_brain or founder.",
  },
  {
    id: "before_skills",
    rule: "Resume Department must load knowledge snapshot before requesting Skills from the Brain Router.",
  },
  {
    id: "live_off",
    rule: "Knowledge System dry-run does not call providers, generate templates, or publish.",
  },
];

export const PRIORITY_RANK: Record<KnowledgePriority, number> = {
  critical: 4,
  high: 3,
  normal: 2,
  low: 1,
};

export function ownershipFor(domain: KnowledgeDomain): DomainOwnershipPolicy {
  const found = DOMAIN_OWNERSHIP.find((d) => d.domain === domain);
  if (!found) {
    throw new Error(`Unknown knowledge domain: ${domain}`);
  }
  return found;
}

export function canWrite(
  domain: KnowledgeDomain,
  role: KnowledgeWriterRole,
): boolean {
  return ownershipFor(domain).write_by.includes(role);
}

export function isGlobalReadable(domain: KnowledgeDomain): boolean {
  return ownershipFor(domain).read_by.includes("everyone");
}
