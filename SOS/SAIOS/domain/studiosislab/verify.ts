#!/usr/bin/env node
/**
 * StudiosisLab Domain Knowledge Pack verification
 * Run: npm run verify (from SOS/SAIOS/domain/studiosislab)
 */
import { loadStudiosisLabKnowledge, KNOWLEDGE_VERSION } from "./ResumeKnowledge.js";
import { RESUME_CATEGORIES } from "./ResumeCategories.js";
import { FEATURE_CATALOG } from "./FeatureCatalog.js";
import { REVENUE_STREAMS, SIXTY_DAY_REVENUE_OBJECTIVE } from "./RevenueModel.js";
import { ROADMAP_GOALS } from "./RoadmapGoals.js";
import { QUALITY_STANDARDS } from "./QualityStandards.js";
import { TEMPLATE_STANDARDS } from "./TemplateStandards.js";
import { SEO_STANDARDS } from "./SEOStandards.js";
import { ASSET_STANDARDS } from "./AssetStandards.js";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

const EXPECTED_CATEGORY_NAMES = [
  "Business",
  "Finance",
  "Marketing",
  "Sales",
  "Healthcare",
  "Engineering",
  "IT",
  "Design",
  "Government",
  "Legal",
  "Hospitality",
  "Education",
  "Student",
  "Executive",
  "Creative",
];

const EXPECTED_FEATURE_NAMES = [
  "Resume Builder",
  "Resume Templates",
  "ATS Checker",
  "Cover Letter",
  "Invoice Generator",
  "Portfolio Builder",
  "PDF Tools",
  "Projects",
  "E-sign",
  "Dashboard",
];

async function main(): Promise<void> {
  const knowledge = loadStudiosisLabKnowledge();

  assert(knowledge.version === KNOWLEDGE_VERSION, "knowledge version mismatch");
  assert(knowledge.domain === "studiosislab", "domain should be studiosislab");
  assert(knowledge.categories.length === 15, `expected 15 categories, got ${knowledge.categories.length}`);

  for (const name of EXPECTED_CATEGORY_NAMES) {
    const cat = knowledge.categories.find((c) => c.name === name);
    assert(Boolean(cat), `missing category: ${name}`);
    assert(cat!.sample_job_roles.length >= 3, `${name} should have sample job roles`);
    assert(cat!.recommended_template_count >= 1, `${name} should have recommended template count`);
    assert(cat!.seo_value >= 1 && cat!.seo_value <= 10, `${name} seo_value out of range`);
    assert(cat!.ats_importance >= 1 && cat!.ats_importance <= 10, `${name} ats_importance out of range`);
  }

  assert(knowledge.features.length === 10, `expected 10 features, got ${knowledge.features.length}`);
  for (const name of EXPECTED_FEATURE_NAMES) {
    assert(knowledge.features.some((f) => f.name === name), `missing feature: ${name}`);
  }

  assert(knowledge.revenue.streams.length === 6, "expected 6 revenue streams");
  assert(
    knowledge.revenue.streams.some((s) => s.name === "Traffic"),
    "missing Traffic revenue stream",
  );
  assert(
    knowledge.revenue.streams.some((s) => s.name === "SEO Pages"),
    "missing SEO Pages revenue stream",
  );
  assert(
    knowledge.revenue.streams.some((s) => s.name === "Display Ads"),
    "missing Display Ads revenue stream",
  );
  assert(
    knowledge.revenue.objective.horizon_days === 60,
    "expected 60-day revenue objective",
  );
  assert(
    knowledge.revenue.objective.milestones.length >= 4,
    "revenue objective should have milestones",
  );

  assert(knowledge.roadmap.length === 8, `expected 8 roadmap weeks, got ${knowledge.roadmap.length}`);
  for (let week = 1; week <= 8; week++) {
    const entry = knowledge.roadmap.find((w) => w.week === week);
    assert(Boolean(entry), `missing roadmap week ${week}`);
    assert(entry!.goals.length >= 2, `week ${week} should have goals`);
    assert(entry!.deliverables.length >= 2, `week ${week} should have deliverables`);
  }

  assert(knowledge.quality.length === 6, "expected 6 quality standards");
  assert(knowledge.quality.some((q) => q.name === "Core Web Vitals"), "missing Core Web Vitals standard");
  assert(TEMPLATE_STANDARDS.length >= 3, "template standards should load");
  assert(SEO_STANDARDS.length >= 3, "SEO standards should load");
  assert(ASSET_STANDARDS.length >= 3, "asset standards should load");

  assert(RESUME_CATEGORIES.length === 15, "RESUME_CATEGORIES export");
  assert(FEATURE_CATALOG.length === 10, "FEATURE_CATALOG export");
  assert(REVENUE_STREAMS.length === 6, "REVENUE_STREAMS export");
  assert(SIXTY_DAY_REVENUE_OBJECTIVE.horizon_days === 60, "SIXTY_DAY_REVENUE_OBJECTIVE export");
  assert(ROADMAP_GOALS.length === 8, "ROADMAP_GOALS export");
  assert(QUALITY_STANDARDS.length === 6, "QUALITY_STANDARDS export");

  console.log(
    JSON.stringify(
      {
        pass: true,
        component: "studiosislab-domain-knowledge",
        version: knowledge.version,
        categories: knowledge.categories.length,
        features: knowledge.features.length,
        revenue_streams: knowledge.revenue.streams.length,
        revenue_horizon_days: knowledge.revenue.objective.horizon_days,
        roadmap_weeks: knowledge.roadmap.length,
        quality_standards: knowledge.quality.length,
        recommended_templates_total: knowledge.categories.reduce(
          (s, c) => s + c.recommended_template_count,
          0,
        ),
        checks: {
          knowledge_loads: true,
          categories: true,
          features: true,
          revenue_model: true,
          roadmap: true,
          quality_standards: true,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(JSON.stringify({ pass: false, error: String(err) }, null, 2));
  process.exit(1);
});
