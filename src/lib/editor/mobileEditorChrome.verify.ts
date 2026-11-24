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

console.log("mobileEditorChrome.verify: PASS");
