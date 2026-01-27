
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createPortal } from "react-dom";

import {
  Canvas,
  Textbox,
  Rect,
  FabricObject,
  ActiveSelection,
  Group
} from "fabric";

import { jsPDF } from "jspdf";

import { TEMPLATE_EDITOR_CONFIG } from "@/data/templates";

// -------------------------------
// TYPES
// -------------------------------
type Snapshot = { objects: any[] };

type SafeArea = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  w: number;
  h: number;
};

type PageHistory = {
  undo: Snapshot[];
  redo: Snapshot[];
  lastStr: string;
};

// -------------------------------
// REFS + EDITOR STATE
// -------------------------------
export default function EditorPage() {
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const fabricCanvasRef = useRef<Canvas | null>(null);

  const baseWRef = useRef(2480);
  const baseHRef = useRef(3508);

  const safeAreaRef = useRef<SafeArea | null>(null);

  const params = useParams<{ id: string }>();
  const router = useRouter();

  const templateId = (params?.id || "t001") as string;
  const editorConfig =
    TEMPLATE_EDITOR_CONFIG[templateId] || TEMPLATE_EDITOR_CONFIG["t001"];

  // -------------------------------
  // AD GATE
  // -------------------------------
  const [showAd, setShowAd] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(12);
  const pendingDownloadRef = useRef<null | (() => void)>(null);

  // -------------------------------
  // ZOOM
  // -------------------------------
  const [zoom, setZoom] = useState(25);
  const zoomMin = 15;
  const zoomMax = 80;
  const zoomStep = 5;
  const zoomScale = zoom / 100;

  // -------------------------------
  // MULTI PAGE
  // -------------------------------
  const [pageIndex, setPageIndex] = useState(0);
  const [pageCount, setPageCount] = useState(1);

  const pagesRef = useRef<Snapshot[]>([]);
  const pageHistoryRef = useRef<PageHistory[]>([]);

  const isSwitchingPageRef = useRef(false);

  // -------------------------------
  // HISTORY
  // -------------------------------
  const isApplyingHistoryRef = useRef(false);
  const isInitialBuildRef = useRef(true);

  const historyDebounceRef = useRef<number | null>(null);
  const HISTORY_LIMIT = 60;

  // -------------------------------
  // SYSTEM OBJECT STORAGE
  // -------------------------------
  const systemObjectsJsonRef = useRef<any[]>([]);

  // -------------------------------
  // EXTRA PROPS (Fabric serialization)
  // -------------------------------
  const EXTRA_PROPS = useMemo(
    () => [
      "excludeFromExport",
      "selectable",
      "evented",
      "hasControls",
      "lockMovementX",
      "lockMovementY",
      "lockScalingX",
      "lockScalingY",
      "lockRotation",
      "role",
      "isLocked",
      "uid",

      // Section metadata
      "sectionType",
      "sectionId",
      "isSectionRoot",
    ],
    []
  );

  // -------------------------------
  // UID HELPERS
  // -------------------------------
  function newUid() {
    return `obj_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  function newSectionId() {
    return `sec_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  // -------------------------------
  // SYSTEM ROLE DETECTORS
  // -------------------------------
  function isSystemObjectJson(obj: any) {
    return obj?.role === "sidebar" || obj?.role === "safeGuide";
  }

  function isSystemObjectLive(obj: any) {
    return obj?.role === "sidebar" || obj?.role === "safeGuide";
  }

  // -------------------------------
  // SERIALIZATION
  // -------------------------------
  function getFullJson(c: Canvas) {
    return c.toDatalessJSON(EXTRA_PROPS as any);
  }

  function serializeUserSnapshot(c: Canvas): Snapshot {
    const full = getFullJson(c);
    const userObjects = (full.objects || []).filter(
      (o: any) => !isSystemObjectJson(o)
    );
    return { objects: userObjects };
  }

  // -------------------------------
  // PAGE HISTORY HELPERS
  // -------------------------------
  function getPH(i: number): PageHistory {
    if (!pageHistoryRef.current[i]) {
      pageHistoryRef.current[i] = {
        undo: [],
        redo: [],
        lastStr: "",
      };
    }
    return pageHistoryRef.current[i];
  }


  // -------------------------------
  // HISTORY: PUSH
  // -------------------------------
  function pushHistory(reason: string) {
    const c = fabricCanvasRef.current;
    if (!c) return;

    if (isInitialBuildRef.current) return;
    if (isApplyingHistoryRef.current) return;
    if (isSwitchingPageRef.current) return;

    const ph = getPH(pageIndex);

    const snap = serializeUserSnapshot(c);
    const str = JSON.stringify(snap);

    if (str === ph.lastStr) return;

    ph.undo.push(snap);
    ph.lastStr = str;
    ph.redo = [];

    if (ph.undo.length > HISTORY_LIMIT) {
      ph.undo.shift();
    }

    pagesRef.current[pageIndex] = snap;
  }

  // -------------------------------
  // HISTORY: DEBOUNCED PUSH
  // -------------------------------
  function scheduleHistoryPush(reason: string, delayMs = 250) {
    if (historyDebounceRef.current)
      clearTimeout(historyDebounceRef.current);

    historyDebounceRef.current = window.setTimeout(() => {
      pushHistory(reason);
      historyDebounceRef.current = null;
    }, delayMs);
  }

  // -------------------------------
  // LOCK / UNLOCK
  // -------------------------------
  function lockObject(obj: any) {
    if (!obj) return;
    if (isSystemObjectLive(obj)) return;

    obj.isLocked = true;
    obj.selectable = false;
    obj.evented = false;

    obj.hasControls = false;
    obj.lockMovementX = true;
    obj.lockMovementY = true;
    obj.lockScalingX = true;
    obj.lockScalingY = true;
    obj.lockRotation = true;

    obj.setCoords?.();
  }

  function unlockObject(obj: any) {
    if (!obj) return;
    if (isSystemObjectLive(obj)) return;

    obj.isLocked = false;
    obj.selectable = true;
    obj.evented = true;

    obj.hasControls = true;
    obj.lockMovementX = false;
    obj.lockMovementY = false;
    obj.lockScalingX = false;
    obj.lockScalingY = false;
    obj.lockRotation = false;

    obj.setCoords?.();
  }

  // -------------------------------
  // KEYBOARD GUARD (avoid deleting text while typing)
  // -------------------------------
  function isTypingInInput(e: KeyboardEvent) {
    const t = e.target as HTMLElement | null;
    if (!t) return false;

    const tag = t.tagName?.toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return true;
    if ((t as any).isContentEditable) return true;

    return false;
  }

  // -------------------------------
  // SELECTION HELPERS
  // -------------------------------
  function isActiveSelection(obj: any) {
    if (!obj) return false;
    if (obj instanceof ActiveSelection) return true;
    return String(obj.type || "").toLowerCase() === "activeselection";
  }

  function getSelectionObjects(sel: any): any[] {
    return sel?.getObjects?.() || sel?._objects || [];
  }

  // -------------------------------
  // GROUP TEXT EDITING
  // -------------------------------
  function enableGroupTextEditing(c: Canvas) {
    c.on("mouse:dblclick", (e: any) => {
      const t = e?.target as any;
      if (!t) return;
      const isTextbox = String(t?.type || "").toLowerCase() === "textbox";
      if (!isTextbox) return;

      // If the textbox is inside a group (like a section), enable editing.
      if (t.group) {
        t.selectable = true;
        c.setActiveObject(t);
      }
      t.enterEditing?.();
      t.selectAll?.();
    });
  }

  // ==========================================================
  // SECTION SYSTEM (Education / Experience / Skills)
  // ==========================================================
  type SectionType = "education" | "experience" | "skills";

  function getNextSectionTop() {
    const c = fabricCanvasRef.current;
    const a = safeAreaRef.current;
    if (!c || !a) return a.top + 520;

    const GAP = 36;
    let maxBottom = a.top + 520;

    c.getObjects().forEach((o: any) => {
      if (o?.role !== "section") return;
      const br = o.getBoundingRect(true, true);
      const bottom = br.top + br.height;
      if (bottom > maxBottom) maxBottom = bottom;
    });

    return Math.min(maxBottom + GAP, a.bottom - 200);
  }

  // -------------------------------
  // Normalize Section Group (critical!)
  // -------------------------------
  function normalizeSectionGroup(g: any) {
    if (!g) return;

    g.subTargetCheck = true;
    g.interactive = true;
    g.lockRotation = true;

    const kids = g.getObjects?.() || g._objects || [];
    kids.forEach((k: any) => {
      const isTextbox = String(k?.type || "").toLowerCase() === "textbox";

      if (isTextbox) {
        // text box → editable only via dblclick
        k.selectable = false;
        k.evented = true;
        k.hoverCursor = "text";

        k.hasControls = false;
        k.lockMovementX = true;
        k.lockMovementY = true;
        k.lockScalingX = true;
        k.lockScalingY = true;
        k.lockRotation = true;
      } else {
        // divider, shapes
        k.selectable = false;
        k.evented = false;

        k.hasControls = false;
        k.lockMovementX = true;
        k.lockMovementY = true;
        k.lockScalingX = true;
        k.lockScalingY = true;
        k.lockRotation = true;
      }

      k.setCoords?.();
    });

    g.setCoords?.();
  }

  // -------------------------------
  // APPLY SNAPSHOT (History + Page Switch)
  // -------------------------------
  async function applySnapshot(snap?: Snapshot) {
  const c = fabricCanvasRef.current;
  if (!c || !snap) return;

  isApplyingHistoryRef.current = true;

  const systemObjects = systemObjectsJsonRef.current || [];
  const merged = {
    objects: [...systemObjects, ...(snap.objects || [])],
  };

  // Clear canvas + reset background (Fabric v6)
  c.clear();
  c.backgroundColor = "#ffffff";

  // Fabric v6: loadFromJSON is async / promise-based
  await c.loadFromJSON(merged as any);

  // Re-normalize section groups after JSON load
  c.getObjects().forEach((o: any) => {
    if (o?.role === "section") normalizeSectionGroup(o);
  });

  c.renderAll();

  isApplyingHistoryRef.current = false;
}

  function undo() {
    const c = fabricCanvasRef.current;
    if (!c) return;

    const ph = getPH(pageIndex);
    if (!ph.undo || ph.undo.length <= 1) return;

    const current = ph.undo.pop()!;
    ph.redo.push(current);

    const prev = ph.undo[ph.undo.length - 1];
    applySnapshot(prev);
  }

  function redo() {
    const c = fabricCanvasRef.current;
    if (!c) return;

    const ph = getPH(pageIndex);
    if (!ph.redo || ph.redo.length === 0) return;

    const next = ph.redo.pop()!;
    ph.undo.push(next);

    applySnapshot(next);
  }

  // -------------------------------
  // Create Section Group
  // -------------------------------
  function createSectionGroup(sectionType: SectionType, left: number, top: number) {
    const a = safeAreaRef.current;
    if (!a) return null;

    const sectionId = newSectionId();
    const W = a.right - left;

    // --- Title
    const titleText =
      sectionType === "education"
        ? "Education"
        : sectionType === "experience"
        ? "Experience"
        : "Skills";

    const title = new Textbox(titleText, {
      left: 0,
      top: 0,
      width: W,
      fontSize: 54,
      fontWeight: "bold",
      textAlign: "left",
      editable: true,
      selectable: true,
      evented: true,
    }) as any;

    title.uid = newUid();
    title.role = "sectionItem";
    title.sectionId = sectionId;

    // --- Divider
    const divider = new Rect({
      left: 0,
      top: 72,
      width: W,
      height: 6,
      fill: "#111827",
      selectable: false,
      evented: false,
    }) as any;

    divider.uid = newUid();
    divider.role = "sectionItem";
    divider.sectionId = sectionId;

    // --- Content
    let contentDefault = "";
    if (sectionType === "education") {
      contentDefault =
        "• Degree / Course — University / College (Year)\n• Achievement / GPA / Relevant coursework";
    } else if (sectionType === "experience") {
      contentDefault =
        "• Job Title — Company (Year–Year)\n  - Impact bullet 1\n  - Impact bullet 2";
    } else {
      contentDefault = "• Skill 1 • Skill 2 • Skill 3\n• Tool 1 • Tool 2 • Tool 3";
    }

    const content = new Textbox(contentDefault, {
      left: 0,
      top: 96,
      width: W,
      fontSize: 38,
      lineHeight: 1.45,
      textAlign: "left",
      editable: true,
      selectable: true,
      evented: true,
    }) as any;

    content.uid = newUid();
    content.role = "sectionItem";
    content.sectionId = sectionId;

    // --- Group
    const g = new Group([title, divider, content], {
      left,
      top,
      selectable: true,
      evented: true,
      hasControls: true,
      lockRotation: true,
    }) as any;

    g.uid = newUid();
    g.role = "section";
    g.sectionType = sectionType;
    g.sectionId = sectionId;
    g.isSectionRoot = true;

    normalizeSectionGroup(g);
    g.setCoords?.();

    return g;
  }

  // -------------------------------
  // Add Section
  // -------------------------------
  function addSection(sectionType: SectionType) {
    const c = fabricCanvasRef.current;
    const a = safeAreaRef.current;
    if (!c || !a) return;

    const left = a.left;
    const top = getNextSectionTop();

    const g = createSectionGroup(sectionType, left, top);
    if (!g) return;

    c.add(g);
    c.setActiveObject(g);
    c.requestRenderAll();
    pushHistory(`section:add:${sectionType}`);
  }

  // -------------------------------
  // Section Root Resolver
  // -------------------------------
  function getSectionRootFromTarget(target: any): any | null {
    const c = fabricCanvasRef.current;
    if (!c || !target) return null;

    if (target?.role === "section") return target;

    const parent = target?.group;
    if (parent?.role === "section") return parent;

    const sid = target?.sectionId;
    if (sid) {
      return c.getObjects().find((o: any) => o?.role === "section" && o.sectionId === sid) || null;
    }

    return null;
  }

  // -------------------------------
  // DELETE SELECTED OBJECTS
  // -------------------------------
  function deleteSelectedObjects() {
    const c = fabricCanvasRef.current;
    if (!c) return;

    const active: any = c.getActiveObject();
    if (!active) return;
    if (active?.isEditing) return;

    // Multi-selection
    if (isActiveSelection(active)) {
      const objs = getSelectionObjects(active);
      const roots = objs
        .map((o) =>
          o?.role?.startsWith?.("section") ? getSectionRootFromTarget(o) : o
        )
        .filter(Boolean);

      const unique = Array.from(new Set(roots));
      unique.forEach((o: any) => {
        if (isSystemObjectLive(o)) return;
        c.remove(o);
      });

      c.discardActiveObject();
      c.requestRenderAll();
      pushHistory("delete:multi");
      return;
    }

    // Single object
    const root = getSectionRootFromTarget(active);
    const target = root || active;
    if (isSystemObjectLive(target)) return;

    c.remove(target);
    c.discardActiveObject();
    c.requestRenderAll();
    pushHistory("delete:single");
  }

  // -------------------------------
  // LOCK / UNLOCK SELECTED
  // -------------------------------
  function lockSelectedObjects() {
    const c = fabricCanvasRef.current;
    if (!c) return;

    const active: any = c.getActiveObject();
    if (!active) return;
    if (active?.isEditing) return;

    if (isActiveSelection(active)) {
      const objs = getSelectionObjects(active);
      const roots = objs
        .map((o) => getSectionRootFromTarget(o) || o)
        .filter(Boolean);
      const unique = Array.from(new Set(roots));
      unique.forEach((o: any) => lockObject(o));
      c.requestRenderAll();
      pushHistory("lock:multi");
      return;
    }

    lockObject(getSectionRootFromTarget(active) || active);
    c.requestRenderAll();
    pushHistory("lock:single");
  }

  function unlockSelectedOrAllLocked() {
    const c = fabricCanvasRef.current;
    if (!c) return;

    const active: any = c.getActiveObject();
    if (active?.isEditing) return;

    if (active) {
      if (isActiveSelection(active)) {
        const objs = getSelectionObjects(active);
        const roots = objs
          .map((o) => getSectionRootFromTarget(o) || o)
          .filter(Boolean);
        const unique = Array.from(new Set(roots));
        unique.forEach((o: any) => unlockObject(o));
        c.requestRenderAll();
        pushHistory("unlock:multi");
        return;
      }

      unlockObject(getSectionRootFromTarget(active) || active);
      c.requestRenderAll();
      pushHistory("unlock:single");
      return;
    }

    // No selection: unlock everything that's locked
    let changed = false;
    c.getObjects().forEach((o: any) => {
      if (o?.isLocked) {
        unlockObject(o);
        changed = true;
      }
    });
    if (changed) {
      c.requestRenderAll();
      pushHistory("unlock:all");
    }
  }

  // -------------------------------
  // Remove Selected Section
  // -------------------------------
  function removeSelectedSection() {
    const c = fabricCanvasRef.current;
    if (!c) return;

    const active: any = c.getActiveObject();
    if (!active) return;
    if (active?.isEditing) return;

    // Multi
    if (isActiveSelection(active)) {
      const objs = getSelectionObjects(active);
      const roots = objs
        .map(getSectionRootFromTarget)
        .filter(Boolean);

      const uniqueRoots = Array.from(new Set(roots));
      if (!uniqueRoots.length) return;

      uniqueRoots.forEach((g: any) => c.remove(g));
      c.discardActiveObject();
      c.requestRenderAll();
      pushHistory("section:remove");
      return;
    }

    // Single
    const root = getSectionRootFromTarget(active);
    if (!root) return;

    c.remove(root);
    c.discardActiveObject();
    c.requestRenderAll();
    pushHistory("section:remove");
  }

  // ==========================================================
  // DUPLICATION SYSTEM (Section-Safe)
  // ==========================================================
  async function cloneObjectSafe(obj: any) {
    return await new Promise((resolve, reject) => {
      try {
        obj.clone((cloned: any) => resolve(cloned));
      } catch (err) {
        reject(err);
      }
    });
  }

  async function duplicateSelectedObjects() {
    const c = fabricCanvasRef.current;
    if (!c) return;

    const active: any = c.getActiveObject();
    if (!active) return;
    if (active?.isEditing) return;
    if (isSystemObjectLive(active)) return;

    const OFFSET = 40;

    const isSectionLike = (o: any) =>
      o?.role === "section" || o?.sectionType || o?.isSectionRoot;

    const cloneWithOffset = async (src: any) => {
      const br = src.getBoundingRect(true, true);
      const cloned: any = await cloneObjectSafe(src);

      cloned.uid = newUid();
      cloned.left = br.left + OFFSET;
      cloned.top = br.top + OFFSET;

      // Handle Section duplication
      if (isSectionLike(src)) {
        cloned.role = "section";
        cloned.sectionType = src.sectionType;
        cloned.sectionId = newSectionId();
        cloned.isSectionRoot = true;

        const kids = cloned.getObjects?.() || cloned._objects || [];
        kids.forEach((k: any) => {
          k.uid = newUid();
          k.role = "sectionItem";
          k.sectionId = cloned.sectionId;
        });

        normalizeSectionGroup(cloned);
      }

      cloned.setCoords?.();
      return cloned;
    };

    // Multi-selection
    if (isActiveSelection(active)) {
      const originals = getSelectionObjects(active);
      const clones = [];

      for (const o of originals) {
        if (isSystemObjectLive(o)) continue;
        const cloned = await cloneWithOffset(o);
        c.add(cloned);
        clones.push(cloned);
      }

      if (clones.length) {
        c.discardActiveObject();
        const sel = new ActiveSelection(clones, { canvas: c } as any);
        c.setActiveObject(sel);
        c.requestRenderAll();
        pushHistory("duplicate:multi");
      }
      return;
    }

    // Single object
    const cloned = await cloneWithOffset(active);
    c.add(cloned);
    c.setActiveObject(cloned);
    c.requestRenderAll();
    pushHistory("duplicate:single");
  }
  // ==========================================================
  // CANVAS INITIALIZATION (Fabric.js)
  // ==========================================================
  useEffect(() => {
    if (!canvasElRef.current) return;

    // -------------------------
    // Define A4
    // -------------------------
    const A4_WIDTH = 2480;
    const A4_HEIGHT = 3508;

    baseWRef.current = A4_WIDTH;
    baseHRef.current = A4_HEIGHT;

    // Safe margins
    const SAFE_MARGIN = 120;

    // Sidebar (optional)
    const SIDEBAR_W = editorConfig.hasSidebar ? 360 : 0;
    const SIDEBAR_GAP = editorConfig.hasSidebar ? 60 : 0;

    const SAFE_LEFT = editorConfig.hasSidebar
      ? SIDEBAR_W + SIDEBAR_GAP
      : SAFE_MARGIN;

    const SAFE_TOP = SAFE_MARGIN;
    const SAFE_RIGHT = A4_WIDTH - SAFE_MARGIN;
    const SAFE_BOTTOM = A4_HEIGHT - SAFE_MARGIN;

    const SAFE_W = SAFE_RIGHT - SAFE_LEFT;
    const SAFE_H = SAFE_BOTTOM - SAFE_TOP;

    safeAreaRef.current = {
      left: SAFE_LEFT,
      top: SAFE_TOP,
      right: SAFE_RIGHT,
      bottom: SAFE_BOTTOM,
      w: SAFE_W,
      h: SAFE_H,
    };

    // -------------------------
    // Create Fabric Canvas
    // -------------------------
    const canvas = new Canvas(canvasElRef.current, {
      width: A4_WIDTH,
      height: A4_HEIGHT,
      backgroundColor: "#ffffff",
      selection: true,
      preserveObjectStacking: true,
      subTargetCheck: true,
    } as any);

    fabricCanvasRef.current = canvas;
    enableGroupTextEditing(canvas);

    isInitialBuildRef.current = true;
    isApplyingHistoryRef.current = true;

    // ==========================================================
    // SYSTEM LAYERS (Sidebar + Safe Guide)
    // ==========================================================
    if (editorConfig.hasSidebar) {
      const sidebarObj = new Rect({
        left: 0,
        top: 0,
        width: SIDEBAR_W,
        height: A4_HEIGHT,
        fill: "#f3f4f6",
        selectable: false,
        evented: false,
      }) as any;

      sidebarObj.role = "sidebar";
      sidebarObj.uid = "system_sidebar";
      sidebarObj.hasControls = false;

      canvas.add(sidebarObj);
    }

    // Safe-area dashed box
    const safeGuide = new Rect({
      left: SAFE_LEFT,
      top: SAFE_TOP,
      width: SAFE_W,
      height: SAFE_H,
      fill: "transparent",
      stroke: "#d1d5db",
      strokeDashArray: [12, 10],
      selectable: false,
      evented: false,
      excludeFromExport: true,
    }) as any;

    safeGuide.role = "safeGuide";
    safeGuide.uid = "system_safeGuide";
    safeGuide.hasControls = false;

    canvas.add(safeGuide);

    // ==========================================================
    // INITIAL USER OBJECTS — Title + Body text
    // ==========================================================
    const title = new Textbox("Your Name", {
      left: editorConfig.titleAlign === "center" ? A4_WIDTH / 2 : SAFE_LEFT,
      top: 180,
      width:
        editorConfig.titleAlign === "center"
          ? A4_WIDTH - SAFE_MARGIN * 2
          : SAFE_W,
      fontSize: editorConfig.titleFontSize,
      fontWeight: "bold",
      textAlign: editorConfig.titleAlign,
      originX: editorConfig.titleAlign === "center" ? "center" : "left",
    }) as any;

    title.uid = newUid();

    const body = new Textbox(
      "Click to edit text.\nThis is the resume body.",
      {
        left: SAFE_LEFT,
        top: 340,
        width: SAFE_W,
        fontSize: editorConfig.bodyFontSize,
        lineHeight: 1.6,
        textAlign: "left",
      }
    ) as any;

    body.uid = newUid();

    canvas.add(title, body);
    canvas.setActiveObject(title);
    canvas.renderAll();

    // ==========================================================
    // SYSTEM OBJECTS JSON — Store separately
    // ==========================================================
    {
      const full = canvas.toDatalessJSON(EXTRA_PROPS as any);
      systemObjectsJsonRef.current = (full.objects || []).filter(
        (o: any) => o.role === "sidebar" || o.role === "safeGuide"
      );
    }

    // ==========================================================
    // SAFE AREA CLAMP (Live Movement + Scaling)
    // ==========================================================
    const clampToSafeArea = (obj: any) => {
      if (!obj || !obj.selectable) return;
      if (obj.role === "sidebar" || obj.role === "safeGuide") return;

      const br = obj.getBoundingRect(true, true);

      // Clamp width
      if (br.width > SAFE_W) {
        const ratio = SAFE_W / br.width;
        obj.scaleX *= ratio;
        obj.scaleY *= ratio;
      }

      // Clamp height
      const br2 = obj.getBoundingRect(true, true);
      if (br2.height > SAFE_H) {
        const ratio = SAFE_H / br2.height;
        obj.scaleX *= ratio;
        obj.scaleY *= ratio;
      }

      const br3 = obj.getBoundingRect(true, true);
      let dx = 0;
      let dy = 0;

      if (br3.left < SAFE_LEFT) dx = SAFE_LEFT - br3.left;
      if (br3.top < SAFE_TOP) dy = SAFE_TOP - br3.top;

      const right = br3.left + br3.width;
      const bottom = br3.top + br3.height;

      if (right > SAFE_RIGHT) dx = SAFE_RIGHT - right;
      if (bottom > SAFE_BOTTOM) dy = SAFE_BOTTOM - bottom;

      obj.left += dx;
      obj.top += dy;
      obj.setCoords();
    };

    canvas.on("object:moving", (e) => {
      if (!e.target) return;
      clampToSafeArea(e.target);
    });

    canvas.on("object:scaling", (e) => {
      if (!e.target) return;
      clampToSafeArea(e.target);
    });

    canvas.on("object:modified", (e) => {
      if (!e.target) return;
      clampToSafeArea(e.target);
    });

    // ==========================================================
    // INITIAL PAGE SETUP
    // ==========================================================
    const baseline = serializeUserSnapshot(canvas);

    pagesRef.current = [baseline];
    pageHistoryRef.current = [
      { undo: [baseline], redo: [], lastStr: JSON.stringify(baseline) },
    ];

    setPageIndex(0);
    setPageCount(1);

    isApplyingHistoryRef.current = false;
    isInitialBuildRef.current = false;

    // ==========================================================
    // HISTORY EVENTS
    // ==========================================================
    canvas.on("object:modified", (e: any) => {
      const t: any = e?.target;
      if (!t) return;
      if (isSystemObjectLive(t)) return;
      if (isApplyingHistoryRef.current || isInitialBuildRef.current) return;

      pushHistory("object:modified");
    });

    canvas.on("text:changed", (e: any) => {
      const t: any = e.target;
      if (!t) return;
      if (isSystemObjectLive(t)) return;
      if (isApplyingHistoryRef.current || isInitialBuildRef.current) return;

      scheduleHistoryPush("text:changed", 300);
    });

    canvas.on("text:editing:exited", (e: any) => {
      const t: any = e.target;
      if (!t) return;
      if (isSystemObjectLive(t)) return;
      if (isApplyingHistoryRef.current || isInitialBuildRef.current) return;

      pushHistory("text:exit");
    });

    // ==========================================================
    // CLEANUP
    // ==========================================================
    return () => {
      if (historyDebounceRef.current) {
        clearTimeout(historyDebounceRef.current);
        historyDebounceRef.current = null;
      }

      canvas.dispose();
      fabricCanvasRef.current = null;
    };
  }, [
    templateId,
    editorConfig.hasSidebar,
    editorConfig.titleAlign,
    editorConfig.titleFontSize,
    editorConfig.bodyFontSize,
    EXTRA_PROPS,
  ]);

  // ==========================================================
  // ZOOM RECALC
  // ==========================================================
  useEffect(() => {
    const c = fabricCanvasRef.current;
    if (!c) return;

    c.setZoom(zoomScale);
    c.setWidth(baseWRef.current * zoomScale);
    c.setHeight(baseHRef.current * zoomScale);
    c.calcOffset();
    c.requestRenderAll();
  }, [zoomScale]);

  // ==========================================================
  // KEYBOARD SHORTCUTS
  // ==========================================================
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const c = fabricCanvasRef.current;
      if (!c) return;

      const active = c.getActiveObject();
      if (active?.isEditing) return;

      if (e.key === "Delete" || e.key === "Backspace") {
        deleteSelectedObjects();
        return;
      }

      const isMac = navigator.platform.toLowerCase().includes("mac");
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (!mod) return;

      const key = e.key.toLowerCase();

      if (key === "d") {
        e.preventDefault();
        duplicateSelectedObjects();
      }

      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }

      if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault();
        redo();
      }

      if (key === "l" && !e.shiftKey) {
        e.preventDefault();
        lockSelectedObjects();
      }

      if (key === "l" && e.shiftKey) {
        e.preventDefault();
        unlockSelectedOrAllLocked();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [zoomScale, pageIndex]);

  // ==========================================================
  // MULTI-PAGE SYSTEM — Snapshots + Switching + Page Ops
  // ==========================================================

  // Save the current page snapshot
  function saveCurrentPageSnapshot() {
    const c = fabricCanvasRef.current;
    if (!c) return;

    const snap = serializeUserSnapshot(c);
    pagesRef.current[pageIndex] = snap;

    const ph = getPH(pageIndex);
    const str = JSON.stringify(snap);

    if (ph.undo.length === 0) ph.undo = [snap];
    ph.lastStr = str;
  }

  // Apply a new snapshot (used when switching pages)
  async function switchToPage(nextIndex: number) {
    const c = fabricCanvasRef.current;
    if (!c) return;

    if (nextIndex < 0 || nextIndex >= pagesRef.current.length) return;

    isSwitchingPageRef.current = true;

    // Save current page before leaving
    saveCurrentPageSnapshot();
    setPageIndex(nextIndex);

    const snap = pagesRef.current[nextIndex];
    await applySnapshot(snap);

    isSwitchingPageRef.current = false;
  }

  // Add a brand-new blank page
  function addPage() {
    saveCurrentPageSnapshot();

    const empty: Snapshot = { objects: [] };

    // Insert after current page
    pagesRef.current.splice(pageIndex + 1, 0, empty);

    pageHistoryRef.current.splice(pageIndex + 1, 0, {
      undo: [empty],
      redo: [],
      lastStr: JSON.stringify(empty),
    });

    setPageCount(pagesRef.current.length);
    switchToPage(pageIndex + 1);
  }

  // Duplicate current page (full clone)
  function duplicatePage() {
    saveCurrentPageSnapshot();

    const snap = pagesRef.current[pageIndex];
    const cloned: Snapshot = JSON.parse(JSON.stringify(snap));

    pagesRef.current.splice(pageIndex + 1, 0, cloned);
    pageHistoryRef.current.splice(pageIndex + 1, 0, {
      undo: [cloned],
      redo: [],
      lastStr: JSON.stringify(cloned),
    });

    setPageCount(pagesRef.current.length);
    switchToPage(pageIndex + 1);
  }

  // Delete current page
  function deletePage() {
    if (pagesRef.current.length <= 1) return;

    pagesRef.current.splice(pageIndex, 1);
    pageHistoryRef.current.splice(pageIndex, 1);

    const newCount = pagesRef.current.length;
    setPageCount(newCount);

    const next = Math.min(pageIndex, newCount - 1);
    switchToPage(next);
  }

  // Move current page to the left
  function movePageLeft() {
    if (pageIndex <= 0) return;
    saveCurrentPageSnapshot();

    const p = pagesRef.current;
    const h = pageHistoryRef.current;

    [p[pageIndex - 1], p[pageIndex]] = [p[pageIndex], p[pageIndex - 1]];
    [h[pageIndex - 1], h[pageIndex]] = [h[pageIndex], h[pageIndex - 1]];

    setPageIndex((i) => i - 1);
  }

  // Move current page to the right
  function movePageRight() {
    if (pageIndex >= pagesRef.current.length - 1) return;
    saveCurrentPageSnapshot();

    const p = pagesRef.current;
    const h = pageHistoryRef.current;

    [p[pageIndex + 1], p[pageIndex]] = [p[pageIndex], p[pageIndex + 1]];
    [h[pageIndex + 1], h[pageIndex]] = [h[pageIndex], h[pageIndex + 1]];

    setPageIndex((i) => i + 1);
  }

  // ----------------------------------------------------------
  // EXPORT: All pages to PDF
  // ----------------------------------------------------------
  function exportAllPagesPdf() {
    if (showAd || pendingDownloadRef.current) return;

    const runExport = async () => {
      const c = fabricCanvasRef.current;
      if (!c) return;

      saveCurrentPageSnapshot();

      const originalIndex = pageIndex;
      const originalSnap = pagesRef.current[pageIndex];
      const originalZoom = c.getZoom();
      const originalW = c.getWidth();
      const originalH = c.getHeight();

      const pageW = baseWRef.current;
      const pageH = baseHRef.current;

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "px",
        format: [pageW, pageH],
      });

      try {
        for (let i = 0; i < pagesRef.current.length; i++) {
          await applySnapshot(pagesRef.current[i]);

          c.setZoom(1);
          c.setWidth(pageW);
          c.setHeight(pageH);
          c.calcOffset();
          c.requestRenderAll();

          await new Promise((r) => setTimeout(r, 50));

          const dataUrl = c.toDataURL({
            format: "png",
            multiplier: 1,
            quality: 1,
          });

          if (i > 0) pdf.addPage([pageW, pageH], "portrait");
          pdf.addImage(dataUrl, "PNG", 0, 0, pageW, pageH);
        }
      } finally {
        await applySnapshot(originalSnap);
        setPageIndex(originalIndex);
        c.setZoom(originalZoom);
        c.setWidth(originalW);
        c.setHeight(originalH);
        c.calcOffset();
        c.requestRenderAll();
      }

      pdf.save("resume.pdf");
    };

    pendingDownloadRef.current = runExport;
    setShowAd(true);
  }

  // AD countdown + modal actions
  useEffect(() => {
    if (!showAd) return;

    setSecondsLeft(12);
    const t = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(t);
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    return () => clearInterval(t);
  }, [showAd]);

  function confirmDownload() {
    setShowAd(false);
    const fn = pendingDownloadRef.current;
    pendingDownloadRef.current = null;
    fn?.();
  }

  function cancelAdGate() {
    setShowAd(false);
    pendingDownloadRef.current = null;
  }

  // ===================================================================
  // UI + CANVAS WRAPPER + PAGE CONTROLS + SECTION CONTROLS + AD MODAL
  // ===================================================================
  return (
    <main className="p-6">

      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">

        {/* Back Button */}
        <button onClick={() => router.back()} className="border px-3 py-1">
          Back
        </button>

        {/* Controls */}
        <div className="flex gap-2 flex-wrap items-center">

          {/* PDF Export */}
          <button
            onClick={() => {
              console.log("PDF button clicked");
              exportAllPagesPdf();
            }}
            className="bg-black text-white px-3 py-1 rounded"
            title="Exports all pages to one PDF"
          >
            Download PDF (All Pages)
          </button>

          {/* Add Section Controls */}
          <div className="flex gap-2 items-center border rounded px-2 py-1 bg-white">
            <span className="text-sm text-zinc-600">Add Section:</span>

            <button
              className="border px-2 py-1 rounded"
              onClick={() => addSection("education")}
              title="Add Education section"
            >
              Education
            </button>

            <button
              className="border px-2 py-1 rounded"
              onClick={() => addSection("experience")}
              title="Add Experience section"
            >
              Experience
            </button>

            <button
              className="border px-2 py-1 rounded"
              onClick={() => addSection("skills")}
              title="Add Skills section"
            >
              Skills
            </button>

            {/* Remove Section */}
            <button
              className="border px-2 py-1 rounded"
              onClick={removeSelectedSection}
              title="Remove selected section"
            >
              Remove Section
            </button>
          </div>

          {/* Undo / Redo */}
          <button
            onClick={undo}
            className="border px-3 py-1 rounded"
            title="Undo"
          >
            Undo
          </button>

          <button
            onClick={redo}
            className="border px-3 py-1 rounded"
            title="Redo"
          >
            Redo
          </button>

          {/* Zoom Controls */}
          <button
            onClick={() => setZoom((z) => Math.max(zoomMin, z - zoomStep))}
            className="border px-3 py-1 rounded"
          >
            – Zoom
          </button>

          <button
            onClick={() => setZoom(25)}
            className="border px-3 py-1 rounded"
          >
            Reset
          </button>

          <button
            onClick={() => setZoom((z) => Math.min(zoomMax, z + zoomStep))}
            className="border px-3 py-1 rounded"
          >
            + Zoom
          </button>

          <span className="text-sm text-zinc-700">{zoom}%</span>

          {/* Page Controls */}
          <div className="ml-4 flex gap-2 items-center border rounded px-2 py-1 bg-white">

            <button
              className="border px-2 py-1 rounded"
              onClick={() => switchToPage(pageIndex - 1)}
              disabled={pageIndex === 0}
              title="Previous page"
            >
              ◀
            </button>

            <span className="text-sm">
              Page {pageIndex + 1}/{pageCount}
            </span>

            <button
              className="border px-2 py-1 rounded"
              onClick={() => switchToPage(pageIndex + 1)}
              disabled={pageIndex >= pageCount - 1}
              title="Next page"
            >
              ▶
            </button>

            <button
              className="border px-2 py-1 rounded"
              onClick={addPage}
              title="Add new page"
            >
              + Page
            </button>

            <button
              className="border px-2 py-1 rounded"
              onClick={duplicatePage}
              title="Duplicate page"
            >
              Duplicate
            </button>

            <button
              className="border px-2 py-1 rounded"
              onClick={deletePage}
              disabled={pageCount <= 1}
              title="Delete page"
            >
              Delete
            </button>

            <button
              className="border px-2 py-1 rounded"
              onClick={movePageLeft}
              disabled={pageIndex === 0}
              title="Move page left"
            >
              ←
            </button>

            <button
              className="border px-2 py-1 rounded"
              onClick={movePageRight}
              disabled={pageIndex >= pageCount - 1}
              title="Move page right"
            >
              →
            </button>
          </div>
        </div>

        <div className="text-sm text-zinc-600">
          Template ID: {templateId}
        </div>
      </div>

      {/* Canvas Container */}
      <div className="flex justify-center overflow-auto border rounded-lg bg-zinc-100 p-4">
        <div
          style={{
            width: baseWRef.current * zoomScale,
            height: baseHRef.current * zoomScale,
            background: "white",
            boxShadow: "0 10px 30px rgba(0,0,0,0.15)"
          }}
        >
          <canvas ref={canvasElRef} />
        </div>
      </div>

      {/* AD MODAL */}
      {showAd &&
        createPortal(
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
              padding: 16
            }}
          >
            <div
              style={{
                background: "white",
                borderRadius: 16,
                padding: 24,
                width: "100%",
                maxWidth: 520
              }}
            >
              <h2 style={{ fontWeight: 700, fontSize: 18 }}>
                Almost there…
              </h2>

              <p style={{ marginTop: 8, fontSize: 14 }}>
                Watch this short ad to unlock download.
              </p>

              <div
                style={{
                  marginTop: 16,
                  background: "#e5e7eb",
                  borderRadius: 12,
                  height: 220,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                Ad Placeholder
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: 16
                }}
              >
                <span style={{ fontSize: 14 }}>
                  {secondsLeft > 0
                    ? `Unlocking in ${secondsLeft}s`
                    : "Unlocked ✅"}
                </span>

                <button
                  disabled={secondsLeft > 0}
                  onClick={confirmDownload}
                  style={{
                    background: "black",
                    color: "white",
                    border: 0,
                    padding: "10px 16px",
                    borderRadius: 10,
                    cursor: secondsLeft > 0 ? "not-allowed" : "pointer",
                    opacity: secondsLeft > 0 ? 0.5 : 1
                  }}
                >
                  Download
                </button>
              </div>

              <button
                onClick={cancelAdGate}
                style={{
                  marginTop: 12,
                  fontSize: 14,
                  textDecoration: "underline",
                  background: "transparent",
                  border: 0,
                  padding: 0,
                  cursor: "pointer"
                }}
              >
                Cancel
              </button>
            </div>
          </div>,
          document.body
        )}
    </main>
  );
}
