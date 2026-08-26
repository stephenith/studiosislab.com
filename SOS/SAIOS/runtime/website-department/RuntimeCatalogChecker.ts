/**
 * Runtime catalog health for Website Department.
 */
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  getResumeCatalogSnapshotFromRoot,
  loadRuntimeTemplateJsonFromRoot,
  runtimeTemplateJsonExists,
} from "../../../../src/lib/resumeCatalogRuntime.js";
import type { ScenarioResult } from "./types.js";

const REPO_ROOT = resolve(import.meta.dirname, "../../../..");

export function checkRuntimeCatalog(catalogId = "t094"): {
  pass: boolean;
  scenarios: ScenarioResult[];
  evidence: Record<string, unknown>;
} {
  const snapshot = getResumeCatalogSnapshotFromRoot(REPO_ROOT);
  const template = snapshot.templates.find((t) => t.id === catalogId) ?? null;
  const jsonExists = runtimeTemplateJsonExists(catalogId);
  const json = loadRuntimeTemplateJsonFromRoot(REPO_ROOT, catalogId);
  const apiRoute = existsSync(join(REPO_ROOT, "src/app/api/resume-catalog/route.ts"));
  const templateApi = existsSync(
    join(REPO_ROOT, "src/app/api/resume-catalog/template/[templateId]/route.ts"),
  );

  const scenarios: ScenarioResult[] = [
    {
      id: "runtime_catalog_api_surface",
      label: "Runtime catalog API returns t094",
      pass: Boolean(template && template.status === "published" && apiRoute && templateApi),
      severity: "critical",
      details: template
        ? `Found ${catalogId} (${template.title}) in runtime catalog`
        : `${catalogId} missing from runtime catalog`,
      evidence: { catalog_count: snapshot.templates.length, template },
    },
    {
      id: "fabric_json_loadable",
      label: "Fabric JSON is loadable",
      pass: jsonExists && Array.isArray(json?.objects) && (json?.objects.length ?? 0) > 0,
      severity: "critical",
      details: jsonExists
        ? `template-json/${catalogId}.json loadable (${json?.objects?.length ?? 0} objects)`
        : `template-json/${catalogId}.json missing`,
    },
  ];

  return {
    pass: scenarios.every((s) => s.pass),
    scenarios,
    evidence: {
      catalog_id: catalogId,
      published: template?.status === "published",
      thumb: template?.thumb ?? null,
      json_exists: jsonExists,
      object_count: json?.objects?.length ?? 0,
    },
  };
}
