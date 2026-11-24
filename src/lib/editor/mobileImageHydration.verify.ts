import assert from "node:assert/strict";
import {
  assetIdOfImage,
  isUnsafeFabricImageSrc,
  rehydratePhoneImageSources,
} from "./mobileImageHydration";
import { omitImageCropChromeFromSnapshot } from "./imageCrop";

assert.equal(isUnsafeFabricImageSrc("blob:https://studiosislab.com/abc"), true);
assert.equal(isUnsafeFabricImageSrc(""), true);
assert.equal(isUnsafeFabricImageSrc("/templates/t004.png"), false);
assert.equal(assetIdOfImage({ slbAssetId: "asset-1" }), "asset-1");
assert.equal(assetIdOfImage({ data: { slbAssetId: "asset-2" } }), "asset-2");

const saved: { objects: any[] } = {
  objects: [
    {
      type: "image",
      src: "blob:https://local/revoked",
      slbAssetId: "asset-1",
      cropX: 12,
      cropY: 4,
      width: 80,
      height: 60,
    },
    { type: "textbox", text: "Nurse" },
  ],
};

async function main() {
const blobs = new Map<string, Blob>([["asset-1", new Blob(["photo"], { type: "image/jpeg" })]]);
const urls: string[] = [];
const restored = await rehydratePhoneImageSources(
  saved,
  async (id) => blobs.get(id) || null,
  (blob) => {
    const url = `blob:hydrated-${blob.type}-${urls.length}`;
    urls.push(url);
    return url;
  }
);
assert.equal(restored.missingAssetIds.length, 0);
assert.equal(saved.objects[0].src, "blob:hydrated-image/jpeg-0");
assert.equal(saved.objects[0].slbAssetId, "asset-1");
assert.equal(saved.objects[0].cropX, 12);
assert.equal(saved.objects[0].cropY, 4);
assert.equal(saved.objects[0].width, 80);

const missingPage: { objects: any[] } = {
  objects: [
    {
      type: "image",
      src: "blob:https://local/gone",
      slbAssetId: "missing-asset",
      cropX: 2,
      width: 40,
      height: 40,
    },
    { type: "textbox", text: "Kept" },
  ],
};
const missing = await rehydratePhoneImageSources(
  missingPage,
  async () => null,
  (blob) => `blob:placeholder-${blob.type}`
);
assert.deepEqual(missing.missingAssetIds, ["missing-asset"]);
assert.equal(missingPage.objects[0].slbAssetId, "missing-asset");
assert.equal(missingPage.objects[0].data.slbAssetMissing, true);
assert.equal(missingPage.objects[0].cropX, 2);
assert.equal(missingPage.objects[1].text, "Kept");
assert.equal(String(missingPage.objects[0].src).startsWith("blob:placeholder-"), true);

const chrome = omitImageCropChromeFromSnapshot({
  objects: [
    { type: "image", slbAssetId: "asset-1", cropX: 12, cropY: 4 },
    { type: "rect", role: "image-crop-rect" },
  ],
});
assert.equal(chrome.objects.length, 1);
assert.equal(chrome.objects[0].slbAssetId, "asset-1");
assert.equal(chrome.objects[0].cropX, 12);

console.log("mobileImageHydration.verify: PASS");
}

void main();
