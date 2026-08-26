import type { RoadmapWeek } from "./types.js";

/**
 * StudiosisLab 8-week product roadmap goals.
 */
export const ROADMAP_GOALS: readonly RoadmapWeek[] = [
  {
    week: 1,
    title: "Foundation & Category SEO",
    goals: [
      "Finalize 15 resume category definitions and job role mappings",
      "Publish SEO landing pages for top 5 priority categories",
      "Establish template quality and ATS standards baseline",
    ],
    deliverables: ["Category pages live", "Sitemap v1", "Quality rubric documented"],
  },
  {
    week: 2,
    title: "Template Batch 1",
    goals: [
      "Ship first 10 ATS resume templates (Marketing, Engineering, Student)",
      "Generate thumbnails and sample profiles per template",
      "Run ATS validation on all batch 1 templates",
    ],
    deliverables: ["10 templates", "10 thumbnails", "ATS validation report"],
  },
  {
    week: 3,
    title: "Template Batch 2 & SEO Expansion",
    goals: [
      "Ship 10 additional templates (Finance, Sales, IT, Healthcare)",
      "Publish 10 new SEO pages for long-tail role keywords",
      "Enable resume builder integration for new templates",
    ],
    deliverables: ["20 total templates", "20 SEO pages", "Builder integration"],
  },
  {
    week: 4,
    title: "Monetization Layer 1",
    goals: [
      "Enable display ads on free download pages",
      "Launch paid watermark-free PDF export",
      "Track download and ad impression analytics",
    ],
    deliverables: ["Ad slots live", "Paid export flow", "Analytics dashboard"],
  },
  {
    week: 5,
    title: "Template Batch 3",
    goals: [
      "Ship 15 templates across Business, Design, Education, Executive",
      "Add ATS Checker public tool page",
      "Optimize Core Web Vitals on catalog pages",
    ],
    deliverables: ["35 total templates", "ATS Checker page", "CWV audit pass"],
  },
  {
    week: 6,
    title: "Cover Letter & PDF Tools",
    goals: [
      "Launch cover letter templates for top 5 categories",
      "Ship PDF merge and compress tools",
      "Cross-link resume and cover letter product pages",
    ],
    deliverables: ["Cover letter MVP", "PDF tools MVP", "Internal link graph"],
  },
  {
    week: 7,
    title: "Template Batch 4 & Video Ads",
    goals: [
      "Complete 50-template catalog across all 15 categories",
      "Enable video ads on tool completion screens",
      "Publish remaining category SEO pages",
    ],
    deliverables: ["50 templates", "Video ad integration", "Full category SEO"],
  },
  {
    week: 8,
    title: "Revenue Optimization",
    goals: [
      "Hit 60-day revenue objective milestones",
      "A/B test ad placement and paid export pricing",
      "Document portfolio builder and e-sign roadmap for Q2",
    ],
    deliverables: ["Revenue report", "A/B test results", "Q2 roadmap brief"],
  },
] as const;

export function getRoadmapWeek(week: number): RoadmapWeek | undefined {
  return ROADMAP_GOALS.find((w) => w.week === week);
}
