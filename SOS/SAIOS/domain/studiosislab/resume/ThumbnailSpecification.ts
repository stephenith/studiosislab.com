/**
 * Thumbnail generation specification for StudiosisLab resume templates.
 * Derived from product behavior: resumePreviewExport.ts, EditorShell.tsx
 */
export const THUMBNAIL_SPECIFICATION = {
  version: "1.0.0",
  catalog_card: {
    width_px: 400,
    height_px: 520,
    aspect_ratio: "portrait",
    format: "png",
    path_pattern: "/templates/{template_id}.png",
  },
  generation: {
    source: "First page Fabric JSON only",
    method: "Offscreen Fabric canvas loadFromJSON + toDataURL",
    multiplier: 0.25,
    format: "png",
    background: "#ffffff",
    fallback_image: "/templates/avatar-placeholder.png",
    sanitize: "Replace broken image src with placeholder before render",
  },
  canvas_fallback_dimensions: {
    A4: { width: 794, height: 1123 },
    Letter: { width: 816, height: 1056 },
  },
  quality_rules: [
    "Thumbnail must show full first page with margins visible",
    "No selection handles or editor chrome in export",
    "Text legible at catalog card size (name readable)",
    "Accent colors accurate to template JSON fills",
    "Match generateResumeThumbnail / makeThumbnailFromCanvasEl output",
  ],
  marketplace: {
    social_preview: { width: 1200, height: 630, format: "webp" },
    card_thumbnail: { width: 400, height: 520, format: "webp" },
    alt_text_pattern: "{category} ATS resume template — {title}",
  },
  validation: [
    "PNG/WebP file exists at thumbnailPath",
    "Dimensions within 5% of spec",
    "File size < 200KB for catalog card",
    "Visual QA: no blank/white-only failure",
  ],
} as const;

export type ThumbnailSpecification = typeof THUMBNAIL_SPECIFICATION;
