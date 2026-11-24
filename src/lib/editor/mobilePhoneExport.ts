/**
 * Phone PNG/PDF raster. Same steps as downloadPages: rehydrate, loadFromJSON, bind, Fabric toDataURL.
 */
import type { Canvas } from "fabric";
import { exportToDataURL, type PageExportResult } from "@/lib/editor/exportCanvas";
import { isImageCropChrome } from "@/lib/editor/imageCrop";
import { cloneJson } from "@/lib/editor/mobileDocument";
import {
  finalizePhoneExportImages,
  rehydratePhoneImageSources,
} from "@/lib/editor/mobileImageHydration";
import { getPageBounds, loadSnapshotOntoCanvas } from "@/lib/editor/mobileEditorUtils";
import type { PageSize } from "@/types/editor";

export async function rasterMobileExportPage(options: {
  liveCanvas: Canvas | null;
  snapshot: any;
  exportCanvas: Canvas;
  loadAsset: (assetId: string) => Promise<Blob | null>;
  objectUrls: string[];
  pageW: number;
  pageH: number;
  pageSizeKey: PageSize;
}): Promise<{ result: PageExportResult; missingAssetIds: string[] }> {
  const { liveCanvas, exportCanvas, loadAsset, objectUrls, pageW, pageH, pageSizeKey } = options;
  exportCanvas.setDimensions({ width: pageW, height: pageH });
  const prepared = cloneJson(options.snapshot || { objects: [] });
  const hydration = await rehydratePhoneImageSources(prepared, loadAsset);
  objectUrls.push(...hydration.urls);
  await loadSnapshotOntoCanvas(exportCanvas, prepared, pageW, pageH, {
    isTemplateLoad: false,
    preserveUserImages: true,
    preservePageBox: true,
  });
  await finalizePhoneExportImages(liveCanvas, exportCanvas);
  const result = exportToDataURL(exportCanvas, {
    multiplier: 2,
    getPageBounds: (target) => getPageBounds(target, pageSizeKey),
    filter: (object) => !isImageCropChrome(object),
  });
  if (!result) throw new Error("Page export failed");
  return { result, missingAssetIds: hydration.missingAssetIds };
}
