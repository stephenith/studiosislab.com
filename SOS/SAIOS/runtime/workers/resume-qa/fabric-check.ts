/**
 * Fabric JSON structure validation
 */
import type { QAModuleReport, QATemplateContext } from "./types.js";

const ALLOWED_CUSTOM_PROPS = new Set([
  "id",
  "role",
  "name",
  "isPageBg",
  "data",
  "selectable",
  "evented",
  "hasControls",
  "hasBorders",
  "lockMovementX",
  "lockMovementY",
  "lockRotation",
  "lockScalingX",
  "lockScalingY",
]);

function objType(o: Record<string, unknown>): string {
  return String(o.type ?? "").toLowerCase();
}

function hasInvalidTransform(o: Record<string, unknown>): boolean {
  const scaleX = Number(o.scaleX ?? 1);
  const scaleY = Number(o.scaleY ?? 1);
  const angle = Number(o.angle ?? 0);
  if (!Number.isFinite(scaleX) || !Number.isFinite(scaleY)) return true;
  if (scaleX <= 0 || scaleY <= 0) return true;
  if (Math.abs(angle) > 360) return true;
  return false;
}

export function runFabricCheck(ctx: QATemplateContext): QAModuleReport {
  const { json } = ctx;
  const objects = json.objects;
  const checks = [];

  const structureOk =
    typeof json.version === "string" &&
    Array.isArray(objects) &&
    objects.length > 0 &&
    typeof json.width === "number" &&
    typeof json.height === "number";
  checks.push({
    id: "json-structure",
    pass: structureOk,
    detail: structureOk
      ? `version=${json.version}, ${objects.length} objects`
      : "Invalid root JSON structure",
    severity: "required" as const,
  });

  const supported = new Set(["rect", "textbox", "line", "image", "group"]);
  const badTypes = objects.filter((o) => !supported.has(objType(o)));
  checks.push({
    id: "supported-object-types",
    pass: badTypes.length === 0,
    detail:
      badTypes.length === 0
        ? "rect, textbox, line only"
        : `Unexpected types: ${badTypes.map((o) => o.type).join(", ")}`,
    severity: "required" as const,
  });

  const unknownProps: string[] = [];
  for (const o of objects) {
    for (const key of Object.keys(o)) {
      if (
        !key.startsWith("version") &&
        !ALLOWED_CUSTOM_PROPS.has(key) &&
        !isStandardFabricProp(key)
      ) {
        unknownProps.push(`${objType(o)}.${key}`);
      }
    }
  }
  checks.push({
    id: "custom-properties",
    pass: unknownProps.length < 50,
    detail: `${unknownProps.length} non-standard property keys (Fabric serialization props allowed)`,
    severity: "recommended" as const,
  });

  const badTransforms = objects.filter(hasInvalidTransform);
  checks.push({
    id: "no-invalid-transforms",
    pass: badTransforms.length === 0,
    detail:
      badTransforms.length === 0
        ? "All transforms valid"
        : `${badTransforms.length} objects with invalid scale/angle`,
    severity: "required" as const,
  });

  const groups = objects.filter((o) => objType(o) === "group");
  const corruptedGroups = groups.filter((o) => {
    const nested = (o as { objects?: unknown[] }).objects;
    return nested !== undefined && !Array.isArray(nested);
  });
  checks.push({
    id: "no-corrupted-groups",
    pass: corruptedGroups.length === 0,
    detail:
      groups.length === 0
        ? "No groups (ATS-safe flat structure)"
        : `${groups.length} groups, ${corruptedGroups.length} corrupted`,
    severity: "required" as const,
  });

  const nanCoords = objects.filter(
    (o) =>
      !Number.isFinite(Number(o.left)) ||
      !Number.isFinite(Number(o.top)) ||
      !Number.isFinite(Number(o.width ?? 0)),
  );
  checks.push({
    id: "no-nan-coordinates",
    pass: nanCoords.length === 0,
    detail: nanCoords.length ? `${nanCoords.length} objects with NaN coords` : "Coordinates finite",
    severity: "required" as const,
  });

  const pass = checks.filter((c) => c.severity === "required").every((c) => c.pass);
  return {
    module: "fabric",
    pass,
    checked_at: new Date().toISOString(),
    checks,
  };
}

function isStandardFabricProp(key: string): boolean {
  return [
    "type",
    "left",
    "top",
    "width",
    "height",
    "fill",
    "stroke",
    "strokeWidth",
    "opacity",
    "angle",
    "scaleX",
    "scaleY",
    "flipX",
    "flipY",
    "originX",
    "originY",
    "visible",
    "text",
    "fontSize",
    "fontFamily",
    "fontWeight",
    "lineHeight",
    "charSpacing",
    "textAlign",
    "rx",
    "ry",
    "shadow",
    "backgroundColor",
    "paintFirst",
    "fillRule",
    "globalCompositeOperation",
    "skewX",
    "skewY",
    "strokeDashArray",
    "strokeLineCap",
    "strokeDashOffset",
    "strokeLineJoin",
    "strokeUniform",
    "strokeMiterLimit",
    "x1",
    "y1",
    "x2",
    "y2",
  ].includes(key);
}
