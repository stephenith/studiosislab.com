/**
 * Read-only production role-target integrity scan (Phase 6A).
 * Does not mutate candidate status or canvases.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateCanvasRoleTargetIntegrity } from "./RoleTargetIntegrity.js";

const REPO = fileURLToPath(new URL("../../../../", import.meta.url));
const CAND_ROOT = join(
  REPO,
  "SOS/07_LOGS/saios/first-production-cycle/candidates",
);

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
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

  for (const id of dirs) {
    const dir = join(CAND_ROOT, id);
    const canvasPath = join(dir, "canvas.json");
    const manifestPath = join(dir, "candidate-manifest.json");
    if (!existsSync(canvasPath)) {
      counts.SKIPPED_NO_CANVAS += 1;
      continue;
    }
    let targetTitle = "";
    let roleFamily = "";
    let sampleTitle: string | null = null;
    let resumeContent: unknown = null;
    if (existsSync(manifestPath)) {
      try {
        const m = readJson(manifestPath) as {
          production_target?: { title?: string; role_family?: string };
          title?: string;
          role_family?: string;
          role?: string;
        };
        targetTitle = String(
          m.production_target?.title ?? m.title ?? m.role ?? "",
        ).trim();
        roleFamily = String(
          m.production_target?.role_family ?? m.role_family ?? targetTitle,
        ).trim();
      } catch {
        /* ignore */
      }
    }
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
      // Derive from candidate id when manifest lacks target (legacy).
      const m = id.match(/^cand-[^-]+-(.+?)-\d{8}T/);
      if (m?.[1]) {
        roleFamily = m[1].replace(/-/g, "_");
        targetTitle = roleFamily.replace(/_/g, " ");
      }
    }

    const result = evaluateCanvasRoleTargetIntegrity({
      target_title: targetTitle || roleFamily,
      target_role_family: roleFamily || targetTitle,
      canvas: readJson(canvasPath) as { objects?: unknown[] },
      resume_content: resumeContent,
      openai_resume_content: resumeContent,
      sample_title: sampleTitle,
    });
    counts.TOTAL_SCANNED += 1;
    if (result.match === "ROLE_MATCH") counts.MATCH += 1;
    else if (result.match === "ROLE_COMPATIBLE_ALIAS") counts.COMPATIBLE_ALIAS += 1;
    else if (result.match === "ROLE_MISMATCH") {
      counts.MISMATCH += 1;
      mismatches.push({
        candidate_id: id,
        target: targetTitle || roleFamily,
        structured: result.structured_role,
        rendered: result.rendered_role,
        reason: result.reason,
      });
    } else {
      counts.UNEVALUABLE += 1;
      mismatches.push({
        candidate_id: id,
        match: result.match,
        target: targetTitle || roleFamily,
        structured: result.structured_role,
        rendered: result.rendered_role,
        reason: result.reason,
      });
    }
  }

  const hard = mismatches.filter((m) => !m.match || m.match === "ROLE_MISMATCH");
  console.log(
    JSON.stringify(
      {
        schema_version: "scan-production-role-integrity-6a-1.0.0",
        counts,
        hard_mismatch_count: hard.length,
        hard_mismatches: hard,
        unevaluable_or_mismatch: mismatches,
      },
      null,
      2,
    ),
  );
}

main();
