/**
 * Seeded Knowledge Registry — six domains — Agent #120.
 */
import type { KnowledgeDomain, KnowledgeEntry } from "./KnowledgeEntry.js";
import { ownershipFor } from "./KnowledgePolicies.js";

const NOW = "2026-07-11T08:51:00.000Z";

function entry(
  partial: Omit<KnowledgeEntry, "read_roles" | "write_roles" | "created_at" | "updated_at" | "active"> &
    Partial<Pick<KnowledgeEntry, "created_at" | "updated_at" | "active">>,
): KnowledgeEntry {
  const own = ownershipFor(partial.domain);
  return {
    ...partial,
    read_roles: [...own.read_by],
    write_roles: [...own.write_by],
    created_at: partial.created_at ?? NOW,
    updated_at: partial.updated_at ?? NOW,
    active: partial.active ?? true,
  };
}

/** Canonical seed corpus — architecture / dry-run only (no live resume content). */
export const SEED_ENTRIES: KnowledgeEntry[] = [
  // —— Founder ——
  entry({
    entry_id: "founder.preferences.core",
    domain: "founder",
    title: "Founder preferences",
    summary: "Permanent taste and operating preferences for StudiosisLab.",
    content: {
      brand_first: true,
      ats_friendly_default: true,
      no_purple_default_ai_look: true,
      approve_before_live: true,
    },
    tags: ["preferences", "permanent"],
    scope: "global",
    priority: "critical",
    version: "1.0.0",
    source: "founder",
    confidence: "confirmed",
    owner: "founder",
  }),
  entry({
    entry_id: "founder.philosophy.product",
    domain: "founder",
    title: "Product philosophy",
    summary: "Product decisions that constrain all departments.",
    content: {
      website_on_vercel: true,
      aios_on_hetzner_control_plane: true,
      departments_request_skills_not_prompts: true,
    },
    tags: ["philosophy", "product"],
    scope: "global",
    priority: "critical",
    version: "1.0.0",
    source: "founder",
    confidence: "confirmed",
    owner: "founder",
  }),
  entry({
    entry_id: "founder.philosophy.design",
    domain: "founder",
    title: "Design & typography preferences",
    summary: "Design DNA constraints: typography, spacing, layout.",
    content: {
      typography: "expressive purposeful fonts; avoid Inter/Roboto/Arial defaults",
      spacing: "intentional hierarchy; avoid cluttered first viewport",
      layout: "one composition; brand as hero-level signal",
    },
    tags: ["design", "typography", "spacing"],
    scope: "global",
    priority: "high",
    version: "1.0.0",
    source: "founder",
    confidence: "confirmed",
    owner: "founder",
  }),
  entry({
    entry_id: "founder.rules.approval",
    domain: "founder",
    title: "Approval rules",
    summary: "When founder approval is required.",
    content: {
      live_requires_SOS_AIOS_LIVE: true,
      openai_requires_budget_env: true,
      publication_requires_gate: true,
    },
    tags: ["approval", "rules"],
    scope: "global",
    priority: "critical",
    version: "1.0.0",
    source: "executive_brain",
    confidence: "confirmed",
    owner: "executive_brain",
  }),

  // —— Company ——
  entry({
    entry_id: "company.architecture.aios",
    domain: "company",
    title: "StudiosisLab AIOS architecture",
    summary: "Control-plane architecture and department boundaries.",
    content: {
      flow: "Founder → Executive/Brain Router → Skill Library → Provider Adapter",
      providers: ["mock", "openai(disabled)", "local(disabled)"],
      website_department: "disabled until enabled",
      resume_department: "dry_run",
    },
    tags: ["architecture", "aios"],
    scope: "global",
    priority: "critical",
    version: "1.0.0",
    source: "architecture_change",
    confidence: "confirmed",
    owner: "architecture",
  }),
  entry({
    entry_id: "company.standards.coding",
    domain: "company",
    title: "Coding standards",
    summary: "Repo coding and agent delivery standards.",
    content: {
      no_sdk_without_approval: true,
      append_only_project_state: true,
      verify_scripts_required: true,
    },
    tags: ["coding", "standards"],
    scope: "global",
    priority: "high",
    version: "1.0.0",
    source: "architecture_change",
    confidence: "confirmed",
    owner: "architecture",
  }),
  entry({
    entry_id: "company.specs.json",
    domain: "company",
    title: "JSON specifications",
    summary: "Canonical JSON contracts for factory + AIOS logs.",
    content: {
      project_state: "SOS/project-state.json",
      provider_registry: "SOS/SAIOS/config/provider-registry.json",
      skill_registry: "SOS/SAIOS/config/skill-registry.json",
    },
    tags: ["json", "specs"],
    scope: "global",
    priority: "high",
    version: "1.0.0",
    source: "architecture_change",
    confidence: "confirmed",
    owner: "architecture",
  }),
  entry({
    entry_id: "company.rules.publication",
    domain: "company",
    title: "Publication rules",
    summary: "Publication gates and freeze rules.",
    content: {
      qa_must_pass: true,
      founder_review_when_required: true,
      no_publish_from_knowledge_dry_run: true,
    },
    tags: ["publication", "rules"],
    scope: "global",
    priority: "critical",
    version: "1.0.0",
    source: "architecture_change",
    confidence: "confirmed",
    owner: "architecture",
  }),
  entry({
    entry_id: "company.infra.topology",
    domain: "company",
    title: "Infrastructure",
    summary: "Website on Vercel; AIOS control plane on Hetzner VPS.",
    content: {
      website: "vercel",
      aios: "hetzner_vps",
      pm2_autostart: false,
    },
    tags: ["infrastructure"],
    scope: "global",
    priority: "high",
    version: "1.0.0",
    source: "architecture_change",
    confidence: "confirmed",
    owner: "architecture",
  }),

  // —— Project ——
  entry({
    entry_id: "project.roadmap.active",
    domain: "project",
    title: "Active roadmap",
    summary: "AIOS Sprint knowledge + brain stack.",
    content: {
      focus: "Knowledge System after Resume↔Brain dry-run",
      latest_agent: "120",
      next_agent: "121",
    },
    tags: ["roadmap", "milestones"],
    scope: "global",
    priority: "high",
    version: "1.0.0",
    source: "seed",
    confidence: "confirmed",
    owner: "executive_brain",
  }),
  entry({
    entry_id: "project.state.current",
    domain: "project",
    title: "Current project state pointer",
    summary: "Pointer to SOS/project-state.json as source of truth.",
    content: {
      path: "SOS/project-state.json",
      resume_brain_integration: "ready",
      mock_provider: "ready",
      live: false,
    },
    tags: ["project-state", "completed", "pending"],
    scope: "global",
    priority: "critical",
    version: "1.0.0",
    source: "seed",
    confidence: "confirmed",
    owner: "executive_brain",
  }),

  // —— Department ——
  entry({
    entry_id: "department.resume.ops",
    domain: "department",
    title: "Resume Department operational knowledge",
    summary: "Resume Factory ops map to Skills; QA/gates are deterministic.",
    content: {
      skills_path: "planning→resume.layout_planning; critique→resume.resume_critique",
      deterministic: ["qa", "publication_gate"],
      mode: "dry_run",
      before_skills: ["founder", "company", "department", "learning"],
    },
    tags: ["resume", "operations"],
    scope: "department",
    priority: "critical",
    version: "1.0.0",
    source: "department",
    confidence: "confirmed",
    owner: "resume_department",
    department_id: "resume",
  }),
  entry({
    entry_id: "department.website.status",
    domain: "department",
    title: "Website Department status",
    summary: "Website department remains disabled in AIOS enablement.",
    content: {
      enabled: false,
      hosting: "vercel",
    },
    tags: ["website", "status"],
    scope: "department",
    priority: "normal",
    version: "1.0.0",
    source: "department",
    confidence: "confirmed",
    owner: "website_department",
    department_id: "website",
  }),
  entry({
    entry_id: "department.future.placeholder",
    domain: "department",
    title: "Future departments placeholder",
    summary: "Slot for future department operational knowledge.",
    content: {
      departments: ["notification", "timeline", "future"],
    },
    tags: ["future"],
    scope: "department",
    priority: "low",
    version: "1.0.0",
    source: "seed",
    confidence: "draft",
    owner: "executive_brain",
    department_id: "future",
  }),

  // —— Learning ——
  entry({
    entry_id: "learning.observations.quality",
    domain: "learning",
    title: "Quality observations",
    summary: "Common quality observations from factory history (non-live).",
    content: {
      approved_pattern: "single-column ATS layouts score higher",
      rejected_pattern: "multi-column decorative layouts fail ATS gate",
      common_mistakes: ["raw prompts to providers", "publishing without gate"],
      future_improvements: ["wire knowledge snapshot into ResumeBrainGateway"],
    },
    tags: ["quality", "approved", "rejected", "revisions"],
    scope: "global",
    priority: "high",
    version: "1.0.0",
    source: "seed",
    confidence: "observed",
    owner: "learning_pipeline",
  }),

  // —— Runtime ——
  entry({
    entry_id: "runtime.health.snapshot",
    domain: "runtime",
    title: "Runtime health snapshot",
    summary: "Dry-run runtime sensor values (not LIVE).",
    content: {
      active_tasks: 0,
      queue_state: "idle",
      scheduler_state: "stopped",
      health: "ok",
      last_heartbeat: NOW,
      current_cycle: null,
      live: false,
    },
    tags: ["health", "queue", "scheduler", "heartbeat", "cycle"],
    scope: "cycle",
    priority: "normal",
    version: "1.0.0",
    source: "runtime_sensor",
    confidence: "observed",
    owner: "runtime",
  }),
];

