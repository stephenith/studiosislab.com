import assert from "node:assert/strict";
import {
  incomingThumbnailMayReplace,
  thumbnailMatchesSavedRevision,
  prepareFirstPageThumbnailJson,
  selectFirstPageSnapshot,
  THUMBNAIL_OMITTED_IMAGE_SRC,
} from "./resumePreviewScene";

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
    { type: "textbox", text: label, left: 80, top: 90, width: 400, fontSize: 32, fontFamily: "Georgia" },
    ...extra,
  ],
});

const first = selectFirstPageSnapshot({
  pagesData: [page("PAGE ONE"), page("PAGE TWO")],
  canvasJson: page("ACTIVE PAGE TWO"),
});
assert.equal(first.objects[1].text, "PAGE ONE");

const source = page("Edited", [
    { type: "line", role: "grid", left: 0, top: 0 },
    { type: "rect", excludeFromExport: true, left: 10, top: 10, width: 20, height: 20 },
    { type: "rect", role: "image-crop-rect", left: 12, top: 12, width: 30, height: 30 },
    { type: "rect", data: { role: "image-crop-dim" }, left: 0, top: 0, width: 8, height: 8 },
    { type: "image", src: "blob:http://local/secret", left: 30, top: 30, width: 40, height: 40 },
    {
      type: "image",
      src: "blob:http://local/upload",
      slbAssetId: "asset-1",
      slbSource: "local",
      left: 40,
      top: 40,
      width: 48,
      height: 48,
    },
    { type: "image", src: "https://cdn.example/photo.png", left: 50, top: 50, width: 40, height: 40 },
  ]);
const sourceLeft = source.objects[1].left;
const prepared = prepareFirstPageThumbnailJson(source);
assert.equal(source.objects[1].left, sourceLeft);
assert.equal(prepared.objects.some((obj) => obj.role === "grid"), false);
assert.equal(prepared.objects.some((obj) => obj.role === "image-crop-rect"), false);
assert.equal(prepared.objects.some((obj) => obj?.data?.role === "image-crop-dim"), false);
assert.equal(prepared.objects.some((obj) => obj.excludeFromExport === true), false);
assert.equal(prepared.objects.find((obj) => obj.text === "Edited").text, "Edited");
const omitted = prepared.objects.find((obj) => obj.opacity === 0);
assert.equal(omitted.src, THUMBNAIL_OMITTED_IMAGE_SRC);
const keptLocal = prepared.objects.find((obj) => obj.slbAssetId === "asset-1");
assert.equal(keptLocal.src, "blob:http://local/upload");
assert.equal(keptLocal.opacity, undefined);
const remote = prepared.objects.find((obj) => String(obj.src || "").startsWith("https://"));
assert.equal(remote.crossOrigin, "anonymous");
assert.equal(prepared.empty, false);

const ordinary = prepareFirstPageThumbnailJson(
  {
    objects: [
      { type: "rect", role: "pageBackground", left: 0, top: 0, width: 794, height: 1123, fill: "#ffffff" },
      { type: "textbox", text: "Ordinary", left: 180, top: 90, width: 200, fontSize: 24 },
      { type: "rect", left: 40, top: 400, width: 2000, height: 80, fill: "#111111" },
    ],
  },
  "A4"
);
assert.equal(ordinary.width, 794);
assert.equal(ordinary.height, 1123);
assert.equal(ordinary.objects.find((obj) => obj.text === "Ordinary").left, 180);

const letter = prepareFirstPageThumbnailJson(
  {
    objects: [
      { type: "rect", role: "pageBackground", left: 0, top: 0, width: 816, height: 1056, fill: "#ffffff" },
      { type: "textbox", text: "Letter", left: 700, top: 40, width: 80, fontSize: 18 },
    ],
  },
  "Letter"
);
assert.equal(letter.width, 816);
assert.equal(letter.height, 1056);
assert.equal(letter.objects.find((obj) => obj.text === "Letter").left, 700);

const alreadyEditorSized = prepareFirstPageThumbnailJson(
  {
    objects: [
      {
        type: "rect",
        role: "pageBackground",
        left: 0,
        top: 0,
        width: 2480,
        height: 3508,
        scaleX: 794 / 2480,
        scaleY: 1123 / 3508,
        fill: "#ffffff",
      },
      { type: "textbox", text: "Saved", left: 80, top: 90, width: 200, fontSize: 24 },
    ],
  },
  "A4"
);
assert.ok(Math.abs(alreadyEditorSized.width - 794) < 1);
assert.equal(alreadyEditorSized.objects.find((obj) => obj.text === "Saved").left, 80);

const legacy = {
  objects: [
    { type: "rect", left: 0, top: 0, width: 2480, height: 3508, fill: "#ffffff" },
    { type: "textbox", text: "Wide", left: 240, top: 190, width: 1800, fontSize: 64 },
  ],
};
const legacyLeft = legacy.objects[1].left;
const legacyPrepared = prepareFirstPageThumbnailJson(legacy, "A4");
assert.equal(legacy.objects[1].left, legacyLeft);
assert.equal(legacyPrepared.objects[1].left, 240);
assert.equal(legacyPrepared.objects[1].scaleX, undefined);
assert.equal(legacyPrepared.width, 2480);
assert.equal(legacyPrepared.height, 3508);

const blank = prepareFirstPageThumbnailJson(
  { objects: [{ type: "rect", role: "pageBackground", left: 0, top: 0, width: 794, height: 1123 }] },
  "A4"
);
assert.equal(blank.empty, true);

assert.equal(incomingThumbnailMayReplace(undefined, 2), true);
assert.equal(incomingThumbnailMayReplace(2, 2), true);
assert.equal(incomingThumbnailMayReplace(2, 3), true);
assert.equal(incomingThumbnailMayReplace(5, 4), false);
assert.equal(thumbnailMatchesSavedRevision(undefined, 4), true);
assert.equal(thumbnailMatchesSavedRevision(4, 4), true);
assert.equal(thumbnailMatchesSavedRevision(2000, 1000), false);
assert.equal(thumbnailMatchesSavedRevision(1000, 2000), false);

let stored: { revision: number; value: string } | null = null;
function apply(revision: number, value: string): "written" | "stale" {
  if (!incomingThumbnailMayReplace(stored?.revision, revision)) return "stale";
  stored = { revision, value };
  return "written";
}

async function race() {
  const older = new Promise<string>((resolve) => {
    setTimeout(() => resolve(apply(1, "old-pixels")), 30);
  });
  assert.equal(apply(2, "new-pixels"), "written");
  assert.equal(await older, "stale");
  assert.equal(stored?.value, "new-pixels");
  assert.equal(stored?.revision, 2);
  console.log("resumePreviewScene.verify PASS");
}

void race();
