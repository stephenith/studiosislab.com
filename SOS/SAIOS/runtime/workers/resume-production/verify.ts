#!/usr/bin/env tsx
import { RESUME_PRODUCTION_WORKER } from "./index.js";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

async function main(): Promise<void> {
  assert(RESUME_PRODUCTION_WORKER.worker_type === "resume-production-worker", "worker type");
  assert(RESUME_PRODUCTION_WORKER.version === "1.0.0", "version");
  assert(RESUME_PRODUCTION_WORKER.capabilities.length >= 5, "capabilities");
  assert(RESUME_PRODUCTION_WORKER.constraints.some((c) => c.includes("src/")), "src constraint");

  const { selectDesignFamily } = await import("./family-selector.js");
  const { loadResumeIntelligenceEngine } = await import(
    "../../../domain/studiosislab/resume/intelligence/ResumeIntelligenceEngine.js"
  );
  const intel = loadResumeIntelligenceEngine();
  const sel = selectDesignFamily("Modern ATS Professional Resume", intel.database.design_families);
  assert(sel.selected_family_id === "corporate-modern", "family selection for brief");

  const { buildModernAtsProfessionalTemplate } = await import("./template-builder.js");
  const tpl = buildModernAtsProfessionalTemplate(sel.selected_family_id);
  assert(tpl.json.objects.length > 10, "template object count");
  assert(tpl.json.version === "6.9.1", "fabric version");

  const { runDesignQA } = await import("./design-qa.js");
  const qa = runDesignQA({ template: tpl, tier: "ats_safe", family_id: sel.selected_family_id });
  assert(qa.pass, "design QA must pass for built template");

  const { validateTemplate } = await import("./validator.js");
  const val = validateTemplate(tpl);
  assert(val.pass, "validation must pass for built template");

  console.log(JSON.stringify({ pass: true, component: "resume-production-worker", checks: { definition: true, family: true, template: true, design_qa: true, validation: true } }, null, 2));
}

main().catch((e) => {
  console.error(JSON.stringify({ pass: false, error: String(e) }, null, 2));
  process.exit(1);
});
