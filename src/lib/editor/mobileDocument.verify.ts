import assert from "node:assert/strict";
import {
  mergePreservedImages,
  mobileCommitDecision,
  mobileSavePayload,
  nextMobileRevision,
  pagesFromResumeRecord,
  resumeHasLocalOnlyImage,
  savedPagePixelSize,
} from "./mobileDocument";
import { buildPDFFromPages } from "./exportCanvas";
import {
  editorHrefForViewport,
  isResumeDocumentId,
  PHONE_EDITOR_MEDIA_QUERY,
  phoneEditorHrefFromDesktopPath,
  wantsPhoneEditor,
} from "./phoneEditorRoute";

const page = (label: string, extra: any[] = []) => ({
  objects: [
    {
      type: "rect",
      role: "pageBackground",
      left: 0,
      top: 0,
      width: 794,
      height: 1123,
      fill: "#ffffff",
    },
    { type: "textbox", text: label, left: 80, top: 90 },
    ...extra,
  ],
});

assert.equal(mobileCommitDecision(5, 5, "100", "100"), "write");
assert.equal(mobileCommitDecision(5, null), "write");
assert.equal(mobileCommitDecision(undefined, 0), "write");
assert.equal(mobileCommitDecision(6, 5, "200", "100"), "stale");
assert.equal(mobileCommitDecision(4, 5, "200", "100"), "stale");
assert.equal(mobileCommitDecision(5, 5, "200", "100"), "stale");
assert.equal(nextMobileRevision(10), 11);
assert.equal(nextMobileRevision(null), 1);

const photo = {
  type: "image",
  src: "/uploads/portrait.png",
  slbAssetId: "asset-1",
  slbSource: "local",
  slbId: "img-1",
  left: 40,
  top: 40,
};
const server = page("Experience", [photo]);
const edited = page("Experience — phone", [
  {
    type: "image",
    src: "blob:http://phone/temp",
    slbAssetId: "asset-1",
    slbSource: "local",
    slbId: "img-1",
    left: 40,
    top: 40,
  },
]);
const merged = mergePreservedImages(edited, server);
assert.equal(merged.objects[1].text, "Experience — phone");
assert.equal(merged.objects[2].src, "/uploads/portrait.png");
assert.equal(merged.objects[2].slbAssetId, "asset-1");
assert.notEqual(merged.objects[2].src, "/templates/t004.png");

const dropped = mergePreservedImages(page("Kept text"), server);
const restored = dropped.objects.find((obj: any) => obj.type === "image");
assert.equal(restored.src, "/uploads/portrait.png");
assert.equal(restored.slbAssetId, "asset-1");

const record = pagesFromResumeRecord({
  pagesData: [page("One"), page("Two")],
  canvasJson: page("Ignored"),
});
assert.equal(record.shape, "pages");
const saved = mobileSavePayload({
  shape: "pages",
  serverPages: record.pages,
  activeIndex: 0,
  activeJson: page("One edited"),
});
assert.equal(saved.pagesData?.length, 2);
assert.equal(saved.pagesData?.[0].objects[1].text, "One edited");
assert.equal(saved.pagesData?.[1].objects[1].text, "Two");
assert.equal(saved.canvasJson, undefined);

const single = pagesFromResumeRecord({ canvasJson: page("Solo") });
const singleSaved = mobileSavePayload({
  shape: single.shape,
  serverPages: single.pages,
  activeIndex: 0,
  activeJson: page("Solo edited"),
});
assert.equal(singleSaved.pagesData, undefined);
assert.equal(singleSaved.canvasJson.objects[1].text, "Solo edited");

assert.equal(savedPagePixelSize(page("A4")).w, 794);
assert.equal(resumeHasLocalOnlyImage(page("Local", [{ type: "image", src: "blob:http://x", slbAssetId: "a" }])), true);
assert.equal(resumeHasLocalOnlyImage(page("Remote", [photo])), false);

assert.equal(isResumeDocumentId("8d0b6d6e-4c3a-4f1e-9a2b-0c1d2e3f4a5b"), true);
assert.equal(isResumeDocumentId("legacy_doc-1"), true);
assert.equal(isResumeDocumentId("../secret"), false);
assert.equal(isResumeDocumentId(""), false);
assert.equal(
  editorHrefForViewport({ docId: "8d0b6d6e-4c3a-4f1e-9a2b-0c1d2e3f4a5b", templateId: "t001" }, true),
  "/editor/mobile/template/t001?doc=8d0b6d6e-4c3a-4f1e-9a2b-0c1d2e3f4a5b"
);
assert.equal(
  editorHrefForViewport({ docId: "8d0b6d6e-4c3a-4f1e-9a2b-0c1d2e3f4a5b" }, false),
  "/editor/doc/8d0b6d6e-4c3a-4f1e-9a2b-0c1d2e3f4a5b"
);
assert.equal(editorHrefForViewport({ templateId: "t004" }, false), "/editor/template/t004");
assert.equal(editorHrefForViewport({ blank: true }, true), "/editor/mobile/template/blank");
assert.equal(
  phoneEditorHrefFromDesktopPath("/editor/doc/8d0b6d6e-4c3a-4f1e-9a2b-0c1d2e3f4a5b"),
  "/editor/mobile/template/resume?doc=8d0b6d6e-4c3a-4f1e-9a2b-0c1d2e3f4a5b"
);
assert.equal(wantsPhoneEditor(() => false), false);
assert.equal(wantsPhoneEditor((query) => query === PHONE_EDITOR_MEDIA_QUERY), true);
assert.equal(PHONE_EDITOR_MEDIA_QUERY.includes("max-width: 767px"), true);
assert.equal(PHONE_EDITOR_MEDIA_QUERY.includes("pointer: coarse"), true);
assert.equal(PHONE_EDITOR_MEDIA_QUERY.includes("max-height: 520px"), true);

const singlePage = pagesFromResumeRecord({ pagesData: [page("Only")] });
const singlePageSaved = mobileSavePayload({
  shape: singlePage.shape,
  serverPages: singlePage.pages,
  activeIndex: 0,
  activeJson: page("Only edited"),
});
assert.equal(singlePageSaved.pagesData?.[0].objects[1].text, "Only edited");
assert.equal(singlePageSaved.canvasJson.objects[1].text, "Only edited");

const onePixelPng =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const pdfBlob = buildPDFFromPages([
  { dataUrl: onePixelPng, width: 794, height: 1123 },
  { dataUrl: onePixelPng, width: 816, height: 1056 },
]);

pdfBlob.arrayBuffer().then((buffer) => {
  const pdfText = Buffer.from(buffer).toString("latin1");
  assert.equal(pdfBlob.type, "application/pdf");
  assert.match(pdfText, /\/Type\s*\/Page\b/);
  assert.equal((pdfText.match(/\/Type\s*\/Page\b/g) || []).length, 2);
  console.log("mobileDocument.verify: PASS");
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
