import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const shell = readFileSync(
  path.join(__dirname, "../../components/editor/mobile/MobileEditorShell.tsx"),
  "utf8"
);

assert.match(
  shell,
  /\{ id: "templates".+\n\s+\{ id: "text".+\n\s+\{ id: "shapes".+\n\s+\{ id: "upload".+\n\s+\{ id: "tables".+\n\s+\{ id: "frames"/
);
assert.equal(/\{ id: "tables".+\n\s+\{ id: "frames".+\n\s+\{ id: "upload"/.test(shell), false);
assert.match(shell, /aria-label="Zoom"/);
assert.match(shell, /<Search /);
assert.match(shell, /type="range"/);
assert.match(shell, /MOBILE_ZOOM_PERCENT_MIN/);
assert.match(shell, /MOBILE_ZOOM_PERCENT_MAX/);
assert.match(shell, /editor\.setZoomPercent/);
assert.match(shell, /pointer-events-none|data-slb-canvas-control="true"/);
assert.equal(/aria-label="Zoom out"/.test(shell), false);
assert.equal(/aria-label="Zoom in"/.test(shell), false);
assert.equal(/aria-label="Fit page"/.test(shell), false);

const errorStart = shell.indexOf('className="absolute inset-0 z-30 flex items-center justify-center bg-[#ebecf0] p-6"');
const errorEnd = shell.indexOf("Back to Resume Hub", errorStart);
const errorCard = shell.slice(errorStart, errorEnd + "Back to Resume Hub".length);
assert.ok(errorStart > 0 && errorEnd > errorStart);
assert.match(errorCard, /data-slb-load-error="true"/);
assert.match(errorCard, /flex w-full flex-col gap-3/);
assert.match(errorCard, /Try again/);
assert.match(errorCard, /min-h-11 w-full/);
assert.match(errorCard, /We couldn't load this resume|editor\.loadError/);
assert.match(shell, /!editor\.loadError &&\s*editor\.pageFrames\.map/);
assert.match(shell, /!editor\.loadError \? \(/);
assert.match(shell, /href="\/resume"/);
assert.equal(shell.indexOf("editor.pageFrames.map") > shell.indexOf('data-slb-load-error="true"'), false);
const zoomGate = shell.indexOf("{!editor.loadError ? (");
const zoomLabel = shell.indexOf('aria-label="Zoom"');
assert.ok(zoomGate > 0 && zoomLabel > zoomGate);

console.log("mobileEditorChrome.verify: PASS");
