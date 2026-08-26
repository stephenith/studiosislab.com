/**
 * Discovers and verifies Resume Factory subsystems.
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { getResumeCatalogSnapshotFromRoot } from "../../../../src/lib/resumeCatalogRuntime.js";
import { verifyRelease } from "../publication/ReleaseManager.js";
import type { SubsystemStatus } from "./types.js";

const REPO_ROOT = resolve(import.meta.dirname, "../../../..");
const SOS_ROOT = join(REPO_ROOT, "SOS");

export const SUBSYSTEM_REGISTRY: Array<{
  id: string;
  label: string;
  verify_command: string | null;
  module_path: string;
  read_only?: boolean;
}> = [
  { id: "research", label: "Research Engine", verify_command: "research:verify", module_path: "SOS/SAIOS/runtime/research" },
  { id: "benchmark", label: "Benchmark Engine", verify_command: "benchmark:verify", module_path: "SOS/SAIOS/runtime/benchmark" },
  { id: "design-brain", label: "Design Brain", verify_command: "design-brain:verify", module_path: "SOS/SAIOS/runtime/design-brain" },
  { id: "design-dna", label: "Design DNA", verify_command: "design-dna:verify", module_path: "SOS/SAIOS/missions/design-dna-v1" },
  { id: "design-system", label: "Design System", verify_command: "design-system:verify", module_path: "SOS/SAIOS/runtime/design-system" },
  { id: "adaptive-composer", label: "Adaptive Composer", verify_command: "composer:verify", module_path: "SOS/SAIOS/runtime/adaptive-composer" },
  { id: "premium-generator", label: "Premium Generator", verify_command: "premium-generator:verify", module_path: "SOS/SAIOS/runtime/workers/resume-production" },
  { id: "qa", label: "QA", verify_command: "resume-qa:verify", module_path: "SOS/SAIOS/runtime/workers/resume-qa" },
  { id: "visual-render", label: "Visual Render", verify_command: "visual-render:verify", module_path: "SOS/SAIOS/runtime/visual-render" },
  { id: "founder-critic", label: "Founder Critic", verify_command: "founder-critic:verify", module_path: "SOS/SAIOS/runtime/founder-critic" },
  { id: "competitive-validation", label: "Competitive Validation", verify_command: "competitive-validation:verify", module_path: "SOS/SAIOS/runtime/competitive-validation" },
  { id: "publication", label: "Publication", verify_command: "publication:verify", module_path: "SOS/SAIOS/runtime/publication" },
  { id: "release-manager", label: "Release Manager", verify_command: "release-manager:verify", module_path: "SOS/SAIOS/runtime/publication/ReleaseManager.ts", read_only: true },
  { id: "runtime-catalog", label: "Runtime Catalog", verify_command: "catalog-integration:verify", module_path: "src/lib/resumeCatalogRuntime.ts", read_only: true },
  { id: "factory-state", label: "Factory State", verify_command: "factory-state:verify", module_path: "SOS/SAIOS/runtime/factory-state", read_only: true },
  { id: "production-dashboard", label: "Production Dashboard", verify_command: "production-dashboard:verify", module_path: "SOS/SAIOS/runtime/production-dashboard", read_only: true },
  { id: "catalog-integrity", label: "Catalog Integrity", verify_command: "catalog-integrity:verify", module_path: "SOS/SAIOS/runtime/catalog-integrity", read_only: true },
  { id: "batch-release", label: "Batch Release", verify_command: "batch-release:verify", module_path: "SOS/SAIOS/runtime/batch-release", read_only: true },
];

function runNpmVerify(command: string): boolean {
  try {
    execSync(`npm run ${command}`, {
      cwd: REPO_ROOT,
      stdio: "pipe",
      timeout: 120_000,
    });
    return true;
  } catch {
    return false;
  }
}

function verifyRuntimeCatalogReadOnly(): { pass: boolean; note: string } {
  const snapshot = getResumeCatalogSnapshotFromRoot(REPO_ROOT);
  const t094 = snapshot.templates.find((t) => t.id === "t094");
  const live = verifyRelease({ catalog_id: "t094", target_root: REPO_ROOT });
  if (!t094 || !live.pass) {
    return { pass: false, note: "t094 missing from runtime catalog or live surfaces" };
  }
  return { pass: true, note: "Live runtime catalog and t094 surfaces verified (read-only)" };
}

function verifyReleaseManagerReadOnly(): { pass: boolean; note: string } {
  const historyPath = join(SOS_ROOT, "07_LOGS/saios/publication/release-manager/release-history.json");
  const managerPath = join(SOS_ROOT, "SAIOS/runtime/publication/ReleaseManager.ts");
  if (!existsSync(managerPath) || !existsSync(historyPath)) {
    return { pass: false, note: "Release Manager module or history missing" };
  }
  const history = JSON.parse(readFileSync(historyPath, "utf8")) as Array<{ status: string }>;
  const released = history.some((r) => r.status === "released");
  const rolledBack = history.filter((r) => r.status === "rolled_back");
  if (!released) return { pass: false, note: "No released entry in history" };
  return {
    pass: true,
    note: `Release Manager available; ${rolledBack.length} rollback snapshot(s) on record (read-only — live t094 blocks re-release verify)`,
  };
}

function verifyOrchestrationArtifact(id: string): { pass: boolean; note: string } {
  const paths: Record<string, string[]> = {
    "factory-state": ["SOS/project-state.json", "SOS/PROJECT_STATUS.md"],
    "production-dashboard": ["SOS/07_LOGS/saios/production-dashboard/dashboard.json"],
    "catalog-integrity": ["SOS/07_LOGS/saios/catalog-integrity/catalog-integrity.json"],
    "batch-release": ["SOS/07_LOGS/saios/batch-release/batch-release-summary.json"],
  };
  const required = paths[id] ?? [];
  const missing = required.filter((p) => !existsSync(join(REPO_ROOT, p)));
  if (missing.length > 0) return { pass: false, note: `Missing: ${missing.join(", ")}` };
  return { pass: true, note: "Operational artifacts present (read-only)" };
}

export function verifyAllSubsystems(): SubsystemStatus[] {
  return SUBSYSTEM_REGISTRY.map((sub) => {
    const moduleExists = existsSync(join(REPO_ROOT, sub.module_path));
    if (!moduleExists) {
      return {
        id: sub.id,
        label: sub.label,
        verify_command: sub.verify_command,
        module_path: sub.module_path,
        status: "fail",
        note: "module path missing",
      };
    }

    if (sub.id === "runtime-catalog") {
      const check = verifyRuntimeCatalogReadOnly();
      return {
        id: sub.id,
        label: sub.label,
        verify_command: sub.verify_command,
        module_path: sub.module_path,
        status: check.pass ? "read_only_pass" : "fail",
        note: check.note,
      };
    }

    if (sub.id === "release-manager") {
      const check = verifyReleaseManagerReadOnly();
      return {
        id: sub.id,
        label: sub.label,
        verify_command: sub.verify_command,
        module_path: sub.module_path,
        status: check.pass ? "read_only_pass" : "fail",
        note: check.note,
      };
    }

    if (sub.read_only) {
      const check = verifyOrchestrationArtifact(sub.id);
      return {
        id: sub.id,
        label: sub.label,
        verify_command: sub.verify_command,
        module_path: sub.module_path,
        status: check.pass ? "read_only_pass" : "fail",
        note: check.note,
      };
    }

    if (!sub.verify_command) {
      return {
        id: sub.id,
        label: sub.label,
        verify_command: null,
        module_path: sub.module_path,
        status: "skipped",
        note: "no verify command",
      };
    }

    const pass = runNpmVerify(sub.verify_command);
    return {
      id: sub.id,
      label: sub.label,
      verify_command: sub.verify_command,
      module_path: sub.module_path,
      status: pass ? "pass" : "fail",
    };
  });
}
