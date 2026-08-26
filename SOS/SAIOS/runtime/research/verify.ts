#!/usr/bin/env tsx
/**
 * Self-test — simulates full research workflow with mocked Cursor execution.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createMockCursorResearchExecutor } from "./ResearchCoordinator.js";
import { RESEARCH_DIRECTOR, runResearchSession } from "./ResearchDirector.js";
import { SESSIONS_ROOT } from "./ResearchMemory.js";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

async function main(): Promise<void> {
  assert(
    RESEARCH_DIRECTOR.director_type === "resume-design-research-director",
    "director type",
  );
  assert(RESEARCH_DIRECTOR.role === "coordination_only", "coordination only");

  const mockCursor = createMockCursorResearchExecutor({ failure_rate: 0, base_ms: 15 });

  const result = await runResearchSession({
    objective:
      "Generate a modern ATS-optimized professional resume for a mid-level software engineer.",
    cursor_executor: mockCursor,
    mcp_firecrawl_available: true,
    persist: true,
  });

  const dir = result.session_dir;

  assert(result.pass, "validation pass");
  assert(result.design_brief.confidence > 0, "brief confidence");
  assert(result.design_brief.industry === "software", "industry detected");
  assert(
    result.design_brief.studiosislab_comparison.uniqueness_score > 0,
    "uniqueness score",
  );
  assert(
    result.design_brief.studiosislab_comparison.pass_uniqueness,
    "uniqueness target met",
  );

  assert(existsSync(join(dir, "research.json")), "research.json");
  assert(existsSync(join(dir, "design-brief.json")), "design-brief.json");
  assert(existsSync(join(dir, "sources.json")), "sources.json");
  assert(existsSync(join(dir, "comparison.json")), "comparison.json");
  assert(existsSync(join(dir, "industry-analysis.json")), "industry-analysis.json");
  assert(existsSync(join(dir, "ats-plan.json")), "ats-plan.json");
  assert(existsSync(join(dir, "layout-plan.json")), "layout-plan.json");
  assert(existsSync(join(dir, "typography-plan.json")), "typography-plan.json");
  assert(existsSync(join(dir, "color-plan.json")), "color-plan.json");
  assert(existsSync(join(dir, "report.md")), "report.md");

  const brief = JSON.parse(
    readFileSync(join(dir, "design-brief.json"), "utf8"),
  ) as { brief_id: string; ats_plan: { compatibility_tier: string } };
  assert(brief.brief_id, "brief id in artifact");
  assert(brief.ats_plan.compatibility_tier === "ats_safe", "ats plan");

  const v = result.validation;
  assert(v.checks.research_complete, "research complete");
  assert(v.checks.industry_complete, "industry complete");
  assert(v.checks.template_comparison_complete, "comparison complete");
  assert(v.checks.firecrawl_complete, "firecrawl complete");
  assert(v.checks.typography_complete, "typography complete");
  assert(v.checks.color_complete, "color complete");
  assert(v.checks.layout_complete, "layout complete");
  assert(v.checks.ats_complete, "ats complete");
  assert(v.checks.design_brief_complete, "brief complete");

  assert(dir.startsWith(SESSIONS_ROOT), "session under research root");

  console.log(
    JSON.stringify(
      {
        pass: true,
        component: "resume-design-research-engine",
        session_id: result.session_id,
        session_dir: result.session_dir,
        industry: result.design_brief.industry,
        confidence: result.design_brief.confidence,
        uniqueness_score: result.design_brief.studiosislab_comparison.uniqueness_score,
        ats_tier: result.design_brief.ats_plan.compatibility_tier,
        layout: result.design_brief.layout_plan.structure,
        font: result.design_brief.typography_plan.font_family,
        checks: v.checks,
        overall: "PASS",
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
