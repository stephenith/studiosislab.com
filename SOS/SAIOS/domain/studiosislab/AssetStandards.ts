import type { AssetStandard } from "./types.js";

/**
 * Asset standards for thumbnails, icons, and template media.
 */
export const ASSET_STANDARDS: readonly AssetStandard[] = [
  {
    id: "thumbnail",
    name: "Template Thumbnails",
    formats: ["webp", "png", "jpg"],
    requirements: [
      "1200×630px primary social preview",
      "400×520px catalog card thumbnail",
      "WebP with PNG fallback",
      "Alt text includes category and template name",
    ],
  },
  {
    id: "icons",
    name: "Section Icons",
    formats: ["svg"],
    requirements: [
      "SVG only for UI icons",
      "Monochrome and category-accent variants",
      "24px and 32px grid alignment",
      "Accessible contrast ratio 4.5:1 minimum",
    ],
  },
  {
    id: "preview-pdf",
    name: "Preview PDFs",
    formats: ["pdf"],
    requirements: [
      "First-page preview only for catalog",
      "Watermarked on free tier",
      "Searchable text layer required",
      "No personal data in sample content",
    ],
  },
  {
    id: "sample-profiles",
    name: "Sample Profiles",
    formats: ["json", "md"],
    requirements: [
      "Fictional names and employers only",
      "Role-aligned to category job titles",
      "JSON schema compatible with resume builder",
      "Localized date formats per market",
    ],
  },
] as const;

export function getAssetStandardById(id: string): AssetStandard | undefined {
  return ASSET_STANDARDS.find((s) => s.id === id);
}
