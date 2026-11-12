/**
 * Phone-only page order. Saved pages stay in their own coordinates.
 * The stacked scene is a display copy with a gap between pages.
 */
import { cloneJson, savedPagePixelSize } from "@/lib/editor/mobileDocument";

export const MOBILE_PAGE_GAP = 180;
export const MOBILE_A4_WIDTH = 794;
export const MOBILE_A4_HEIGHT = 1123;

export type MobilePageSize = { w: number; h: number };

export type MobilePageStack = {
  objects: any[];
  pageTops: number[];
  pageSizes: MobilePageSize[];
  width: number;
  height: number;
};

export function blankMobilePage(): { objects: any[] } {
  return {
    objects: [
      {
        type: "rect",
        role: "pageBackground",
        name: "Page Background",
        left: 0,
        top: 0,
        width: MOBILE_A4_WIDTH,
        height: MOBILE_A4_HEIGHT,
        fill: "#ffffff",
        data: { role: "pageBackground", kind: "page-bg", system: true },
      },
    ],
  };
}

export function insertMobilePage(
  pages: any[],
  activeIndex: number,
  page: any
): { pages: any[]; index: number } {
  const next = pages.map((item) => cloneJson(item));
  const index = next.length === 0 ? 0 : Math.min(Math.max(activeIndex, 0), next.length - 1) + 1;
  next.splice(index, 0, cloneJson(page));
  return { pages: next, index };
}

export function deleteMobilePage(
  pages: any[],
  activeIndex: number
): { pages: any[]; index: number } | null {
  if (pages.length < 2) return null;
  const next = pages.map((item) => cloneJson(item));
  const removeAt = Math.min(Math.max(activeIndex, 0), next.length - 1);
  next.splice(removeAt, 1);
  return { pages: next, index: Math.min(removeAt, next.length - 1) };
}

/** A page rectangle is not an editable element, even after it is stacked below another page. */
export function isMobilePageSurface(obj: any): boolean {
  if (!obj) return false;
  const role = String(obj.role || obj.data?.role || obj.data?.kind || "");
  if (role === "pageBackground" || role === "page-bg" || role === "page" || obj.isPageBg === true) return true;
  const name = typeof obj.name === "string" ? obj.name.toLowerCase().trim() : "";
  if (name === "page background" || name === "page-bg") return true;
  const id = obj.id || obj.data?.id;
  if (id === "page_bg") return true;
  const type = String(obj.type || "").toLowerCase();
  if (type !== "rect") return false;
  const width = Math.abs(
    typeof obj.getScaledWidth === "function"
      ? Number(obj.getScaledWidth()) || 0
      : (Number(obj.width) || 0) * (Number(obj.scaleX) || 1)
  );
  const height = Math.abs(
    typeof obj.getScaledHeight === "function"
      ? Number(obj.getScaledHeight()) || 0
      : (Number(obj.height) || 0) * (Number(obj.scaleY) || 1)
  );
  return (
    (Math.abs(width - MOBILE_A4_WIDTH) < 4 && Math.abs(height - MOBILE_A4_HEIGHT) < 4) ||
    (Math.abs(width - 816) < 4 && Math.abs(height - 1056) < 4)
  );
}

function isPageBackground(obj: any): boolean {
  const role = String(obj?.role || obj?.data?.role || obj?.data?.kind || "");
  return (
    role === "pageBackground" ||
    role === "page-bg" ||
    role === "page" ||
    obj?.isPageBg === true ||
    obj?.name === "Page Background"
  );
}

function blankBackground(width: number, height: number) {
  return { ...blankMobilePage().objects[0], width, height };
}

export function stackMobilePages(pages: any[]): MobilePageStack {
  const objects: any[] = [];
  const pageTops: number[] = [];
  const pageSizes: MobilePageSize[] = [];
  let y = 0;
  let width = MOBILE_A4_WIDTH;
  pages.forEach((page) => {
    const size = savedPagePixelSize(page);
    pageTops.push(y);
    pageSizes.push(size);
    width = Math.max(width, size.w);
    const copy = cloneJson(page || { objects: [] });
    const list = Array.isArray(copy.objects) ? copy.objects : [];
    if (!list.some((obj: any) => isPageBackground(obj))) list.unshift(blankBackground(size.w, size.h));
    list.forEach((obj: any) => {
      obj.top = (Number(obj.top) || 0) + y;
      objects.push(obj);
    });
    y += size.h + MOBILE_PAGE_GAP;
  });
  return {
    objects,
    pageTops,
    pageSizes,
    width,
    height: pages.length ? y - MOBILE_PAGE_GAP : MOBILE_A4_HEIGHT,
  };
}

export function mobilePageIndexForObjectTop(top: number, pageTops: number[]): number {
  let index = 0;
  for (let i = 0; i < pageTops.length; i += 1) {
    if (top + 0.5 >= pageTops[i]) index = i;
  }
  return index;
}

export function mobilePageIndexAtSceneY(sceneY: number, pageTops: number[], pageSizes: MobilePageSize[]): number {
  let best = 0;
  let bestDistance = Infinity;
  pageTops.forEach((top, index) => {
    const height = pageSizes[index]?.h || MOBILE_A4_HEIGHT;
    const distance = Math.abs(sceneY - (top + height / 2));
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  });
  return best;
}

export function splitStackedMobilePages(objects: any[], pageTops: number[]): { objects: any[] }[] {
  const buckets = pageTops.map(() => [] as any[]);
  objects.forEach((raw) => {
    const obj = cloneJson(raw);
    const top = Number(obj.top) || 0;
    const index = mobilePageIndexForObjectTop(top, pageTops);
    obj.top = top - (pageTops[index] || 0);
    buckets[index]?.push(obj);
  });
  return buckets.map((pageObjects) => ({ objects: pageObjects }));
}
