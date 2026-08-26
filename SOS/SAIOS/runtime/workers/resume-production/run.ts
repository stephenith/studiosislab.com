#!/usr/bin/env tsx
/**
 * Resume Production Worker v1 — generate ONE prototype template.
 * Output: SOS/07_LOGS/saios/generated-resumes/modern-ats-professional-v1/
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadResumeDesignKnowledge } from "../../../domain/studiosislab/resume/ResumeDesignKnowledge.js";
import { loadResumeIntelligenceEngine } from "../../../domain/studiosislab/resume/intelligence/ResumeIntelligenceEngine.js";
import { selectDesignFamily } from "./family-selector.js";
import { buildModernAtsProfessionalTemplate } from "./template-builder.js";
import { runDesignQA } from "./design-qa.js";
import { validateTemplate } from "./validator.js";
import { ENGINES, enforceEngineAccess } from "../../../architecture/runtime-guard.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOS_ROOT = join(__dirname, "../../../..");
const OUTPUT_DIR = join(SOS_ROOT, "07_LOGS/saios/generated-resumes/modern-ats-professional-v1");

const BRIEF = "Modern ATS Professional Resume";

const EDITOR_CONTRACT = {
  source: "Editor System Audit (Agent #053)",
  canvas: { width: 794, height: 1123, fabric_version: "6.9.1", page_size: "A4" },
  page_background: {
    index: 0,
    role: "pageBackground",
    locked: true,
    dimensions: "794×1123",
  },
  serialization_props: [
    "role", "data", "id", "name", "slbAssetId", "slbSource", "isPageBg", "locked", "hidden",
  ],
  forbidden: [
    "blob image src",
    "negative content coordinates",
    "skill bars / star ratings in ATS tier",
    "data URL images for cloud save",
  ],
};

async function main(): Promise<void> {
  enforceEngineAccess(ENGINES.LEGACY_PRODUCTION_V1, { source: "cli" });
  console.log("[resume-production-worker] v1 starting (LEGACY)…");

  const knowledge = loadResumeDesignKnowledge();
  const intelligence = loadResumeIntelligenceEngine();

  console.log("[knowledge] loaded", {
    version: knowledge.version,
    corpus_templates: knowledge.corpus.published_template_count,
    families: intelligence.database.design_families.length,
    generator_rules: intelligence.generator_rules.length,
    validation_checks: knowledge.validation_checklist.length,
  });

  const familySelection = selectDesignFamily(
    BRIEF,
    intelligence.database.design_families,
  );

  console.log("[family] selected", familySelection);

  const tier = "ats_safe" as const;
  const template = buildModernAtsProfessionalTemplate(familySelection.selected_family_id);

  const designQa = runDesignQA({
    template,
    tier,
    family_id: familySelection.selected_family_id,
  });

  if (!designQa.pass) {
    const failed = designQa.checks.filter((c) => !c.pass);
    console.error("[design-qa] FAILED", failed);
    process.exit(1);
  }
  console.log("[design-qa] PASS", designQa.checks.length, "checks");

  const validation = validateTemplate(template);
  if (!validation.pass) {
    const failed = validation.items.filter((i) => !i.pass && i.severity === "required");
    console.error("[validation] FAILED", failed);
    process.exit(1);
  }
  console.log("[validation] PASS", validation.auto_checks_passed, "/", validation.auto_checks_total);

  mkdirSync(OUTPUT_DIR, { recursive: true });

  writeFileSync(
    join(OUTPUT_DIR, "template-preview.json"),
    JSON.stringify(template.json, null, 2),
    "utf8",
  );

  writeFileSync(join(OUTPUT_DIR, "validation.json"), JSON.stringify(validation, null, 2), "utf8");

  const { writePreviewAssetsBesideTemplate } = await import("./preview-assets.js");
  await writePreviewAssetsBesideTemplate(template.json, OUTPUT_DIR);

  const designReport = buildDesignReport({
    brief: BRIEF,
    knowledge,
    intelligence,
    familySelection,
    template,
    designQa,
    validation,
    editorContract: EDITOR_CONTRACT,
  });
  writeFileSync(join(OUTPUT_DIR, "design-report.md"), designReport, "utf8");

  console.log("[output] written to", OUTPUT_DIR);
  console.log(
    JSON.stringify(
      {
        pass: true,
        worker: "resume-production-worker",
        version: "1.0.0",
        prototype_id: template.prototype_id,
        family: familySelection.selected_family_id,
        tier,
        design_qa: designQa.pass,
        validation: validation.pass,
        output_dir: OUTPUT_DIR,
        status: "PROTOTYPE — human approval required before production",
      },
      null,
      2,
    ),
  );
}

function buildDesignReport(ctx: {
  brief: string;
  knowledge: ReturnType<typeof loadResumeDesignKnowledge>;
  intelligence: ReturnType<typeof loadResumeIntelligenceEngine>;
  familySelection: ReturnType<typeof selectDesignFamily>;
  template: ReturnType<typeof buildModernAtsProfessionalTemplate>;
  designQa: ReturnType<typeof runDesignQA>;
  validation: ReturnType<typeof validateTemplate>;
  editorContract: Record<string, unknown>;
}): string {
  const { brief, familySelection, template, designQa, validation } = ctx;
  const objCount = template.json.objects.length;
  const textCount = template.json.objects.filter((o) => o.type === "Textbox").length;

  return `# Design Report — ${template.title}

**Prototype ID:** \`${template.prototype_id}\`  
**Status:** PROTOTYPE ONLY — human approval mandatory before production  
**Generated:** ${new Date().toISOString()}

---

## Brief

${brief}

## Knowledge sources consulted

- Resume Design Knowledge (\`loadResumeDesignKnowledge\`)
- Resume Intelligence Engine (\`loadResumeIntelligenceEngine\`)
- Resume Generation Specification
- Validation Checklist (${ctx.knowledge.validation_checklist.length} checks)
- ATS Standards (${ctx.knowledge.ats_standards.length} standards)
- Generator Rules (${ctx.intelligence.generator_rules.length} rules)
- Template DNA corpus (${ctx.intelligence.database.template_dna.length} templates)
- Editor Technical Map (contract summary)

## Family selection

| Field | Value |
|-------|-------|
| Selected family | **${familySelection.display_name}** (\`${familySelection.selected_family_id}\`) |
| Selection score | ${familySelection.score} |
| Production tier | \`ats_safe\` |
| Reference templates | ${familySelection.reference_template_ids.join(", ")} |

### Rationale

${familySelection.rationale.map((r) => `- ${r}`).join("\n")}

### DNA reference notes

${familySelection.reference_dna_notes.map((n) => `- ${n}`).join("\n")}

## Design concept

**Modern ATS Professional** is a single-column, single-font (Inter) layout with StudiosisLab accent blue (\`#2563eb\`). It combines:

- **corporate-modern** family identity (clean business, balanced whitespace)
- **operations-management** section structure (summary → experience → education → skills)
- **minimal-ats** decoration density (< 0.15, no images, no groups)

### Layout

- Canvas: 794×1123 A4
- Margins: 56px left/right
- Header: accent bar + name + title + inline contact
- Sections: uppercase heading + 1px rule + body text
- Alignment grid: 8px / 10px increments

### Typography

| Element | Size | Weight |
|---------|------|--------|
| Name | 26pt | Bold |
| Title | 13pt | Medium |
| Contact | 10.5pt | Regular |
| Section headings | 11pt | Bold, charSpacing 100 |
| Body | 11pt | Regular |

### Color palette

- Text: \`#111827\`
- Muted: \`#4b5563\` / \`#6b7280\`
- Accent: \`#2563eb\` (StudiosisLab blue)
- Dividers: \`#e5e7eb\`
- Background: \`#ffffff\`

## Object inventory

- Total objects: ${objCount}
- Textboxes: ${textCount}
- Images: 0
- Groups: 0
- Skill bars / star ratings: 0

## Design QA (pre-generation gate)

**Result:** ${designQa.pass ? "PASS" : "FAIL"}

| Check | Category | Pass |
|-------|----------|------|
${designQa.checks.map((c) => `| ${c.id} | ${c.category} | ${c.pass ? "✅" : "❌"} |`).join("\n")}

## Validation

**Result:** ${validation.pass ? "PASS" : "FAIL"} (${validation.auto_checks_passed}/${validation.auto_checks_total})

## Editor compatibility

- Fabric version 6.9.1
- Page background at index 0 with \`role: pageBackground\`
- All content as Textbox / Line / Rect primitives
- No negative coordinates
- No blob or data image URLs
- UUID \`id\` + \`data.id\` on all objects

## Differentiation from corpus

- Distinct from **corporate-sidebar** family: no two-column layout
- Distinct from **t057**: no dark sidebar block; lighter modern header
- Uses StudiosisLab blue accent vs purple-heavy executive templates
- Flat object list (no groups) for maximum ATS parse reliability

## Output artifacts

| File | Description |
|------|-------------|
| \`template-preview.json\` | Fabric JSON prototype |
| \`thumbnail.png\` | 0.25× PNG preview |
| \`validation.json\` | Automated validation report |
| \`design-report.md\` | This document |

## Next steps (human gate)

1. Visual review of \`thumbnail.png\`
2. Load \`template-preview.json\` in editor via \`__slbImportTemplate\` (dev)
3. Assign template ID (e.g. \`t080\`) if approved
4. Register in manifest + registry (manual — worker does NOT auto-publish)
`;
}

main().catch((err) => {
  console.error(JSON.stringify({ pass: false, error: String(err) }, null, 2));
  process.exit(1);
});
