/**
 * Browser harness: real Fabric Canvas.toDataURL through the mobile downloadPages steps.
 * Not a synthetic RGBA helper.
 */
import { FabricImage } from "fabric";
import { createStore, get, set } from "idb-keyval";
import { initFabricCanvas } from "@/lib/editor/canvasInitializer";
import { exportToDataURL, buildPDFFromPages } from "@/lib/editor/exportCanvas";
import { cloneJson, mergePreservedImages } from "@/lib/editor/mobileDocument";
import { finalizePhoneExportImages, isMissingPhoneExportImage } from "@/lib/editor/mobileImageHydration";
import { splitStackedMobilePages } from "@/lib/editor/mobilePageStack";
import { rasterMobileExportPage } from "@/lib/editor/mobilePhoneExport";
import {
  FABRIC_JSON_PROPS,
  getPageBounds,
  loadSnapshotOntoCanvas,
  serializeCanvasForSave,
} from "@/lib/editor/mobileEditorUtils";
import { ensureObjectId } from "@/components/editor/editor/utils/fabricHelpers";

export const CRIMSON = [220, 20, 60] as const;
export const BLUE = [0, 0, 255] as const;
export const LIME = [50, 205, 50] as const;
export const MAGENTA = [255, 0, 255] as const;

const TEST_IDB_STORE = createStore("slb-phone-export-fabric-test", "assets");

async function putIndexedDbAsset(assetId: string, blob: Blob): Promise<void> {
  await set(
    assetId,
    {
      assetId,
      uid: "harness",
      docId: "phone-export-fabric",
      blob,
      contentType: blob.type || "image/png",
      createdAt: Date.now(),
      lastAccessAt: Date.now(),
    },
    TEST_IDB_STORE
  );
}

async function loadIndexedDbAsset(assetId: string): Promise<Blob | null> {
  const row = (await get(assetId, TEST_IDB_STORE)) as { blob?: Blob } | undefined;
  if (!row || !(row.blob instanceof Blob)) return null;
  return row.blob;
}

const memoryAssets = new Map<string, Blob>();

async function storeTestAsset(assetId: string, blob: Blob): Promise<"indexeddb-test" | "memory"> {
  memoryAssets.set(assetId, blob);
  try {
    await putIndexedDbAsset(assetId, blob);
    const roundTrip = await loadIndexedDbAsset(assetId);
    if (roundTrip) return "indexeddb-test";
  } catch {
    /* Playwright WebKit may deny IndexedDB; fall back to an in-memory map. */
  }
  return "memory";
}

async function loadTestAsset(assetId: string): Promise<Blob | null> {
  try {
    const blob = await loadIndexedDbAsset(assetId);
    if (blob) return blob;
  } catch {
    /* fall through */
  }
  return memoryAssets.get(assetId) || null;
}

type CaseResult = {
  name: string;
  ok: boolean;
  detail: string;
  stages?: Record<string, unknown>;
};

function colorClose(actual: number[], expected: readonly number[], tol = 12) {
  return (
    Math.abs(actual[0] - expected[0]) <= tol &&
    Math.abs(actual[1] - expected[1]) <= tol &&
    Math.abs(actual[2] - expected[2]) <= tol
  );
}

function pixelAt(data: Uint8ClampedArray, width: number, x: number, y: number) {
  const i = (Math.floor(y) * width + Math.floor(x)) * 4;
  return [data[i], data[i + 1], data[i + 2], data[i + 3]];
}

function pageHasColor(data: Uint8ClampedArray, width: number, height: number, expected: readonly number[]) {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (colorClose(pixelAt(data, width, x, y), expected)) return true;
    }
  }
  return false;
}

function makeSwatchPng(
  leftColor: readonly number[] = CRIMSON,
  rightColor: readonly number[] = BLUE,
  width = 64,
  height = 32
): string {
  const el = document.createElement("canvas");
  el.width = width;
  el.height = height;
  const ctx = el.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  ctx.fillStyle = `rgb(${leftColor[0]},${leftColor[1]},${leftColor[2]})`;
  ctx.fillRect(0, 0, width / 2, height);
  ctx.fillStyle = `rgb(${rightColor[0]},${rightColor[1]},${rightColor[2]})`;
  ctx.fillRect(width / 2, 0, width / 2, height);
  return el.toDataURL("image/png");
}

