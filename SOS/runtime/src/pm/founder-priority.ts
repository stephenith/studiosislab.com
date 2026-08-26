/**
 * Founder Decision Engine — launch-value priority model.
 * Sourced from SOS/01_KNOWLEDGE/ (Founder_Vision, Product_Priorities, Launch_Strategy, PM_DECISION_ENGINE).
 */
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { BacklogItem, PmState } from "./types.js";
import { isVagueTask } from "./readers.js";

export type FounderCategory =
  | "launch_blocker"
  | "revenue_blocker"
  | "mobile"
  | "resume"
  | "authentication"
  | "downloads"
  | "seo"
  | "firebase"
  | "esign"
  | "internal_improvements"
  | "documentation"
  | "deferred";

export const FOUNDER_CATEGORY_ORDER: Record<FounderCategory, number> = {
  launch_blocker: 11,
  revenue_blocker: 10,
  mobile: 9,
  resume: 8,
  authentication: 7,
  downloads: 6,
  seo: 5,
  firebase: 4,
  esign: 3,
  internal_improvements: 2,
  documentation: 1,
  deferred: 0,
};

export const FOUNDER_CATEGORY_LABELS: Record<FounderCategory, string> = {
  launch_blocker: "Launch blocker",
  revenue_blocker: "Revenue blocker",
  mobile: "Mobile resume editor",
  resume: "Resume builder flow",
  authentication: "Authentication",
  downloads: "Downloads / export",
  seo: "SEO / traffic",
  firebase: "Firebase / persistence",
  esign: "E-sign (pre-launch)",
  internal_improvements: "Internal improvements",
  documentation: "Documentation",
  deferred: "Deferred / low priority",
};

const CATEGORY_BASE: Record<FounderCategory, number> = {
  launch_blocker: 1000,
  revenue_blocker: 800,
  mobile: 700,
  resume: 600,
  authentication: 500,
  downloads: 450,
  seo: 400,
  firebase: 350,
  esign: 150,
  internal_improvements: 200,
  documentation: 100,
  deferred: 0,
};

const LAUNCH_BLOCKER_PATTERNS =
  /launch blocker|p0|r1\b|phone users|cannot edit|mobile hub|hub.*route|editor\/mobile|EditorMobileGuard|L4 fail|users cannot/i;
const REVENUE_BLOCKER_PATTERNS =
  /export blocked|ad gate broken|cannot download|download fail|revenue blocker/i;
const MOBILE_PATTERNS =
  /mobile|EditorMobileGuard|\/editor\/mobile|phone|viewport|tablet/i;
const RESUME_PATTERNS =
  /resume|editor|useFabricEditor|canvas|template apply|resume_docs|gallery|recents|ResumeHub/i;
const AUTH_PATTERNS = /auth|login|EditorAuthGate|signIn|sign-in|session|google sign/i;
const DOWNLOAD_PATTERNS = /export|download|pdf|png|exportCanvas|jspdf/i;
const SEO_PATTERNS = /seo|templateSeoContent|sitemap|organic|landing page/i;
const FIREBASE_PATTERNS = /firebase|firestore|resume_docs/i;
const ESIGN_PATTERNS = /e-sign|esign|esign_documents|invite\/complete|tools\/esign/i;
const INTERNAL_PATTERNS =
  /categoryid|orphan|normalize|cleanup|readme|hub alias|publisher dashboard|internal|tooling|hygiene/i;
const DOC_PATTERNS =
  /constitution|sos constitution|00_constitution|knowledge cleanup|internal doc|author sos|mission\.md|vision\.md|approval matrix|documentation|knowledge base|01_KNOWLEDGE|\breadme\b/i;
const DEFERRED_PATTERNS = /games|publisher dashboard|dashboard\/login|runtime polish|commander telemetry/i;
const REFACTOR_PATTERNS =
  /refactor|architecture|restructure|monolithic|cosmetic|clean up code|abstraction/i;

const KNOWLEDGE_FILES = [
  "Founder_Vision.md",
  "Product_Priorities.md",
  "Launch_Strategy.md",
  "Decision_Framework.md",
  "PM_DECISION_ENGINE.md",
] as const;

export type LaunchReadiness = {
  launch_blockers_open: string[];
  launch_stage: string;
  criteria_met: string[];
  criteria_unmet: string[];
  knowledge_loaded: boolean;
  knowledge_files: string[];
};

