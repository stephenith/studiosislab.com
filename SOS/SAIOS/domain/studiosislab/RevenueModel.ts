import type { RevenueObjective, RevenueStream } from "./types.js";

/**
 * StudiosisLab revenue streams and 60-day objective.
 */
export const REVENUE_STREAMS: readonly RevenueStream[] = [
  {
    id: "traffic",
    name: "Traffic",
    description: "Organic and referral visitors to template catalog and tools",
    priority: "P0",
  },
  {
    id: "seo-pages",
    name: "SEO Pages",
    description: "Category and role-specific landing pages driving organic search",
    priority: "P0",
  },
  {
    id: "resume-templates",
    name: "Resume Templates",
    description: "Premium template downloads and builder conversions",
    priority: "P0",
  },
  {
    id: "display-ads",
    name: "Display Ads",
    description: "Programmatic display advertising on free-tier pages",
    priority: "P1",
  },
  {
    id: "video-ads",
    name: "Video Ads",
    description: "In-stream and rewarded video ads on tool completion flows",
    priority: "P2",
  },
  {
    id: "downloads",
    name: "Downloads",
    description: "Paid PDF/DOCX exports and watermark-free downloads",
    priority: "P0",
  },
] as const;

export const SIXTY_DAY_REVENUE_OBJECTIVE: RevenueObjective = {
  horizon_days: 60,
  target_description:
    "Achieve sustainable monetization through SEO-driven traffic, template downloads, and ad revenue within 60 days of catalog launch",
  primary_streams: ["traffic", "seo-pages", "resume-templates", "display-ads", "downloads"],
  milestones: [
    { day: 7, goal: "Publish first 10 category SEO pages and index sitemap" },
    { day: 14, goal: "Reach 1,000 weekly organic sessions" },
    { day: 21, goal: "Launch 25 ATS resume templates across top 5 categories" },
    { day: 30, goal: "Enable display ads on free download flow" },
    { day: 45, goal: "Reach 5,000 weekly sessions and 500 template downloads" },
    { day: 60, goal: "Hit first $1,000 cumulative revenue from ads and paid downloads" },
  ],
};

export function getRevenueStreamById(id: string): RevenueStream | undefined {
  return REVENUE_STREAMS.find((s) => s.id === id);
}
