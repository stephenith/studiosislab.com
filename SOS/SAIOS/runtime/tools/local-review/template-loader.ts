import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { extractTemplateMetadata } from "./template-metadata.js";

export type LoadedTemplate = {
  /** Absolute path to template-preview.json */
  path: string;
  /** Parent folder name (e.g. modern-ats-professional-v1) */
  templateName: string;
  /** Parsed Fabric JSON */
  json: {
    version?: string;
    width?: number;
    height?: number;
    objects: unknown[];
  };
  objectCount: number;
  canvasWidth: number;
  canvasHeight: number;
  candidateName: string | null;
  jobTitle: string | null;
};

const SOS_ROOT = resolve(import.meta.dirname, "../../../..");
export const GENERATED_ROOT = join(SOS_ROOT, "07_LOGS/saios/generated-resumes");
const PREVIEW_FILENAME = "template-preview.json";

function findPreviewFiles(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      findPreviewFiles(full, out);
    } else if (name === PREVIEW_FILENAME) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Locate template-preview.json under SOS/07_LOGS/saios/generated-resumes/.
 * Resolution order: --path > --slug= > --template= / REVIEW_TEMPLATE > REVIEW_SLUG env > most recent mtime.
 */
export function loadGeneratedTemplate(argv: string[] = process.argv.slice(2)): LoadedTemplate {
  const pathArg = argv.find((a) => a.startsWith("--path="));
  if (pathArg) {
    const abs = resolve(pathArg.slice("--path=".length));
    return parsePreviewFile(abs);
  }

  const slugArg =
    argv.find((a) => a.startsWith("--slug="))?.slice("--slug=".length) ||
    process.env.REVIEW_SLUG?.trim();

  const nameArg =
    argv.find((a) => a.startsWith("--template="))?.slice("--template=".length) ||
    process.env.REVIEW_TEMPLATE?.trim();

  const candidates = findPreviewFiles(GENERATED_ROOT);
  if (candidates.length === 0) {
    throw new Error(
      `No ${PREVIEW_FILENAME} found under ${GENERATED_ROOT}. Run the Resume Production Worker first.`,
    );
  }

  let chosen: string;
  if (slugArg) {
    const match = candidates.find((p) => p.includes(slugArg));
    if (!match) {
      throw new Error(
        `No template matching slug "${slugArg}". Found: ${candidates.map((p) => p.split("/generated-resumes/")[1]?.split("/")[0]).join(", ")}`,
      );
    }
    chosen = match;
  } else if (nameArg) {
    const match = candidates.find((p) => p.includes(nameArg));
    if (!match) {
      throw new Error(
        `No template matching "${nameArg}". Found: ${candidates.map((p) => p.split("/generated-resumes/")[1]?.split("/")[0]).join(", ")}`,
      );
    }
    chosen = match;
  } else {
    candidates.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
    chosen = candidates[0]!;
    if (candidates.length > 1) {
      const meta = extractTemplateMetadata(chosen);
      console.warn(
        `[template-loader] Multiple templates found (${candidates.length}). ` +
          `Using most recent: ${chosen.split("/generated-resumes/")[1]?.split("/")[0]} ` +
          `(${meta.candidate_name ?? "unknown"}). ` +
          `Pass --path= or --slug=production-batch-001-software-engineer to load a specific template.`,
      );
    }
  }

  return parsePreviewFile(chosen);
}

function parsePreviewFile(absPath: string): LoadedTemplate {
  const raw = readFileSync(absPath, "utf8");
  const json = JSON.parse(raw) as LoadedTemplate["json"];
  if (!json || !Array.isArray(json.objects)) {
    throw new Error(`Invalid Fabric JSON at ${absPath}: missing objects[]`);
  }
  const parts = absPath.split("/generated-resumes/");
  const templateName =
    parts[1]?.split("/")[0] ?? absPath.split("/").slice(-2, -1)[0] ?? "unknown";

  const bg = json.objects[0] as { width?: number; height?: number } | undefined;
  const canvasWidth = json.width ?? bg?.width ?? 794;
  const canvasHeight = json.height ?? bg?.height ?? 1123;
  const meta = extractTemplateMetadata(absPath);

  return {
    path: absPath,
    templateName,
    json,
    objectCount: json.objects.length,
    canvasWidth: Number(canvasWidth),
    canvasHeight: Number(canvasHeight),
    candidateName: meta.candidate_name,
    jobTitle: meta.job_title,
  };
}
