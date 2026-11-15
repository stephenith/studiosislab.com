/**
 * Offline checks for e-sign phone chrome. No Firebase, mail, or PDFs.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import {
  ESIGN_PHONE_HEADER_BG,
  ESIGN_PHONE_MEDIA_QUERY,
  ESIGN_PHONE_STAGE_BG,
  ESIGN_SIGNATURE_METHODS,
  pinEsignShellToVisualViewport,
  wantsEsignPhoneLayout,
} from "./esignPhoneLayout";

function main() {
  assert.deepEqual([...ESIGN_SIGNATURE_METHODS], ["draw", "upload", "mobile"]);
  assert.equal(ESIGN_PHONE_HEADER_BG, "#1f1f28");
  assert.equal(ESIGN_PHONE_STAGE_BG, "#ebecf0");
  assert.match(ESIGN_PHONE_MEDIA_QUERY, /max-width: 767px/);

  const desktop = wantsEsignPhoneLayout({
    match: () => false,
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36",
    screenWidth: 1440,
    screenHeight: 900,
    maxTouchPoints: 0,
  });
  assert.equal(desktop, false);

  const ipad = wantsEsignPhoneLayout({
    match: (query) =>
      query === "(pointer: coarse)" || query === "(hover: none)",
    userAgent: "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)",
    screenWidth: 1024,
    screenHeight: 1366,
    maxTouchPoints: 5,
  });
  assert.equal(ipad, false);

  const iphone = wantsEsignPhoneLayout({
    match: () => false,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    screenWidth: 430,
    screenHeight: 932,
    maxTouchPoints: 5,
  });
  assert.equal(iphone, true);

  const android = wantsEsignPhoneLayout({
    match: () => false,
    userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Mobile",
    screenWidth: 412,
    screenHeight: 915,
    maxTouchPoints: 5,
  });
  assert.equal(android, true);

  const narrowDesktop = wantsEsignPhoneLayout({
    match: (query) => query.includes("max-width: 767px"),
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)",
    screenWidth: 1440,
    screenHeight: 900,
    maxTouchPoints: 0,
  });
  assert.equal(narrowDesktop, true);

  const root = {
    style: {} as Record<string, string>,
  } as unknown as HTMLElement;
  const pinned = pinEsignShellToVisualViewport(
    root,
    { height: 420, offsetTop: 40 },
    780
  );
  assert.equal(pinned.keyboardOpen, true);
  assert.equal(pinned.height, 420);
  assert.equal(pinned.top, 40);
  assert.equal(root.style.position, "fixed");
  assert.equal(root.style.top, "40px");
  assert.equal(root.style.height, "420px");

  const closed = pinEsignShellToVisualViewport(root, { height: 780, offsetTop: 0 }, 780);
  assert.equal(closed.keyboardOpen, false);

  const panel = readFileSync(
    path.join(__dirname, "../components/esign/SignatureToolsPanel.tsx"),
    "utf8"
  );
  assert.match(panel, /id="draw"/);
  assert.match(panel, /title="Draw signature"/);
  assert.match(panel, /id="upload"/);
  assert.match(panel, /title="Upload signature"/);
  assert.match(panel, /id="mobile"/);
  assert.match(panel, /title="Sign using your mobile"/);
  assert.equal(/Type signature/.test(panel), false);

  const viewer = readFileSync(
    path.join(__dirname, "../app/tools/esign/[documentId]/EsignViewerClient.tsx"),
    "utf8"
  );
  assert.match(viewer, /EsignPhoneDock/);
  assert.match(viewer, /!phoneLayout &&/);
  assert.match(viewer, /phoneZoomPercent/);
  assert.match(viewer, /touch-none/);
  assert.match(viewer, /gesturestart/);
  assert.match(viewer, /onPageSelect/);
  assert.match(viewer, /setPhoneSheet\(null\)/);
  assert.match(viewer, /bg-\[#1f1f28\]/);
  assert.match(viewer, /bg-\[#ebecf0\]/);
  assert.match(viewer, /searchParams\.get\("token"\)/);
  assert.match(viewer, /\/api\/esign\/export/);
  assert.match(viewer, /\/api\/esign\/invite/);
  assert.match(viewer, /\/api\/esign\/invite\/complete/);
  assert.match(viewer, /href="\/tools"/);
  assert.match(viewer, /bg-\[#000000\]/);

  const dock = readFileSync(
    path.join(__dirname, "../components/esign/EsignPhoneChrome.tsx"),
    "utf8"
  );
  assert.match(dock, /min-h-11/);
  assert.match(dock, /visualViewport/);

  console.log("esignPhoneLayout.verify.ts: pass");
}

main();