export type FounderScoreResult = {
  category: FounderCategory;
  category_label: string;
  category_order: number;
  base_score: number;
  modifiers: Array<{ label: string; delta: number }>;
  founder_score: number;
  launch_stage: string;
  refused_while_blockers: boolean;
  reasons: string[];
};

export type FounderKnowledgeSummary = {
  loaded: boolean;
  knowledge_root: string;
  files_present: string[];
  files_missing: string[];
};

function evidenceText(item: BacklogItem): string {
  return `${item.title} ${item.description} ${item.evidence.join(" ")}`.toLowerCase();
}

export function classifyFounderCategory(item: BacklogItem): FounderCategory {
  const text = evidenceText(item);

  if (LAUNCH_BLOCKER_PATTERNS.test(text)) return "launch_blocker";
  if (REVENUE_BLOCKER_PATTERNS.test(text)) return "revenue_blocker";
  if (MOBILE_PATTERNS.test(text)) return "mobile";
  if (DOWNLOAD_PATTERNS.test(text) && !ESIGN_PATTERNS.test(text)) return "downloads";
  if (RESUME_PATTERNS.test(text) && !MOBILE_PATTERNS.test(text)) return "resume";
  if (RESUME_PATTERNS.test(text)) return "resume";
  if (AUTH_PATTERNS.test(text)) return "authentication";
  if (SEO_PATTERNS.test(text)) return "seo";
  if (ESIGN_PATTERNS.test(text)) return "esign";
  if (FIREBASE_PATTERNS.test(text)) return "firebase";
  if (DOC_PATTERNS.test(text) || item.evidence.every((e) => e.startsWith("SOS/"))) return "documentation";
  if (INTERNAL_PATTERNS.test(text)) return "internal_improvements";
  if (DEFERRED_PATTERNS.test(text)) return "deferred";

  if (item.evidence.some((e) => e.startsWith("src/"))) return "resume";
  return "internal_improvements";
}

export function isDocumentationCategory(category: FounderCategory): boolean {
  return category === "documentation";
}

export function isCleanupOrRefactorTask(item: BacklogItem): boolean {
  const text = evidenceText(item);
  return INTERNAL_PATTERNS.test(text) || REFACTOR_PATTERNS.test(text);
}

export function isArchitectureOrRefactorTask(item: BacklogItem): boolean {
  return REFACTOR_PATTERNS.test(evidenceText(item));
}

export function isR1MobileHubGapOpen(state: PmState): boolean {
  for (const task of state.task_queue) {
    if (task.status !== "completed") continue;
    if (task.metadata?.launch_criterion === "L4") return false;
    if (/mobile.*(hub|routing|redirect)/i.test(task.title)) return false;
  }
  for (const taskId of state.completed_task_ids) {
    const task = state.task_queue.find((t) => t.task_id === taskId);
    if (task && /mobile.*(hub|routing|redirect)/i.test(task.title)) return false;
    if (task?.metadata?.launch_criterion === "L4") return false;
  }
  return true;
}

export function assessLaunchReadiness(state: PmState, _allItems: BacklogItem[]): LaunchReadiness {
  const launch_blockers_open: string[] = [];
  const criteria_unmet: string[] = [];
  const criteria_met: string[] = [];

  if (isR1MobileHubGapOpen(state)) {
    launch_blockers_open.push("R1_mobile_hub_gap");
    criteria_unmet.push("L4_phone_user_can_edit_from_hub");
  }

  const hasCompletedProduct = state.completed_task_ids.length > 0;
  if (hasCompletedProduct) criteria_met.push("pipeline_has_shipped_tasks");

  let launch_stage = "Phase A — Core editor";
  if (!isR1MobileHubGapOpen(state)) {
    launch_stage = "Phase C — Discovery (mobile routing cleared)";
  } else if (launch_blockers_open.length > 0) {
    launch_stage = "Phase B — Mobile parity (blocker open)";
  }

  return {
    launch_blockers_open,
    launch_stage,
    criteria_met,
    criteria_unmet,
    knowledge_loaded: false,
    knowledge_files: [],
  };
}

export async function loadFounderKnowledge(knowledgeRoot: string): Promise<FounderKnowledgeSummary> {
  const files_present: string[] = [];
  const files_missing: string[] = [];

  for (const file of KNOWLEDGE_FILES) {
    const path = join(knowledgeRoot, file);
    if (existsSync(path)) files_present.push(file);
    else files_missing.push(file);
  }

  return {
    loaded: files_missing.length === 0,
    knowledge_root: knowledgeRoot,
    files_present,
    files_missing,
  };
}

