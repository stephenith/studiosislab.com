/**
 * Runtime catalog health (static evidence only).
 */
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  getResumeCatalogSnapshotFromRoot,
  loadRuntimeTemplateJsonFromRoot,
  runtimeTemplateJsonExists,
} from "../../../../src/lib/resumeCatalogRuntime.js";
import {
  modulePassFromScenarios,
  outcomeFromStaticEvidence,
  scenarioResult,
} from "./WebsiteCheckHelpers.js";
import type { ScenarioResult } from "./types.js";

const DEFAULT_REPO_ROOT = resolve(import.meta.dirname, "../../../..");

export function checkRuntimeCatalog(input?: {
  repo_root?: string;
  template_id?: string | null;
}): {
  pass: boolean;
  scenarios: ScenarioResult[];
  evidence: Record<string, unknown>;
} {
  const repoRoot = input?.repo_root ?? DEFAULT_REPO_ROOT;
  const templateId = input?.template_id;
  const snapshot = getResumeCatalogSnapshotFromRoot(repoRoot);
  const template = templateId
    ? snapshot.templates.find((t) => t.id === templateId) ?? null
    : null;
  const jsonExists = templateId ? runtimeTemplateJsonExists(templateId) : false;
  const json = templateId
    ? loadRuntimeTemplateJsonFromRoot(repoRoot, templateId)
    : null;
  const apiRoute = existsSync(join(repoRoot, "src/app/api/resume-catalog/route.ts"));
  const templateApi = existsSync(
    join(repoRoot, "src/app/api/resume-catalog/template/[templateId]/route.ts"),
  );

  const scenarios: ScenarioResult[] = [
    scenarioResult({
      id: "runtime_catalog_api_surface",
      label: "Runtime catalog API surface + derived template",
      outcome: outcomeFromStaticEvidence(
        Boolean(template && template.status === "published" && apiRoute && templateApi),
      ),
      severity: "critical",
      execution: "static_evidence_only",
      details: template
        ? `Found ${templateId} (${template.title}) in runtime catalog (not live HTTP proof)`
        : `${templateId ?? "no template"} missing from runtime catalog`,
      evidence: { catalog_count: snapshot.templates.length, template },
    }),
    scenarioResult({
      id: "fabric_json_loadable",
      label: "Fabric JSON is loadable",
      outcome: outcomeFromStaticEvidence(
        Boolean(
          templateId &&
            jsonExists &&
            Array.isArray(json?.objects) &&
            (json?.objects.length ?? 0) > 0,
        ),
      ),
      severity: "critical",
      execution: "static_evidence_only",
      details: jsonExists
        ? `template-json/${templateId}.json loadable (${json?.objects?.length ?? 0} objects)`
        : `template-json/${templateId ?? "?"}.json missing`,
    }),
  ];

  return {
    pass: modulePassFromScenarios(scenarios),
    scenarios,
    evidence: {
      template_id: templateId,
      published: template?.status === "published",
      thumb: template?.thumb ?? null,
      json_exists: jsonExists,
      object_count: json?.objects?.length ?? 0,
    },
  };
}
