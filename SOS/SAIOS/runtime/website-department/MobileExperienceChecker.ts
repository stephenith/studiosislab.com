/**
 * Mobile experience structural checks — static evidence only.
 * Does NOT prove responsive/mobile viewport behaviour.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { ScenarioResult } from "./types.js";

const DEFAULT_REPO_ROOT = resolve(import.meta.dirname, "../../../..");

export function checkMobileExperience(input?: { repo_root?: string }): {
  pass: boolean;
  scenarios: ScenarioResult[];
  report: Record<string, unknown>;
} {
  const repoRoot = input?.repo_root ?? DEFAULT_REPO_ROOT;
  const mobileEditor = join(repoRoot, "src/app/editor/mobile/template/[templateId]/page.tsx");
  const mobileHook = join(repoRoot, "src/components/editor/mobile/useMobileFabricEditor.ts");
  const gallery = join(repoRoot, "src/app/resume/ResumeHubClient.tsx");
  const layout = join(repoRoot, "src/app/layout.tsx");
  const gallerySrc = existsSync(gallery) ? readFileSync(gallery, "utf8") : "";

  const scenarios: ScenarioResult[] = [
    {
      id: "mobile_layout_source",
      label: "Root layout source present (not mobile viewport proof)",
      pass: existsSync(layout),
      severity: "critical",
      execution: "static_evidence_only",
      details:
        "STATIC_EVIDENCE_ONLY: layout file present; does not prove page loads at a mobile viewport",
    },
    {
      id: "mobile_no_obvious_fixed_overflow",
      label: "No extreme fixed-width gallery literals (heuristic)",
      pass: !gallerySrc.includes("min-width: 1400") && !gallerySrc.includes("width: 2000"),
      severity: "warning",
      execution: "static_evidence_only",
      details: "Heuristic only — not a responsive layout proof",
    },
    {
      id: "mobile_gallery_source",
      label: "Resume gallery client source present",
      pass: existsSync(gallery) && gallerySrc.length > 0,
      severity: "critical",
      execution: "static_evidence_only",
      details: "ResumeHubClient present (not mobile usability proof)",
    },
    {
      id: "mobile_template_cards_source",
      label: "Gallery template/thumbnail surfaces in source",
      pass:
        gallerySrc.toLowerCase().includes("template") ||
        gallerySrc.toLowerCase().includes("thumb"),
      severity: "critical",
      execution: "static_evidence_only",
      details: "Source mentions template/thumbnail surfaces (not visibility proof)",
    },
    {
      id: "mobile_viewport_behaviour",
      label: "Mobile viewport / responsive behaviour",
      pass: true,
      severity: "info",
      execution: "not_run",
      details:
        "NOT_RUN: no browser/viewport automation; static source evidence is not mobile UX proof",
    },
    {
      id: "mobile_editor_route",
      label: "Mobile editor route sources present",
      pass: existsSync(mobileEditor) && existsSync(mobileHook),
      severity: "info",
      execution: "static_evidence_only",
      details: "Mobile editor page + hook available on disk",
    },
  ];

  return {
    pass: scenarios
      .filter((s) => s.severity === "critical" && s.execution !== "not_run")
      .every((s) => s.pass),
    scenarios,
    report: {
      coverage: "static_evidence_only",
      mobile_viewport_proof: "NOT_RUN",
      mobile_editor: existsSync(mobileEditor),
      gallery_client: existsSync(gallery),
      checks: Object.fromEntries(scenarios.map((s) => [s.id, { pass: s.pass, execution: s.execution }])),
    },
  };
}
