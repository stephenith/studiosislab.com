/**
 * Download / export flow structural checks (static evidence only).
 * Does NOT prove downloads work.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { ScenarioResult } from "./types.js";

const DEFAULT_REPO_ROOT = resolve(import.meta.dirname, "../../../..");

export function checkDownloadFlow(input?: { repo_root?: string }): {
  pass: boolean;
  scenarios: ScenarioResult[];
  report: Record<string, unknown>;
} {
  const repoRoot = input?.repo_root ?? DEFAULT_REPO_ROOT;
  const fabric = join(repoRoot, "src/components/editor/useFabricEditor.ts");
  const shell = join(repoRoot, "src/components/editor/EditorShell.tsx");
  const mobile = join(repoRoot, "src/components/editor/mobile/useMobileFabricEditor.ts");
  const fabricSrc = existsSync(fabric) ? readFileSync(fabric, "utf8") : "";
  const shellSrc = existsSync(shell) ? readFileSync(shell, "utf8") : "";
  const mobileSrc = existsSync(mobile) ? readFileSync(mobile, "utf8") : "";

  const hasDesktopExport =
    fabricSrc.includes("download") ||
    fabricSrc.includes("slbExport") ||
    fabricSrc.includes("toDataURL");
  const hasShellDownload = shellSrc.toLowerCase().includes("download");
  const hasMobilePdf = mobileSrc.includes("downloadPdf") || mobileSrc.includes("pdf");

  const scenarios: ScenarioResult[] = [
    {
      id: "download_flow_source",
      label: "Download/export source paths present",
      pass: hasDesktopExport && hasShellDownload,
      severity: "critical",
      execution: "static_evidence_only",
      details: hasDesktopExport
        ? "Editor export/download path present in source (not download execution proof)"
        : "No download/export path found in fabric editor",
    },
    {
      id: "mobile_download_path_source",
      label: "Mobile download path present in source",
      pass: hasMobilePdf,
      severity: "warning",
      execution: "static_evidence_only",
      details: hasMobilePdf
        ? "Mobile PDF download path present in source"
        : "Mobile PDF path missing",
    },
    {
      id: "download_execution",
      label: "Download / export execution",
      pass: true,
      severity: "info",
      execution: "not_run",
      details:
        "NOT_RUN: download/export behaviour not executed; static source evidence is not download proof",
    },
  ];

  return {
    pass: scenarios
      .filter((s) => s.severity === "critical" && s.execution !== "not_run")
      .every((s) => s.pass),
    scenarios,
    report: {
      coverage: "static_evidence_only",
      download_execution: "NOT_RUN",
      desktop_export_source: hasDesktopExport,
      shell_download_cta_source: hasShellDownload,
      mobile_pdf_source: hasMobilePdf,
    },
  };
}
