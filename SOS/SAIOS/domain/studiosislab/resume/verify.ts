#!/usr/bin/env node
/**
 * StudiosisLab Resume Design Knowledge Pack verification
 * Run: npm run verify (from SOS/SAIOS/domain/studiosislab/resume)
 */
import { loadResumeDesignKnowledge, RESUME_GENERATION_SPECIFICATION } from "./ResumeDesignKnowledge.js";
import { VALIDATION_CHECKLIST, getAutoCheckableChecks, getRequiredChecks } from "./ValidationChecklist.js";
import { SECTION_LIBRARY } from "./SectionLibrary.js";
import { DESIGN_STANDARDS } from "./DesignStandards.js";
import { ATS_STANDARDS } from "./ATSStandards.js";
import { LAYOUT_RULES } from "./LayoutRules.js";
import { THUMBNAIL_SPECIFICATION } from "./ThumbnailSpecification.js";
import { SAMPLE_PROFILE_STANDARDS } from "./SampleProfileStandards.js";
import { GAP_ANALYSIS } from "./ExternalBestPractices.js";
import {
  loadResumeIntelligenceEngine,
  getTemplateDNA,
  getRequiredGeneratorRules,
  DESIGN_FAMILIES,
} from "./intelligence/ResumeIntelligenceEngine.js";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

async function main(): Promise<void> {
  const knowledge = loadResumeDesignKnowledge();

  assert(knowledge.version === "1.0.0", "knowledge version");
  assert(knowledge.domain === "studiosislab-resume", "knowledge domain");
  assert(knowledge.corpus.published_template_count >= 70, "corpus should analyze 70+ templates");
  assert(knowledge.corpus.improvement_gaps.length >= 5, "corpus improvement gaps documented");

  assert(DESIGN_STANDARDS.length >= 5, "design standards");
  assert(ATS_STANDARDS.length >= 4, "ATS standards");
  assert(LAYOUT_RULES.length >= 6, "layout rules");
  assert(knowledge.typography_scale.length >= 6, "typography scale");
  assert(SECTION_LIBRARY.length >= 8, "section library");

  const requiredSections = ["contact", "summary", "experience", "education", "skills"];
  for (const id of requiredSections) {
    const sec = SECTION_LIBRARY.find((s) => s.id === id);
    assert(Boolean(sec?.required), `required section: ${id}`);
  }

  assert(RESUME_GENERATION_SPECIFICATION.mandatory_for === "resume-worker", "generation spec target");
  assert(RESUME_GENERATION_SPECIFICATION.canvas.width === 794, "A4 width in spec");
  assert(RESUME_GENERATION_SPECIFICATION.forbidden.length >= 3, "forbidden rules");

  assert(VALIDATION_CHECKLIST.length >= 15, "validation checklist size");
  assert(getRequiredChecks().length >= 10, "required validation checks");
  assert(getAutoCheckableChecks().length >= 10, "auto-checkable validation");

  assert(THUMBNAIL_SPECIFICATION.generation.multiplier === 0.25, "thumbnail multiplier");
  assert(THUMBNAIL_SPECIFICATION.catalog_card.width_px === 400, "catalog card width");

  assert(SAMPLE_PROFILE_STANDARDS.naming.approved_names.length >= 5, "sample names");
  assert(SAMPLE_PROFILE_STANDARDS.experience.quantification.includes("50%"), "quantified bullets rule");

  assert(GAP_ANALYSIS.length >= 5, "gap analysis entries");
  assert(knowledge.external_principles.markets !== undefined, "external market principles");

  const external = knowledge.external_principles as { markets?: { US?: unknown; UK?: unknown } };
  assert(Boolean(external.markets?.US), "US market principles");
  assert(Boolean(external.markets?.UK), "UK market principles");

  const intelligence = loadResumeIntelligenceEngine();
  assert(intelligence.version === "1.0.0", "intelligence version");
  assert(intelligence.database.published_template_count === 79, "79 templates in DNA");
  assert(intelligence.database.template_dna.length === 79, "template DNA entries");
  assert(DESIGN_FAMILIES.length >= 14, "design families");
  assert(intelligence.generator_rules.length >= 40, "generator rules");
  assert(getRequiredGeneratorRules().length >= 15, "required generator rules");
  const dna = getTemplateDNA();
  assert(dna.every((t) => t.id && t.family && typeof t.ats_score === "number"), "DNA entry shape");
  assert(knowledge.intelligence !== undefined, "intelligence wired into knowledge pack");

  console.log(
    JSON.stringify(
      {
        pass: true,
        component: "studiosislab-resume-design-knowledge",
        version: knowledge.version,
        corpus_templates_analyzed: knowledge.corpus.published_template_count,
        design_families: intelligence.database.design_families.length,
        template_dna_entries: intelligence.database.template_dna.length,
        generator_rules: intelligence.generator_rules.length,
        design_standards: knowledge.design_standards.length,
        ats_standards: knowledge.ats_standards.length,
        layout_rules: knowledge.layout_rules.length,
        sections: knowledge.sections.length,
        validation_checks: knowledge.validation_checklist.length,
        auto_checkable: getAutoCheckableChecks().length,
        gap_analysis_items: knowledge.gap_analysis.length,
        checks: {
          knowledge_loads: true,
          corpus_analysis: true,
          design_standards: true,
          ats_standards: true,
          layout_rules: true,
          typography: true,
          section_library: true,
          generation_spec: true,
          validation_checklist: true,
          thumbnail_spec: true,
          sample_profiles: true,
          external_practices: true,
          resume_intelligence_engine: true,
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
