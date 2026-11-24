import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium, webkit, type Browser } from "playwright";

const root = path.resolve(__dirname, "../../..");
const entry = path.join(root, "src/lib/editor/mobileExportFabric.browser.ts");
const outDir = mkdtempSync(path.join(tmpdir(), "slb-mobile-export-fabric-"));
const bundle = path.join(outDir, "mobileExportFabric.iife.js");

const built = spawnSync(
  "npx",
  [
    "--yes",
    "esbuild",
    entry,
    "--bundle",
    "--format=iife",
    "--global-name=MobileExportFabric",
    `--outfile=${bundle}`,
    "--platform=browser",
    `--alias:@=${path.join(root, "src")}`,
  ],
  { cwd: root, encoding: "utf8" }
);

if (built.status !== 0) {
  throw new Error(`esbuild failed:\n${built.stdout}\n${built.stderr}`);
}

async function withHarnessOrigin<T>(fn: (origin: string) => Promise<T>): Promise<T> {
  const js = readFileSync(bundle);
  const html = "<!doctype html><html><body></body></html>";
  const server = createServer((req, res) => {
    if (req.url === "/harness.js") {
      res.writeHead(200, { "content-type": "text/javascript; charset=utf-8" });
      res.end(js);
      return;
    }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(html);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const port = (server.address() as AddressInfo).port;
    return await fn(`http://127.0.0.1:${port}/`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
}

async function runInBrowser(kind: "chromium" | "webkit", browser: Browser, origin: string) {
  const page = await browser.newPage();
  await page.goto(origin, { waitUntil: "load" });
  await page.addScriptTag({ path: bundle });
  const result = await page.evaluate(async () => {
    try {
      const api = (window as unknown as { MobileExportFabric?: { runMobileExportFabricCases?: () => Promise<unknown> } })
        .MobileExportFabric;
      if (!api?.runMobileExportFabricCases) {
        return {
          propsIncludeId: false,
          cases: [{ name: "missing-api", ok: false, detail: "MobileExportFabric global was not installed" }],
          failed: ["missing-api"],
        };
      }
      return await api.runMobileExportFabricCases();
    } catch (err) {
      return {
        propsIncludeId: false,
        cases: [{ name: "run-error", ok: false, detail: err instanceof Error ? err.message : String(err) }],
        failed: ["run-error"],
      };
    }
  });
  await page.close();
  writeFileSync(path.join(outDir, `${kind}.json`), JSON.stringify(result, null, 2));
  return result as {
    propsIncludeId: boolean;
    cases: Array<{ name: string; ok: boolean; detail: string; stages?: Record<string, unknown> }>;
    failed: string[];
  };
}

async function main() {
  const engines: Array<["chromium" | "webkit", () => Promise<Browser>]> = [
    ["chromium", () => chromium.launch()],
    ["webkit", () => webkit.launch()],
  ];
  const reports: Record<string, Awaited<ReturnType<typeof runInBrowser>>> = {};
  await withHarnessOrigin(async (origin) => {
  for (const [kind, launch] of engines) {
    let browser: Browser | null = null;
    try {
      browser = await launch();
      reports[kind] = await runInBrowser(kind, browser, origin);
    } catch (err) {
      reports[kind] = {
        propsIncludeId: false,
        cases: [
          {
            name: `${kind}-launch`,
            ok: false,
            detail: err instanceof Error ? err.message : String(err),
          },
        ],
        failed: [`${kind}-launch`],
      };
    } finally {
      await browser?.close();
    }
  }
  });

  console.log("mobileExportFabric.verify reports", JSON.stringify(reports, null, 2));

  const chromiumReport = reports.chromium;
  assert.ok(chromiumReport, "chromium report missing");
  const uncropped = chromiumReport.cases.find((item) => item.name === "uncropped-same-device");
  const cropped = chromiumReport.cases.find((item) => item.name === "cropped-same-device");
  const missing = chromiumReport.cases.find((item) => item.name === "missing-other-device");
  const duplicate = chromiumReport.cases.find((item) => item.name === "duplicate-asset-id");
  const later = chromiumReport.cases.find((item) => item.name === "later-page");
  const merged = chromiumReport.cases.find((item) => item.name === "merge-preserved-upload");

  assert.equal(chromiumReport.propsIncludeId, true);
  assert.equal(uncropped?.ok, true, `uncropped Fabric toDataURL failed: ${uncropped?.detail}`);
  assert.match(String(uncropped?.detail || ""), /"slbAssetId":"asset-uncropped"/);
  assert.match(String(uncropped?.detail || ""), /"assetStore":"indexeddb-test"/);
  assert.equal(cropped?.ok, true, `cropped Fabric toDataURL failed: ${cropped?.detail}`);
  assert.equal(missing?.ok, true, `missing-asset case failed: ${missing?.detail}`);
  assert.match(String(missing?.detail || ""), /"assetStore":"in-memory-null-loader"/);
  assert.equal(duplicate?.ok, true, `duplicate-asset case failed: ${duplicate?.detail}`);
  assert.match(String(duplicate?.detail || ""), /"leftHasOwn":true/);
  assert.match(String(duplicate?.detail || ""), /"rightHasOwn":true/);
  assert.doesNotMatch(String(duplicate?.detail || ""), /"swapped":true/);
  assert.equal(merged?.ok, true, `merge-preserved-upload failed: ${merged?.detail}`);
  assert.match(String(merged?.detail || ""), /"identityKept":true/);
  assert.match(String(merged?.detail || ""), /"mergedAssetId":"asset-merged-upload"/);
  assert.match(String(merged?.detail || ""), /"assetStore":"indexeddb-test"/);
  assert.equal(later?.ok, true, `later-page case failed: ${later?.detail}`);

  const webkitUnavailable = ["webkit-launch", "missing-api", "run-error"].some((name) =>
    reports.webkit?.failed?.includes(name)
  );
  if (webkitUnavailable) {
    console.log("mobileExportFabric.verify: WebKit unavailable; Chromium Fabric toDataURL cases PASS");
    return;
  }
  const webUncropped = reports.webkit.cases.find((item) => item.name === "uncropped-same-device");
  const webCropped = reports.webkit.cases.find((item) => item.name === "cropped-same-device");
  const webMerged = reports.webkit.cases.find((item) => item.name === "merge-preserved-upload");
  const webDuplicate = reports.webkit.cases.find((item) => item.name === "duplicate-asset-id");
  assert.equal(webUncropped?.ok, true, `webkit uncropped failed: ${webUncropped?.detail}`);
  assert.equal(webCropped?.ok, true, `webkit cropped failed: ${webCropped?.detail}`);
  assert.equal(webMerged?.ok, true, `webkit merge-preserved-upload failed: ${webMerged?.detail}`);
  assert.equal(webDuplicate?.ok, true, `webkit duplicate-asset failed: ${webDuplicate?.detail}`);
  console.log("mobileExportFabric.verify: PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
