/**
 * Download / export flow reachability (read-only structural checks).
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { ScenarioResult } from "./types.js";

const REPO_ROOT = resolve(import.meta.dirname, "../../../..");

export function checkDownloadFlow(): {
  pass: boolean;
  scenarios: ScenarioResult[];
  report: Record<string, unknown>;
} {
  const fabric = join(REPO_ROOT, "src/components/editor/useFabricEditor.ts");
  const shell = join(REPO_ROOT, "src/components/editor/EditorShell.tsx");
  const mobile = join(REPO_ROOT, "src/components/editor/mobile/useMobileFabricEditor.ts");
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
      id: "download_flow_reachable",
      label: "Download flow is reachable",
      pass: hasDesktopExport && hasShellDownload,
      severity: "critical",
      details: hasDesktopExport
        ? "Editor export/download path present"
        : "No download/export path found in fabric editor",
    },
    {
      id: "mobile_download_path",
      label: "Mobile download path present",
      pass: hasMobilePdf,
      severity: "warning",
      details: hasMobilePdf ? "Mobile PDF download path present" : "Mobile PDF path missing",
    },
  ];

  return {
    pass: scenarios.filter((s) => s.severity === "critical").every((s) => s.pass),
    scenarios,
    report: {
      desktop_export: hasDesktopExport,
      shell_download_cta: hasShellDownload,
      mobile_pdf: hasMobilePdf,
    },
  };
}