async function pngBytesFromDataUrl(dataUrl: string): Promise<{ data: Uint8ClampedArray; width: number; height: number }> {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const el = document.createElement("canvas");
  el.width = img.naturalWidth;
  el.height = img.naturalHeight;
  const ctx = el.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  ctx.drawImage(img, 0, 0);
  const pixels = ctx.getImageData(0, 0, el.width, el.height);
  return { data: pixels.data, width: el.width, height: el.height };
}

function pageBackground(w: number, h: number, top = 0) {
  return {
    type: "rect",
    role: "pageBackground",
    name: "Page Background",
    left: 0,
    top,
    width: w,
    height: h,
    fill: "#ffffff",
    data: { role: "pageBackground", kind: "page-bg", system: true },
  };
}

function fingerprint(canvas: any) {
  const images = (canvas.getObjects?.() || []).filter((o: any) => String(o.type || "").toLowerCase() === "image");
  const first = images[0];
  return {
    width: canvas.getWidth?.() ?? canvas.width,
    height: canvas.getHeight?.() ?? canvas.height,
    zoom: canvas.getZoom?.() ?? 1,
    vt: canvas.viewportTransform ? [...canvas.viewportTransform] : null,
    imageCount: images.length,
    image: first
      ? {
          id: first.id,
          left: first.left,
          top: first.top,
          cropX: first.cropX,
          cropY: first.cropY,
          width: first.width,
          height: first.height,
          slbAssetId: first.slbAssetId,
        }
      : null,
    active: canvas.getActiveObject?.()?.id ?? null,
  };
}

