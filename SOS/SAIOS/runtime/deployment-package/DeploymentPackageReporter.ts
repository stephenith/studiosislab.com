/**
 * Write reports + deployment manifest.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { PACKAGE_ROOT } from "./paths.js";
import type { DeploymentPackageResult } from "./types.js";

export function writeDeploymentPackageReports(
  result: DeploymentPackageResult,
): void {
  const manifest = {
    generated_at: result.generated_at,
    status: result.status,
    assumptions: {
      os: "Ubuntu 24.04 LTS",
      node: "22 LTS",
      process: "PM2",
      proxy: "Nginx",
      vcs: "Git",
      kubernetes: false,
      cloud_specific: false,
    },
    assets: result.assets,
    health_surfaces: result.health_surfaces,
    environment: {
      required: result.environment.required.map((v) => v.name),
      optional: result.environment.optional.map((v) => v.name),
      missing: result.environment.missing,
      present_non_secret: result.environment.present_non_secret,
      safe_defaults: result.environment.safe_defaults,
      rules: result.environment.rules,
      note: "Secret values never included",
    },
    deploy: false,
    note: "Package preparation only — no deployment performed",
  };

  writeFileSync(
    join(PACKAGE_ROOT, "deployment-manifest.json"),
    JSON.stringify(manifest, null, 2),
  );

  const report = [
    `# Deployment Package Report`,
    ``,
    `AI OS Deployment Package V1 — Agent #112.`,
    `Prepares deployable assets. Does **not** deploy.`,
    ``,
    `## Status: ${result.status}`,
    ``,
    `Generated: ${result.generated_at}`,
    ``,
    `## Assumptions`,
    ``,
    `- Ubuntu 24.04 LTS`,
    `- Node 22 LTS`,
    `- PM2 · Nginx · Git`,
    `- No Kubernetes · No cloud-specific logic`,
    ``,
    `## Assets`,
    ``,
    ...result.assets.map((a) => `- \`${a.name}\` (${a.kind})`),
    ``,
    `## Environment`,
    ``,
    `- Required: ${result.environment.required.map((v) => v.name).join(", ")}`,
    `- Optional: ${result.environment.optional.map((v) => v.name).join(", ")}`,
    `- Missing required: ${result.environment.missing.join(", ") || "none"}`,
    `- Present (non-secret): ${result.environment.present_non_secret.join(", ") || "none"}`,
    ``,
    `## Health surfaces`,
    ``,
    ...result.health_surfaces.map(
      (h) => `- **${h.label}** ← \`${h.source}\` · ${h.expected}`,
    ),
    ``,
    `## Checks`,
    ``,
    ...Object.entries(result.checks).map(
      ([k, v]) => `- ${k}: ${v ? "PASS" : "FAIL"}`,
    ),
    ``,
  ].join("\n");

  writeFileSync(join(PACKAGE_ROOT, "deployment-package-report.md"), report);
}
