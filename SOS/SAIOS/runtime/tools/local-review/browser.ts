import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright";

/** StudiosisLab repo root (5 levels up from local-review/) */
export const REPO_ROOT = resolve(import.meta.dirname, "../../../../..");
const USER_DATA_DIR = join(import.meta.dirname, ".playwright-user-data");
const DEFAULT_PORT = Number(process.env.REVIEW_PORT || 3000);
const EDITOR_PATH = "/editor/new";

export type ImportResult = {
  success: boolean;
  error?: string;
  objectCount: number;
  canvasWidth: number;
  canvasHeight: number;
  importDurationMs: number;
};

let devServerProc: ChildProcess | null = null;

export function getEditorUrl(port = DEFAULT_PORT): string {
  return `http://localhost:${port}${EDITOR_PATH}`;
}

export function isLoginUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname;
    return path === "/login" || path.startsWith("/login/") || path === "/dashboard/login";
  } catch {
    return /\/login(\?|$|\/)/.test(url);
  }
}

async function isImportApiReady(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    return (
      typeof (window as unknown as { __slbImportTemplate?: unknown }).__slbImportTemplate ===
      "function"
    );
  });
}

type DevServerProbe = {
  ready: boolean;
  url: string;
  status?: number;
  error?: string;
};

function probeUrl(port: number): string {
  return `http://localhost:${port}${EDITOR_PATH}`;
}

async function probeDevServer(port = DEFAULT_PORT): Promise<DevServerProbe> {
  const url = probeUrl(port);
  try {
    const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(3000) });
    return { ready: res.status < 500, url, status: res.status };
  } catch (err) {
    return {
      ready: false,
      url,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function logDevServerProbe(probe: DevServerProbe): void {
  const ts = new Date().toISOString();
  if (probe.status !== undefined) {
    console.log(`[server] ${ts} GET ${probe.url} -> HTTP ${probe.status}`);
  } else {
    console.log(`[server] ${ts} GET ${probe.url} -> connection error: ${probe.error}`);
  }
}

function inspectRepoRoot(): { hasPackageJson: boolean; hasDevScript: boolean } {
  const packageJsonPath = join(REPO_ROOT, "package.json");
  const hasPackageJson = existsSync(packageJsonPath);
  let hasDevScript = false;
  if (hasPackageJson) {
    try {
      const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
        scripts?: Record<string, string>;
      };
      hasDevScript = typeof pkg.scripts?.dev === "string" && pkg.scripts.dev.length > 0;
    } catch {
      hasDevScript = false;
    }
  }
  return { hasPackageJson, hasDevScript };
}

export async function isDevServerUp(port = DEFAULT_PORT): Promise<boolean> {
  return (await probeDevServer(port)).ready;
}

export async function ensureDevServer(port = DEFAULT_PORT): Promise<void> {
  const initial = await probeDevServer(port);
  logDevServerProbe(initial);
  if (initial.ready) {
    console.log(`[server] localhost:${port} already running`);
    return;
  }

  const { hasPackageJson, hasDevScript } = inspectRepoRoot();
  console.log(`[server] REPO_ROOT: ${REPO_ROOT}`);
  console.log(`[server] package.json exists: ${hasPackageJson}`);
  console.log(`[server] package.json dev script: ${hasDevScript}`);

  if (!hasPackageJson) {
    throw new Error(`package.json not found at ${join(REPO_ROOT, "package.json")}`);
  }
  if (!hasDevScript) {
    throw new Error(`package.json at ${REPO_ROOT} has no "dev" script`);
  }

  console.log(`[server] Starting Next.js dev server on port ${port}…`);

  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];
  let childExited = false;
  let exitCode: number | null = null;

  devServerProc = spawn("npm", ["run", "dev", "--", "-p", String(port)], {
    cwd: REPO_ROOT,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, NODE_ENV: "development" },
  });

  devServerProc.stdout?.on("data", (chunk: Buffer) => {
    const text = chunk.toString();
    stdoutChunks.push(text);
    for (const line of text.split("\n").filter((l) => l.trim().length > 0)) {
      console.log(`[server:stdout] ${line}`);
    }
  });

  devServerProc.stderr?.on("data", (chunk: Buffer) => {
    const text = chunk.toString();
    stderrChunks.push(text);
    for (const line of text.split("\n").filter((l) => l.trim().length > 0)) {
      console.log(`[server:stderr] ${line}`);
    }
  });

  devServerProc.on("exit", (code) => {
    childExited = true;
    exitCode = code;
  });

  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (childExited) {
      const stderr = stderrChunks.join("").trim();
      const stdout = stdoutChunks.join("").trim();
      throw new Error(
        `Dev server process exited with code ${exitCode ?? "null"} before becoming ready.` +
          (stderr ? `\nstderr:\n${stderr}` : "") +
          (stdout ? `\nstdout:\n${stdout}` : ""),
      );
    }

    const probe = await probeDevServer(port);
    logDevServerProbe(probe);
    if (probe.ready) {
      console.log(`[server] Next.js started`);
      console.log(`[server] Ready at http://localhost:${port}`);
      devServerProc.unref();
      return;
    }
    await sleep(1500);
  }

  const stderr = stderrChunks.join("").trim();
  const stdout = stdoutChunks.join("").trim();
  throw new Error(
    `Dev server did not become ready on port ${port} within 120s` +
      (stderr ? `\nstderr:\n${stderr}` : "") +
      (stdout ? `\nstdout:\n${stdout}` : ""),
  );
}

