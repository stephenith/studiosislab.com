/**
 * Manifest and registry draft builders — drafts only, never write production files.
 */
import type { ManifestDraft, RegistryDraft, SEODraft, TemplateMetadata } from "./types.js";

export function buildManifestDraft(metadata: TemplateMetadata, seo: SEODraft): ManifestDraft {
  return {
    id: metadata.catalog_id,
    title: metadata.title,
    categoryId: metadata.category_id,
    thumbnailPath: `/templates/${metadata.catalog_id}.webp`,
    jsonPath: `src/data/template-json/${metadata.catalog_id}.json`,
    status: "draft",
    tags: seo.keywords,
  };
}

export function buildRegistryDraft(metadata: TemplateMetadata, seo: SEODraft): RegistryDraft {
  const export_name = `DRAFT_${metadata.catalog_id.toUpperCase()}`;
  const snippet = `// DRAFT — do not import until founder final publish approval
export const ${export_name} = {
  id: "${metadata.catalog_id}",
  name: ${JSON.stringify(metadata.title)},
  tags: ${JSON.stringify(seo.keywords)},
  thumbnail: "/templates/${metadata.catalog_id}.webp",
  status: "draft",
};
`;
  return { export_name, snippet };
}
