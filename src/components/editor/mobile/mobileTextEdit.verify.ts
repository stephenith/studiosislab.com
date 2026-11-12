import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { applyMobileTextStyle, focusCanvasText, holdPhoneTextCaret } from "./mobileCanvasActions";

const textarea = {
  style: {} as Record<string, string>,
  selectionStart: 0,
  selectionEnd: 0,
  focusCalls: [] as Array<{ preventScroll?: boolean } | undefined>,
  focus(options?: { preventScroll?: boolean }) {
    this.focusCalls.push(options);
  },
};

const obj = {
  type: "textbox",
  text: "Alex Morgan",
  fontWeight: 400,
  fontSize: 18,
  textAlign: "left",
  fill: "#111827",
  editable: false,
  isEditing: false,
  hiddenTextarea: null as typeof textarea | null,
  selectionStart: 0,
  selectionEnd: 0,
  set(props: Record<string, unknown>) {
    Object.assign(this, props);
  },
  enterEditing() {
    this.isEditing = true;
    this.hiddenTextarea = textarea;
    textarea.focus();
  },
  getSelectionStartFromPointer() {
    return 4;
  },
  initDimensions() {
    this.inited = true;
  },
  setCoords() {
    this.coords = true;
  },
  canvas: { requestRenderAll() {} },
  inited: false,
  coords: false,
};

const canvas = {
  setActiveObject() {},
  requestRenderAll() {},
};

const scroll = { x: 0, y: 0 };
(globalThis as { window?: unknown }).window = {
  scrollX: 0,
  scrollY: 0,
  scrollTo(x: number, y: number) {
    scroll.x = x;
    scroll.y = y;
  },
  visualViewport: { offsetTop: 18 },
};

const started = focusCanvasText(canvas as never, obj, { type: "touchend" } as Event);
assert.equal(started, true);
assert.equal(obj.isEditing, true);
assert.equal(obj.editable, true);
assert.equal(obj.selectionStart, 4);
assert.equal(obj.selectionEnd, 4);
assert.equal(textarea.style.position, "fixed");
assert.equal(textarea.style.fontSize, "16px");
assert.equal(textarea.style.top, "18px");
assert.equal(textarea.focusCalls.at(-1)?.preventScroll, true);

obj.isEditing = false;
obj.hiddenTextarea = null;
const appended = focusCanvasText(canvas as never, obj);
assert.equal(appended, true);
assert.equal(obj.selectionStart, "Alex Morgan".length);

applyMobileTextStyle(obj, { fontWeight: 700, fontSize: 20, textAlign: "center", fill: "#7C3AED" });
assert.equal(obj.fontWeight, 700);
assert.equal(obj.fontSize, 20);
assert.equal(obj.textAlign, "center");
assert.equal(obj.fill, "#7C3AED");
assert.equal(obj.inited, true);
assert.equal(obj.coords, true);

holdPhoneTextCaret(obj);
assert.equal(textarea.style.fontSize, "16px");

const shell = fs.readFileSync(path.join(import.meta.dirname, "MobileEditorShell.tsx"), "utf8");
const panel = shell.slice(shell.indexOf("function TextStyleBar"), shell.indexOf("const RESIZE_CORNERS"));
assert.equal(panel.includes("Selected text"), false);
assert.equal(panel.includes("<textarea"), false);
assert.equal(panel.includes('aria-label="Font family"'), true);
assert.equal(panel.includes('aria-label="Font size"'), true);
assert.equal(panel.includes('aria-label="Bold"'), true);
assert.equal(panel.includes('aria-label="Italic"'), true);
assert.equal(panel.includes('aria-label="Underline"'), true);
assert.equal(panel.includes('aria-label="Text alignment"'), true);
assert.equal(panel.includes('aria-label="Text color"'), true);
assert.equal(panel.includes('type="color"'), true);
assert.equal(/<input(?![^>]*type="color")/.test(panel), false);

const hook = fs.readFileSync(path.join(import.meta.dirname, "useMobileFabricEditor.ts"), "utf8");
const textBranch = hook.slice(hook.indexOf('hit?.type === "text"'), hook.indexOf('hit?.type === "object"'));
assert.equal(textBranch.includes("focusCanvasText("), true);
assert.equal(textBranch.includes("exitCanvasText("), false);
assert.equal(hook.includes('canvas.on("text:changed"'), true);

console.log("mobileTextEdit.verify: PASS");
