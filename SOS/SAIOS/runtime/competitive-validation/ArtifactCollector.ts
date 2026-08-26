/**
 * Competitive validation artifact collector.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { loadGeneratedTemplate } from "../tools/local-review/template-loader.js";
import { extractTemplateMetadata } from "../tools/local-review/template-metadata.js";
import { loadTemplateArtifacts } from "../founder-critic/ArtifactCollector.js";

const SOS_ROOT = resolve(import.meta.dirname, "../../..");
const QA_ROOT = join(SOS_ROOT, "07_LOGS/saios/qa");

export type CompetitiveLoadedContext = {
  loaded: ReturnType<typeof loadGeneratedTemplate>;
  metadata: ReturnType<typeof extractTemplateMetadata>;
  prototype_dir: string;
  prototype_id: string;
  qa_validation: Record<string, unknown>;
  critic_ctx: ReturnType<typeof loadTemplateArtifacts>;
  design_bundle: Record<string, unknown> | null;
  premium_score: Record<string, unknown> | null;
};

export function resolvePrototypeDir(input: {
  template_path?: string;
  prototype_dir?: string;
}): string {
  if (input.prototype_dir) return input.prototype_dir;
  if (input.template_path) return dirname(input.template_path);
  const loaded = loadGeneratedTemplate();
  return dirname(loaded.path);
}

export function loadCompetitiveContext(input: {
  template_path?: string;
  prototype_dir?: string;
}): CompetitiveLoadedContext {
  const prototype_dir = resolvePrototypeDir(input);
  const loaded = input.template_path
    ? loadGeneratedTemplate([`--path=${input.template_path}`])
    : loadGeneratedTemplate([`--path=${join(prototype_dir, "template-preview.json")}`]);
  const metadata = extractTemplateMetadata(loaded.path);
  const prototype_id = prototype_dir.split("/").pop() ?? loaded.templateName;
  const critic_ctx = loadTemplateArtifacts(prototype_dir);

  const qaPath = join(QA_ROOT, prototype_id, "validation.json");
  if (!existsSync(qaPath)) {
    throw new Error(`Competitive validation requires QA validation: ${qaPath}`);
  }

  const parseJson = (path: string): Record<string, unknown> | null => {
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  };

  return {
    loaded,
    metadata,
    prototype_dir,
    prototype_id,
    qa_validation: JSON.parse(readFileSync(qaPath, "utf8")) as Record<string, unknown>,
    critic_ctx,
    design_bundle: parseJson(join(prototype_dir, "design-bundle.json")),
    premium_score: parseJson(join(prototype_dir, "premium-score.json")),
  };
}
