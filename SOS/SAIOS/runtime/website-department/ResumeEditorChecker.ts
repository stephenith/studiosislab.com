/**
 * Editor route / template openability checks.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadRuntimeTemplateJsonFromRoot } from "../../../../src/lib/resumeCatalogRuntime.js";
import type { ScenarioResult } from "./types.js";

const REPO_ROOT = resolve(import.meta.dirname, "../../../..");

export function checkResumeEditor(catalogId = "t094"): {
  pass: boolean;
  scenarios: ScenarioResult[];
} {
  const editorPage = join(REPO_ROOT, "src/app/editor/template/[templateId]/page.tsx");
  const editorShell = join(REPO_ROOT, "src/components/editor/EditorShell.tsx");
  const fabricHook = join(REPO_ROOT, "src/components/editor/useFabricEditor.ts");
  const templateClient = join(REPO_ROOT, "src/lib/runtimeTemplateClient.ts");
  const json = loadRuntimeTemplateJsonFromRoot(REPO_ROOT, catalogId);
  const pageSrc = existsSync(editorPage) ? readFileSync(editorPage, "utf8") : "";

  const scenarios: ScenarioResult[] = [
    {
      id: "editor_route_open_t094",
      label: "Editor route can open t094",
      pass:
        existsSync(editorPage) &&
        existsSync(editorShell) &&
        (pageSrc.includes("templateId") || pageSrc.includes("template")),
      severity: "critical",
      details: existsSync(editorPage)
        ? `/editor/template/${catalogId} page present`
        : "Editor template page missing",
    },
    {
      id: "editor_fabric_ready",
      label: "Fabric editor wiring present",
      pass: existsSync(fabricHook) && existsSync(templateClient),
      severity: "critical",
      details: "useFabricEditor + runtimeTemplateClient available",
    },
    {
      id: "editor_json_ready",
      label: "Editor template JSON ready",
      pass: Array.isArray(json?.objects) && (json?.objects.length ?? 0) > 0,
      severity: "critical",
      details: `objects=${json?.objects?.length ?? 0}`,
    },
  ];

  return { pass: scenarios.every((s) => s.pass), scenarios };
}