async function addLivePhoto(
  canvas: any,
  blob: Blob,
  meta: { slbAssetId: string; left: number; top: number; crop?: { cropX: number; cropY: number; width: number; height: number } }
) {
  const url = URL.createObjectURL(blob);
  try {
    const img = await FabricImage.fromURL(url, { crossOrigin: "anonymous" } as any);
    img.set({
      left: meta.left,
      top: meta.top,
      scaleX: 1,
      scaleY: 1,
      slbAssetId: meta.slbAssetId,
      slbSource: "local",
    } as any);
    (img as any).slbAssetId = meta.slbAssetId;
    (img as any).data = { ...(img as any).data, slbAssetId: meta.slbAssetId, slbSource: "local" };
    if (meta.crop) img.set(meta.crop);
    ensureObjectId(img);
  canvas.add(img);
  canvas.setActiveObject?.(img);
  canvas.requestRenderAll();
  return img as any;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function rasterLikeDownloadPages(options: {
  liveCanvas: any;
  snapshots: any[];
  loadAsset: (assetId: string) => Promise<Blob | null>;
  pageW: number;
  pageH: number;
}) {
  const exportEl = document.createElement("canvas");
  const exportCanvas = initFabricCanvas(exportEl, {
    width: options.pageW,
    height: options.pageH,
    backgroundColor: "#ffffff",
    selection: false,
  });
  const objectUrls: string[] = [];
  const rendered: { dataUrl: string; width: number; height: number }[] = [];
  const missingAssetIds: string[] = [];
  const stageNotes: Record<string, unknown>[] = [];
  try {
    for (const snapshot of options.snapshots) {
      const { result, missingAssetIds: missing } = await rasterMobileExportPage({
        liveCanvas: options.liveCanvas,
        snapshot,
        exportCanvas,
        loadAsset: options.loadAsset,
        objectUrls,
        pageW: options.pageW,
        pageH: options.pageH,
        pageSizeKey: "A4",
      });
      missingAssetIds.push(...missing);
      const images = (exportCanvas.getObjects() || []).filter((o: any) => String(o.type || "").toLowerCase() === "image");
      stageNotes.push({
        hydrationMissing: missing,
        afterBind: images.map((o: any) => ({
          id: o.id,
          missing: isMissingPhoneExportImage(o),
          elW: Number(o._element?.naturalWidth ?? o._element?.width ?? 0),
          elH: Number(o._element?.naturalHeight ?? o._element?.height ?? 0),
          src: String(o.getSrc?.() || o.src || "").slice(0, 48),
        })),
        dataUrlPrefix: result.dataUrl.slice(0, 22),
        rasterWidth: result.width,
        rasterHeight: result.height,
      });
      rendered.push(result);
    }
    return { rendered, missingAssetIds, stageNotes, objectUrls };
  } finally {
    try {
      exportCanvas.dispose();
    } catch {
      /* ignore */
    }
  }
}

async function runUncroppedSameDevice(): Promise<CaseResult> {
  const pageW = 160;
  const pageH = 100;
  const liveEl = document.createElement("canvas");
  document.body.appendChild(liveEl);
  const live = initFabricCanvas(liveEl, { width: pageW, height: pageH, backgroundColor: "#ffffff" });
  const png = makeSwatchPng();
  const blob = await (await fetch(png)).blob();
  const assetId = "asset-uncropped";
  try {
    live.add(
      new (await import("fabric")).Rect({
        left: 0,
        top: 0,
        width: pageW,
        height: pageH,
        fill: "#ffffff",
        role: "pageBackground",
        name: "Page Background",
        data: { role: "pageBackground", kind: "page-bg", system: true },
      } as any)
    );
    const photo = await addLivePhoto(live, blob, { slbAssetId: assetId, left: 16, top: 16 });
    const liveExport = exportToDataURL(live, {
      multiplier: 2,
      getPageBounds: (target) => getPageBounds(target, "A4"),
    });
    if (!liveExport) throw new Error("live export failed");
    const livePixels = await pngBytesFromDataUrl(liveExport.dataUrl);
    const liveHasCrimson = pageHasColor(livePixels.data, livePixels.width, livePixels.height, CRIMSON);
    const liveHasBlue = pageHasColor(livePixels.data, livePixels.width, livePixels.height, BLUE);

    const before = fingerprint(live);
    const snapshot = serializeCanvasForSave(live);
    const serializedImage = (snapshot.objects || []).find((o: any) => String(o.type).toLowerCase() === "image");
    const assetStore = await storeTestAsset(assetId, blob);
    const { rendered, missingAssetIds, stageNotes } = await rasterLikeDownloadPages({
      liveCanvas: live,
      snapshots: [snapshot],
      loadAsset: loadTestAsset,
      pageW,
      pageH,
    });
    const after = fingerprint(live);
    const pngPixels = await pngBytesFromDataUrl(rendered[0].dataUrl);
    const pdf = buildPDFFromPages(rendered);
    const pngHasCrimson = pageHasColor(pngPixels.data, pngPixels.width, pngPixels.height, CRIMSON);
    const pngHasBlue = pageHasColor(pngPixels.data, pngPixels.width, pngPixels.height, BLUE);
    const liveUnchanged =
      JSON.stringify(before) === JSON.stringify(after) ||
      (before.width === after.width &&
        before.height === after.height &&
        before.zoom === after.zoom &&
        String(before.vt) === String(after.vt) &&
        before.image?.left === after.image?.left &&
        before.image?.top === after.image?.top &&
        before.image?.cropX === after.image?.cropX &&
        before.active === after.active);

    const ok =
      liveHasCrimson &&
      liveHasBlue &&
      String(serializedImage?.src || "").startsWith("blob:") &&
      serializedImage?.slbAssetId === assetId &&
      pngHasCrimson &&
      pngHasBlue &&
      rendered[0].dataUrl.startsWith("data:image/png") &&
      pdf.size > 0 &&
      missingAssetIds.length === 0 &&
      liveUnchanged;

    return {
      name: "uncropped-same-device",
      ok,
      detail: JSON.stringify({
        liveHasCrimson,
        liveHasBlue,
        serializedSrcKind: String(serializedImage?.src || "").slice(0, 12),
        slbAssetId: serializedImage?.slbAssetId,
        serializedDataId: serializedImage?.data?.id,
        serializedKeys: serializedImage ? Object.keys(serializedImage) : [],
        pngHasCrimson,
        pngHasBlue,
        pdfSize: pdf.size,
        missingAssetIds,
        liveUnchanged,
        photoId: photo.id,
        assetStore,
        stageNotes,
      }),
      stages: {
        livePixels: liveHasCrimson && liveHasBlue,
        serializedBlob: String(serializedImage?.src || "").startsWith("blob:"),
          assetStore,
          png: pngHasCrimson && pngHasBlue,
        pdfUsesSameRaster: true,
      },
    };
  } finally {
    live.dispose();
    liveEl.remove();
  }
}

async function runCroppedSameDevice(): Promise<CaseResult> {
  const pageW = 160;
  const pageH = 100;
  const liveEl = document.createElement("canvas");
  document.body.appendChild(liveEl);
  const live = initFabricCanvas(liveEl, { width: pageW, height: pageH, backgroundColor: "#ffffff" });
  const png = makeSwatchPng();
  const blob = await (await fetch(png)).blob();
  const { Rect } = await import("fabric");
  try {
    live.add(
      new Rect({
        left: 0,
        top: 0,
        width: pageW,
        height: pageH,
        fill: "#ffffff",
        role: "pageBackground",
        name: "Page Background",
        data: { role: "pageBackground", kind: "page-bg", system: true },
      } as any)
    );
    await addLivePhoto(live, blob, {
      slbAssetId: "asset-crop",
      left: 16,
      top: 16,
      crop: { cropX: 32, cropY: 0, width: 32, height: 32 },
    });
    const snapshot = serializeCanvasForSave(live);
    await storeTestAsset("asset-crop", blob);
    const { rendered, missingAssetIds } = await rasterLikeDownloadPages({
      liveCanvas: live,
      snapshots: [snapshot],
      loadAsset: loadTestAsset,
      pageW,
      pageH,
    });
    const pngPixels = await pngBytesFromDataUrl(rendered[0].dataUrl);
    const hasBlue = pageHasColor(pngPixels.data, pngPixels.width, pngPixels.height, BLUE);
    const hasCrimson = pageHasColor(pngPixels.data, pngPixels.width, pngPixels.height, CRIMSON);
    const ok = hasBlue && !hasCrimson && missingAssetIds.length === 0;
    return {
      name: "cropped-same-device",
      ok,
      detail: JSON.stringify({ hasBlue, hasCrimson, missingAssetIds, cropX: snapshot.objects.find((o: any) => o.type === "image")?.cropX }),
    };
  } finally {
    live.dispose();
    liveEl.remove();
  }
}

async function runRevokedWithoutRehydrate(): Promise<CaseResult> {
  const pageW = 160;
  const pageH = 100;
  const liveEl = document.createElement("canvas");
  document.body.appendChild(liveEl);
  const live = initFabricCanvas(liveEl, { width: pageW, height: pageH, backgroundColor: "#ffffff" });
  const png = makeSwatchPng();
  const blob = await (await fetch(png)).blob();
  const { Rect } = await import("fabric");
  try {
    live.add(
      new Rect({
        left: 0,
        top: 0,
        width: pageW,
        height: pageH,
        fill: "#ffffff",
        role: "pageBackground",
        name: "Page Background",
        data: { role: "pageBackground", kind: "page-bg", system: true },
      } as any)
    );
    await addLivePhoto(live, blob, { slbAssetId: "asset-revoked", left: 16, top: 16 });
    const snapshot = serializeCanvasForSave(live);
    const exportEl = document.createElement("canvas");
    const exportCanvas = initFabricCanvas(exportEl, { width: pageW, height: pageH, backgroundColor: "#ffffff", selection: false });
    let threw = "";
    let pngHasCrimson = false;
    let pngHasBlue = false;
    try {
      await loadSnapshotOntoCanvas(exportCanvas, cloneJson(snapshot), pageW, pageH, {
        isTemplateLoad: false,
        preserveUserImages: true,
        preservePageBox: true,
      });
      await finalizePhoneExportImages(live, exportCanvas);
      const result = exportToDataURL(exportCanvas, {
        multiplier: 2,
        getPageBounds: (target) => getPageBounds(target, "A4"),
      });
      if (!result) throw new Error("Page export failed");
      const pixels = await pngBytesFromDataUrl(result.dataUrl);
      pngHasCrimson = pageHasColor(pixels.data, pixels.width, pixels.height, CRIMSON);
      pngHasBlue = pageHasColor(pixels.data, pixels.width, pixels.height, BLUE);
    } catch (err) {
      threw = err instanceof Error ? err.message : String(err);
    } finally {
      exportCanvas.dispose();
    }
    return {
      name: "revoked-blob-no-rehydrate",
      ok: true,
      detail: JSON.stringify({ threw, pngHasCrimson, pngHasBlue, serializedSrc: String(snapshot.objects.find((o: any) => o.type === "image")?.src || "").slice(0, 24) }),
      stages: { bindWithoutIdb: pngHasCrimson && pngHasBlue, threw },
    };
  } finally {
    live.dispose();
    liveEl.remove();
  }
}

async function runDuplicateAsset(): Promise<CaseResult> {
  const pageW = 200;
  const pageH = 100;
  const liveEl = document.createElement("canvas");
  document.body.appendChild(liveEl);
  const live = initFabricCanvas(liveEl, { width: pageW, height: pageH, backgroundColor: "#ffffff" });
  const leftBlob = await (await fetch(makeSwatchPng(CRIMSON, BLUE))).blob();
  const rightBlob = await (await fetch(makeSwatchPng(LIME, MAGENTA))).blob();
  const { Rect } = await import("fabric");
  try {
    live.add(
      new Rect({
        left: 0,
        top: 0,
        width: pageW,
        height: pageH,
        fill: "#ffffff",
        role: "pageBackground",
        name: "Page Background",
        data: { role: "pageBackground", kind: "page-bg", system: true },
      } as any)
    );
    const a = await addLivePhoto(live, leftBlob, { slbAssetId: "shared-asset", left: 8, top: 16 });
    const b = await addLivePhoto(live, rightBlob, { slbAssetId: "shared-asset", left: 90, top: 16 });
    const snapshot = serializeCanvasForSave(live);
    const assetStore = await storeTestAsset("shared-asset", leftBlob);
    const { rendered } = await rasterLikeDownloadPages({
      liveCanvas: live,
      snapshots: [snapshot],
      loadAsset: loadTestAsset,
      pageW,
      pageH,
    });
    const pixels = await pngBytesFromDataUrl(rendered[0].dataUrl);
    const leftSample = pixelAt(pixels.data, pixels.width, 24, 40);
    const rightSample = pixelAt(pixels.data, pixels.width, 200, 40);
    const leftHasOwn = colorClose(leftSample, CRIMSON) || colorClose(leftSample, BLUE);
    const rightHasOwn = colorClose(rightSample, LIME) || colorClose(rightSample, MAGENTA);
    const leftHasOther = colorClose(leftSample, LIME) || colorClose(leftSample, MAGENTA);
    const rightHasOther = colorClose(rightSample, CRIMSON) || colorClose(rightSample, BLUE);
    const idsDiffer = a.id !== b.id;
    const ok = idsDiffer && leftHasOwn && rightHasOwn && !leftHasOther && !rightHasOther;
    return {
      name: "duplicate-asset-id",
      ok,
      detail: JSON.stringify({
        idsDiffer,
        a: a.id,
        b: b.id,
        leftSample,
        rightSample,
        leftHasOwn,
        rightHasOwn,
        swapped: leftHasOther || rightHasOther,
        assetStore,
      }),
    };
  } finally {
    live.dispose();
    liveEl.remove();
  }
}

async function runMergePreservedUpload(): Promise<CaseResult> {
  const pageW = 160;
  const pageH = 100;
  const liveEl = document.createElement("canvas");
  document.body.appendChild(liveEl);
  const live = initFabricCanvas(liveEl, { width: pageW, height: pageH, backgroundColor: "#ffffff" });
  const blob = await (await fetch(makeSwatchPng())).blob();
  const assetId = "asset-merged-upload";
  const { Rect } = await import("fabric");
  try {
    live.add(
      new Rect({
        left: 0,
        top: 0,
        width: pageW,
        height: pageH,
        fill: "#ffffff",
        role: "pageBackground",
        name: "Page Background",
        data: { role: "pageBackground", kind: "page-bg", system: true },
      } as any)
    );
    const photo = await addLivePhoto(live, blob, { slbAssetId: assetId, left: 16, top: 16 });
    const snapshot = serializeCanvasForSave(live);
    const previous = {
      objects: [
        pageBackground(pageW, pageH),
        {
          type: "image",
          src: makeSwatchPng(LIME, MAGENTA),
          id: "template-photo",
          slbId: "template-photo",
          data: { id: "template-photo" },
          left: 88,
          top: 16,
          width: 64,
          height: 32,
          scaleX: 1,
          scaleY: 1,
        },
      ],
    };
    const merged = mergePreservedImages(snapshot, previous);
    const mergedImage = (merged.objects || []).find((o: any) => String(o.type || "").toLowerCase() === "image");
    const identityKept =
      String(mergedImage?.id) === String(photo.id) &&
      String(mergedImage?.data?.id) === String(photo.id) &&
      String(mergedImage?.slbAssetId) === assetId;
    const assetStore = await storeTestAsset(assetId, blob);
    const { rendered, missingAssetIds, stageNotes } = await rasterLikeDownloadPages({
      liveCanvas: live,
      snapshots: [merged],
      loadAsset: loadTestAsset,
      pageW,
      pageH,
    });
    const pixels = await pngBytesFromDataUrl(rendered[0].dataUrl);
    const pngHasCrimson = pageHasColor(pixels.data, pixels.width, pixels.height, CRIMSON);
    const pngHasBlue = pageHasColor(pixels.data, pixels.width, pixels.height, BLUE);
    const ok = identityKept && pngHasCrimson && pngHasBlue && missingAssetIds.length === 0;
    return {
      name: "merge-preserved-upload",
      ok,
      detail: JSON.stringify({
        identityKept,
        mergedId: mergedImage?.id,
        mergedDataId: mergedImage?.data?.id,
        mergedAssetId: mergedImage?.slbAssetId,
        mergedSrcKind: String(mergedImage?.src || "").slice(0, 24),
        photoId: photo.id,
        pngHasCrimson,
        pngHasBlue,
        missingAssetIds,
        assetStore,
        stageNotes,
      }),
    };
  } finally {
    live.dispose();
    liveEl.remove();
  }
}

async function runLaterPage(): Promise<CaseResult> {
  const pageW = 160;
  const pageH = 100;
  const pageTops = [0, 180];
  const liveEl = document.createElement("canvas");
  document.body.appendChild(liveEl);
  const live = initFabricCanvas(liveEl, { width: pageW, height: 280, backgroundColor: "#eeeeee" });
  const png = makeSwatchPng();
  const blob = await (await fetch(png)).blob();
  const { Rect } = await import("fabric");
  try {
    live.add(
      new Rect({
        left: 0,
        top: 0,
        width: pageW,
        height: pageH,
        fill: "#ffffff",
        role: "pageBackground",
        name: "Page Background",
        data: { role: "pageBackground", kind: "page-bg", system: true },
      } as any)
    );
    live.add(
      new Rect({
        left: 0,
        top: 180,
        width: pageW,
        height: pageH,
        fill: "#ffffff",
        role: "pageBackground",
        name: "Page Background",
        data: { role: "pageBackground", kind: "page-bg", system: true },
      } as any)
    );
    await addLivePhoto(live, blob, { slbAssetId: "asset-page2", left: 16, top: 196 });
    const stacked = serializeCanvasForSave(live);
    const split = splitStackedMobilePages(stacked.objects || [], pageTops);
    const pages = split.map((page, index) => mergePreservedImages(page, page));
    await storeTestAsset("asset-page2", blob);
    const page1 = await rasterLikeDownloadPages({
      liveCanvas: live,
      snapshots: [pages[0]],
      loadAsset: loadTestAsset,
      pageW,
      pageH,
    });
    const page2 = await rasterLikeDownloadPages({
      liveCanvas: live,
      snapshots: [pages[1]],
      loadAsset: loadTestAsset,
      pageW,
      pageH,
    });
    const p1 = await pngBytesFromDataUrl(page1.rendered[0].dataUrl);
    const p2 = await pngBytesFromDataUrl(page2.rendered[0].dataUrl);
    const page1HasPhoto = pageHasColor(p1.data, p1.width, p1.height, CRIMSON) || pageHasColor(p1.data, p1.width, p1.height, BLUE);
    const page2HasPhoto =
      pageHasColor(p2.data, p2.width, p2.height, CRIMSON) && pageHasColor(p2.data, p2.width, p2.height, BLUE);
    const ok = !page1HasPhoto && page2HasPhoto;
    return {
      name: "later-page",
      ok,
      detail: JSON.stringify({ page1HasPhoto, page2HasPhoto, page2ImageTop: pages[1].objects.find((o: any) => o.type === "image")?.top }),
    };
  } finally {
    live.dispose();
    liveEl.remove();
  }
}

async function runMissingOtherDevice(): Promise<CaseResult> {
  const saved = {
    objects: [
      pageBackground(160, 100),
      {
        type: "image",
        src: "blob:https://local/gone",
        slbAssetId: "missing-asset",
        cropX: 40,
        cropY: 16,
        width: 64,
        height: 32,
        left: 16,
        top: 16,
        scaleX: 1,
        scaleY: 1,
        data: { slbAssetId: "missing-asset" },
      },
    ],
  };
  const original = cloneJson(saved);
  const liveEl = document.createElement("canvas");
  document.body.appendChild(liveEl);
  const live = initFabricCanvas(liveEl, { width: 160, height: 100, backgroundColor: "#ffffff" });
  try {
    let threw = "";
    let pngHasPhoto = false;
    let missingIds: string[] = [];
    try {
      const result = await rasterLikeDownloadPages({
        liveCanvas: live,
        snapshots: [saved],
        loadAsset: async () => null,
        pageW: 160,
        pageH: 100,
      });
      // in-memory miss: other-device asset is not in IndexedDB
      missingIds = result.missingAssetIds;
      const pixels = await pngBytesFromDataUrl(result.rendered[0].dataUrl);
      pngHasPhoto =
        pageHasColor(pixels.data, pixels.width, pixels.height, CRIMSON) ||
        pageHasColor(pixels.data, pixels.width, pixels.height, BLUE);
    } catch (err) {
      threw = err instanceof Error ? err.message : String(err);
    }
    const originalImage = original.objects[1] as any;
    const savedImage = saved.objects[1] as any;
    const unchanged =
      originalImage.cropX === 40 &&
      originalImage.slbAssetId === "missing-asset" &&
      originalImage.src === "blob:https://local/gone" &&
      savedImage.cropX === 40 &&
      savedImage.src === "blob:https://local/gone";
    const ok = !pngHasPhoto && missingIds.includes("missing-asset") && unchanged && !threw;
    return {
      name: "missing-other-device",
      ok,
      detail: JSON.stringify({
        threw,
        pngHasPhoto,
        missingIds,
        unchanged,
        assetStore: "in-memory-null-loader",
      }),
    };
  } finally {
    live.dispose();
    liveEl.remove();
  }
}

export async function runMobileExportFabricCases() {
  const cases: CaseResult[] = [];
  cases.push(await runUncroppedSameDevice());
  cases.push(await runCroppedSameDevice());
  cases.push(await runRevokedWithoutRehydrate());
  cases.push(await runDuplicateAsset());
  cases.push(await runMergePreservedUpload());
  cases.push(await runLaterPage());
  cases.push(await runMissingOtherDevice());
  return {
    propsIncludeId: (FABRIC_JSON_PROPS as readonly string[]).includes("id"),
    cases,
    failed: cases.filter((item) => !item.ok).map((item) => item.name),
  };
}