export async function openReviewBrowser(port = DEFAULT_PORT): Promise<{
  context: BrowserContext;
  page: Page;
}> {
  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    viewport: { width: 1440, height: 900 },
    args: ["--disable-blink-features=AutomationControlled"],
  });
  console.log("[browser] Context created");
  const page = context.pages()[0] ?? (await context.newPage());
  console.log(`[browser] Page created — ${page.url()}`);
  return { context, page };
}

/**
 * Navigate to the editor and wait for __slbImportTemplate.
 * On /login: pause once, wait for URL change (no refresh loop).
 * If session already active: skip login wait entirely.
 */
export async function waitForEditorReady(page: Page, editorUrl: string): Promise<void> {
  console.log(`[browser] Navigating to ${editorUrl}`);
  await page.goto(editorUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page
    .waitForURL((url) => isLoginUrl(url.href) || url.pathname.includes("/editor/"), {
      timeout: 15_000,
      waitUntil: "domcontentloaded",
    })
    .catch(() => undefined);
  console.log(`[browser] Current URL: ${page.url()}`);

  if (await isImportApiReady(page)) {
    console.log("[editor] __slbImportTemplate detected");
    return;
  }

  if (isLoginUrl(page.url())) {
    console.log("[browser] Login detected");
    console.log("Waiting for user login...");
    await page.waitForURL((url) => !isLoginUrl(url.href), {
      timeout: 600_000,
      waitUntil: "domcontentloaded",
    });
  }

  if (!(await isImportApiReady(page))) {
    if (!page.url().includes("/editor/")) {
      await page.goto(editorUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
    }

    await page.waitForFunction(
      () =>
        typeof (window as unknown as { __slbImportTemplate?: unknown }).__slbImportTemplate ===
        "function",
      undefined,
      { timeout: 180_000 },
    );
  }

  console.log("[editor] __slbImportTemplate detected");
}

export async function importTemplateInBrowser(
  page: Page,
  json: Record<string, unknown>,
  expectedObjectCount: number,
): Promise<ImportResult> {
  const start = Date.now();
  console.log("[import] Import started");

  // tsx/esbuild injects __name into serialized page.evaluate bodies
  await page.evaluate(() => {
    (globalThis as unknown as { __name?: (t: unknown) => unknown }).__name = (t) => t;
  });

  const result = await page.evaluate(
    async ({ payload, expected }) => {
      const win = window as unknown as {
        __slbImportTemplate?: (j: unknown, r?: string) => Promise<void>;
        __slbCanvas?: {
          getObjects?: () => unknown[];
          width?: number;
          height?: number;
          requestRenderAll?: () => void;
        };
        __canvas?: {
          getObjects?: () => unknown[];
          width?: number;
          height?: number;
          requestRenderAll?: () => void;
        };
      };

      const getActiveCanvas = () => win.__slbCanvas ?? win.__canvas;

      if (typeof win.__slbImportTemplate !== "function") {
        return {
          success: false,
          error: "__slbImportTemplate is not defined (dev mode + editor canvas required)",
          objectCount: 0,
          canvasWidth: 0,
          canvasHeight: 0,
        };
      }

      const errors: string[] = [];
      const onError = (msg: string) => errors.push(msg);
      const prevError = console.error;
      console.error = (...args: unknown[]) => {
        onError(args.map(String).join(" "));
        prevError.apply(console, args);
      };

      try {
        await win.__slbImportTemplate(payload, "template-loaded");

        let objectCount = 0;
        let canvasWidth = 0;
        let canvasHeight = 0;
        for (let attempt = 0; attempt < 24; attempt++) {
          await new Promise((r) => setTimeout(r, 250));
          const canvas = getActiveCanvas();
          objectCount = canvas?.getObjects?.()?.length ?? 0;
          canvasWidth = Number(canvas?.width ?? 0);
          canvasHeight = Number(canvas?.height ?? 0);
          if (objectCount > 0) break;
        }

        getActiveCanvas()?.requestRenderAll?.();

        if (objectCount === 0) {
          return {
            success: false,
            error: "Canvas has zero objects after import",
            objectCount,
            canvasWidth,
            canvasHeight,
          };
        }

        if (objectCount < Math.max(1, expected - 2)) {
          return {
            success: false,
            error: `Expected ~${expected} objects, got ${objectCount}`,
            objectCount,
            canvasWidth,
            canvasHeight,
          };
        }

        const slbErr = errors.find((e) => e.includes("[slbImport] Failed"));
        if (slbErr) {
          return {
            success: false,
            error: slbErr,
            objectCount,
            canvasWidth,
            canvasHeight,
          };
        }

        return { success: true, objectCount, canvasWidth, canvasHeight };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
          objectCount: 0,
          canvasWidth: 0,
          canvasHeight: 0,
        };
      } finally {
        console.error = prevError;
      }
    },
    { payload: json, expected: expectedObjectCount },
  );

  const importResult = {
    ...result,
    importDurationMs: Date.now() - start,
  };
  console.log(
    `[import] Import finished — ${importResult.success ? "success" : "failed"} (${importResult.importDurationMs}ms)`,
  );
  return importResult;
}

export function detachDevServer(): void {
  if (devServerProc && !devServerProc.killed) {
    console.log("[server] Leaving dev server running (started by review tool)");
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
