/**
 * Writes catalog integrity audit artifacts.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type {
  CatalogConflict,
  CatalogHistoryEntry,
  CatalogIntegrityResult,
  PublicationSafetyReport,
  ResolutionEntry,
} from "./types.js";

const REPO_ROOT = resolve(import.meta.dirname, "../../../..");
const SOS_ROOT = join(REPO_ROOT, "SOS");
const OUTPUT_DIR = join(SOS_ROOT, "07_LOGS/saios/catalog-integrity");

export function renderResolutionPlan(
  conflicts: CatalogConflict[],
  resolutions: ResolutionEntry[],
  nextId: string,
): string {
  const lines = [
    "# Catalog Conflict Resolution Plan",
    "",
    `**Generated:** ${new Date().toISOString()}`,
    "",
    "> Auto-generated recommendations only. No files were modified.",
    "",
    `**Next available catalog ID:** \`${nextId}\``,
    "",
    "## Conflicts",
    "",
  ];

  if (conflicts.length === 0) {
    lines.push("- No conflicts detected.");
  } else {
    for (const c of conflicts) {
      lines.push(`### ${c.type} — \`${c.value}\` (${c.severity})`);
      lines.push("");
      for (const o of c.occurrences) {
        lines.push(`- **${o.source}** — ${o.ref}${o.prototype_id ? ` (${o.prototype_id})` : ""}`);
      }
      lines.push(`- **Recommended:** ${c.recommended_action}`);
      if (c.suggested_catalog_id) {
        lines.push(`- **Suggested ID:** \`${c.suggested_catalog_id}\``);
      }
      lines.push("");
    }
  }

  lines.push("## Resolution Actions", "");
  if (resolutions.length === 0) {
    lines.push("- No resolution actions required.");
  } else {
    for (const r of resolutions) {
      lines.push(`### ${r.conflict_type} — \`${r.conflict_value}\``);
      lines.push(`- **Keep:** ${r.keep.prototype_id} → \`${r.keep.catalog_id}\` (${r.keep.reason})`);
      if (r.reassign) {
        lines.push(
          `- **Reassign:** ${r.reassign.prototype_id} \`${r.reassign.from_catalog_id}\` → \`${r.reassign.to_catalog_id}\` (${r.reassign.reason})`,
        );
      }
      lines.push(`- **Backward compatible:** ${r.backward_compatible}`);
      lines.push(`- **Requires manual approval:** ${r.requires_manual_approval}`);
      lines.push("");
    }
  }

  return lines.join("\n");
}

export function renderPublicationAudit(
  result: CatalogIntegrityResult,
  pendingQueue: Array<{ catalog_id: string; prototype_id: string; safe: boolean }>,
): string {
  const lines = [
    "# Publication Safety Audit",
    "",
    `**Generated:** ${result.generated_at}`,
    "",
    "## Safety Summary",
    "",
    `| Check | Status |`,
    `|-------|--------|`,
    ...Object.entries(result.safety.checks).map(([k, v]) => `| ${k} | ${v ? "PASS" : "FAIL"} |`),
    "",
    `**Safe to publish (live layer):** ${result.safety.safe_to_publish}`,
    `**Pipeline conflicts:** ${result.safety.pipeline_conflicts}`,
  ];

  lines.push("", "## Pending Publication Queue", "");
  for (const item of pendingQueue) {
    lines.push(
      `- \`${item.catalog_id}\` — ${item.prototype_id} — ${item.safe ? "SAFE" : "BLOCKED (conflict)"}`,
    );
  }

  lines.push("", "## Catalog History Snapshot", "");
  lines.push(`Tracked catalog entries: ${result.history.length}`);
  lines.push(`Live published (factory batch): ${result.history.filter((h) => h.live).length}`);

  return lines.join("\n");
}

export function persistCatalogIntegrityArtifacts(input: {
  result: CatalogIntegrityResult;
  conflicts: CatalogConflict[];
  resolutions: ResolutionEntry[];
  history: CatalogHistoryEntry[];
  safety: PublicationSafetyReport;
  pendingQueue: Array<{ catalog_id: string; prototype_id: string; safe: boolean }>;
}): { output_dir: string; files: string[] } {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const files = {
    integrity: join(OUTPUT_DIR, "catalog-integrity.json"),
    conflicts: join(OUTPUT_DIR, "catalog-conflicts.json"),
    safety: join(OUTPUT_DIR, "publication-safety.json"),
    history: join(OUTPUT_DIR, "catalog-history.json"),
    resolution: join(OUTPUT_DIR, "resolution-plan.md"),
    audit: join(OUTPUT_DIR, "publication-audit.md"),
  };

  writeFileSync(files.integrity, JSON.stringify(input.result, null, 2));
  writeFileSync(
    files.conflicts,
    JSON.stringify(
      { generated_at: input.result.generated_at, conflicts: input.conflicts },
      null,
      2,
    ),
  );
  writeFileSync(files.safety, JSON.stringify(input.safety, null, 2));
  writeFileSync(
    files.history,
    JSON.stringify({ generated_at: input.result.generated_at, entries: input.history }, null, 2),
  );
  writeFileSync(
    files.resolution,
    renderResolutionPlan(input.conflicts, input.resolutions, input.result.next_available_catalog_id),
  );
  writeFileSync(files.audit, renderPublicationAudit(input.result, input.pendingQueue));

  return { output_dir: OUTPUT_DIR, files: Object.values(files) };
}

export { OUTPUT_DIR };
