import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { chromium } from "playwright";

type TemplateStatus = "draft" | "published";

type ManifestTemplate = {
  id: string;
  title: string;
  categoryId: string;
  thumbnailPath: string;
  jsonPath: string;
  status: TemplateStatus;
};

type Manifest = {
  templates: ManifestTemplate[];
};

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "../..");
const MANIFEST_PATH = path.join(ROOT, "templates.manifest.json");

function fail(message: string): never {
  throw new Error(message);
}

function readManifest(): Manifest {
  if (!fs.existsSync(MANIFEST_PATH)) {
    fail(`Manifest not found: ${MANIFEST_PATH}`);
  }
  const raw = fs.readFileSync(MANIFEST_PATH, "utf8");
  const parsed = JSON.parse(raw) as Manifest;
  if (!Array.isArray(parsed.templates)) {
    fail("templates.manifest.json must contain templates[]");
  }
  return parsed;
}

function writeManifest(manifest: Manifest): void {
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

function parseArgs(): { id: string; title: string; categoryId: string } {
  const id = String(process.argv[2] || "").trim().toLowerCase();
  const title = String(process.argv[3] || "").trim();
  const categoryId = String(process.argv[4] || "").trim().toLowerCase();

  if (!id || !title || !categoryId) {
    fail(
      'Usage: npm run template:extract t005 "My Template Title" business'
    );
  }

  if (!/^t\d{3,4}$/i.test(id)) {
    fail(`Invalid id "${id}". Expected format like t001.`);
  }

  return { id, title, categoryId };
}

function ensureCanAddTemplate(manifest: Manifest, id: string, jsonRelPath: string): string {
  if (manifest.templates.some((t) => t.id === id)) {
    fail(`Template id "${id}" already exists`);
  }

  const jsonAbsPath = path.join(ROOT, jsonRelPath);
  if (fs.existsSync(jsonAbsPath)) {
    fail(`File already exists: ${jsonRelPath}`);
  }

  return jsonAbsPath;
}

function validateSnapshot(snapshot: any): void {
  if (!snapshot || typeof snapshot !== "object") {
    fail("Invalid snapshot object");
  }
  if (!Array.isArray(snapshot.objects)) {
    fail("Snapshot missing objects[]");
  }
  if (snapshot.objects.length === 0) {
    fail("Snapshot is empty");
  }
}

function shouldNormalizeImageSrc(src: string): boolean {
  const normalized = String(src || "").trim().toLowerCase();
  if (!normalized) return false;
  if (normalized.startsWith("data:")) return false;
  if (normalized.startsWith("http://")) return false;
  if (normalized.startsWith("https://")) return false;
  return normalized.startsWith("blob:");
}

function walkFabricTree(root: any, onNode: (node: any) => void): void {
  const seen = new WeakSet<object>();
  const visit = (value: any) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (seen.has(value)) return;
    seen.add(value);
    onNode(value);
    for (const nested of Object.values(value)) {
      if (nested && typeof nested === "object") visit(nested);
    }
  };
  visit(root);
}

function isImageNode(node: any): boolean {
  return String(node?.type || "").toLowerCase() === "image";
}

function stripTemplateLocalAssetFields(snapshot: any): void {
  walkFabricTree(snapshot, (node) => {
    if (!node || typeof node !== "object") return;
    if ((node as any).slbSource === "local") {
      delete (node as any).slbSource;
      delete (node as any).slbAssetId;
      return;
    }
    if ((node as any).slbSource != null && String((node as any).slbSource).toLowerCase() === "local") {
      delete (node as any).slbSource;
      delete (node as any).slbAssetId;
    }
  });
}

function collectBlobImageSources(snapshot: any): string[] {
  const blobSrcs: string[] = [];
  walkFabricTree(snapshot, (node) => {
    if (!isImageNode(node)) return;
    const src = String(node?.src || "");
    if (shouldNormalizeImageSrc(src)) {
      blobSrcs.push(src);
    }
  });
  return Array.from(new Set(blobSrcs));
}

function validateNoBlobSources(snapshot: any, templateId: string): void {
  const blobPaths: string[] = [];
  const walk = (node: any, pathParts: string[]) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach((child, idx) => walk(child, [...pathParts, String(idx)]));
      return;
    }
    for (const [key, value] of Object.entries(node)) {
      const nextPath = [...pathParts, key];
      if (typeof value === "string" && key === "src" && value.toLowerCase().startsWith("blob:")) {
        blobPaths.push(nextPath.join("."));
      } else if (value && typeof value === "object") {
        walk(value, nextPath);
      }
    }
  };
  walk(snapshot, []);
  if (blobPaths.length > 0) {
    throw new Error(
      `[extract] Blob sources are forbidden in templates (${templateId}). Paths: ${blobPaths.slice(0, 10).join(", ")}`
    );
  }
}