export const KNOWLEDGE_DOMAINS: KnowledgeDomain[] = [
  "founder",
  "company",
  "project",
  "department",
  "learning",
  "runtime",
];

export class KnowledgeRegistry {
  private entries: Map<string, KnowledgeEntry>;

  constructor(seed: KnowledgeEntry[] = SEED_ENTRIES) {
    this.entries = new Map(seed.map((e) => [e.entry_id, structuredClone(e)]));
  }

  listDomains(): KnowledgeDomain[] {
    return [...KNOWLEDGE_DOMAINS];
  }

  listAll(): KnowledgeEntry[] {
    return [...this.entries.values()].filter((e) => e.active);
  }

  get(entryId: string): KnowledgeEntry | undefined {
    return this.entries.get(entryId);
  }

  byDomain(domain: KnowledgeDomain): KnowledgeEntry[] {
    return this.listAll().filter((e) => e.domain === domain);
  }

  upsert(entry: KnowledgeEntry): void {
    this.entries.set(entry.entry_id, entry);
  }

  count(): number {
    return this.listAll().length;
  }

  domainCounts(): Record<KnowledgeDomain, number> {
    const out = Object.fromEntries(
      KNOWLEDGE_DOMAINS.map((d) => [d, 0]),
    ) as Record<KnowledgeDomain, number>;
    for (const e of this.listAll()) {
      out[e.domain] += 1;
    }
    return out;
  }
}
