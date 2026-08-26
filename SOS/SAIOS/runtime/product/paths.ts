import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 10; i++) {
    const pkg = join(dir, "package.json");
    if (existsSync(pkg)) {
      try {
        const parsed = JSON.parse(readFileSync(pkg, "utf8")) as { name?: string };
        if (parsed.name === "studiosislab") return dir;
      } catch {
        // continue
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error("Could not locate studiosislab repository root.");
}

export type ProductPaths = {
  repoRoot: string;
  reportsDir: string;
};

export function resolveProductPaths(overrideReportsDir?: string): ProductPaths {
  const runtimeRoot = join(__dirname, "..");
  const saiosRoot = join(runtimeRoot, "..");
  const sosRoot = join(saiosRoot, "..");
  const repoRoot = findRepoRoot(sosRoot);
  const logsRoot = join(repoRoot, "SOS", "07_LOGS", "saios", "product");
  return {
    repoRoot,
    reportsDir: overrideReportsDir ?? join(logsRoot, "delivery-reports"),
  };
}

export function deliveryReportPath(reportsDir: string, reportId: string): string {
  const safe = reportId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return join(reportsDir, `${safe}.json`);
}