async function normalizeTemplateSnapshotAssets(
  snapshot: any,
  templateId: string,
  page?: any
): Promise<any> {
  if (!snapshot || typeof snapshot !== "object") return snapshot;

  stripTemplateLocalAssetFields(snapshot);

  const imageObjects: any[] = [];
  walkFabricTree(snapshot, (node) => {
    if (isImageNode(node)) imageObjects.push(node);
  });
  if (imageObjects.length === 0) return snapshot;

  let convertedCount = 0;
  const fallbackSrc = "/templates/avatar-placeholder.png";

  // Prefer browser-context conversion because blob: URLs are tied to that page session.
  if (page) {
    const uniqueBlobSrcs = collectBlobImageSources(snapshot);
    if (uniqueBlobSrcs.length > 0) {
      const resolvedMap = await page.evaluate(async (sources: string[]) => {
        const results: Record<string, string | null> = {};
        for (const src of sources) {
          try {
            const response = await fetch(src);
            if (!response.ok) {
              results[src] = null;
              continue;
            }
            const blob = await response.blob();
            const dataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                const result = String(reader.result || "");
                if (result.startsWith("data:")) resolve(result);
                else reject(new Error("Invalid data URL result"));
              };
              reader.onerror = () => reject(new Error("FileReader conversion failed"));
              reader.readAsDataURL(blob);
            });
            results[src] = dataUrl;
          } catch {
            results[src] = null;
          }
        }
        return results;
      }, uniqueBlobSrcs);

      for (const obj of imageObjects) {
        const src = String(obj?.src || "");
        if (!shouldNormalizeImageSrc(src)) continue;
        const converted = resolvedMap[src];
        if (typeof converted === "string" && converted.startsWith("data:")) {
          obj.src = converted;
          convertedCount += 1;
        } else {
          obj.src = fallbackSrc;
          console.warn(
            `[extract] Failed to convert blob image for ${templateId}; using placeholder (${src})`
          );
        }
      }
    }
  }

  // Safety pass in current runtime (handles any leftover blob sources).
  for (const obj of imageObjects) {
    const src = String(obj?.src || "");
    if (!shouldNormalizeImageSrc(src)) continue;
    try {
      const response = await fetch(src);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const buffer = Buffer.from(await blob.arrayBuffer());
      const mime = String(blob.type || "image/png");
      obj.src = `data:${mime};base64,${buffer.toString("base64")}`;
      convertedCount += 1;
    } catch {
      obj.src = fallbackSrc;
      console.warn(
        `[extract] Failed to normalize image src for ${templateId}; using placeholder (${src})`
      );
    }
  }

  validateNoBlobSources(snapshot, templateId);
  console.log(`[extract] Normalized template assets: ${templateId} (${convertedCount} images)`);
  return snapshot;
}

async function extractSnapshot(editorUrl: string, templateId: string): Promise<any> {
  console.log("[extract] Launching browser...");

  const context = await chromium.launchPersistentContext(
    path.join(ROOT, ".tmp", "template-profile"),
    { headless: false } // 👈 IMPORTANT (so you can SEE what's happening)
  );

  const page = context.pages()[0] ?? (await context.newPage());

  try {
    console.log("[extract] Opening:", editorUrl);

    await page.goto(editorUrl, {
      waitUntil: "load",
      timeout: 30000,
    });

    console.log("[extract] Page loaded");

    // Give React + Fabric time to fully initialize
    await page.waitForTimeout(3000);

    console.log("[extract] Waiting for hook...");

    await page.waitForFunction(() => {
      return typeof (window as any).__slbGetTemplateSnapshot === "function";
    }, { timeout: 20000 });

    console.log("[extract] Hook found");

    const snapshot = await page.evaluate(() => {
      return (window as any).__slbGetTemplateSnapshot();
    });

    const normalizedSnapshot = await normalizeTemplateSnapshotAssets(
      snapshot,
      templateId,
      page
    );

    console.log("[extract] Snapshot captured");

    return normalizedSnapshot;

  } catch (err: any) {
    console.error("[extract] ERROR:", err?.message || err);
    throw err;
  } finally {
    await context.close();
  }
}

function runTemplatesSync(): void {
  console.log("[extract] Running templates:sync...");

  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

  const result = spawnSync(npmCmd, ["run", "templates:sync"], {
    cwd: ROOT,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    fail("templates:sync failed");
  }
}

async function main() {
  const { id, title, categoryId } = parseArgs();

  const editorUrl = process.env.TEMPLATE_EDITOR_URL;
  if (!editorUrl) fail("TEMPLATE_EDITOR_URL missing");

  const manifest = readManifest();

  const jsonRelPath = `src/data/template-json/${id}.json`;
  const jsonAbsPath = ensureCanAddTemplate(manifest, id, jsonRelPath);

  const snapshot = await extractSnapshot(editorUrl, id);
  validateSnapshot(snapshot);
  validateNoBlobSources(snapshot, id);

  fs.mkdirSync(path.dirname(jsonAbsPath), { recursive: true });
  const snapshotJson = JSON.stringify(snapshot, null, 2);
  if (snapshotJson.length > 2 * 1024 * 1024) {
    console.warn(`[extract] Template too large: ${id} (${snapshotJson.length} bytes)`);
  }
  fs.writeFileSync(jsonAbsPath, snapshotJson);

  manifest.templates.push({
    id,
    title,
    categoryId,
    thumbnailPath: `/templates/${id}.png`,
    jsonPath: jsonRelPath,
    status: "published",
  });

  writeManifest(manifest);

  runTemplatesSync();

  console.log(`✅ Template ${id} created successfully`);
}

main().catch((err) => {
  console.error("[template:extract FAILED]", err.message);
  process.exit(1);
});