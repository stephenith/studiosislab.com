import assert from "node:assert/strict";
import { elementResizeMode, resizeBoundsForCorner } from "./mobileEditorUtils";

const start = { left: 10, top: 20, width: 100, height: 40 };

const grown = resizeBoundsForCorner(start, "br", 30, 10, "free");
assert.deepEqual(grown, { left: 10, top: 20, width: 130, height: 50 });

const shrunk = resizeBoundsForCorner(start, "tl", 10, 10, "free");
assert.deepEqual(shrunk, { left: 20, top: 30, width: 90, height: 30 });

const image = resizeBoundsForCorner({ left: 0, top: 0, width: 100, height: 50 }, "br", 50, 0, "uniform");
assert.equal(image.left, 0);
assert.equal(image.top, 0);
assert.equal(image.width / image.height, 2);
assert.equal(image.width, 150);
assert.equal(image.height, 75);

const text = resizeBoundsForCorner(start, "br", 40, 80, "text");
assert.equal(text.left, 10);
assert.equal(text.top, 20);
assert.equal(text.width, 140);
assert.equal(text.height, 40);

assert.equal(elementResizeMode({ type: "rect", role: "pageBackground", width: 794, height: 1123 }), "none");
assert.equal(elementResizeMode({ type: "rect", left: 0, top: 1300, width: 794, height: 1123 }), "none");
assert.equal(elementResizeMode({ type: "textbox", text: "Headline", width: 200, height: 40 }), "text");
assert.equal(elementResizeMode({ type: "image", width: 120, height: 80 }), "uniform");
assert.equal(elementResizeMode({ type: "rect", width: 80, height: 40 }), "free");
assert.equal(elementResizeMode({ type: "group", data: { role: "skill-bar" } }), "none");

console.log("mobileSelection.verify: PASS");
