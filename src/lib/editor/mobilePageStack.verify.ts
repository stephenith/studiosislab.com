import assert from "node:assert/strict";
import { mobileSavePayload, pagesFromResumeRecord, savedPagePixelSize } from "./mobileDocument";
import {
  blankMobilePage,
  deleteMobilePage,
  insertMobilePage,
  MOBILE_A4_HEIGHT,
  MOBILE_A4_WIDTH,
  MOBILE_PAGE_GAP,
  splitStackedMobilePages,
  stackMobilePages,
} from "./mobilePageStack";

const textPage = (label: string, top = 90) => ({
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
    { type: "textbox", text: label, left: 80, top },
  ],
});

const original = [textPage("One", 90), textPage("Two", 140)];
const added = insertMobilePage(original, 0, blankMobilePage());
assert.equal(added.pages.length, 3);
assert.equal(added.index, 1);
assert.equal(added.pages[0].objects[1].text, "One");
assert.equal(added.pages[2].objects[1].text, "Two");
assert.equal(savedPagePixelSize(added.pages[1]).w, MOBILE_A4_WIDTH);
assert.equal(savedPagePixelSize(added.pages[1]).h, MOBILE_A4_HEIGHT);
assert.equal(original.length, 2);

const duplicated = insertMobilePage(original, 0, original[0]);
assert.deepEqual(
  duplicated.pages.map((page) => page.objects[1].text),
  ["One", "One", "Two"]
);
duplicated.pages[1].objects[1].text = "One copy";
assert.equal(duplicated.pages[0].objects[1].text, "One");
assert.equal(original[0].objects[1].text, "One");
assert.notEqual(duplicated.pages[0], duplicated.pages[1]);

const removed = deleteMobilePage(duplicated.pages, 1);
assert.ok(removed);
assert.deepEqual(
  removed.pages.map((page) => page.objects[1].text),
  ["One", "Two"]
);
assert.equal(removed.index, 1);
assert.equal(deleteMobilePage([textPage("Only")], 0), null);

const stacked = stackMobilePages(duplicated.pages);
assert.equal(stacked.pageTops.length, 3);
assert.equal(stacked.pageTops[1], MOBILE_A4_HEIGHT + MOBILE_PAGE_GAP);
assert.equal(stacked.objects.find((obj) => obj.text === "One copy").top, stacked.pageTops[1] + 90);
assert.ok(stacked.height > MOBILE_A4_HEIGHT * 2);

const roundTrip = splitStackedMobilePages(stacked.objects, stacked.pageTops);
assert.deepEqual(
  roundTrip.map((page) => page.objects.find((obj) => obj.type === "textbox")?.text),
  ["One", "One copy", "Two"]
);
assert.equal(roundTrip[1].objects.find((obj) => obj.type === "textbox")?.top, 90);
assert.equal(roundTrip[0].objects.find((obj) => obj.type === "textbox")?.top, 90);

const saved = mobileSavePayload({
  shape: "pages",
  serverPages: roundTrip,
  activeIndex: -1,
  activeJson: { objects: [] },
});
assert.equal(saved.pagesData?.length, 3);
const reloaded = pagesFromResumeRecord({ pagesData: saved.pagesData, canvasJson: textPage("Ignored") });
assert.deepEqual(
  reloaded.pages.map((page) => page.objects.find((obj: any) => obj.type === "textbox")?.text),
  ["One", "One copy", "Two"]
);
assert.equal(reloaded.pages[1].objects.find((obj: any) => obj.type === "textbox")?.top, 90);

console.log("mobilePageStack.verify: PASS");
