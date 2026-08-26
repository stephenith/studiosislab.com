/**
 * Category coverage — published, draft, queued, missing per category.
 */
import { loadJobHistory, loadPublicationCatalog, loadUnifiedRuns } from "./DataAggregator.js";
import type { CategoryCoverageRow } from "./types.js";

const CATEGORIES = [
  "Software Engineering",
  "Finance",
  "Marketing",
  "Sales",
  "Healthcare",
  "Education",
  "HR",
  "Operations",
  "Executive",
  "Creative",
  "Student",
  "Customer Support",
  "Project Management",
  "Administrative",
  "Government",
  "Hospitality",
];

const CATEGORY_KEYS: Record<string, string[]> = {
  "Software Engineering": ["software", "engineering", "developer"],
  Finance: ["finance", "accounting"],
  Marketing: ["marketing", "brand"],
  Sales: ["sales", "revenue"],
  Healthcare: ["healthcare", "medical"],
  Education: ["education", "teacher"],
  HR: ["hr", "human resources"],
  Operations: ["operations", "logistics"],
  Executive: ["executive", "director"],
  Creative: ["creative", "design"],
  Student: ["student", "intern"],
  "Customer Support": ["support", "customer"],
  "Project Management": ["project", "pm"],
  Administrative: ["admin", "administrative"],
  Government: ["government", "public"],
  Hospitality: ["hospitality", "hotel"],
};

export function buildCategoryCoverage(): CategoryCoverageRow[] {
  const catalog = loadPublicationCatalog()?.entries ?? [];
  const history = loadJobHistory()?.entries ?? [];
  const runs = loadUnifiedRuns();

  return CATEGORIES.map((category) => {
    const keys = CATEGORY_KEYS[category] ?? [category.toLowerCase()];
    const match = (text: string) => keys.some((k) => text.toLowerCase().includes(k));

    const published = catalog.filter(
      (e) => match(String(e.category ?? "")) && e.state === "published",
    ).length;
    const draft = catalog.filter(
      (e) => match(String(e.category ?? "")) && (e.state === "draft" || e.state === "ready_to_publish"),
    ).length;
    const queued = history.filter((e) => match(String(e.category ?? "")) && e.status === "queued").length;
    const target = 10;
    const have = published + draft + queued;
    const missing = Math.max(0, target - have);

    return {
      category,
      published,
      draft,
      queued,
      missing,
      target_count: target,
    };
  });
}
