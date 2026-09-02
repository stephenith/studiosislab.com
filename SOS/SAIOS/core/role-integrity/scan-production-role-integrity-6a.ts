/**
 * Read-only production role-target integrity scan (Phase 6A).
 * Does not mutate candidate status or canvases.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  evaluateCanvasRoleTargetIntegrity,
  extractRenderedProfessionalRole,
} from "./RoleTargetIntegrity.js";

const REPO = fileURLToPath(new URL("../../../../", import.meta.url));
const CAND_ROOT = join(
  REPO,
  "SOS/07_LOGS/saios/first-production-cycle/candidates",
);

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

function readTarget(dir: string): { title: string; role_family: string } {
  for (const name of [
    "production-target.json",
    "candidate-manifest.json",
    "manifest.json",
  ]) {
    const p = join(dir, name);
    if (!existsSync(p)) continue;
    try {
      const m = readJson(p) as {
        production_target?: { title?: string; role_family?: string };
        title?: string;
        role_family?: string;
        role?: string;
      };
      const title = String(
        m.production_target?.title ?? m.title ?? m.role ?? "",
      ).trim();
      const role_family = String(
        m.production_target?.role_family ?? m.role_family ?? title,
      ).trim();
      if (title || role_family) return { title: title || role_family, role_family: role_family || title };
    } catch {
      /* ignore */
    }
  }
  return { title: "", role_family: "" };
}

function main() {
  if (!existsSync(CAND_ROOT)) {
    console.error("candidates root missing", CAND_ROOT);
    process.exit(2);
  }
  const dirs = readdirSync(CAND_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name.startsWith("cand-"))
    .map((d) => d.name)
    .sort();

  const counts = {
    TOTAL_SCANNED: 0,
    MATCH: 0,
    COMPATIBLE_ALIAS: 0,
    MISMATCH: 0,
    UNEVALUABLE: 0,
    SKIPPED_NO_CANVAS: 0,
  };
  const mismatches: Array<Record<string, unknown>> = [];
  const unevaluable: Array<Record<string, unknown>> = [];

  for (const id of dirs) {
    const dir = join(CAND_ROOT, id);
    const canvasPath = join(dir, "canvas.json");
    if (!existsSync(canvasPath)) {
      counts.SKIPPED_NO_CANVAS += 1;
      continue;
    }
    let { title: targetTitle, role_family: roleFamily } = readTarget(dir);
    let sampleTitle: string | null = null;
    let resumeContent: unknown = null;
    const resumePath = join(dir, "resume.json");
    if (existsSync(resumePath)) {
      try {
        const rj = readJson(resumePath) as {
          visual_guidance?: {
            resume_content?: { title?: string };
            openai_resume_content?: { title?: string };
          };
        };
        resumeContent =
          rj.visual_guidance?.resume_content ??
          rj.visual_guidance?.openai_resume_content ??
          null;
        if (resumeContent && typeof resumeContent === "object") {
          sampleTitle =
            String((resumeContent as { title?: unknown }).title ?? "").trim() ||
            null;
        }
      } catch {
        /* ignore */
      }
    }
    if (!targetTitle && !roleFamily) {
      const m = id.match(/^cand-[^-]+-(.+?)-\d{8}T/);
      if (m?.[1]) {
        roleFamily = m[1].replace(/-/g, "_");
        targetTitle = roleFamily.replace(/_/g, " ");
      }
    }

    const canvas = readJson(canvasPath) as { objects?: unknown[] };
    // Historical candidates often lack resume.json; use rendered professional
    // title as structured evidence so the canonical checker can evaluate
    // target↔generated identity (still fail-closed when rendered missing).
    const rendered = extractRenderedProfessionalRole(canvas);
    if (!sampleTitle && !resumeContent && rendered) {
      sampleTitle = rendered;
    }

    const result = evaluateCanvasRoleTargetIntegrity({
      target_title: targetTitle || roleFamily,
      target_role_family: roleFamily || targetTitle,
      canvas,
      resume_content: resumeContent,
      openai_resume_content: resumeContent,
      sample_title: sampleTitle,
    });
    counts.TOTAL_SCANNED += 1;
    const row = {
      candidate_id: id,
      target: targetTitle || roleFamily,
      role_family: roleFamily,
      structured: result.structured_role,
      rendered: result.rendered_role,
      match: result.match,
      reason: result.reason,
    };
    if (result.match === "ROLE_MATCH") counts.MATCH += 1;
    else if (result.match === "ROLE_COMPATIBLE_ALIAS") counts.COMPATIBLE_ALIAS += 1;
    else if (result.match === "ROLE_MISMATCH") {
      counts.MISMATCH += 1;
      mismatches.push(row);
    } else {
      counts.UNEVALUABLE += 1;
      unevaluable.push(row);
    }
  }

  console.log(
    JSON.stringify(
      {
        schema_version: "scan-production-role-integrity-6a-1.0.0",
        counts,
        hard_mismatch_count: mismatches.length,
        hard_mismatches: mismatches,
        unevaluable,
      },
      null,
      2,
    ),
  );
}

main();
