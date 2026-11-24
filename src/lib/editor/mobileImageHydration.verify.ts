import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { cloneJson, mergePreservedImages } from "./mobileDocument";
import { omitImageCropChromeFromSnapshot } from "./imageCrop";
import { buildPDFFromPages } from "./exportCanvas";
import { splitStackedMobilePages, stackMobilePages } from "./mobilePageStack";
import {
  assetIdOfImage,
  fabricImageHasDecodedPixels,
  isMissingPhoneExportImage,
  isUnsafeFabricImageSrc,
  PHONE_EXPORT_IMAGE_WAIT_MS,
  PHONE_EXPORT_MISSING_PHOTO_NOTICE,
  rehydratePhoneImageSources,
  waitForPhoneExportImages,
} from "./mobileImageHydration";

assert.equal(isUnsafeFabricImageSrc("blob:https://studiosislab.com/abc"), true);
assert.equal(isUnsafeFabricImageSrc(""), true);
assert.equal(isUnsafeFabricImageSrc("/templates/t004.png"), false);
assert.equal(assetIdOfImage({ slbAssetId: "asset-1" }), "asset-1");
assert.equal(assetIdOfImage({ data: { slbAssetId: "asset-2" } }), "asset-2");
assert.equal(PHONE_EXPORT_IMAGE_WAIT_MS > 0, true);
assert.match(PHONE_EXPORT_MISSING_PHOTO_NOTICE, /isn't available on this phone/);

const croppedPhoto = {
  type: "image",
  src: "blob:https://local/revoked",
  slbAssetId: "asset-1",
  cropX: 12,
  cropY: 4,
  width: 80,
  height: 60,
  left: 120,
  top: 80,
  scaleX: 0.5,
  scaleY: 0.5,
};

async function main() {
  const saved: { objects: any[] } = {
    objects: [
      {
        type: "rect",
        role: "pageBackground",
        left: 0,
        top: 0,
        width: 794,
        height: 1123,
      },
      cloneJson(croppedPhoto),
      { type: "textbox", text: "Nurse" },
    ],
  };
  const originalSaved = cloneJson(saved);
  const blobs = new Map<string, Blob>([["asset-1", new Blob(["photo"], { type: "image/jpeg" })]]);
  const urls: string[] = [];
  const exportPayload = cloneJson(saved);
  const restored = await rehydratePhoneImageSources(
    exportPayload,
    async (id) => blobs.get(id) || null,
    (blob) => {
      const url = `blob:hydrated-${blob.type}-${urls.length}`;
      urls.push(url);
      return url;
    }
  );
  assert.equal(restored.missingAssetIds.length, 0);
  assert.equal(exportPayload.objects[1].src, "blob:hydrated-image/jpeg-0");
  assert.equal(exportPayload.objects[1].slbAssetId, "asset-1");
  assert.equal(exportPayload.objects[1].cropX, 12);
  assert.equal(exportPayload.objects[1].cropY, 4);
  assert.equal(exportPayload.objects[1].width, 80);
  assert.equal(exportPayload.objects[1].height, 60);
  assert.equal(exportPayload.objects[1].left, 120);
  assert.equal(exportPayload.objects[1].top, 80);
  assert.equal(originalSaved.objects[1].src, "blob:https://local/revoked");
  assert.equal(originalSaved.objects[1].cropX, 12);

  const serialized = omitImageCropChromeFromSnapshot(cloneJson(exportPayload));
  assert.equal(serialized.objects[1].cropX, 12);
  const stacked = stackMobilePages([serialized]);
  const split = splitStackedMobilePages(stacked.objects, stacked.pageTops);
  assert.equal(split[0].objects.find((obj: any) => obj.type === "image")?.cropX, 12);
  assert.equal(split[0].objects.find((obj: any) => obj.type === "image")?.top, 80);
  const merged = mergePreservedImages(split[0], originalSaved);
  assert.equal(merged.objects.find((obj: any) => obj.type === "image")?.cropX, 12);
  assert.equal(merged.objects.find((obj: any) => obj.type === "image")?.src, "blob:https://local/revoked");

  const raster = {
    dataUrl:
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    width: 794,
    height: 1123,
  };
  const pdf = buildPDFFromPages([raster]);
  assert.equal(pdf.type, "application/pdf");
  assert.ok(pdf.size > 0);

  const missingOriginal: { objects: any[] } = {
    objects: [
      {
        type: "image",
        src: "blob:https://local/gone",
        slbAssetId: "missing-asset",
        cropX: 40,
        cropY: 16,
        width: 200,
        height: 180,
        left: 90,
        top: 70,
      },
      { type: "textbox", text: "Kept" },
    ],
  };
  const missingPage = cloneJson(missingOriginal);
  const missing = await rehydratePhoneImageSources(
    missingPage,
    async () => null,
    (blob) => `blob:placeholder-${blob.type}`
  );
  assert.deepEqual(missing.missingAssetIds, ["missing-asset"]);
  assert.equal(missingPage.objects[0].slbAssetId, "missing-asset");
  assert.equal(missingPage.objects[0].data.slbAssetMissing, true);
  assert.equal(missingPage.objects[0].cropX, 0);
  assert.equal(missingPage.objects[0].cropY, 0);
  assert.equal(missingPage.objects[0].width, 200);
  assert.equal(missingPage.objects[0].left, 90);
  assert.equal(missingPage.objects[1].text, "Kept");
  assert.equal(String(missingPage.objects[0].src).startsWith("blob:placeholder-"), true);
  assert.equal(missingOriginal.objects[0].cropX, 40);
  assert.equal(missingOriginal.objects[0].src, "blob:https://local/gone");
  assert.equal(isMissingPhoneExportImage(missingPage.objects[0]), true);

  const chrome = omitImageCropChromeFromSnapshot({
    objects: [
      { type: "image", slbAssetId: "asset-1", cropX: 12, cropY: 4 },
      { type: "rect", role: "image-crop-rect" },
    ],
  });
  assert.equal(chrome.objects.length, 1);
  assert.equal(chrome.objects[0].slbAssetId, "asset-1");
  assert.equal(chrome.objects[0].cropX, 12);

  assert.equal(fabricImageHasDecodedPixels({ _element: { naturalWidth: 800, naturalHeight: 600 } }), true);
  assert.equal(fabricImageHasDecodedPixels({ _element: { naturalWidth: 1, naturalHeight: 1 } }), false);

  const started = Date.now();
  await waitForPhoneExportImages({
    getObjects: () => [
      { type: "image", data: { slbAssetMissing: true }, _element: { naturalWidth: 1, naturalHeight: 1 } },
      { type: "image", _element: { naturalWidth: 640, naturalHeight: 480, complete: true } },
      { type: "textbox" },
    ],
  });
  assert.ok(Date.now() - started < 250);

  let loadHandler: (() => void) | undefined;
  const pending = {
    type: "image",
    _element: {
      complete: false,
      naturalWidth: 0,
      naturalHeight: 0,
      addEventListener: (name: string, handler: () => void) => {
        if (name === "load") loadHandler = handler;
      },
      removeEventListener: () => undefined,
    },
  };
  const pendingWait = waitForPhoneExportImages({ getObjects: () => [pending] }, 50);
  pending._element.naturalWidth = 400;
  pending._element.naturalHeight = 300;
  loadHandler?.();
  await pendingWait;

  const timedOut = waitForPhoneExportImages(
    {
      getObjects: () => [
        {
          type: "image",
          _element: {
            complete: false,
            naturalWidth: 0,
            addEventListener: () => undefined,
            removeEventListener: () => undefined,
          },
        },
      ],
    },
    20
  );
  const timeoutStarted = Date.now();
  await timedOut;
  assert.ok(Date.now() - timeoutStarted < 200);

  const hook = readFileSync(
    path.join(__dirname, "../../components/editor/mobile/useMobileFabricEditor.ts"),
    "utf8"
  );
  assert.match(hook, /cloneJson\(snapshot/);
  assert.match(hook, /waitForPhoneExportImages\(canvas\)/);
  assert.match(hook, /PHONE_EXPORT_MISSING_PHOTO_NOTICE/);
  assert.match(hook, /preparePhoneSnapshot\(snapshot/);
  const waitIdx = hook.indexOf("waitForPhoneExportImages(canvas)");
  const exportIdx = hook.indexOf("exportToDataURL(canvas", waitIdx);
  assert.ok(waitIdx > 0 && exportIdx > waitIdx);

  console.log("mobileImageHydration.verify: PASS");
}

void main();
