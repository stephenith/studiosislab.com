#!/usr/bin/env tsx
/**
 * Static verification for local template review tooling.
 */
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { GENERATED_ROOT, loadGeneratedTemplate } from "./template-loader.js";

const TOOL_DIR = import.meta.dirname;

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

async function main(): Promise<void> {
  const required = [
    "review-template.ts",
    "browser.ts",
    "template-loader.ts",
    "verify.ts",
    "README.md",
    "package.json",
  ];
  for (const f of required) {
    assert(existsSync(join(TOOL_DIR, f)), `missing ${f}`);
  }

  const tpl = loadGeneratedTemplate();
  assert(tpl.objectCount > 0, "template has objects");
  assert(tpl.json.version === "6.9.1", "fabric version");
  assert(existsSync(GENERATED_ROOT), "generated-resumes root exists");

  let playwrightOk = false;
  try {
    const pw = await import("playwright");
    playwrightOk = typeof pw.chromium?.launch === "function";
  } catch {
    playwrightOk = false;
  }
  assert(playwrightOk, "playwright importable — run npm install in local-review");

  const { isLoginUrl } = await import("./browser.js");
  assert(isLoginUrl("http://localhost:3000/login?next=%2Feditor%2Fnew"), "login url detect");
  assert(!isLoginUrl("http://localhost:3000/editor/new"), "editor not login");
  assert(isLoginUrl("http://localhost:3000/dashboard/login"), "dashboard login");

  console.log(
    JSON.stringify(
      {
        pass: true,
        component: "local-template-review",
        template: tpl.templateName,
        template_path: tpl.path,
        object_count: tpl.objectCount,
        canvas: `${tpl.canvasWidth}x${tpl.canvasHeight}`,
        checks: {
          files: true,
          template_loader: true,
          generated_root: true,
          playwright: true,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(JSON.stringify({ pass: false, error: String(err) }, null, 2));
  process.exit(1);
});
