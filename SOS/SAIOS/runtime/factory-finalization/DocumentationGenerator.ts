/**
 * Generates Resume Factory V1 operational documentation.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import type { ProductionReadiness, RuntimeDependencyGraph } from "./types.js";

const REPO_ROOT = resolve(import.meta.dirname, "../../../..");
const SOS_ROOT = join(REPO_ROOT, "SOS");
const REPORT_DIR = join(SOS_ROOT, "09_REPORTS/factory-v1");
const OPS_DIR = join(SOS_ROOT, "07_LOGS/saios/factory-finalization");

export function generateAllDocumentation(input: {
  readiness: ProductionReadiness;
  graph: RuntimeDependencyGraph;
}): { report_dir: string; ops_dir: string; files: string[] } {
  mkdirSync(REPORT_DIR, { recursive: true });
  mkdirSync(OPS_DIR, { recursive: true });

  const { readiness, graph } = input;
  const files: Record<string, string> = {};

  files.architecture = join(REPORT_DIR, "factory-architecture.md");
  files.graph = join(OPS_DIR, "runtime-dependency-graph.json");
  files.readiness = join(OPS_DIR, "production-readiness.json");
  files.operations = join(REPORT_DIR, "operations-manual.md");
  files.maintenance = join(REPORT_DIR, "maintenance-guide.md");
  files.release = join(REPORT_DIR, "release-checklist.md");
  files.founder = join(REPORT_DIR, "founder-operations.md");
  files.developer = join(REPORT_DIR, "developer-onboarding.md");
  files.disaster = join(REPORT_DIR, "disaster-recovery.md");
  files.final = join(REPORT_DIR, "factory-final-report.md");

  writeFileSync(files.architecture, renderArchitecture(graph));
  writeFileSync(files.graph, JSON.stringify(graph, null, 2));
  writeFileSync(files.readiness, JSON.stringify(readiness, null, 2));
  writeFileSync(files.operations, renderOperationsManual(readiness));
  writeFileSync(files.maintenance, renderMaintenanceGuide());
  writeFileSync(files.release, renderReleaseChecklist());
  writeFileSync(files.founder, renderFounderOperations());
  writeFileSync(files.developer, renderDeveloperOnboarding());
  writeFileSync(files.disaster, renderDisasterRecovery());
  writeFileSync(files.final, renderFinalReport(readiness, graph));

  return { report_dir: REPORT_DIR, ops_dir: OPS_DIR, files: Object.values(files) };
}

function renderArchitecture(graph: RuntimeDependencyGraph): string {
  return `# Resume Factory V1 — Architecture Map

**Version:** ${graph.version}  
**Status:** STABLE · FEATURE COMPLETE · PRODUCTION READY  
**Generated:** ${graph.generated_at}

## Pipeline

\`\`\`
Research → Benchmark → Design Brain → Design DNA → Design System
  → Adaptive Composer → Premium Generator → QA → Visual Render
  → Founder Critic → Competitive Validation → Publication
  → Release Manager → Runtime Catalog → StudiosisLab Website
\`\`\`

## Orchestration Layer (Agents #095–#098)

| Module | Role |
|--------|------|
| Factory State Manager | Single source of truth (\`SOS/project-state.json\`) |
| Production Dashboard | Lifecycle visibility |
| Catalog Integrity | Identity safety and conflict resolution |
| Batch Release Manager | Controlled multi-template release coordination |

## Design Principles

1. **No auto-publish** — founder final approval mandatory
2. **Orchestration only** — orchestration agents never mutate AI intelligence
3. **Append-only history** — operational state updates preserve records
4. **Reusable platform** — factory backend supports Resume Builder, Cover Letter, Portfolio, Invoice, PDF Tools

## Subsystems

${graph.nodes.map((n) => `- **${n.label}** (\`${n.id}\`) — depends on: ${n.depends_on.join(", ") || "none"}`).join("\n")}
`;
}

function renderOperationsManual(readiness: ProductionReadiness): string {
  return `# Resume Factory V1 — Operations Manual

**Readiness Score:** ${readiness.readiness_score}/${readiness.readiness_max}  
**Status:** ${readiness.factory_v1_status}

## Daily Operations

1. Run \`npm run production-dashboard:verify\` for lifecycle status
2. Review \`SOS/07_LOGS/saios/production-dashboard/dashboard.md\`
3. Check \`SOS/project-state.json\` pending actions
4. Review founder review queue (FR#004+)

## Publication Workflow

1. Template completes pipeline → publication package created
2. Founder reviews via Founder Critic → approval recorded
3. Catalog Integrity validates unique IDs
4. Batch Release dry run → founder selects templates
5. Release Manager executes single release with \`founder_final_publish_approval: true\`
6. Runtime catalog surfaces update automatically

## Key Paths

| Asset | Path |
|-------|------|
| Factory State | \`SOS/project-state.json\` |
| Publication Packages | \`SOS/07_LOGS/saios/publication/packages/\` |
| Release History | \`SOS/07_LOGS/saios/publication/release-manager/release-history.json\` |
| Production Dashboard | \`SOS/07_LOGS/saios/production-dashboard/\` |
| Live Manifest | \`templates.manifest.json\` |
| Runtime Catalog | \`src/lib/resumeCatalogRuntime.ts\` |

## Verify Commands

\`\`\`bash
npm run factory-final:verify    # Full V1 readiness
npm run factory-state:verify      # Project state
npm run production-dashboard:verify
npm run catalog-integrity:verify
npm run batch-release:verify
npm run release-manager:verify    # Staging only (read-only when live)
\`\`\`
`;
}

function renderMaintenanceGuide(): string {
  return `# Resume Factory V1 — Maintenance Guide

## Frozen Components (Do Not Modify Without Founder Approval)

- Design Brain, Design DNA, Adaptive Composer, Premium Generator
- Publication logic, Release Manager core
- Runtime Catalog integration

## Safe Maintenance

- Run verify commands after any operational change
- Update \`SOS/project-state.json\` operational fields only
- Append to history; never delete historical records
- Regenerate dashboards via orchestration agents (#096–#098)

## Versioning

- Factory version tracked in \`SOS/project-state.json\` → \`factory_version\`
- Design DNA version → \`latest_design_dna\`
- Calibration version → \`latest_calibration\`

## Adding New Templates

1. Production batch mission generates templates
2. QA + Visual Render + Founder Critic pass
3. Publication package built
4. Catalog Integrity assigns unique ID
5. Founder approval → Batch Release dry run → Release Manager
`;
}

function renderReleaseChecklist(): string {
  return `# Resume Factory V1 — Release Checklist

## Pre-Release

- [ ] QA PASS confirmed
- [ ] Founder Critic review complete
- [ ] Founder final publish approval obtained
- [ ] Catalog Integrity PASS (no duplicate IDs)
- [ ] Publication package complete (all 10 required files)
- [ ] Batch Release dry run reviewed
- [ ] Rollback snapshot capability confirmed

## Release Execution

- [ ] \`founder_final_publish_approval: true\` set
- [ ] Release Manager validates package
- [ ] Checksum recorded in release history
- [ ] Live surfaces verified: manifest, registry, SEO, gallery, editor

## Post-Release

- [ ] \`npm run catalog-integration:verify\` (or read-only runtime check)
- [ ] Production dashboard updated
- [ ] Factory state history appended
- [ ] Founder notified
`;
}

function renderFounderOperations(): string {
  return `# Resume Factory V1 — Founder Daily Operations Guide

## Morning Check (5 minutes)

1. Open \`SOS/07_LOGS/saios/production-dashboard/dashboard.md\`
2. Review templates waiting founder approval
3. Check stale flags and issues count
4. Review \`SOS/project-state.json\` pending actions

## Approval Workflow

1. Review template in local preview (\`npm run review:template\`)
2. Record decision in founder review mission
3. For publication: explicitly approve via Release Manager
4. Never auto-publish — batch release is dry-run only until you approve

## Current State

- **Live template:** t094 (Software Engineer)
- **Ready queue:** 14 templates awaiting founder final approval
- **Pending review:** FR#004

## Quick Commands

\`\`\`bash
npm run production-dashboard:verify
npm run catalog-integrity:verify
npm run batch-release:verify
\`\`\`
`;
}

function renderDeveloperOnboarding(): string {
  return `# Resume Factory V1 — Developer Onboarding Guide

## Repository Layout

\`\`\`
SOS/
  SAIOS/runtime/          # Factory engines and orchestration
  07_LOGS/saios/          # Generated artifacts, packages, dashboards
  09_REPORTS/             # Reports and V1 documentation
  project-state.json      # Factory state (single source of truth)
src/
  lib/resumeCatalogRuntime.ts   # Live catalog reader
  data/template-json/           # Published template JSON
templates.manifest.json         # Gallery manifest
\`\`\`

## Getting Started

1. Clone repo, \`npm install\`
2. Run \`npm run factory-final:verify\` to validate environment
3. Read \`SOS/09_REPORTS/factory-v1/factory-architecture.md\`

## Development Rules

- **Never** modify AI engines for operational tasks
- **Never** auto-publish templates
- Use orchestration agents for visibility and coordination
- All changes to published templates go through Release Manager

## Verify Commands by Subsystem

See \`package.json\` scripts ending in \`:verify\`

## Architecture

Factory V1 is **feature complete**. New product work should use the factory as a backend platform, not extend the pipeline unless explicitly approved.
`;
}

function renderDisasterRecovery(): string {
  return `# Resume Factory V1 — Disaster Recovery Guide

## Rollback a Release

1. Locate release in \`SOS/07_LOGS/saios/publication/release-manager/release-history.json\`
2. Use Release Manager \`rollbackRelease({ release_id })\`
3. Snapshot restores previous manifest, registry, SEO, template JSON, thumbnail
4. Verify live surfaces via read-only runtime catalog check

## Factory State Recovery

1. Run \`npm run factory-state:verify\` to rebuild from discovery
2. Compare with \`SOS/07_LOGS/saios/factory-finalization/production-readiness.json\`
3. Operational history is append-only in \`project-state.json\`

## Publication Package Corruption

1. Regenerate from latest \`generated-resumes/\` prototype (do not modify AI)
2. Re-run publication prep for affected catalog ID only
3. Catalog Integrity validates before re-release

## Complete Factory Reset (Last Resort)

1. Restore \`SOS/project-state.json\` from backup
2. Run all verify commands
3. Confirm t094 live release integrity
4. Do NOT delete \`07_LOGS\` history
`;
}

function renderFinalReport(readiness: ProductionReadiness, graph: RuntimeDependencyGraph): string {
  const passCount = readiness.subsystems.filter(
    (s) => s.status === "pass" || s.status === "read_only_pass",
  ).length;

  return `# Resume Factory V1 — Final Production Readiness Report

**Agent:** #099 — Resume Factory V1 Finalization & Operational Freeze  
**Generated:** ${readiness.generated_at}  
**Factory Version:** ${readiness.factory_version}

## Verdict

| Flag | Status |
|------|--------|
| STABLE | ${readiness.factory_v1_status === "STABLE" ? "✅" : "❌"} |
| FEATURE COMPLETE | ${readiness.feature_complete ? "✅" : "❌"} |
| PRODUCTION READY | ${readiness.production_ready ? "✅" : "❌"} |
| FOUNDATION LOCKED | ${readiness.foundation_locked ? "✅" : "❌"} |

**Readiness Score:** ${readiness.readiness_score}/${readiness.readiness_max}

## Subsystem Verification

${readiness.subsystems.map((s) => `- ${s.label}: **${s.status}**${s.note ? ` — ${s.note}` : ""}`).join("\n")}

**Passed:** ${passCount}/${readiness.subsystems.length}

## Readiness Dimensions

${readiness.dimensions.map((d) => `- ${d.label}: ${d.score}/${d.max} (${d.status})`).join("\n")}

## Remaining Risks

${readiness.risks.map((r) => `- ${r}`).join("\n")}

## Recommended Future Work

${readiness.future_work.map((w) => `- ${w}`).join("\n")}

## Platform Reuse

Resume Factory V1 is the official production baseline for:

- Resume Builder
- Cover Letter Generator
- Portfolio Builder
- Invoice Generator
- PDF Tools

Future work should focus on user-facing products rather than expanding the factory pipeline.

---

*This report finalizes Resume Factory V1. The architecture is frozen for production operation. Improvements are permitted without breaking the V1 baseline.*
`;
}

export { REPORT_DIR, OPS_DIR };
