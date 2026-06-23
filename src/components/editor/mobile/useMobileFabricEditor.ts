"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Canvas } from "fabric";
import { getSystemTemplateById } from "@/data/systemTemplates/registry";
import { initFabricCanvas } from "@/lib/editor/canvasInitializer";
import { exportToDataURL, buildPDFFromPages } from "@/lib/editor/exportCanvas";
import {
  fabricSavePayloadHasDataImageSrc,
  fitCanvasToViewport,
  getPageBounds,
  isTextObject,
  loadSnapshotOntoCanvas,
  serializeCanvasForSave,
} from "@/lib/editor/mobileEditorUtils";
import { createResumeDoc, updateResumeDoc } from "@/lib/resumeDocs";
import { useAuth } from "@/lib/useAuth";
import { PAGE_SIZES, type PageSize } from "@/types/editor";

export type MobileSaveStatus = "idle" | "unsaved" | "saving" | "saved" | "error";

export type MobileTextEditState = {
  draft: string;
} | null;

type UseMobileFabricEditorOptions = {
  templateId: string;
};

export function useMobileFabricEditor({ templateId }: UseMobileFabricEditorOptions) {
  const { user } = useAuth();
  const canvasRef = useRef<Canvas | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const pageSizeRef = useRef(PAGE_SIZES.A4);
  const editingObjectRef = useRef<any>(null);
  const docIdRef = useRef<string | null>(null);
  const isDirtyRef = useRef(false);

  const [canvasReady, setCanvasReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [docTitle, setDocTitle] = useState("Untitled Resume");
  const [saveStatus, setSaveStatus] = useState<MobileSaveStatus>("idle");
  const [textEdit, setTextEdit] = useState<MobileTextEditState>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const fitToContainer = useCallback(() => {
    const c = canvasRef.current;
    const vp = viewportRef.current;
    if (!c || !vp) return;
    const rect = vp.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const { w, h } = pageSizeRef.current;
    fitCanvasToViewport(c, rect.width, rect.height, w, h);
  }, []);

  const attachCanvasEl = useCallback(
    (el: HTMLCanvasElement | null) => {
      if (!el) return;
      if (canvasRef.current) {
        try {
          canvasRef.current.dispose();
        } catch {
          /* ignore */
        }
        canvasRef.current = null;
      }

      const { w, h } = pageSizeRef.current;
      const c = initFabricCanvas(el, {
        width: w,
        height: h,
        backgroundColor: "#ebecf0",
        selection: false,
        preserveObjectStacking: true,
      });
      canvasRef.current = c;

      c.on("mouse:down", (opt: any) => {
        const target = opt?.target;
        if (!target || !isTextObject(target)) return;
        editingObjectRef.current = target;
        setTextEdit({ draft: String(target.text ?? "") });
      });

      setCanvasReady(true);
    },
    []
  );

  useEffect(() => {
    if (!canvasReady) return;

    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setLoadError(null);

      const template = getSystemTemplateById(templateId);
      if (!template) {
        setLoadError("Template not found.");
        setLoading(false);
        return;
      }

      setDocTitle(template.name || "Untitled Resume");
      docIdRef.current = null;

      try {
        const snapshot = await template.load();

        if (cancelled) return;

        const c = canvasRef.current;
        if (!c) {
          throw new Error("Canvas failed to initialize");
        }

        const { w, h } = pageSizeRef.current;
        await loadSnapshotOntoCanvas(c, snapshot, w, h, {
          isTemplateLoad: true,
        });

        if (cancelled) return;
        requestAnimationFrame(() => fitToContainer());
        setSaveStatus("idle");
        setLoading(false);
      } catch (err) {
        console.error("[mobile-editor] Failed to load template", err);
        if (!cancelled) {
          setLoadError("We couldn't load this template. Please try again.");
          setLoading(false);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [canvasReady, fitToContainer, templateId]);

  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;

    const ro = new ResizeObserver(() => fitToContainer());
    ro.observe(vp);
    return () => ro.disconnect();
  }, [fitToContainer, loading]);

  const closeTextEdit = useCallback(() => {
    editingObjectRef.current = null;
    setTextEdit(null);
  }, []);

  const commitTextEdit = useCallback(() => {
    const c = canvasRef.current;
    const obj = editingObjectRef.current;
    if (!c || !obj || !textEdit) {
      closeTextEdit();
      return;
    }
    obj.set?.({ text: textEdit.draft });
    obj.setCoords?.();
    c.requestRenderAll();
    isDirtyRef.current = true;
    setSaveStatus("unsaved");
    closeTextEdit();
  }, [closeTextEdit, textEdit]);

  const save = useCallback(async () => {
    const c = canvasRef.current;
    if (!c || !user?.uid) {
      setSaveStatus("error");
      return false;
    }

    const canvasJson = serializeCanvasForSave(c);
    if (fabricSavePayloadHasDataImageSrc(canvasJson)) {
      console.error("[mobile-editor] Save blocked: canvas contains data:image URLs");
      setSaveStatus("error");
      return false;
    }

    setSaveStatus("saving");
    try {
      const pageSize: PageSize = "A4";
      const common = {
        uid: user.uid,
        title: docTitle || "Untitled Resume",
        canvasJson,
        pageSize,
        zoom: 1,
      };

      if (docIdRef.current) {
        await updateResumeDoc({
          ...common,
          docId: docIdRef.current,
        });
      } else {
        const newId = await createResumeDoc({
          ...common,
          sourceTemplateId: templateId,
        });
        docIdRef.current = newId;
      }

      isDirtyRef.current = false;
      setSaveStatus("saved");
      return true;
    } catch (err) {
      console.error("[mobile-editor] Save failed", err);
      setSaveStatus("error");
      return false;
    }
  }, [docTitle, templateId, user?.uid]);

  const downloadPdf = useCallback(async () => {
    const c = canvasRef.current;
    if (!c) return;

    setIsDownloading(true);
    try {
      const result = exportToDataURL(c, {
        multiplier: 2,
        getPageBounds: (canvas) => getPageBounds(canvas, "A4"),
      });
      if (!result) {
        console.error("[mobile-editor] PDF export failed: no page bounds");
        return;
      }
      const blob = buildPDFFromPages([result]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "resume.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[mobile-editor] PDF download failed", err);
    } finally {
      setIsDownloading(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (canvasRef.current) {
        try {
          canvasRef.current.dispose();
        } catch {
          /* ignore */
        }
        canvasRef.current = null;
      }
    };
  }, []);

  return {
    loading,
    loadError,
    docTitle,
    setDocTitle,
    saveStatus,
    textEdit,
    setTextEdit,
    isDownloading,
    attachCanvasEl,
    viewportRef,
    closeTextEdit,
    commitTextEdit,
    save,
    downloadPdf,
  };
}
