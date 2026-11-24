import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { cloneJson, mergePreservedImages } from "./mobileDocument";
import { omitImageCropChromeFromSnapshot } from "./imageCrop";
import { buildPDFFromPages } from "./exportCanvas";
import { splitStackedMobilePages, stackMobilePages } from "./mobilePageStack";
import {
  assetIdOfImage,
  bindDecodedPhoneExportImages,
  fabricImageHasDecodedPixels,
  finalizePhoneExportImages,
  isMissingPhoneExportImage,
  isUnsafeFabricImageSrc,
  PHONE_EXPORT_IMAGE_WAIT_MS,
  PHONE_EXPORT_LOCAL_IMAGE_FAILED,
  PHONE_EXPORT_MISSING_PHOTO_NOTICE,
  phoneExportLocalImagesWithoutPixels,
  rasterPhoneExportPageRgba,
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
  assert.equal("crossOrigin" in exportPayload.objects[1], false);
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

  const networkImage = {
    type: "image",
    src: "https://cdn.example/photo.png",
    crossOrigin: "anonymous",
    width: 40,
    height: 40,
  };
  const networkPayload = { objects: [cloneJson(networkImage)] };
  await rehydratePhoneImageSources(networkPayload, async () => null);
  assert.equal(networkPayload.objects[0].crossOrigin, "anonymous");
  assert.equal(networkPayload.objects[0].src, "https://cdn.example/photo.png");

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
  assert.match(hook, /finalizePhoneExportImages\(canvasRef.current, canvas\)/);
  assert.match(hook, /PHONE_EXPORT_MISSING_PHOTO_NOTICE/);
  assert.match(hook, /PHONE_EXPORT_LOCAL_IMAGE_FAILED/);
  assert.match(hook, /preparePhoneSnapshot\(snapshot/);
  const bindIdx = hook.indexOf("finalizePhoneExportImages(canvasRef.current, canvas)");
  const exportIdx = hook.indexOf("exportToDataURL(canvas", bindIdx);
  assert.ok(bindIdx > 0 && exportIdx > bindIdx);

  const CRIMSON = [220, 20, 60] as const;
  const BLUE = [30, 80, 220] as const;
  const sourceW = 8;
  const sourceH = 4;
  const sourceRgba = new Uint8ClampedArray(sourceW * sourceH * 4);
  for (let y = 0; y < sourceH; y++) {
    for (let x = 0; x < sourceW; x++) {
      const color = x < sourceW / 2 ? CRIMSON : BLUE;
      const i = (y * sourceW + x) * 4;
      sourceRgba[i] = color[0];
      sourceRgba[i + 1] = color[1];
      sourceRgba[i + 2] = color[2];
      sourceRgba[i + 3] = 255;
    }
  }

  function liveDecoded(overrides: Record<string, unknown> = {}) {
    return {
      type: "image",
      id: "img-live",
      data: { id: "img-live", slbAssetId: "asset-1" },
      slbAssetId: "asset-1",
      cropX: 0,
      cropY: 0,
      width: sourceW,
      height: sourceH,
      left: 0,
      top: 0,
      scaleX: 1,
      scaleY: 1,
      _element: {
        naturalWidth: sourceW,
        naturalHeight: sourceH,
        width: sourceW,
        height: sourceH,
        rgba: sourceRgba,
        complete: true,
      },
      ...overrides,
    };
  }

  function emptyExport(overrides: Record<string, unknown> = {}) {
    return {
      type: "image",
      id: "img-live",
      data: { id: "img-live", slbAssetId: "asset-1" },
      slbAssetId: "asset-1",
      src: "blob:https://local/revoked",
      cropX: 0,
      cropY: 0,
      width: sourceW,
      height: sourceH,
      left: 0,
      top: 0,
      scaleX: 1,
      scaleY: 1,
      _element: { naturalWidth: 0, naturalHeight: 0, width: 0, height: 0, complete: true },
      ...overrides,
    };
  }

  function pixelAt(data: Uint8ClampedArray | Buffer, width: number, x: number, y: number) {
    const i = (y * width + x) * 4;
    return [data[i], data[i + 1], data[i + 2], data[i + 3]];
  }

  function colorClose(actual: number[], expected: readonly number[], tol = 8) {
    return (
      Math.abs(actual[0] - expected[0]) <= tol &&
      Math.abs(actual[1] - expected[1]) <= tol &&
      Math.abs(actual[2] - expected[2]) <= tol
    );
  }

  function pageHasColor(data: Uint8ClampedArray | Buffer, width: number, height: number, expected: readonly number[]) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (colorClose(pixelAt(data, width, x, y), expected)) return true;
      }
    }
    return false;
  }

  async function pngFromPage(images: any[], pageW: number, pageH: number) {
    const rgba = rasterPhoneExportPageRgba(images, pageW, pageH);
    const png = await sharp(Buffer.from(rgba), {
      raw: { width: pageW, height: pageH, channels: 4 },
    })
      .png()
      .toBuffer();
    const dataUrl = `data:image/png;base64,${png.toString("base64")}`;
    const decoded = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    return {
      dataUrl,
      width: pageW,
      height: pageH,
      rgba: decoded.data,
      decodedWidth: decoded.info.width,
      decodedHeight: decoded.info.height,
    };
  }

  const uncroppedExport = emptyExport();
  const uncroppedBind = bindDecodedPhoneExportImages([liveDecoded()], [uncroppedExport]);
  assert.equal(uncroppedBind.bound, 1);
  assert.equal(fabricImageHasDecodedPixels(uncroppedExport), true);
  assert.equal(uncroppedExport.cropX, 0);
  assert.equal(uncroppedExport.width, sourceW);
  assert.equal(uncroppedExport.slbAssetId, "asset-1");
  const uncropped = await pngFromPage([uncroppedExport], sourceW, sourceH);
  assert.equal(uncropped.decodedWidth, sourceW);
  assert.equal(uncropped.decodedHeight, sourceH);
  assert.equal(colorClose(pixelAt(uncropped.rgba, sourceW, 1, 1), CRIMSON), true);
  assert.equal(colorClose(pixelAt(uncropped.rgba, sourceW, 6, 1), BLUE), true);

  const croppedExport = emptyExport({ cropX: 4, cropY: 0, width: 4, height: 4, left: 0, top: 0 });
  bindDecodedPhoneExportImages([liveDecoded()], [croppedExport]);
  assert.equal(croppedExport.cropX, 4);
  assert.equal(croppedExport.width, 4);
  assert.equal(croppedExport.height, 4);
  const cropped = await pngFromPage([croppedExport], 4, 4);
  assert.equal(colorClose(pixelAt(cropped.rgba, 4, 1, 1), BLUE), true);
  assert.equal(pageHasColor(cropped.rgba, 4, 4, CRIMSON), false);

  const missingSaved = {
    type: "image",
    src: "blob:https://local/gone",
    slbAssetId: "missing-asset",
    cropX: 40,
    cropY: 16,
    width: 200,
    height: 180,
    left: 0,
    top: 0,
  };
  const missingClone = cloneJson(missingSaved);
  const missingHydration = await rehydratePhoneImageSources(missingClone, async () => null, () => "blob:placeholder");
  assert.deepEqual(missingHydration.missingAssetIds, ["missing-asset"]);
  const missingExport = {
    ...missingClone,
    _element: { naturalWidth: 1, naturalHeight: 1, width: 1, height: 1, complete: true, rgba: new Uint8ClampedArray([0, 0, 0, 0]) },
  };
  bindDecodedPhoneExportImages(
    [liveDecoded({ id: "other", data: { id: "other", slbAssetId: "other" }, slbAssetId: "other" })],
    [missingExport]
  );
  assert.equal(isMissingPhoneExportImage(missingExport), true);
  assert.equal(missingExport.cropX, 0);
  assert.equal(missingExport.width, 200);
  const missingRaster = await pngFromPage([missingExport], 12, 12);
  assert.equal(pageHasColor(missingRaster.rgba, 12, 12, CRIMSON), false);
  assert.equal(pageHasColor(missingRaster.rgba, 12, 12, BLUE), false);
  assert.equal(missingSaved.cropX, 40);
  assert.equal(missingSaved.slbAssetId, "missing-asset");
  assert.equal(missingSaved.src, "blob:https://local/gone");

  const verifiedPages = [
    { dataUrl: uncropped.dataUrl, width: uncropped.width, height: uncropped.height },
  ];
  const pdfFromVerifiedRaster = buildPDFFromPages(verifiedPages);
  assert.equal(pdfFromVerifiedRaster.type, "application/pdf");
  assert.ok(pdfFromVerifiedRaster.size > 0);
  assert.equal(verifiedPages[0].dataUrl, uncropped.dataUrl);

  const failedExport = emptyExport();
  await assert.rejects(
    () =>
      finalizePhoneExportImages(
        { getObjects: () => [] },
        { getObjects: () => [failedExport] },
        20
      ),
    (err: unknown) => err instanceof Error && err.message === PHONE_EXPORT_LOCAL_IMAGE_FAILED
  );
  assert.equal(phoneExportLocalImagesWithoutPixels([failedExport]).length, 1);

  const ambiguousLive = [
    liveDecoded({ id: "a", data: { id: "a", slbAssetId: "shared" }, slbAssetId: "shared" }),
    liveDecoded({
      id: "b",
      data: { id: "b", slbAssetId: "shared" },
      slbAssetId: "shared",
      _element: {
        naturalWidth: sourceW,
        naturalHeight: sourceH,
        width: sourceW,
        height: sourceH,
        rgba: sourceRgba,
        complete: true,
      },
    }),
  ];
  const ambiguousExport = emptyExport({
    id: "",
    data: { slbAssetId: "shared" },
    slbAssetId: "shared",
  });
  const ambiguous = bindDecodedPhoneExportImages(ambiguousLive, [ambiguousExport]);
  assert.equal(ambiguous.bound, 0);
  assert.equal(fabricImageHasDecodedPixels(ambiguousExport), false);

  const uniqueById = emptyExport({ id: "a", data: { id: "a", slbAssetId: "shared" }, slbAssetId: "shared" });
  assert.equal(bindDecodedPhoneExportImages(ambiguousLive, [uniqueById]).bound, 1);

  const rescuedSaved = {
    type: "image",
    src: "blob:https://local/revoked",
    slbAssetId: "asset-1",
    cropX: 4,
    cropY: 0,
    width: 4,
    height: 4,
    left: 0,
    top: 0,
  };
  const rescuedClone = cloneJson(rescuedSaved);
  await rehydratePhoneImageSources(rescuedClone, async () => null, () => "blob:placeholder");
  assert.equal(rescuedClone.cropX, 0);
  assert.equal(isMissingPhoneExportImage(rescuedClone), true);
  const rescuedExport = {
    ...rescuedClone,
    id: "img-live",
    data: { ...(rescuedClone as { data?: Record<string, unknown> }).data, id: "img-live" },
    _element: { naturalWidth: 1, naturalHeight: 1, width: 1, height: 1, complete: true },
  };
  const liveCropped = liveDecoded({ cropX: 4, cropY: 0, width: 4, height: 4 });
  assert.equal(bindDecodedPhoneExportImages([liveCropped], [rescuedExport]).bound, 1);
  assert.equal(isMissingPhoneExportImage(rescuedExport), false);
  assert.equal(rescuedExport.cropX, 4);
  assert.equal(rescuedExport.width, 4);
  assert.equal(rescuedExport.slbAssetId, "asset-1");
  const rescuedRaster = await pngFromPage([rescuedExport], 4, 4);
  assert.equal(colorClose(pixelAt(rescuedRaster.rgba, 4, 1, 1), BLUE), true);
  assert.equal(pageHasColor(rescuedRaster.rgba, 4, 4, CRIMSON), false);
  assert.equal(rescuedSaved.cropX, 4);
  assert.equal(rescuedSaved.src, "blob:https://local/revoked");

  const ambiguousMissing = emptyExport({
    id: "",
    data: { slbAssetId: "shared", slbAssetMissing: true },
    slbAssetId: "shared",
    cropX: 0,
  });
  assert.equal(bindDecodedPhoneExportImages(ambiguousLive, [ambiguousMissing]).bound, 0);
  assert.equal(isMissingPhoneExportImage(ambiguousMissing), true);

  assert.equal(new File(["x"], "photo.png", { type: "image/png" }) instanceof Blob, true);

  console.log("mobileImageHydration.verify: PASS");
}

void main();
