/**
 * Publication reporter — persist root and package artifacts.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type {
  ManifestDraft,
  PublicationRecord,
  RegistryDraft,
  ReleasePackage,
  SEODraft,
  TemplateMetadata,
} from "./types.js";
import type { CategoryMetadata } from "./types.js";
import { PUBLICATION_ROOT } from "./CatalogManager.js";

export function persistPublicationArtifacts(input: {
  package_dir: string;
  publication: PublicationRecord;
  metadata: TemplateMetadata;
  category: CategoryMetadata;
  seo: SEODraft;
  manifest: ManifestDraft;
  registry: RegistryDraft;
  release: ReleasePackage;
  release_notes: string;
  landing_page: string;
  persist?: boolean;
}): string[] {
  const files: string[] = [];
  const write = (dir: string, name: string, content: object | string) => {
    const path = join(dir, name);
    if (input.persist !== false) {
      mkdirSync(dir, { recursive: true });
      writeFileSync(path, typeof content === "string" ? content : JSON.stringify(content, null, 2));
    }
    files.push(path);
  };

  write(input.package_dir, "publication.json", input.publication);
  write(input.package_dir, "manifest-entry.json", input.manifest);
  write(input.package_dir, "registry-entry.ts", input.registry.snippet);
  write(input.package_dir, "seo.json", input.seo);
  write(input.package_dir, "landing-page.md", input.landing_page);
  write(input.package_dir, "release-notes.md", input.release_notes);
  write(input.package_dir, "template-metadata.json", input.metadata);
  write(input.package_dir, "category-metadata.json", input.category);

  write(PUBLICATION_ROOT, "publication.json", input.publication);
  write(PUBLICATION_ROOT, "manifest-entry.json", input.manifest);
  write(PUBLICATION_ROOT, "registry-entry.ts", input.registry.snippet);
  write(PUBLICATION_ROOT, "seo.json", input.seo);
  write(PUBLICATION_ROOT, "landing-page.md", input.landing_page);
  write(PUBLICATION_ROOT, "release-package.json", input.release);
  write(PUBLICATION_ROOT, "publication-report.md", renderReport(input));

  return files;
}

function renderReport(input: {
  publication: PublicationRecord;
  metadata: TemplateMetadata;
  seo: SEODraft;
  release: ReleasePackage;
}): string {
  return [
    "# Publication Report",
    "",
    `**Catalog ID:** ${input.metadata.catalog_id}`,
    `**Prototype:** ${input.metadata.prototype_id}`,
    `**State:** ${input.metadata.publication_state}`,
    `**Validation:** ${input.publication.validation_pass ? "PASS" : "FAIL"}`,
    "",
    "## Status",
    "",
    "**WAITING_FOR_FOUNDER_FINAL_PUBLISH_APPROVAL**",
    "",
    "Nothing has been written to `src/`, manifest, or registry.",
    "",
    "## SEO",
    "",
    `- Title: ${input.seo.meta_title}`,
    `- Slug: ${input.seo.slug}`,
    `- Keywords: ${input.seo.keywords.length}`,
    "",
    "## Manual Steps",
    "",
    ...input.release.manual_steps.map((s) => `- ${s}`),
  ].join("\n");
}

export function resolvePackageDir(catalog_id: string): string {
  return join(PUBLICATION_ROOT, "packages", catalog_id);
}
