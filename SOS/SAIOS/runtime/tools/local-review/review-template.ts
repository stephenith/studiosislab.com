#!/usr/bin/env tsx
/**
 * One-click local template review — loads generated template-preview.json into the dev editor.
 */
import { loadGeneratedTemplate } from "./template-loader.js";
import {
  detachDevServer,
  ensureDevServer,
  getEditorUrl,
  importTemplateInBrowser,
  openReviewBrowser,
  waitForEditorReady,
} from "./browser.js";

async function main(): Promise<void> {
  const template = loadGeneratedTemplate();
  console.log(`[template] ${template.templateName}`);
  console.log(`[template] ${template.path}`);
  console.log(`[template] Candidate: ${template.candidateName ?? "unknown"}`);
  console.log(`[template] Role: ${template.jobTitle ?? "unknown"}`);
  console.log(`[template] ${template.objectCount} objects, ${template.canvasWidth}×${template.canvasHeight}`);

  await ensureDevServer();
  const editorUrl = getEditorUrl();

  console.log("[browser] Launching Playwright…");
  const { context, page } = await openReviewBrowser();
  console.log(`[browser] Playwright launched — ${editorUrl}`);

  try {
    await waitForEditorReady(page, editorUrl);
    console.log("[editor] Page loaded, injecting template…");

    const importResult = await importTemplateInBrowser(
      page,
      template.json as Record<string, unknown>,
      template.objectCount,
    );

    console.log("");
    if (importResult.success) {
      console.log("✓ Template loaded successfully");
    } else {
      console.log("✗ Import failed");
      console.log(`  Error: ${importResult.error ?? "unknown"}`);
    }

    console.log("");
    console.log("── Review summary ──────────────────────────");
    console.log(`Editor URL:       ${editorUrl}`);
    console.log(`Template path:    ${template.path}`);
    console.log(`Candidate:        ${template.candidateName ?? "unknown"}`);
    console.log(`Role:             ${template.jobTitle ?? "unknown"}`);
    console.log(`Import duration:  ${importResult.importDurationMs}ms`);
    console.log(`Fabric objects:   ${importResult.objectCount}`);
    console.log(
      `Canvas size:      ${importResult.canvasWidth || template.canvasWidth}×${importResult.canvasHeight || template.canvasHeight}`,
    );
    console.log(`Result:           ${importResult.success ? "PASS" : "FAIL"}`);
    console.log("────────────────────────────────────────────");
    console.log("[browser] Left open for manual review. Press Ctrl+C to exit.");

    if (!importResult.success) {
      process.exitCode = 1;
    }

    // Keep process alive so browser stays open
    await new Promise<void>(() => {});
  } catch (err) {
    console.log("");
    console.log("✗ Import failed");
    console.log(`  Error: ${err instanceof Error ? err.message : String(err)}`);
    console.log("");
    console.log("── Review summary ──────────────────────────");
    console.log(`Editor URL:       ${editorUrl}`);
    console.log(`Template path:    ${template.path}`);
    console.log(`Candidate:        ${template.candidateName ?? "unknown"}`);
    console.log(`Role:             ${template.jobTitle ?? "unknown"}`);
    console.log(`Import duration:  —`);
    console.log(`Fabric objects:   —`);
    console.log(`Canvas size:      ${template.canvasWidth}×${template.canvasHeight}`);
    console.log(`Result:           FAIL`);
    console.log("────────────────────────────────────────────");
    process.exitCode = 1;
    await new Promise<void>(() => {});
  } finally {
    detachDevServer();
    void context;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
