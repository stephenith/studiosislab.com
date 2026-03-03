// scripts/normalize-template-offset.mjs
// Rollback: restore original files from the *.beforeShift.json backups.
// Usage examples:
//   node scripts/normalize-template-offset.mjs src/data/template-json/t003.json
//   node scripts/normalize-template-offset.mjs src/data/template-json/t003.json --inplace
//   node scripts/normalize-template-offset.mjs src/data/template-json --inplace
//
// What it does:
// - Finds the "page-bg" object (role:"page-bg" OR isPageBg:true OR name:"page-bg")
// - Computes minX/minY across NON-page-bg objects (left/top; missing treated as 0)
// - Shifts all non-bg objects by (-minX, -minY) so content starts at (0,0)
// - Writes .normalized.json by default, or edits in-place with a .beforeShift.json backup

import fs from "fs";
import path from "path";

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error(
    "Please pass a file or folder path.\nExample: node scripts/normalize-template-offset.mjs src/data/template-json/t003.json --inplace"
  );
  process.exit(1);
}

const targetPath = args[0];
const INPLACE = args.includes("--inplace") || args.includes("–inplace");

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

function round(n) {
  return Math.round(n * 1000) / 1000;
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

function processTemplateJson(json, filePath) {
  const objects = Array.isArray(json.objects) ? json.objects : [];
  if (objects.length === 0) {
    console.warn(`[skip] No objects array in ${filePath}`);
    return null;
  }

  const pageBg = findPageBg(objects);
  if (!pageBg) {
    console.warn(`[skip] No page-bg found in ${filePath}`);
    return null;
  }

  const nonBg = objects.filter((o) => o !== pageBg);
  if (nonBg.length === 0) {
    console.warn(`[skip] Only page-bg exists in ${filePath}`);
    return null;
  }

  let minX = Infinity;
  let minY = Infinity;
  for (const o of nonBg) {
    const left = Number(o?.left ?? 0);
    const top = Number(o?.top ?? 0);
    minX = Math.min(minX, Number.isFinite(left) ? left : 0);
    minY = Math.min(minY, Number.isFinite(top) ? top : 0);
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    console.warn(`[skip] Invalid minX/minY in ${filePath}`);
    return null;
  }

  if (minX === 0 && minY === 0) {
    console.log(`[ok] already normalized: ${path.basename(filePath)} minX=0 minY=0`);
    return null;
  }

  console.log(
    `[normalize] ${path.basename(filePath)} minX=${round(minX)} minY=${round(minY)}`
  );

  const newObjects = objects.map((o) => {
    if (o === pageBg) return o;
    const copy = structuredClone(o);
    const left = Number(copy?.left ?? 0);
    const top = Number(copy?.top ?? 0);
    copy.left = round((Number.isFinite(left) ? left : 0) - minX);
    copy.top = round((Number.isFinite(top) ? top : 0) - minY);
    return copy;
  });

  return { ...json, objects: newObjects };
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
      const bak = file.replace(/\.json$/i, ".beforeShift.json");
      if (!fs.existsSync(bak)) {
        fs.copyFileSync(file, bak);
      }
      writeJson(file, updated);
      console.log(
        `  -> wrote (in-place) ${path.relative(process.cwd(), file)} (backup: ${path.basename(
          bak
        )})`
      );
    } else {
      const out = file.replace(/\.json$/i, ".normalized.json");
      writeJson(out, updated);
      console.log(`  -> wrote ${path.relative(process.cwd(), out)}`);
    }

    changed++;
  } catch (e) {
    console.error(`[error] ${file}`, e?.message || e);
  }
}

console.log(`Done. Updated ${changed} file(s).`);
