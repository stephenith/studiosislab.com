"use client";

import { useState, useEffect, useCallback } from "react";

export interface ToolbarPosition {
  top: number;
  left: number;
}

/**
 * Computes floating toolbar position from Fabric canvas selection.
 * Returns position relative to the viewport element (for position: absolute inside viewport).
 */
export function useFloatingToolbarPosition(
  hasSelection: boolean,
  getCanvas: () => { getActiveObject: () => any; lowerCanvasEl?: HTMLCanvasElement } | null,
  viewportRef: React.RefObject<HTMLDivElement | null>,
  zoom: number
): { position: ToolbarPosition | null; isMultipleSelection: boolean } {
  const [position, setPosition] = useState<ToolbarPosition | null>(null);
  const [isMultipleSelection, setIsMultipleSelection] = useState(false);

  const updatePosition = useCallback(() => {
    const viewport = viewportRef?.current;
    const canvas = getCanvas();
    if (!viewport || !canvas || !hasSelection) {
      setPosition(null);
      return;
    }
    const active = canvas.getActiveObject();
    if (!active) {
      setPosition(null);
      return;
    }
    setIsMultipleSelection(active.type === "activeSelection");
    const rect = active.getBoundingRect(true);
    const canvasEl = (canvas as any).lowerCanvasEl as HTMLCanvasElement | undefined;
    if (!canvasEl) {
      setPosition(null);
      return;
    }
    const viewportRect = viewport.getBoundingClientRect();
    const canvasElRect = canvasEl.getBoundingClientRect();
    const vpt = (canvas as any).viewportTransform as number[] | undefined;
    const vpt4 = vpt?.[4] ?? 0;
    const vpt5 = vpt?.[5] ?? 0;
    const z = zoom;
    const canvasOffsetTop = canvasElRect.top - viewportRect.top + viewport.scrollTop;
    const canvasOffsetLeft = canvasElRect.left - viewportRect.left + viewport.scrollLeft;
    const centerX = rect.left + rect.width / 2;
    const selectionTop = rect.top;
    const left = canvasOffsetLeft + centerX * z + vpt4;
    const top = canvasOffsetTop + selectionTop * z + vpt5;
    setPosition({ left, top });
  }, [hasSelection, getCanvas, viewportRef, zoom]);

  useEffect(() => {
    if (!hasSelection) {
      setPosition(null);
      return;
    }
    updatePosition();
    const canvas = getCanvas();
    if (!canvas) return;
    const c = canvas as any;
    const onModified = () => updatePosition();
    const onSelectionUpdated = () => updatePosition();
    c.on?.("object:modified", onModified);
    c.on?.("selection:updated", onSelectionUpdated);
    return () => {
      c.off?.("object:modified", onModified);
      c.off?.("selection:updated", onSelectionUpdated);
    };
  }, [hasSelection, getCanvas, updatePosition]);

  return { position, isMultipleSelection };
}
