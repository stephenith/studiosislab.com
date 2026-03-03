// scripts/scale-template.mjs
// Usage examples:
//   node scripts/scale-template.mjs src/data/template-json/t003.json
//   node scripts/scale-template.mjs src/data/template-json/t003.json --inplace
//   node scripts/scale-template.mjs src/data/template-json --inplace
//
// What it does:
// - Finds the "page-bg" object (role:"page-bg" or isPageBg:true) to get target page size (e.g., 794x1123)
// - Computes the bounding-box of all NON-page-bg objects
// - Computes a uniform scale factor so the non-bg content fits inside the page width/height (keeps aspect ratio)
// - Scales left/top/width/height, rx/ry, fontSize, strokeWidth, and a few other common numeric props
// - Writes a new file "<name>.scaled.json" by default, or edits in-place with a .bak backup if --inplace is used

import fs from "fs";
import path from "path";

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Please pass a file or folder path.\nExample: node scripts/scale-template.mjs src/data/template-json/t003.json --inplace");
  process.exit(1);
}

const targetPath = args[0];
const INPLACE = args.includes("--inplace");

function isJsonFile(p) {
  return p.toLowerCase().endsWith(".json");
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function findPageBg(objects) {
  return objects.find(
    (o) =>
      o?.role === "page-bg" ||
      o?.isPageBg === true ||
      o?.name === "page-bg"
  );
}

// Fabric objects can have scaleX/scaleY. If present, visual width = width * scaleX
function getScaledWidth(o) {
  const w = Number(o?.width ?? 0);
  const sx = Number(o?.scaleX ?? 1);
  return w * sx;
}
function getScaledHeight(o) {
  const h = Number(o?.height ?? 0);
  const sy = Number(o?.scaleY ?? 1);
  return h * sy;
}

function getBounds(objects) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const o of objects) {
    const left = Number(o?.left ?? 0);
    const top = Number(o?.top ?? 0);
    const w = getScaledWidth(o);
    const h = getScaledHeight(o);

    minX = Math.min(minX, left);
    minY = Math.min(minY, top);
    maxX = Math.max(maxX, left + w);
    maxY = Math.max(maxY, top + h);
  }

  if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }

  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

function round(n) {
  // keep nice numbers; avoid floating junk
  return Math.round(n * 1000) / 1000;
}

function scaleNumber(v, s) {
  const n = Number(v);
  if (!isFinite(n)) return v;
  return round(n * s);
}

function scaleObject(o, s) {
  // Position + geometry
  if ("left" in o) o.left = scaleNumber(o.left, s);
  if ("top" in o) o.top = scaleNumber(o.top, s);
  if ("width" in o) o.width = scaleNumber(o.width, s);
  if ("height" in o) o.height = scaleNumber(o.height, s);

  // Corner radius for rects
  if ("rx" in o) o.rx = scaleNumber(o.rx, s);
  if ("ry" in o) o.ry = scaleNumber(o.ry, s);

  // Text sizing
  if ("fontSize" in o) o.fontSize = scaleNumber(o.fontSize, s);
  if ("charSpacing" in o) o.charSpacing = scaleNumber(o.charSpacing, s);
  if ("lineHeight" in o) {
    // lineHeight is often a multiplier (like 1.2). If it's > 3 it's probably px-ish; otherwise keep it.
    const lh = Number(o.lineHeight);
    if (isFinite(lh) && lh > 3) o.lineHeight = scaleNumber(o.lineHeight, s);
  }

  // Strokes
  if ("strokeWidth" in o) o.strokeWidth = scaleNumber(o.strokeWidth, s);

  // Shadows (common Fabric structure)
  if (o.shadow && typeof o.shadow === "object") {
    if ("blur" in o.shadow) o.shadow.blur = scaleNumber(o.shadow.blur, s);
    if ("offsetX" in o.shadow) o.shadow.offsetX = scaleNumber(o.shadow.offsetX, s);
    if ("offsetY" in o.shadow) o.shadow.offsetY = scaleNumber(o.shadow.offsetY, s);
  }

  // Images sometimes use crop / clip paths; we won’t touch those unless numeric basics exist.
  // If scaleX/scaleY exist, keep them as-is (since we're scaling width/height directly).
  return o;
}