export async function enrichLaunchReadinessWithKnowledge(
  readiness: LaunchReadiness,
  knowledgeRoot: string,
): Promise<LaunchReadiness> {
  const knowledge = await loadFounderKnowledge(knowledgeRoot);
  return {
    ...readiness,
    knowledge_loaded: knowledge.loaded,
    knowledge_files: knowledge.files_present,
  };
}

export function shouldRefuseTaskWhileBlockers(
  item: BacklogItem,
  category: FounderCategory,
  launchBlockersOpen: string[],
): boolean {
  if (launchBlockersOpen.length === 0) return false;

  if (category === "documentation") return true;
  if (category === "internal_improvements") return true;
  if (category === "deferred") return true;
  if (isArchitectureOrRefactorTask(item)) return true;
  if (isCleanupOrRefactorTask(item) && category !== "launch_blocker" && category !== "mobile") {
    return true;
  }

  const text = evidenceText(item);
  if (DOC_PATTERNS.test(text) && category !== "launch_blocker") return true;

  return false;
}

export function scoreFounderPriority(
  item: BacklogItem,
  readiness: LaunchReadiness,
): FounderScoreResult {
  const category = classifyFounderCategory(item);
  const modifiers: Array<{ label: string; delta: number }> = [];
  const text = evidenceText(item);

  let base = CATEGORY_BASE[category];
  const reasons: string[] = [`Founder category: ${FOUNDER_CATEGORY_LABELS[category]} (base ${base})`];

  if (item.evidence.some((e) => e.startsWith("src/app") || e.startsWith("src/components"))) {
    modifiers.push({ label: "user-facing", delta: 50 });
  } else if (item.evidence.some((e) => e.startsWith("src/"))) {
    modifiers.push({ label: "product code", delta: 30 });
  }

  if (/bug|fix|broken|fail|regression/i.test(text)) {
    modifiers.push({ label: "bug fix", delta: 40 });
  }

  if (item.evidence.filter((e) => e.startsWith("src/")).length <= 5) {
    modifiers.push({ label: "small slice", delta: 30 });
  }

  if (item.priority === "Critical") modifiers.push({ label: "critical priority", delta: 25 });

  if (/firestore\.rules|storage\.rules|routing decision|user-visible routing/i.test(text)) {
    modifiers.push({ label: "hard gate", delta: -200 });
  }

  if (item.status === "blocked" || item.section === "blocked") {
    modifiers.push({ label: "blocked backlog", delta: -500 });
  }

  if (isVagueTask(item)) modifiers.push({ label: "vague task", delta: -80 });

  const refused =
    shouldRefuseTaskWhileBlockers(item, category, readiness.launch_blockers_open);
  if (refused) {
    modifiers.push({ label: "refused while launch blockers open", delta: -900 });
    reasons.push("Refused: documentation/cleanup/refactor while launch blockers exist");
  }

  if (
    isDocumentationCategory(category)
    && readiness.launch_blockers_open.length > 0
  ) {
    modifiers.push({ label: "documentation gate", delta: -900 });
  }

  const modifierSum = modifiers.reduce((s, m) => s + m.delta, 0);
  const founder_score = Math.max(0, base + modifierSum);

  for (const m of modifiers) {
    reasons.push(`${m.label}: ${m.delta >= 0 ? "+" : ""}${m.delta}`);
  }

  return {
    category,
    category_label: FOUNDER_CATEGORY_LABELS[category],
    category_order: FOUNDER_CATEGORY_ORDER[category],
    base_score: base,
    modifiers,
    founder_score,
    launch_stage: readiness.launch_stage,
    refused_while_blockers: refused,
    reasons,
  };
}

export function computeCombinedScore(founder: FounderScoreResult, technicalScore: number): number {
  return founder.category_order * 1_000_000 + founder.founder_score * 1_000 + technicalScore;
}

export async function readFounderKnowledgeExcerpt(
  knowledgeRoot: string,
  fileName: string,
  maxChars = 500,
): Promise<string | null> {
  const path = join(knowledgeRoot, fileName);
  if (!existsSync(path)) return null;
  const raw = await readFile(path, "utf8");
  return raw.slice(0, maxChars);
}
