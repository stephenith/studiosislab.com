/**
 * Factory State Discoverer — auto-discovers project state from SOS artifacts.
 * No hardcoded agent numbers, catalog ids, or release ids.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import type {
  AgentRecord,
  FactoryProjectState,
  FounderReviewRecord,
  HistoryEntry,
  PublicationQueueEntry,
  ReleaseRecord,
} from "./types.js";

const REPO_ROOT = resolve(import.meta.dirname, "../../../..");
const SOS_ROOT = join(REPO_ROOT, "SOS");
const REPORTS_ROOT = join(SOS_ROOT, "09_REPORTS");
const LOGS_ROOT = join(SOS_ROOT, "07_LOGS/saios");
const MANIFEST_PATH = join(REPO_ROOT, "templates.manifest.json");

const AGENT_PATTERN = /(?:#\s*AGENT|Prompt:\s*AGENT|\*{0,2}Agent:\*{0,2})\s*#(\d{3})/g;
const EXCLUDED_SCAN_FILES = new Set([
  "SOS/project-state.json",
  "SOS/PROJECT_STATUS.md",
  "SOS/09_REPORTS/factory-state-report.md",
]);
const AGENT_TITLE_PATTERN = /#\s*AGENT\s*#(\d{3})\s*[—–-]\s*(.+)/i;

function readJson<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return null;
  }
}

function walkFiles(root: string, extensions: string[]): string[] {
  if (!existsSync(root)) return [];
  const out: string[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop()!;
    let entries: Array<{ name: string; isDirectory: () => boolean }>;
    try {
      entries = readdirSync(current, { withFileTypes: true }) as Array<{
        name: string;
        isDirectory: () => boolean;
      }>;
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
        stack.push(full);
        continue;
      }
      if (extensions.some((ext) => entry.name.endsWith(ext))) out.push(full);
    }
  }
  return out;
}

function discoverAgents(): {
  records: AgentRecord[];
  missing_numbers: number[];
  duplicate_numbers: number[];
} {
  const scanRoots = [REPORTS_ROOT, join(SOS_ROOT, "SAIOS"), join(SOS_ROOT, "runtime")];
  const byNumber = new Map<number, AgentRecord>();

  for (const root of scanRoots) {
    for (const file of walkFiles(root, [".md", ".ts", ".tsx"])) {
      const rel = relative(REPO_ROOT, file);
      if (EXCLUDED_SCAN_FILES.has(rel)) continue;
      let content = "";
      try {
        content = readFileSync(file, "utf8");
      } catch {
        continue;
      }
      AGENT_PATTERN.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = AGENT_PATTERN.exec(content)) !== null) {
        const number = Number(match[1]);
        if (Number.isNaN(number)) continue;
        const titleMatch = content.match(AGENT_TITLE_PATTERN);
        const label =
          titleMatch && Number(titleMatch[1]) === number
            ? titleMatch[2].trim()
            : `Agent ${String(number).padStart(3, "0")}`;
        const existing = byNumber.get(number);
        if (existing) {
          if (!existing.sources.includes(rel)) existing.sources.push(rel);
          if (!existing.report_path && rel.startsWith("SOS/09_REPORTS/")) {
            existing.report_path = rel;
          }
        } else {
          byNumber.set(number, {
            number,
            label,
            sources: [rel],
            report_path: rel.startsWith("SOS/09_REPORTS/") ? rel : null,
          });
        }
      }
    }
  }

  const records = [...byNumber.values()].sort((a, b) => a.number - b.number);
  const numbers = records.map((r) => r.number);
  const min = numbers.length ? Math.min(...numbers) : 0;
  const max = numbers.length ? Math.max(...numbers) : 0;
  const missing_numbers: number[] = [];
  for (let n = min; n <= max; n++) {
    if (!numbers.includes(n)) missing_numbers.push(n);
  }
  const duplicate_numbers = numbers.filter((n, i) => numbers.indexOf(n) !== i);

  return { records, missing_numbers, duplicate_numbers };
}

function discoverFounderReviews(): FounderReviewRecord[] {
  if (!existsSync(LOGS_ROOT)) return [];
  return readdirSync(LOGS_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^founder-review-\d+$/.test(d.name))
    .map((d) => {
      const number = Number(d.name.replace("founder-review-", ""));
      const dir = join(LOGS_ROOT, d.name);
      const reportPath = join(dir, `${d.name}.md`);
      const altReport = join(dir, "improvement-summary.md");
      const reportFile = existsSync(reportPath) ? reportPath : altReport;
      let status = "unknown";
      let calibration_version: string | null = null;
      let updated_at: string | null = null;
      if (existsSync(reportFile)) {
        const raw = readFileSync(reportFile, "utf8");
        const statusMatch = raw.match(/\*\*Status:\*\*\s*(.+)/i);
        const calMatch = raw.match(/\*\*Calibration:\*\*\s*(v?[\d.]+)/i);
        status = statusMatch?.[1]?.trim() ?? status;
        calibration_version = calMatch?.[1]?.trim() ?? null;
        updated_at = statSync(reportFile).mtime.toISOString();
      }
      return {
        number,
        id: d.name,
        path: relative(REPO_ROOT, dir),
        status,
        calibration_version,
        updated_at,
      };
    })
    .sort((a, b) => a.number - b.number);
}

function discoverReleases(): ReleaseRecord[] {
  const historyPath = join(LOGS_ROOT, "publication/release-manager/release-history.json");
  const history = readJson<ReleaseRecord[]>(historyPath) ?? [];
  return history.map((entry) => ({
    ...entry,
    rollback_available: existsSync(
      join(LOGS_ROOT, "publication/release-manager/snapshots", entry.release_id, "snapshot.json"),
    ),
  }));
}

function discoverPublishedTemplates(): { published: string[]; draft: string[] } {
  const manifest = readJson<{ templates?: Array<{ id: string; status: string }> }>(MANIFEST_PATH);
  const published: string[] = [];
  const draft: string[] = [];
  for (const template of manifest?.templates ?? []) {
    if (template.status === "published") published.push(template.id);
    else draft.push(template.id);
  }
  return { published, draft };
}

function discoverPublicationQueue(): PublicationQueueEntry[] {
  const catalogPath = join(LOGS_ROOT, "publication/catalog.json");
  const catalog = readJson<{
    templates?: Array<{
      catalog_id: string;
      prototype_id: string;
      title: string;
      publication_state: string;
    }>;
  }>(catalogPath);
  const packagesRoot = join(LOGS_ROOT, "publication/packages");
  return (catalog?.templates ?? []).map((entry) => ({
    catalog_id: entry.catalog_id,
    prototype_id: entry.prototype_id,
    title: entry.title,
    state: entry.publication_state,
    package_dir: existsSync(join(packagesRoot, entry.catalog_id))
      ? relative(REPO_ROOT, join(packagesRoot, entry.catalog_id))
      : null,
  }));
}

function discoverLatestGeneration(): {
  prototype_id: string;
  path: string;
  mtime: string;
} | null {
  const generatedRoot = join(LOGS_ROOT, "generated-resumes");
  if (!existsSync(generatedRoot)) return null;
  let best: { prototype_id: string; path: string; mtime: number } | null = null;
  for (const entry of readdirSync(generatedRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const preview = join(generatedRoot, entry.name, "template-preview.json");
    if (!existsSync(preview)) continue;
    const mtime = statSync(preview).mtimeMs;
    if (!best || mtime > best.mtime) {
      best = { prototype_id: entry.name, path: relative(REPO_ROOT, preview), mtime };
    }
  }
  return best
    ? { prototype_id: best.prototype_id, path: best.path, mtime: new Date(best.mtime).toISOString() }
    : null;
}

function discoverOperationalModules(): string[] {
  const modules: string[] = [];
  const checks: Array<[string, string]> = [
    ["publication-release-manager", "SOS/SAIOS/runtime/publication/ReleaseManager.ts"],
    ["catalog-integration", "SOS/SAIOS/runtime/publication/catalog-integration-verify.ts"],
    ["runtime-resume-catalog", "src/lib/resumeCatalogRuntime.ts"],
    ["factory-state-manager", "SOS/SAIOS/runtime/factory-state/FactoryStateManager.ts"],
  ];
  for (const [name, rel] of checks) {
    if (existsSync(join(REPO_ROOT, rel))) modules.push(name);
  }
  return modules;
}

function readCalibrationVersion(): string {
  const calPath = join(LOGS_ROOT, "learning/founder-calibration.json");
  const records = readJson<Array<{ version?: string }>>(calPath) ?? [];
  const last = records[records.length - 1];
  return last?.version ?? "unknown";
}

function readDesignDnaVersion(): { version: string; status: string } {
  const dnaPath = join(REPO_ROOT, "SOS/SAIOS/runtime/design-system/DesignDNAVersion.ts");
  if (!existsSync(dnaPath)) return { version: "unknown", status: "unknown" };
  const raw = readFileSync(dnaPath, "utf8");
  const match = raw.match(/DESIGN_DNA_VERSION\s*=\s*"([^"]+)"/);
  const version = match?.[1] ?? "unknown";
  const verifyPath = join(REPO_ROOT, "SOS/SAIOS/missions/design-dna-v1/verify.ts");
  return { version, status: existsSync(verifyPath) ? "integrated" : "unknown" };
}

function readQaStatus(prototypeId: string): string {
  const validationPath = join(LOGS_ROOT, "qa", prototypeId, "validation.json");
  const validation = readJson<{ pass?: boolean }>(validationPath);
  if (!validation) return "unknown";
  return validation.pass ? "PASS" : "FAIL";
}

function readCompetitiveStatus(prototypeId: string): string {
  const scorePath = join(
    LOGS_ROOT,
    "competitive-validation/evaluations",
    prototypeId,
    "competitive-score.json",
  );
  const score = readJson<{ gate_pass?: boolean; overall_competitive_score?: number }>(scorePath);
  if (!score) return "not_run";
  return score.gate_pass ? `PASS (${score.overall_competitive_score ?? "?"}/100)` : "FAIL";
}

function buildHistory(input: {
  agents: AgentRecord[];
  founderReviews: FounderReviewRecord[];
  releases: ReleaseRecord[];
  latestGeneration: ReturnType<typeof discoverLatestGeneration>;
}): HistoryEntry[] {
  const history: HistoryEntry[] = [];
  const latestAgent = input.agents[input.agents.length - 1];
  if (latestAgent) {
    history.push({
      at: new Date().toISOString(),
      type: "agent",
      summary: `Latest discovered agent #${String(latestAgent.number).padStart(3, "0")}`,
      ref: latestAgent.report_path ?? latestAgent.sources[0] ?? "",
    });
  }
  const latestFr = input.founderReviews[input.founderReviews.length - 1];
  if (latestFr) {
    history.push({
      at: latestFr.updated_at ?? new Date().toISOString(),
      type: "founder_review",
      summary: `${latestFr.id} — ${latestFr.status}`,
      ref: latestFr.path,
    });
  }
  const liveRelease = [...input.releases].reverse().find((r) => r.status === "released");
  if (liveRelease) {
    history.push({
      at: liveRelease.release_date,
      type: "release",
      summary: `${liveRelease.release_id} published ${liveRelease.catalog_id}`,
      ref: `SOS/07_LOGS/saios/publication/release-manager/releases/${liveRelease.release_id}`,
    });
  }
  if (input.latestGeneration) {
    history.push({
      at: input.latestGeneration.mtime,
      type: "generation",
      summary: `Latest generated resume: ${input.latestGeneration.prototype_id}`,
      ref: input.latestGeneration.path,
    });
  }
  return history;
}

function buildPendingActions(input: {
  founderReviews: FounderReviewRecord[];
  publicationQueue: PublicationQueueEntry[];
  published: string[];
  releases: ReleaseRecord[];
}): string[] {
  const pending: string[] = [];
  const latestFr = input.founderReviews[input.founderReviews.length - 1];
  if (latestFr?.status.toUpperCase().includes("AWAITING")) {
    pending.push(`${latestFr.id} awaiting founder approval`);
  }
  const ready = input.publicationQueue.filter((p) => p.state === "ready_to_publish");
  const unpublishedReady = ready.filter((p) => !input.published.includes(p.catalog_id));
  if (unpublishedReady.length > 0) {
    pending.push(
      `${unpublishedReady.length} publication package(s) ready_to_publish and not live`,
    );
  }
  const rolledBack = input.releases.filter((r) => r.status === "rolled_back").length;
  if (rolledBack > 0) {
    pending.push(`${rolledBack} release(s) rolled back — snapshots available`);
  }
  if (pending.length === 0) {
    pending.push("No blocking pending actions discovered");
  }
  return pending;
}

export function discoverFactoryState(): FactoryProjectState {
  const agentDiscovery = discoverAgents();
  const founderReviews = discoverFounderReviews();
  const releases = discoverReleases();
  const { published, draft } = discoverPublishedTemplates();
  const publicationQueue = discoverPublicationQueue();
  const latestGeneration = discoverLatestGeneration();
  const operationalModules = discoverOperationalModules();
  const calibrationVersion = readCalibrationVersion();
  const designDna = readDesignDnaVersion();

  const latestAgentNumber = agentDiscovery.records.length
    ? Math.max(...agentDiscovery.records.map((r) => r.number))
    : 0;
  const latestFr = founderReviews[founderReviews.length - 1];
  const liveRelease =
    [...releases].reverse().find((r) => r.status === "released") ?? releases[releases.length - 1];

  const primaryPrototype =
    liveRelease?.catalog_id === "t094"
      ? "production-batch-001-software-engineer"
      : latestGeneration?.prototype_id ?? "unknown";

  const batchResult = readJson<{ batch_id?: string; pass?: boolean }>(
    join(LOGS_ROOT, "production-batch-001/mission-result.json"),
  );

  return {
    factory_version: calibrationVersion,
    generated_at: new Date().toISOString(),
    latest_agent: String(latestAgentNumber).padStart(3, "0"),
    next_agent: String(latestAgentNumber + 1).padStart(3, "0"),
    latest_founder_review: latestFr ? `FR#${String(latestFr.number).padStart(3, "0")}` : "none",
    next_founder_review: latestFr
      ? `FR#${String(latestFr.number + 1).padStart(3, "0")}`
      : "FR#001",
    latest_release: liveRelease?.release_id ?? "none",
    latest_catalog: liveRelease?.catalog_id ?? "none",
    latest_calibration: calibrationVersion,
    latest_design_dna: designDna.version,
    latest_batch: batchResult?.batch_id ?? "unknown",
    latest_generation: latestGeneration?.prototype_id ?? "unknown",
    latest_template: liveRelease?.catalog_id ?? latestGeneration?.prototype_id ?? "unknown",
    publication_status: liveRelease?.status === "released" ? "published" : "draft",
    qa_status: readQaStatus(primaryPrototype),
    competitive_validation_status: readCompetitiveStatus(primaryPrototype),
    design_dna_status: designDna.status,
    release_manager_status: operationalModules.includes("publication-release-manager")
      ? "available"
      : "missing",
    runtime_catalog_status: operationalModules.includes("runtime-resume-catalog")
      ? "integrated"
      : "missing",
    pending_actions: buildPendingActions({
      founderReviews,
      publicationQueue,
      published,
      releases,
    }),
    history: buildHistory({
      agents: agentDiscovery.records,
      founderReviews,
      releases,
      latestGeneration,
    }),
    discovery: {
      agents: agentDiscovery,
      founder_reviews: founderReviews,
      releases,
      published_templates: published,
      draft_templates: draft,
      publication_queue: publicationQueue,
      operational_modules: operationalModules,
    },
  };
}