function processTemplateJson(json, filePath) {
  const objects = Array.isArray(json.objects) ? json.objects : [];
  if (objects.length === 0) {
    console.warn(`[skip] No objects array in ${filePath}`);
    return null;
  }

  const pageBg = findPageBg(objects);
  if (!pageBg) {
    console.warn(`[skip] No page-bg (role:"page-bg" or isPageBg:true) found in ${filePath}`);
    return null;
  }

  const pageW = Number(pageBg.width ?? 0);
  const pageH = Number(pageBg.height ?? 0);

  if (!pageW || !pageH) {
    console.warn(`[skip] page-bg has invalid width/height in ${filePath}`);
    return null;
  }

  const nonBg = objects.filter((o) => o !== pageBg);
  if (nonBg.length === 0) {
    console.warn(`[skip] Only page-bg exists in ${filePath}`);
    return null;
  }

  const bounds = getBounds(nonBg);

  // If content already fits, do nothing
  if (bounds.width <= pageW && bounds.height <= pageH) {
    console.log(`[ok] Already fits: ${path.basename(filePath)} content=${round(bounds.width)}x${round(bounds.height)} page=${pageW}x${pageH}`);
    return null;
  }

  // Uniform scale so content fits inside page
  const scaleW = pageW / (bounds.width || 1);
  const scaleH = pageH / (bounds.height || 1);
  const s = Math.min(scaleW, scaleH);

  console.log(`[scale] ${path.basename(filePath)}: bounds=${round(bounds.width)}x${round(bounds.height)} page=${pageW}x${pageH} => scale=${round(s)}`);

  // Scale objects
  const newObjects = objects.map((o) => {
    if (o === pageBg) return o; // keep page-bg as-is (target size)
    const copy = structuredClone(o);

    // Also handle "originX/Y" being "left/top" (good). We won't change origin.
    scaleObject(copy, s);

    return copy;
  });

  // Recompute bounds after scaling (non-bg only)
  const newNonBg = newObjects.filter((o) => o !== pageBg);
  const newBounds = getBounds(newNonBg);

  // Center horizontally and top-align with a fixed margin
  const TOP_MARGIN = 90;
  const offsetX = (pageW - newBounds.width) / 2 - newBounds.minX;
  const offsetY = TOP_MARGIN - newBounds.minY;

  // Apply offsets
  for (const o of newObjects) {
    if (o === pageBg) continue;
    if ("left" in o) o.left = round(Number(o.left ?? 0) + offsetX);
    if ("top" in o) o.top = round(Number(o.top ?? 0) + offsetY);
  }

  return { ...json, objects: newObjects };
}

function collectJsonFiles(p) {
  const stat = fs.statSync(p);
  if (stat.isFile()) return isJsonFile(p) ? [p] : [];
  if (stat.isDirectory()) {
    const entries = fs.readdirSync(p);
    const files = [];
    for (const e of entries) {
      const full = path.join(p, e);
      const st = fs.statSync(full);
      if (st.isDirectory()) files.push(...collectJsonFiles(full));
      else if (st.isFile() && isJsonFile(full)) files.push(full);
    }
    return files;
  }
  return [];
}

const files = collectJsonFiles(targetPath);
if (files.length === 0) {
  console.error("No .json files found at:", targetPath);
  process.exit(1);
}

let changed = 0;

for (const file of files) {
  try {
    const json = readJson(file);
    const updated = processTemplateJson(json, file);
    if (!updated) continue;

    if (INPLACE) {
      const bak = file.replace(/\.json$/i, ".bak.json");
      if (!fs.existsSync(bak)) {
        fs.copyFileSync(file, bak);
      }
      writeJson(file, updated);
      console.log(`  -> wrote (in-place) ${path.relative(process.cwd(), file)} (backup: ${path.basename(bak)})`);
    } else {
      const out = file.replace(/\.json$/i, ".scaled.json");
      writeJson(out, updated);
      console.log(`  -> wrote ${path.relative(process.cwd(), out)}`);
    }

    changed++;
  } catch (e) {
    console.error(`[error] ${file}`, e?.message || e);
  }
}

console.log(`Done. Updated ${changed} file(s).`);
