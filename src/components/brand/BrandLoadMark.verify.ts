import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const source = readFileSync(path.join(__dirname, "BrandLoadMark.tsx"), "utf8");
assert.match(source, /export const BRAND_LOAD_DELAY_MS = 200/);
assert.match(source, /aria-live="polite"/);
assert.match(source, /prefers-reduced-motion/);
assert.match(source, /HOME_LOGOS_LIGHT/);
assert.match(source, /border-t-violet-600/);

const mobile = readFileSync(
  path.join(__dirname, "../editor/mobile/MobileEditorShell.tsx"),
  "utf8"
);
assert.match(mobile, /BrandLoadMark/);
assert.match(mobile, /Try again/);
assert.match(mobile, /editor\.loadError/);

const desktop = readFileSync(path.join(__dirname, "../editor/EditorShell.tsx"), "utf8");
assert.match(desktop, /BrandLoadMark/);
assert.match(desktop, /editor\.loadError/);

const esign = readFileSync(
  path.join(__dirname, "../../app/tools/esign/[documentId]/EsignViewerClient.tsx"),
  "utf8"
);
assert.match(esign, /BrandLoadMark/);
assert.match(esign, /This e‑sign document could not be found/);

const invoice = readFileSync(path.join(__dirname, "../../app/tools/invoice/InvoiceEditor.tsx"), "utf8");
assert.match(invoice, /BrandLoadMark/);
assert.match(invoice, /StorageNotice/);

const galleryOverlay = readFileSync(
  path.join(__dirname, "../resume/GalleryEditorOpenOverlay.tsx"),
  "utf8"
);
assert.match(galleryOverlay, /BrandLoadMark/);
assert.match(galleryOverlay, /data-slb-gallery-editor-open/);
assert.doesNotMatch(galleryOverlay, /brand-load-arc/);

console.log("BrandLoadMark.verify: PASS");
