/**
 * Archive Founder Review resume templates out of the production registry.
 * Move only — never delete generation history.
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

const REPO = resolve(import.meta.dirname, "../../../..");
const CANDIDATES = join(
  REPO,
  "SOS/07_LOGS/saios/first-production-cycle/candidates",
);

export function archiveReviewCandidates(archiveLabel: string): {
  archived_to: string;
  archived: string[];
  skipped: string[];
} {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const archived_to = join(
    REPO,
    "SOS/07_LOGS/saios/first-production-cycle/candidates-archive",
    `${archiveLabel}-${stamp}`,
  );
  mkdirSync(archived_to, { recursive: true });
  mkdirSync(CANDIDATES, { recursive: true });

  const archived: string[] = [];
  const skipped: string[] = [];

  for (const name of readdirSync(CANDIDATES)) {
    if (name.startsWith(".")) {
      skipped.push(name);
      continue;
    }
    const src = join(CANDIDATES, name);
    const dest = join(archived_to, name);
    try {
      renameSync(src, dest);
      archived.push(name);
    } catch (e) {
      skipped.push(`${name}:${e instanceof Error ? e.message : String(e)}`);
    }
  }

  writeFileSync(
    join(archived_to, "_archive-manifest.json"),
    `${JSON.stringify(
      {
        schema_version: "review-candidate-archive-1.0.0",
        agent: 250,
        archived_at: new Date().toISOString(),
        archived_count: archived.length,
        archived,
        skipped,
        note: "Moved from production candidates/ for Founder Review workspace reset. Not deleted.",
        live: false,
        publication_allowed: false,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  return { archived_to, archived, skipped };
}

export function candidatesRoot(): string {
  return CANDIDATES;
}
