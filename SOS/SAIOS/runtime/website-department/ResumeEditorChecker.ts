/**
 * Editor route / template openability checks (static evidence only).
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadRuntimeTemplateJsonFromRoot } from "../../../../src/lib/resumeCatalogRuntime.js";
import type { ScenarioResult } from "./types.js";

const DEFAULT_REPO_ROOT = resolve(import.meta.dirname, "../../../..");

export function checkResumeEditor(input?: {
  repo_root?: string;
  template_id?: string | null;
}): {
  pass: boolean;
  scenarios: ScenarioResult[];
} {
  const repoRoot = input?.repo_root ?? DEFAULT_REPO_ROOT;
  const templateId = input?.template_id;
  const editorPage = join(repoRoot, "src/app/editor/template/[templateId]/page.tsx");
  const editorShell = join(repoRoot, "src/components/editor/EditorShell.tsx");
  const fabricHook = join(repoRoot, "src/components/editor/useFabricEditor.ts");
  const templateClient = join(repoRoot, "src/lib/runtimeTemplateClient.ts");
  const json = templateId
    ? loadRuntimeTemplateJsonFromRoot(repoRoot, templateId)
    : null;
  const pageSrc = existsSync(editorPage) ? readFileSync(editorPage, "utf8") : "";

  const scenarios: ScenarioResult[] = [
    {
      id: "editor_route_open",
      label: "Editor template route source present",
      pass:
        existsSync(editorPage) &&
        existsSync(editorShell) &&
        (pageSrc.includes("templateId") || pageSrc.includes("template")),
      severity: "critical",
      execution: "static_evidence_only",
      details: existsSync(editorPage)
        ? `/editor/template/${templateId ?? "{templateId}"} page present (auth not validated)`
        : "Editor template page missing",
    },
    {
      id: "editor_fabric_ready",
      label: "Fabric editor wiring present",
      pass: existsSync(fabricHook) && existsSync(templateClient),
      severity: "critical",
      execution: "static_evidence_only",
      details: "useFabricEditor + runtimeTemplateClient available",
    },
    {
      id: "editor_json_ready",
      label: "Editor template JSON loadable",
      pass: Boolean(
        templateId && Array.isArray(json?.objects) && (json?.objects.length ?? 0) > 0,
      ),
      severity: "critical",
      execution: "static_evidence_only",
      details: templateId
        ? `objects=${json?.objects?.length ?? 0} for ${templateId}`
        : "No derived template_id available",
    },
  ];

  return { pass: scenarios.every((s) => s.pass), scenarios };
}
