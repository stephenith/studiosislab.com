/**
 * Strict Git path allowlist for publication apply.
 * Implementation itself must never commit/push during SAFE WRITE builds.
 */
import {
  isPathAllowedForPublicationGit,
  QUARANTINED_TEMPLATE_IDS,
  WEBSITE_GIT_ALLOWLIST_PREFIXES,
} from "./paths.js";

export {
  isPathAllowedForPublicationGit,
  QUARANTINED_TEMPLATE_IDS,
  WEBSITE_GIT_ALLOWLIST_PREFIXES,
};

const FORBIDDEN_PREFIXES = [
  "SOS/",
  ".env",
  "package.json",
  "package-lock.json",
  "node_modules/",
  ".git/",
] as const;

export function filterPublicationGitPaths(paths: string[]): {
  allowed: string[];
  rejected: Array<{ path: string; reason: string }>;
} {
  const allowed: string[] = [];
  const rejected: Array<{ path: string; reason: string }> = [];
  for (const raw of paths) {
    const p = raw.replace(/\\/g, "/").replace(/^\.\//, "");
    if (FORBIDDEN_PREFIXES.some((f) => p === f || p.startsWith(f))) {
      rejected.push({ path: p, reason: `forbidden prefix` });
      continue;
    }
    const quarantineHit = (QUARANTINED_TEMPLATE_IDS as readonly string[]).find(
      (q) =>
        p.includes(`/${q}.`) ||
        p.includes(`/${q}/`) ||
        p.endsWith(`/${q}`) ||
        p.includes(`${q}.json`) ||
        p.includes(`${q}.png`) ||
        p.includes(`${q}.webp`),
    );
    if (quarantineHit) {
      rejected.push({
        path: p,
        reason: `quarantined template ${quarantineHit}`,
      });
      continue;
    }
    if (!isPathAllowedForPublicationGit(p)) {
      rejected.push({ path: p, reason: "not on publication allowlist" });
      continue;
    }
    allowed.push(p);
  }
  return { allowed, rejected };
}

export function buildPlanGitAllowlist(
  catalogueIds: string[],
): string[] {
  const files = new Set<string>([
    "templates.manifest.json",
    "src/data/templateCatalog.generated.ts",
    "src/data/templateSnapshots.generated.ts",
    "src/data/systemTemplates/registry.generated.ts",
    "src/data/templateSeoContent.ts",
  ]);
  for (const id of catalogueIds) {
    const cid = id.toLowerCase();
    if ((QUARANTINED_TEMPLATE_IDS as readonly string[]).includes(cid)) {
      continue;
    }
    files.add(`public/templates/${cid}.json`);
    files.add(`public/templates/${cid}.png`);
    files.add(`public/templates/${cid}.webp`);
    files.add(`src/data/template-json/${cid}.json`);
  }
  return [...files].sort();
}
