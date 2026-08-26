/**
 * Convert AIOS staged Fabric canvas → StudiosisLab template JSON.
 * Strip AIOS metadata only. No visual changes.
 */

const STRIP_ROOT_KEYS = new Set([
  "aios",
  "saios",
  "generation_id",
  "candidate_id",
  "staging_package_id",
  "publication_allowed",
  "dry_run",
  "live",
  "live_enabled",
]);

const STRIP_OBJECT_KEYS = new Set([
  "aios",
  "saios",
  "generation_id",
  "candidate_id",
  "internal_runtime",
]);

function stripObject(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (STRIP_OBJECT_KEYS.has(k)) continue;
    out[k] = v;
  }
  return out;
}

export type FabricConversionResult = {
  template: {
    version: string;
    width: number;
    height: number;
    objects: unknown[];
  };
  stripped_root_keys: string[];
  object_count: number;
};

/**
 * Convert staging canvas.json into website-ready Fabric document.
 */
export function convertStagedCanvasToTemplateJson(
  raw: unknown,
): FabricConversionResult {
  if (!raw || typeof raw !== "object") {
    throw new Error("Canvas must be a Fabric JSON object");
  }
  const src = raw as Record<string, unknown>;
  if (!Array.isArray(src.objects) || src.objects.length === 0) {
    throw new Error("Canvas.objects must be a non-empty array");
  }
  const version = String(src.version ?? "6.9.1");
  const width = Number(src.width ?? 794);
  const height = Number(src.height ?? 1123);
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    throw new Error("Canvas width/height invalid");
  }

  const stripped_root_keys = Object.keys(src).filter((k) =>
    STRIP_ROOT_KEYS.has(k),
  );
  const objects = src.objects.map((o) => {
    if (o && typeof o === "object" && !Array.isArray(o)) {
      return stripObject(o as Record<string, unknown>);
    }
    return o;
  });

  return {
    template: {
      version,
      width,
      height,
      objects,
    },
    stripped_root_keys,
    object_count: objects.length,
  };
}
