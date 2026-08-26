/**
 * Release package builder — bundle all publication files for founder final approval.
 */
import type { ManifestDraft, PublicationState, ReleasePackage, TemplateMetadata } from "./types.js";

export function buildReleasePackage(input: {
  catalog_id: string;
  prototype_id: string;
  state: PublicationState;
  package_dir: string;
  manifest: ManifestDraft;
}): ReleasePackage {
  const files: Record<string, string> = {
    "template.json": `${input.package_dir}/template.json`,
    "thumbnail.png": `${input.package_dir}/thumbnail.png`,
    "catalog-preview.png": `${input.package_dir}/catalog-preview.png`,
    "publication.json": `${input.package_dir}/publication.json`,
    "manifest-entry.json": `${input.package_dir}/manifest-entry.json`,
    "registry-entry.ts": `${input.package_dir}/registry-entry.ts`,
    "seo.json": `${input.package_dir}/seo.json`,
    "landing-page.md": `${input.package_dir}/landing-page.md`,
    "release-notes.md": `${input.package_dir}/release-notes.md`,
    "template-metadata.json": `${input.package_dir}/template-metadata.json`,
    "category-metadata.json": `${input.package_dir}/category-metadata.json`,
  };

  return {
    release_id: `release-${input.catalog_id}-${Date.now()}`,
    catalog_id: input.catalog_id,
    prototype_id: input.prototype_id,
    state: input.state,
    files,
    manual_steps: [
      `Copy template.json → src/data/template-json/${input.catalog_id}.json`,
      `Copy thumbnail.png → public templates path as ${input.catalog_id}.webp`,
      "Merge manifest-entry.json into templates.manifest.json (founder only)",
      "Import registry-entry.ts after founder final publish approval",
      "Add seo.json content to templateSeoContent.ts",
      "Run npm run templates:sync",
    ],
    waiting_for: "founder_final_publish_approval",
  };
}

export function buildReleaseNotes(metadata: TemplateMetadata): string {
  return [
    `# Release Notes — ${metadata.title}`,
    "",
    `**Catalog ID:** ${metadata.catalog_id}`,
    `**Version:** ${metadata.version}`,
    `**Prototype:** ${metadata.prototype_id}`,
    `**State:** ${metadata.publication_state}`,
    "",
    "## Highlights",
    "",
    `- Layout family: ${metadata.layout_family}`,
    `- Design family: ${metadata.design_family}`,
    `- ATS tier: ${metadata.ats_tier}`,
    `- Industry: ${metadata.industry}`,
    "",
    "_Draft release notes — founder final publish approval required._",
  ].join("\n");
}
