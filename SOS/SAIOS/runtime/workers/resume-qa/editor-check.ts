/**
 * Editor compatibility validation — Fabric contract, IDs, serialization
 */
import type { QAModuleReport, QATemplateContext } from "./types.js";

const SUPPORTED_TYPES = new Set([
  "rect",
  "textbox",
  "line",
  "image",
  "group",
  "path",
  "circle",
]);

const FABRIC_PROPS = new Set([
  "id",
  "role",
  "name",
  "isPageBg",
  "data",
  "selectable",
  "evented",
  "lockMovementX",
  "lockMovementY",
]);

function objType(o: Record<string, unknown>): string {
  return String(o.type ?? "").toLowerCase();
}

export function runEditorCheck(ctx: QATemplateContext): QAModuleReport {
  const { json } = ctx;
  const objects = json.objects;
  const checks = [];

  checks.push({
    id: "fabric-version",
    pass: json.version === "6.9.1",
    detail: `version=${json.version}`,
    severity: "required" as const,
  });

  const w = json.width ?? 794;
  const h = json.height ?? 1123;
  checks.push({
    id: "canvas-dimensions",
    pass: w === 794 && h === 1123,
    detail: `${w}×${h}`,
    severity: "required" as const,
  });

  const bg = objects[0];
  const bgOk =
    objType(bg ?? {}) === "rect" &&
    (bg?.role === "pageBackground" ||
      bg?.isPageBg === true ||
      (bg?.data as Record<string, unknown> | undefined)?.role === "pageBackground") &&
    Number(bg?.width) === 794 &&
    Number(bg?.height) === 1123;
  checks.push({
    id: "page-background-exists",
    pass: bgOk,
    detail: bgOk ? "Page background rect at index 0" : "Missing or invalid page background",
    severity: "required" as const,
  });

  const missingIds = objects.filter((o) => !o.id && !(o.data as Record<string, unknown>)?.id);
  checks.push({
    id: "object-ids",
    pass: missingIds.length === 0,
    detail:
      missingIds.length === 0
        ? `All ${objects.length} objects have IDs`
        : `${missingIds.length} objects missing id`,
    severity: "required" as const,
  });

  const textboxes = objects.filter((o) => objType(o) === "textbox");
  const lockedContent = textboxes.filter(
    (o) => o.selectable === false && o.evented === false && !o.isPageBg,
  );
  checks.push({
    id: "editable-objects",
    pass: lockedContent.length <= 2,
    detail: `${textboxes.length - lockedContent.length}/${textboxes.length} textboxes editable`,
    severity: "required" as const,
  });

  const images = objects.filter((o) => objType(o) === "image");
  const blobSrc = images.some((o) => String((o as { src?: string }).src ?? "").startsWith("blob:"));
  const jsonBlob = JSON.stringify(json).includes('"src":"blob:');
  checks.push({
    id: "no-blob-urls",
    pass: !blobSrc && !jsonBlob,
    detail: blobSrc || jsonBlob ? "blob: URLs found" : "No blob URLs",
    severity: "required" as const,
  });

  const badSources = images.filter((o) => {
    const src = String((o as { src?: string }).src ?? "");
    return src.length > 0 && !src.startsWith("/") && !src.startsWith("http") && !src.startsWith("data:");
  });
  checks.push({
    id: "image-sources",
    pass: badSources.length === 0,
    detail:
      badSources.length === 0
        ? images.length
          ? `${images.length} images with valid src`
          : "No images (ATS-safe)"
        : `${badSources.length} images with invalid src`,
    severity: "required" as const,
  });

  let serializable = true;
  let serializeError = "";
  try {
    const roundTrip = JSON.parse(JSON.stringify(json));
    serializable = Array.isArray(roundTrip.objects);
  } catch (err) {
    serializable = false;
    serializeError = err instanceof Error ? err.message : String(err);
  }
  checks.push({
    id: "serialization-compatibility",
    pass: serializable,
    detail: serializable ? "JSON round-trip OK" : serializeError,
    severity: "required" as const,
  });

  const unsupported = objects.filter((o) => !SUPPORTED_TYPES.has(objType(o)));
  checks.push({
    id: "supported-object-types",
    pass: unsupported.length === 0,
    detail:
      unsupported.length === 0
        ? "All object types supported"
        : `Unsupported: ${unsupported.map((o) => o.type).join(", ")}`,
    severity: "required" as const,
  });

  const pass = checks.every((c) => c.pass);
  return {
    module: "editor",
    pass,
    checked_at: new Date().toISOString(),
    checks,
  };
}
