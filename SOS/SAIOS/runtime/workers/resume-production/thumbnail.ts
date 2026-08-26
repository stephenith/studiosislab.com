/**
 * Offscreen thumbnail render via fabric/node + node-canvas
 */
import { StaticCanvas } from "fabric/node";
import type { BuiltTemplate } from "./template-builder.js";

export async function renderThumbnailPng(template: BuiltTemplate): Promise<Buffer> {
  const { json } = template;
  const w = json.width ?? 794;
  const h = json.height ?? 1123;
  const multiplier = 0.25;

  const canvas = new StaticCanvas(undefined, {
    width: w,
    height: h,
    backgroundColor: "#ffffff",
  });

  await canvas.loadFromJSON(json);
  canvas.renderAll();

  const dataUrl = canvas.toDataURL({
    format: "png",
    multiplier,
    left: 0,
    top: 0,
    width: w,
    height: h,
  });

  canvas.dispose();

  const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
  return Buffer.from(base64, "base64");
}
