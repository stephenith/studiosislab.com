"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import BrandLoadMark from "@/components/brand/BrandLoadMark";
import {
  endGalleryEditorOpen,
  subscribeGalleryEditorOpen,
} from "@/lib/editor/galleryEditorOpen";

function pathClearsGalleryEditorOpen(pathname: string): boolean {
  if (pathname.startsWith("/login")) return true;
  if (pathname.startsWith("/editor")) return false;
  if (pathname === "/resume" || pathname.startsWith("/resume/")) return false;
  return true;
}

/** Idle until a gallery template click. Reuses BrandLoadMark; no second design. */
export default function GalleryEditorOpenOverlay() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return subscribeGalleryEditorOpen(setOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    if (pathClearsGalleryEditorOpen(pathname)) endGalleryEditorOpen();
  }, [open, pathname]);

  useEffect(() => {
    const onPop = () => {
      const path = `${window.location.pathname}`;
      if (!path.startsWith("/editor")) endGalleryEditorOpen();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      data-slb-gallery-editor-open="true"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-[#ebecf0]"
      role="presentation"
    >
      <BrandLoadMark label="Opening resume" />
    </div>,
    document.body
  );
}

/** Clears the gallery overlay on template error / not-found screens. */
export function ClearGalleryEditorOpen() {
  useEffect(() => {
    endGalleryEditorOpen();
  }, []);
  return null;
}
