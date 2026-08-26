/**
 * SEO draft builder — reuses Resume QA SEO proposal.
 */
import { buildSEOProposal } from "../workers/resume-qa/seo-check.js";
import { loadTemplateContext } from "../workers/resume-qa/template-input.js";
import type { CollectedApprovalContext, SEODraft } from "./types.js";

export function buildSEODraft(ctx: CollectedApprovalContext, catalog_id: string): SEODraft {
  const qaCtx = loadTemplateContext(ctx.prototype_dir);
  const seo = buildSEOProposal({ ...qaCtx, proposed_catalog_id: catalog_id });

  const url = `https://studiosislab.com/templates/${seo.slug}`;
  return {
    meta_title: seo.title,
    meta_description: seo.description,
    slug: seo.slug,
    keywords: seo.keywords,
    structured_data: {
      "@context": "https://schema.org",
      "@type": "CreativeWork",
      name: seo.title,
      description: seo.description,
      keywords: seo.keywords.join(", "),
      genre: seo.category,
      identifier: catalog_id,
    },
    open_graph: {
      title: seo.title,
      description: seo.description,
      type: "website",
      url,
      image: `/templates/${catalog_id}.webp`,
    },
    twitter_card: {
      card: "summary_large_image",
      title: seo.title,
      description: seo.description,
      image: `/templates/${catalog_id}.webp`,
    },
    internal_links: [
      "/templates",
      `/templates/category/${seo.category}`,
      `/templates/${seo.slug}`,
    ],
    faq_suggestions: [
      {
        question: `Is the ${seo.title} ATS-friendly?`,
        answer: `Yes — this template uses ${seo.ats_tag} structure with ATS-safe typography.`,
      },
      {
        question: "Who is this template best for?",
        answer: "Professionals seeking a clean, modern resume optimized for applicant tracking systems.",
      },
      {
        question: "Can I customize this template in the editor?",
        answer: "Yes — all text, spacing, and colors are fully editable in StudiosisLab.",
      },
    ],
  };
}

export function buildLandingPageMarkdown(seo: SEODraft, metadata: { title: string; catalog_id: string }): string {
  return [
    `# ${seo.meta_title}`,
    "",
    seo.meta_description,
    "",
    "## Best For",
    "",
    "- ATS job applications",
    "- Corporate and professional roles",
    "- Modern single-column layouts",
    "",
    "## FAQ",
    "",
    ...seo.faq_suggestions.map((f) => `### ${f.question}\n\n${f.answer}`),
    "",
    `**Catalog ID:** ${metadata.catalog_id}`,
    "",
    "_Draft landing page — not published until founder final approval._",
  ].join("\n");
}
