/**
 * Publication package preparation — draft artifacts only, never writes to production.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { QATemplateContext, QAValidationSummary } from "./types.js";
import { buildSEOProposal } from "./seo-check.js";

export type PublicationPackage = {
  status: "WAITING_FOR_FOUNDER_APPROVAL";
  catalog_id: string;
  package_dir: string;
  files: string[];
  pass: boolean;
};

export function preparePublicationPackage(
  ctx: QATemplateContext,
  qaOutputDir: string,
  summary: QAValidationSummary,
): PublicationPackage {
  const catalog_id = ctx.proposed_catalog_id;
  const package_dir = join(qaOutputDir, "publication-package");
  mkdirSync(package_dir, { recursive: true });

  const jsonSrc = join(ctx.source_dir, "template-preview.json");
  const jsonDest = join(package_dir, `${catalog_id}.json`);
  copyFileSync(jsonSrc, jsonDest);

  const files: string[] = [`✓ ${catalog_id}.json`];

  const thumbCandidates = [
    join(qaOutputDir, "thumbnail.png"),
    join(ctx.source_dir, "thumbnail.png"),
  ];
  const thumbSrc = thumbCandidates.find((p) => existsSync(p));
  if (thumbSrc) {
    const thumbDest = join(package_dir, `${catalog_id}.png`);
    copyFileSync(thumbSrc, thumbDest);
    files.push(`✓ ${catalog_id}.png`);
  } else {
    files.push(`✗ ${catalog_id}.png (missing — render thumbnail before publish)`);
  }

  const seo = buildSEOProposal(ctx);
  const seoPage = {
    templateId: catalog_id,
    slug: seo.slug,
    seoTitle: seo.title,
    seoDescription: seo.description,
    h1: seo.title,
    intro: seo.description,
    bestFor: ["ATS job applications", "Corporate roles", "Professional careers"],
    whatToInclude: ["Work experience", "Education", "Skills", "Certifications"],
    atsTips: ["Use standard section headings", "Keep fonts ATS-safe", "Avoid images in ATS mode"],
    writingTips: ["Lead with measurable achievements", "Mirror job description keywords"],
    faq: [],
    relatedTemplateIds: [],
    isPublished: false,
    tags: seo.keywords,
    ats_tag: seo.ats_tag,
    visual_tag: seo.visual_tag,
  };
  writeFileSync(join(package_dir, "seo-page.json"), JSON.stringify(seoPage, null, 2));
  files.push("✓ seo-page.json");

  const manifestEntry = {
    id: catalog_id,
    title: seo.title,
    categoryId: ctx.category_id,
    thumbnailPath: `/templates/${catalog_id}.webp`,
    jsonPath: `src/data/template-json/${catalog_id}.json`,
    status: "draft",
    tags: seo.keywords,
  };
  writeFileSync(
    join(package_dir, "templates.manifest.entry.json"),
    JSON.stringify(manifestEntry, null, 2),
  );
  files.push("✓ templates.manifest.entry.json (draft)");

  const registrySnippet = `// DRAFT — do not import until founder approval
export const DRAFT_${catalog_id.toUpperCase()} = {
  id: "${catalog_id}",
  name: ${JSON.stringify(seo.title)},
  tags: ${JSON.stringify(seo.keywords)},
  thumbnail: "/templates/${catalog_id}.webp",
  status: "draft",
};
`;
  writeFileSync(join(package_dir, "registry.generated.draft.ts"), registrySnippet);
  files.push("✓ registry.generated.draft.ts (draft)");

  const readme = renderPackageReadme(catalog_id, files, summary.pass);
  writeFileSync(join(package_dir, "READY_FOR_PUBLICATION.md"), readme);

  return {
    status: "WAITING_FOR_FOUNDER_APPROVAL",
    catalog_id,
    package_dir,
    files,
    pass: summary.pass,
  };
}

function renderPackageReadme(
  catalog_id: string,
  files: string[],
  qaPass: boolean,
): string {
  return [
    "# Ready For Publication",
    "",
    "This package is a **draft** prepared by the Resume QA & Publishing Pipeline.",
    "",
    "**Nothing in this folder has been written to production.**",
    "",
    "## Files",
    "",
    ...files.map((f) => `- ${f}`),
    "",
    "## Status",
    "",
    `QA: ${qaPass ? "PASS" : "FAIL"}`,
    "",
    "**WAITING_FOR_FOUNDER_APPROVAL**",
    "",
    "## Manual steps after approval",
    "",
    `1. Copy \`${catalog_id}.json\` → \`src/data/template-json/${catalog_id}.json\``,
    `2. Copy \`${catalog_id}.png\` → public templates path`,
    `3. Merge \`templates.manifest.entry.json\` into \`templates.manifest.json\``,
    "4. Run `npm run templates:sync`",
    "5. Add SEO entry from `seo-page.json` to `templateSeoContent.ts`",
    "",
    `Proposed catalog ID: **${catalog_id}**`,
  ].join("\n");
}

export function readPublicationPackageSummary(pkg: PublicationPackage): string {
  const readmePath = join(pkg.package_dir, "READY_FOR_PUBLICATION.md");
  if (existsSync(readmePath)) {
    return readFileSync(readmePath, "utf8");
  }
  return `Status: ${pkg.status}\nFiles:\n${pkg.files.join("\n")}`;
}
