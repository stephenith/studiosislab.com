/**
 * Invoice phone detection and shell pin.
 * Run: npx --yes tsx src/lib/invoice/phoneLayout.verify.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  INVOICE_PHONE_MEDIA_QUERY,
  pinInvoiceShellToVisualViewport,
  wantsInvoicePhoneLayout,
} from "./phoneLayout";

const desktopNarrow = wantsInvoicePhoneLayout({
  match: (query) => {
    if (query === "(max-width: 767px)") return true;
    if (query === "(pointer: coarse)") return false;
    if (query === "(hover: none)") return false;
    if (query === INVOICE_PHONE_MEDIA_QUERY) return false;
    return false;
  },
  userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
  screenWidth: 1920,
  screenHeight: 1080,
  maxTouchPoints: 0,
});
assert.equal(desktopNarrow, false);

const iphone = wantsInvoicePhoneLayout({
  match: () => false,
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  screenWidth: 430,
  screenHeight: 932,
  maxTouchPoints: 5,
});
assert.equal(iphone, true);

const android = wantsInvoicePhoneLayout({
  match: () => false,
  userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
  screenWidth: 412,
  screenHeight: 915,
  maxTouchPoints: 5,
});
assert.equal(android, true);

const style: Record<string, string> = {};
const root = { style } as unknown as HTMLElement;
const pinned = pinInvoiceShellToVisualViewport(root, { height: 400, offsetTop: 0 }, 800);
assert.equal(pinned.keyboardOpen, true);
assert.equal(pinned.height, 400);
assert.equal(style.position, "fixed");
assert.equal(style.height, "400px");

const editor = fs.readFileSync(path.join(process.cwd(), "src/app/tools/invoice/InvoiceEditor.tsx"), "utf8");
assert.ok(editor.includes("useInvoicePhoneLayout"));
assert.ok(editor.includes("previewOpen"));
assert.ok(editor.includes("openedLatest"));
assert.ok(editor.includes("InvoicePhoneShell"));
assert.equal(editor.includes("from \"@/components/editor/mobile"), false);
assert.equal(editor.includes("useMobileFabricEditor"), false);

const shell = fs.readFileSync(path.join(process.cwd(), "src/app/tools/invoice/InvoicePhoneShell.tsx"), "utf8");
assert.ok(shell.includes("New invoice"));
assert.ok(shell.includes("Preview"));
assert.ok(shell.includes("Download PDF"));
assert.ok(shell.includes("/tools/invoice/history"));
assert.ok(shell.includes("safe-area-inset-bottom"));
assert.ok(shell.includes("taxRows"));
assert.equal(shell.includes("SGST / CGST"), false);

console.log("phoneLayout.verify: pass");
