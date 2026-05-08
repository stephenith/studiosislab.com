import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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
const FABRIC_BUNDLE_PATH = path.join(ROOT, "node_modules", "fabric", "dist", "index.min.js");

const FALLBACK_WIDTH = 794; // A4-ish editor width
const FALLBACK_HEIGHT = 1123; // A4-ish editor height
const TARGET_THUMB_WIDTH = 420;

type CliOptions = {
  id?: string;
  all: boolean;
  force: boolean;
};

function fail(message: string): never {
  throw new Error(message);
}

function parseOptions(argv: string[]): CliOptions {
  const options: CliOptions = { all: false, force: false };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--all") {
      options.all = true;
      continue;
    }
    if (token === "--force") {
      options.force = true;
      continue;
    }
    if (token === "--id") {
      const id = String(argv[i + 1] || "").trim().toLowerCase();
      if (!id) fail("Missing value for --id");
      options.id = id;
      i += 1;
      continue;
    }
    fail(`Unknown flag: ${token}`);
  }

  if (options.id && !/^t\d{3,4}$/i.test(options.id)) {
    fail(`Invalid --id "${options.id}". Expected format like t001.`);
  }

  return options;
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

function resolveJsonAbsolutePath(template: ManifestTemplate): string {
  return path.join(ROOT, template.jsonPath);
}

function resolveThumbAbsolutePath(template: ManifestTemplate): string {
  const thumb = String(template.thumbnailPath || "").trim();
  if (!thumb) fail(`[thumbnail] failed ${template.id}: thumbnailPath is required`);

  const relative = thumb.startsWith("/") ? thumb.slice(1) : thumb;
  return path.join(ROOT, "public", relative);
}

function readAndValidateSnapshot(template: ManifestTemplate): any {
  const jsonAbsPath = resolveJsonAbsolutePath(template);
  if (!fs.existsSync(jsonAbsPath)) {
    fail(`[thumbnail] failed ${template.id}: JSON file missing at ${template.jsonPath}`);
  }

  const raw = fs.readFileSync(jsonAbsPath, "utf8");
  const snapshot = JSON.parse(raw);

  if (!snapshot || typeof snapshot !== "object") {
    fail(`[thumbnail] failed ${template.id}: snapshot must be an object`);
  }
  if (!Array.isArray(snapshot.objects)) {
    fail(`[thumbnail] failed ${template.id}: snapshot.objects must be an array`);
  }
  if (snapshot.objects.length === 0) {
    fail(`[thumbnail] failed ${template.id}: snapshot.objects must not be empty`);
  }
  return snapshot;
}

async function renderPngDataUrl(page: any, snapshot: any): Promise<string> {
  return page.evaluate(
    async ({
      snapshotForEval,
      fallbackWidth,
      fallbackHeight,
      targetThumbWidth,
    }: {
      snapshotForEval: any;
      fallbackWidth: number;
      fallbackHeight: number;
      targetThumbWidth: number;
    }) => {
      const fabricGlobal = (window as any).fabric;
      if (!fabricGlobal?.Canvas) {
        throw new Error("fabric Canvas is unavailable in page context");
      }

      const width =
        typeof snapshotForEval?.width === "number" && Number.isFinite(snapshotForEval.width)
          ? Math.max(1, Math.round(snapshotForEval.width))
          : fallbackWidth;
      const height =
        typeof snapshotForEval?.height === "number" && Number.isFinite(snapshotForEval.height)
          ? Math.max(1, Math.round(snapshotForEval.height))
          : fallbackHeight;

      const canvasEl = document.createElement("canvas");
      canvasEl.width = width;
      canvasEl.height = height;
      document.body.innerHTML = "";
      document.body.appendChild(canvasEl);

      const canvas = new fabricGlobal.Canvas(canvasEl, {
        width,
        height,
        selection: false,
        preserveObjectStacking: true,
      });

      const bg =
        typeof snapshotForEval?.background === "string" && snapshotForEval.background
          ? snapshotForEval.background
          : "#ffffff";
      canvas.set("backgroundColor", bg);

      await new Promise<void>((resolve, reject) => {
        try {
          const onDone = () => resolve();
          const result = canvas.loadFromJSON(snapshotForEval, onDone);
          if (result && typeof result.then === "function") {
            result.then(() => resolve()).catch(reject);
          }
        } catch (error) {
          reject(error);
        }
      });

      canvas.renderAll();

      const ratio = targetThumbWidth / width;
      const multiplier = Math.max(0.05, Math.min(1, ratio));
      const dataUrl = canvas.toDataURL({
        format: "png",
        multiplier,
      } as any);

      canvas.dispose?.();
      return dataUrl;
    },
    {
      snapshotForEval: snapshot,
      fallbackWidth: FALLBACK_WIDTH,
      fallbackHeight: FALLBACK_HEIGHT,
      targetThumbWidth: TARGET_THUMB_WIDTH,
    }
  );
}

function writePngFromDataUrl(dataUrl: string, outPath: string): void {
  const match = /^data:image\/png;base64,(.+)$/i.exec(dataUrl);
  if (!match) fail("Received invalid PNG data URL from renderer");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, Buffer.from(match[1], "base64"));
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const manifest = readManifest();

  const templates = options.id
    ? manifest.templates.filter((template) => template.id.toLowerCase() === options.id)
    : manifest.templates;

  if (options.id && templates.length === 0) {
    fail(`Template id "${options.id}" not found in templates.manifest.json`);
  }

  if (!fs.existsSync(FABRIC_BUNDLE_PATH)) {
    fail(`Fabric browser bundle missing: ${FABRIC_BUNDLE_PATH}`);
  }

  let generated = 0;
  let skipped = 0;
  let failed = 0;

  const browser = await chromium.launch({ headless: true, channel: "chromium" });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.setContent("<!doctype html><html><body></body></html>");
    await page.addScriptTag({ path: FABRIC_BUNDLE_PATH });

    for (const template of templates) {
      const outPath = resolveThumbAbsolutePath(template);
      const exists = fs.existsSync(outPath);
      const shouldOverwrite = options.all || options.force;

      if (exists && !shouldOverwrite) {
        console.log(`[thumbnail] skipped ${template.id} (already exists)`);
        skipped += 1;
        continue;
      }

      try {
        const snapshot = readAndValidateSnapshot(template);
        const dataUrl = await renderPngDataUrl(page, snapshot);
        writePngFromDataUrl(dataUrl, outPath);
        console.log(`[thumbnail] generated ${template.id}`);
        generated += 1;
      } catch (error) {
        failed += 1;
        console.error(`[thumbnail] failed ${template.id}`);
        throw error;
      }
    }
  } finally {
    await context.close();
    await browser.close();
  }

  console.log(
    `[thumbnail] summary generated=${generated} skipped=${skipped} failed=${failed}`
  );
}

main().catch((error: any) => {
  console.error(`[thumbnail] ${String(error?.message || error)}`);
  process.exit(1);
});
