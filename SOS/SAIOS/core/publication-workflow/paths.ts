/**
 * Path roots for multi-eligible publication workflow.
 * Overridable for fixture tests — never relies on dashboard state.
 */
import { join, resolve } from "node:path";

const DEFAULT_REPO = resolve(import.meta.dirname, "../../../..");

export type PublicationRoots = {
  repo: string;
  decisionsJsonl: string;
  lifecycleRoot: string;
  stagingPackagesRoot: string;
  candidatesRoot: string;
  reservationsPath: string;
  plansRoot: string;
  manifestPath: string;
  quarantineRoot: string;
  releaseHistoryPath: string;
  releaseManagerRoot: string;
  executionsRoot: string;
  locksRoot: string;
  exportPackagesRoot: string;
  websiteTargetRoot: string;
};

export function defaultPublicationRoots(
  repo: string = DEFAULT_REPO,
): PublicationRoots {
  return {
    repo,
    decisionsJsonl: join(
      repo,
      "SOS/07_LOGS/saios/founder-decisions/decisions.jsonl",
    ),
    lifecycleRoot: join(repo, "SOS/07_LOGS/saios/staging/lifecycle"),
    stagingPackagesRoot: join(repo, "SOS/07_LOGS/saios/staging/packages"),
    candidatesRoot: join(
      repo,
      "SOS/07_LOGS/saios/first-production-cycle/candidates",
    ),
    reservationsPath: join(
      repo,
      "SOS/07_LOGS/saios/export/catalogue-id-reservations.json",
    ),
    plansRoot: join(repo, "SOS/07_LOGS/saios/publication/plans"),
    manifestPath: join(repo, "templates.manifest.json"),
    quarantineRoot: join(repo, "SOS/07_LOGS/saios/website-orphans"),
    releaseHistoryPath: join(
      repo,
      "SOS/07_LOGS/saios/publication/release-manager/release-history.json",
    ),
    releaseManagerRoot: join(
      repo,
      "SOS/07_LOGS/saios/publication/release-manager",
    ),
    executionsRoot: join(repo, "SOS/07_LOGS/saios/publication/executions"),
    locksRoot: join(repo, "SOS/07_LOGS/saios/publication/locks"),
    exportPackagesRoot: join(repo, "SOS/07_LOGS/saios/export/packages"),
    websiteTargetRoot: repo,
  };
}

/** Website paths publication apply may stage in Git. */
export const WEBSITE_GIT_ALLOWLIST_PREFIXES = [
  "templates.manifest.json",
  "public/templates/",
  "src/data/template-json/",
  "src/data/templateCatalog.generated.ts",
  "src/data/templateSnapshots.generated.ts",
  "src/data/systemTemplates/registry.generated.ts",
  "src/data/templateSeoContent.ts",
] as const;

/** Quarantined catalogue IDs that must never be restored by publication. */
export const QUARANTINED_TEMPLATE_IDS = ["t094", "t099"] as const;

export function expectedGeneratedFilesForCatalogue(
  catalogueId: string,
): string[] {
  const id = catalogueId.toLowerCase();
  return [
    `public/templates/${id}.json`,
    `public/templates/${id}.png`,
    `public/templates/${id}.webp`,
    `src/data/template-json/${id}.json`,
    "templates.manifest.json",
    "src/data/templateCatalog.generated.ts",
    "src/data/templateSnapshots.generated.ts",
    "src/data/systemTemplates/registry.generated.ts",
    "src/data/templateSeoContent.ts",
  ];
}

export function isPathAllowedForPublicationGit(relPath: string): boolean {
  const p = relPath.replace(/\\/g, "/").replace(/^\.\//, "");
  return WEBSITE_GIT_ALLOWLIST_PREFIXES.some(
    (prefix) => p === prefix || p.startsWith(prefix),
  );
}
