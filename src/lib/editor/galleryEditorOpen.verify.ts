import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "path";
import {
  beginGalleryEditorOpen,
  endGalleryEditorOpen,
  isGalleryEditorOpen,
  shouldIgnoreModifiedEditorClick,
  subscribeGalleryEditorOpen,
} from "./galleryEditorOpen";

endGalleryEditorOpen();
assert.equal(isGalleryEditorOpen(), false);

const seen: boolean[] = [];
const stop = subscribeGalleryEditorOpen((open) => seen.push(open));
beginGalleryEditorOpen();
assert.equal(isGalleryEditorOpen(), true);
beginGalleryEditorOpen();
assert.equal(isGalleryEditorOpen(), true);
endGalleryEditorOpen();
assert.equal(isGalleryEditorOpen(), false);
stop();
assert.deepEqual(seen, [false, true, false]);

assert.equal(shouldIgnoreModifiedEditorClick({ metaKey: true, button: 0 }), true);
assert.equal(shouldIgnoreModifiedEditorClick({ ctrlKey: true }), true);
assert.equal(shouldIgnoreModifiedEditorClick({ button: 1 }), true);
assert.equal(shouldIgnoreModifiedEditorClick({ button: 0 }), false);

const hub = readFileSync(path.join(__dirname, "../../app/resume/ResumeHubClient.tsx"), "utf8");
assert.match(hub, /beginGalleryEditorOpen/);
assert.match(hub, /setOpeningTemplateId\(templateId\)/);
assert.match(hub, /openTemplate\(/);
assert.doesNotMatch(hub, /Opening editor…/);

const link = readFileSync(path.join(__dirname, "../../components/resume/ResumeEditorLink.tsx"), "utf8");
assert.match(link, /beginGalleryEditorOpen/);
assert.match(link, /shouldIgnoreModifiedEditorClick/);
assert.match(link, /editorHrefForViewport/);

const overlay = readFileSync(
  path.join(__dirname, "../../components/resume/GalleryEditorOpenOverlay.tsx"),
  "utf8"
);
assert.match(overlay, /BrandLoadMark/);
assert.match(overlay, /data-slb-gallery-editor-open="true"/);
assert.match(overlay, /Opening resume/);
assert.doesNotMatch(overlay, /toDataURL\(/);

const providers = readFileSync(path.join(__dirname, "../../app/providers.tsx"), "utf8");
assert.match(providers, /GalleryEditorOpenOverlay/);

const desktop = readFileSync(path.join(__dirname, "../../components/editor/EditorShell.tsx"), "utf8");
assert.match(desktop, /endGalleryEditorOpen/);
assert.match(desktop, /editor\.isDocDataReady/);
assert.match(desktop, /editor\.loadError/);

const mobile = readFileSync(
  path.join(__dirname, "../../components/editor/mobile/MobileEditorShell.tsx"),
  "utf8"
);
assert.match(mobile, /endGalleryEditorOpen/);
assert.match(mobile, /editor\.loadError/);
assert.match(mobile, /editor\.loading/);

const authGate = readFileSync(path.join(__dirname, "../../components/editor/EditorAuthGate.tsx"), "utf8");
assert.match(authGate, /endGalleryEditorOpen/);
assert.match(authGate, /Redirecting/);

const desktopTemplate = readFileSync(
  path.join(__dirname, "../../app/editor/template/[templateId]/page.tsx"),
  "utf8"
);
assert.match(desktopTemplate, /ClearGalleryEditorOpen/);
assert.match(desktopTemplate, /Template not found/);

const mobileTemplate = readFileSync(
  path.join(__dirname, "../../app/editor/mobile/template/[templateId]/page.tsx"),
  "utf8"
);
assert.match(mobileTemplate, /ClearGalleryEditorOpen/);
assert.match(mobileTemplate, /Template not found/);

console.log("galleryEditorOpen.verify: PASS");
