"use client";

import { TEMPLATE_EDITOR_CONFIG } from "../../../../data/templates";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useParams, useRouter } from "next/navigation";
import { Canvas, Textbox, Rect, FabricObject, ActiveSelection, Group } from "fabric";
import { jsPDF } from "jspdf";
import AdSenseSlot from "../../../components/AdSenseSlot";

// =========================
// 🎨 THEMES (Color Presets)
// =========================
type ThemeId = "classic" | "charcoal" | "soft" | "cream";

const THEMES: Record<ThemeId, any> = {
  classic: {
    sidebarBg: "#f3f4f6",
    safeGuideStroke: "#d1d5db",
    divider: "#111827",
    text: "#111827",
    pageBg: "#ffffff",
  },

  charcoal: {
    sidebarBg: "#111827",
    safeGuideStroke: "#374151",
    divider: "#60a5fa",
    text: "#e5e7eb",
    pageBg: "#0b1220",
  },

  soft: {
    sidebarBg: "#eef2f7",
    safeGuideStroke: "#cbd5e1",
    divider: "#334155",
    text: "#0f172a",
    pageBg: "#f8fafc",
  },

  cream: {
    sidebarBg: "#ffedd5",
    safeGuideStroke: "#fdba74",
    divider: "#9a3412",
    text: "#1f2937",
    pageBg: "#fff7ed",
  },
};
type Theme = {
  id: ThemeId;
  name: string;
};

const THEME_PRESETS: Theme[] = [
  { id: "classic", name: "Classic" },
  { id: "charcoal", name: "Charcoal" },
  { id: "soft", name: "Soft" },
  { id: "cream", name: "Cream" },
];
type Snapshot = {
  objects: any[];
  backgroundColor?: string;
  themeId?: ThemeId; // ✅ add
};

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

export default function EditorPage() {
  // ===============================
// STEP 15.1 — USER MODE (MVP)
// ===============================

  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const fabricCanvasRef = useRef<Canvas | null>(null);
  const isMountedRef = useRef(true);
  

  const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT || "";
  const ADSENSE_SLOT = process.env.NEXT_PUBLIC_ADSENSE_SLOT || "";

  // Base A4 size refs (used by zoom)
  const baseWRef = useRef<number>(2480);
  const baseHRef = useRef<number>(3508);

  const safeAreaRef = useRef<SafeArea | null>(null);

  const params = useParams<{ id: string }>();
  const router = useRouter();

  const templateId = (params?.id || "t001") as string;
  const STORAGE_KEY = useMemo(() => `studiosislab:draft:${templateId}`, [templateId]);
  // ✅ Drafts index (global)
const DRAFTS_INDEX_KEY = "studiosislab:drafts:index";

type DraftIndexItem = {
  key: string;        // localStorage key (STORAGE_KEY)
  templateId: string; // e.g. "t002"
  updatedAt: number;
};

function upsertDraftIndex(item: DraftIndexItem) {
  try {
    const raw = localStorage.getItem(DRAFTS_INDEX_KEY);
    const list: DraftIndexItem[] = raw ? JSON.parse(raw) : [];

    const next = list.filter((x) => x.key !== item.key);
    next.unshift(item); // latest first

    localStorage.setItem(DRAFTS_INDEX_KEY, JSON.stringify(next.slice(0, 50)));
  } catch {}
}

function removeDraftFromIndex(key: string) {
  try {
    const raw = localStorage.getItem(DRAFTS_INDEX_KEY);
    const list: DraftIndexItem[] = raw ? JSON.parse(raw) : [];
    const next = list.filter((x) => x.key !== key);
    localStorage.setItem(DRAFTS_INDEX_KEY, JSON.stringify(next));
  } catch {}
}

// ✅ Single source of truth for draft persistence (prevents double-saves + wrong pageIndex)
function persistDraft(opts?: { pageIndex?: number; now?: number }) {
  try {
    const now = typeof opts?.now === "number" ? opts!.now : Date.now();
    const idx =
      typeof opts?.pageIndex === "number" ? opts!.pageIndex : pageIndexRef.current;

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        templateId,
        pages: pagesRef.current,
        pageIndex: idx,
        updatedAt: now,
      })
    );

    upsertDraftIndex({ key: STORAGE_KEY, templateId, updatedAt: now });
    setLastSavedAt(now);
  } catch {}
}
  const editorConfig =
    TEMPLATE_EDITOR_CONFIG[templateId] || TEMPLATE_EDITOR_CONFIG["t001"];
  const allowedThemes =
    editorConfig.allowedThemes || (Object.keys(THEMES) as ThemeId[]);
  const defaultThemeId = (editorConfig.defaultThemeId || "classic") as ThemeId;
  const safeDefaultTheme: ThemeId = allowedThemes.includes(defaultThemeId)
  ? defaultThemeId
  : allowedThemes[0] || "classic";
  const themeIdRef = useRef<ThemeId>(safeDefaultTheme);
  

  // --- Ad Gate state ---
  // =========================
// 🧑‍💼 USER TYPE (MVP)
// =========================
// Later this will come from auth
  const USER_TYPE: "guest" | "pro" = "guest";
  const [showAd, setShowAd] = useState(false);
  const AD_DURATION = 12; // seconds
  const adTimerRef = useRef<number | null>(null);
  // ✅ Drafts modal
  const [showDrafts, setShowDrafts] = useState(false);
  const [drafts, setDrafts] = useState<DraftIndexItem[]>([]);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const pendingDownloadRef = useRef<null | (() => void)>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState({ current: 0, total: 0 });
  const [exportMode, setExportMode] = useState<"fast" | "high">("fast");
  const [fontFamily, setFontFamily] = useState("Arial");
  const [fontSize, setFontSize] = useState(38);
  const [isBold, setIsBold] = useState(false);
  const [textAlign, setTextAlign] = useState<"left" | "center" | "right">("left");
  const [lineHeight, setLineHeight] = useState(1.6);
  const [charSpacing, setCharSpacing] = useState(0); // Fabric uses "charSpacing" (0..500 typically)
  const [themeId, setThemeId] = useState<ThemeId>(safeDefaultTheme);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isSendingForSignature, setIsSendingForSignature] = useState(false);
  const [lastEnvelopeId, setLastEnvelopeId] = useState<string | null>(null);
  const envelopeIdResolved =
  lastEnvelopeId ||
  (typeof window !== "undefined" && (window as any).lastEnvelopeId) ||
  (typeof window !== "undefined" && localStorage.getItem("lastEnvelopeId")) ||
  null;



  useEffect(() => {
  const saved = localStorage.getItem("lastEnvelopeId");
  if (saved && !lastEnvelopeId) setLastEnvelopeId(saved);
}, [lastEnvelopeId]);
  const [envelopeStatus, setEnvelopeStatus] = useState<string | null>(null);

const fetchEnvelopeStatus = async () => {
  if (!envelopeIdResolved) return null;

  const res = await fetch(
    `/api/docusign/status?envelopeId=${encodeURIComponent(envelopeIdResolved)}`
  );

  // ⛔ Stop polling if unauthorized (token expired)
  if (res.status === 401) {
    console.warn("DocuSign auth expired. Stopping status polling.");
    setEnvelopeStatus("unknown"); // optional but good UX
    return null;
  }

  if (!res.ok) return null;

  const json = await res.json();
  setEnvelopeStatus(json.status);
  return json.status;
};

const checkEnvelopeStatus = async () => {
  const status = await fetchEnvelopeStatus();

  if (!status) {
    alert("❌ No envelopeId found");
    return;
  }

  alert(`Envelope Status: ${status}`);
};

useEffect(() => {
  if (!envelopeIdResolved) return;
  if (envelopeStatus === "completed") return;

  fetchEnvelopeStatus();

  const interval = setInterval(() => {
    fetchEnvelopeStatus();
  }, 10000);

  return () => clearInterval(interval);
}, [envelopeIdResolved, envelopeStatus]);

  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  useEffect(() => {
  themeIdRef.current = themeId;
}, [themeId]);
  const [fontWeight, setFontWeight] = useState<"normal" | "500" | "600" | "bold">("normal");

  // --- Zoom ---
  const [zoom, setZoom] = useState(25); // percent
  const zoomMin = 15;
  const zoomMax = 80;
  const zoomStep = 5;
  const zoomScale = zoom / 100;

  // ---------------- MULTI PAGE ----------------
  const [pageIndex, setPageIndex] = useState(0); // 0-based
  const pageIndexRef = useRef(0);

useEffect(() => {
  pageIndexRef.current = pageIndex;
}, [pageIndex]);
  const [pageCount, setPageCount] = useState(1);

  const pagesRef = useRef<Snapshot[]>([]);
  const pageHistoryRef = useRef<PageHistory[]>([]);
  const isSwitchingPageRef = useRef(false);

  // ---------------- HISTORY ----------------
  const isApplyingHistoryRef = useRef(false);
  const isInitialBuildRef = useRef(true);

  const historyDebounceRef = useRef<number | null>(null);
  const HISTORY_LIMIT = 60;

  // ✅ System layers stored separately (sidebar + safeGuide)
  const systemObjectsJsonRef = useRef<any[]>([]);

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
      "fill",
      "backgroundColor",
      "role",
      "isLocked",
      "uid",
      // ✅ Step 9 section metadata
      "sectionType",
      "sectionId",
      "isSectionRoot",
    ],
    []
  );

  function newUid() {
    return `obj_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  function newSectionId() {
    return `sec_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  function isSystemObjectJson(objJson: any) {
    return objJson?.role === "sidebar" || objJson?.role === "safeGuide";
  }

  function isSystemObjectLive(obj: any) {
    return obj?.role === "sidebar" || obj?.role === "safeGuide";
  }

  function getFullJson(c: Canvas) {
    return c.toDatalessJSON(EXTRA_PROPS as any) as any;
  }

  function serializeUserSnapshot(c: Canvas): Snapshot {
  const full = getFullJson(c);
  const userObjects = (full.objects || []).filter(
    (o: any) => !isSystemObjectJson(o)
  );

  return {
  objects: userObjects,
  backgroundColor: (c as any).backgroundColor || "#ffffff",
  themeId: (themeIdRef.current || safeDefaultTheme) as ThemeId, // ✅ add
};
}

  function getPH(i: number): PageHistory {
    if (!pageHistoryRef.current[i]) {
      pageHistoryRef.current[i] = { undo: [], redo: [], lastStr: "" };
    }
    return pageHistoryRef.current[i];
  }

  function pushHistory(reason: string) {
    const c = fabricCanvasRef.current;
    if (!c) return;

    if (isInitialBuildRef.current) return;
    if (isApplyingHistoryRef.current) return;
    if (isSwitchingPageRef.current) return;

    const idx = pageIndexRef.current;
    const ph = getPH(idx);

    const snap = serializeUserSnapshot(c);
    const str = JSON.stringify(snap);
    if (str === ph.lastStr) return;

    ph.undo.push(snap);
    ph.lastStr = str;
    ph.redo = [];

    if (ph.undo.length > HISTORY_LIMIT) {
      ph.undo.shift();
    }

    // ✅ keep current page snapshot updated
    pagesRef.current[idx] = snap;
    

// ✅ Auto-save draft to localStorage
// ✅ Auto-save draft to localStorage (always uses pageIndexRef.current)
persistDraft({ pageIndex: pageIndexRef.current });

  }

  function scheduleHistoryPush(reason: string, delayMs = 250) {
    if (historyDebounceRef.current)
      window.clearTimeout(historyDebounceRef.current);
    historyDebounceRef.current = window.setTimeout(() => {
      pushHistory(reason);
      historyDebounceRef.current = null;
    }, delayMs);
  }

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

  function isTypingInInput(e: KeyboardEvent) {
    const t = e.target as HTMLElement | null;
    if (!t) return false;

    const tag = t.tagName?.toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return true;
    if ((t as any).isContentEditable) return true;

    return false;
  }

  function isActiveSelection(obj: any) {
    if (!obj) return false;
    if (obj instanceof ActiveSelection) return true;
    const t = String(obj.type || "").toLowerCase();
    return t === "activeselection" || t === "activeselection";
  }

  function getSelectionObjects(sel: any): any[] {
    return sel?.getObjects?.() || sel?._objects || [];
  }

  function deleteSelectedObjects() {
    const c = fabricCanvasRef.current;
    if (!c) return;

    const active: any = c.getActiveObject();
    if (!active) return;
    if (active?.isEditing) return;

    if (isActiveSelection(active)) {
      const objs = getSelectionObjects(active);
      const deletable = objs.filter(
        (o: any) => !isSystemObjectLive(o) && o?.selectable !== false
      );
      if (!deletable.length) return;

      deletable.forEach((o: any) => c.remove(o));
      c.discardActiveObject();
      c.requestRenderAll();
      pushHistory("delete:multi");
      return;
    }

    if (isSystemObjectLive(active)) return;
    if (active?.selectable === false) return;

    c.remove(active);
    c.discardActiveObject();
    c.requestRenderAll();
    pushHistory("delete:single");
  }

  async function cloneObjectSafe(obj: any): Promise<any> {
    if (typeof obj?.clone !== "function") {
      throw new Error("Object has no clone()");
    }

    try {
      const res = obj.clone();
      if (res && typeof res.then === "function") return await res;
      if (res) return res;
    } catch (e) {}

    return await new Promise((resolve, reject) => {
      try {
        obj.clone((cloned: any) => resolve(cloned));
      } catch (err) {
        reject(err);
      }
    });
  }

  function clampToSafeAreaLive(obj: any) {
    const a = safeAreaRef.current;
    if (!a) return;
    if (!obj || obj?.selectable === false) return;
    if (isSystemObjectLive(obj)) return;

    const br = obj.getBoundingRect(true, true);

    let dx = 0;
    let dy = 0;

    if (br.left < a.left) dx = a.left - br.left;
    if (br.top < a.top) dy = a.top - br.top;

    const right = br.left + br.width;
    const bottom = br.top + br.height;

    if (right > a.right) dx = a.right - right;
    if (bottom > a.bottom) dy = a.bottom - bottom;

    if (dx || dy) {
      obj.left = (obj.left || 0) + dx;
      obj.top = (obj.top || 0) + dy;
      obj.setCoords?.();
    }
  }

  // ==========================================================
  // ✅ STEP 9 — SECTION BLOCKS (Education / Experience / Skills)
  // ==========================================================
  type SectionType = "education" | "experience" | "skills";

  function getNextSectionTop() {
    const c = fabricCanvasRef.current;
const a = safeAreaRef.current;

if (!c || !a) return 520; // fallback height when refs not ready

    const GAP = 36;
    let maxBottom = 520;

    c.getObjects().forEach((o: any) => {
      if (o?.role !== "section") return;
      const br = o.getBoundingRect(true, true);
      const bottom = br.top + br.height;
      if (bottom > maxBottom) maxBottom = bottom;
    });

    return Math.min(maxBottom + GAP, (a?.bottom ?? 0) - 200);
  }

  // ✅ UPDATE #1: normalizeSectionGroup(g)
  // Keep group draggable/selectable; children not draggable.
  // Make textboxes NOT selectable on single click, but still evented
  // so dblclick can enter editing.
  function normalizeSectionGroup(g: any) {
    if (!g) return;

    g.subTargetCheck = true;
    g.interactive = true;
    g.lockRotation = true;

    const kids = g.getObjects?.() || g._objects || [];
    kids.forEach((k: any) => {
      const isTextbox = String(k?.type || "").toLowerCase() === "textbox";

      if (isTextbox) {
        k.selectable = false; // ✅ important: prevents ungroup-feel on click
        k.evented = true; // ✅ still hit-testable for dblclick
        k.hoverCursor = "text";

        k.hasControls = false;
        k.lockMovementX = true;
        k.lockMovementY = true;
        k.lockScalingX = true;
        k.lockScalingY = true;
        k.lockRotation = true;
      } else {
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

  function createSectionGroup(sectionType: SectionType, left: number, top: number) {
    const a = safeAreaRef.current;
    if (!a) return null;

    const sectionId = newSectionId();
    const W = a.right - left;

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
      fill: (THEMES[themeIdRef.current] || THEMES.classic).text,
      textAlign: "left",
      editable: true,
      selectable: true,
      evented: true,
    }) as any;
    title.uid = newUid();
    title.role = "sectionItem";
    title.sectionId = sectionId;

    const divider = new Rect({
      left: 0,
      top: 72,
      width: W,
      height: 6,
      fill: (THEMES[themeIdRef.current] || THEMES.classic).divider,
      selectable: false,
      evented: false,
      excludeFromExport: false,
    }) as any;
    divider.uid = newUid();
    divider.role = "sectionItem";
    divider.sectionId = sectionId;

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
      fill: (THEMES[themeIdRef.current] || THEMES.classic).text,
      textAlign: "left",
      editable: true,
      selectable: true,
      evented: true,
    }) as any;
    content.uid = newUid();
    content.role = "sectionItem";
    content.sectionId = sectionId;

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
    clampToSafeAreaLive(g);

    return g;
  }

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
function getSectionRootFromTarget(target: any): any | null {
  const c = fabricCanvasRef.current;
  if (!c || !target) return null;

  // 1) Group itself
  if (target?.role === "section") return target;

  // 2) Child with direct group
  const directParent = target?.group;
  if (directParent?.role === "section") return directParent;

  // 3) Match by sectionId
  const sid = target?.sectionId;
  if (sid) {
    const found = c
      .getObjects()
      .find((o: any) => o?.role === "section" && o?.sectionId === sid);
    if (found) return found;
  }

  return null;
}

function removeSelectedSection() {
  const c = fabricCanvasRef.current;
  if (!c) return;

    const active: any = c.getActiveObject();
  if (!active) return;

  // ✅ optional safety: don't remove system objects
  if (isSystemObjectLive(active)) return;

  // Prevent accidental delete while editing text
  if (active?.isEditing) return;

  // Multi-selection
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
    pushHistory("section:remove:multi");
    return;
  }

  // Single object
  const root = getSectionRootFromTarget(active);
  if (!root) return;

  c.remove(root);
  c.discardActiveObject();
  c.requestRenderAll();
  pushHistory("section:remove:single");
}
// ---------------- DUPLICATE (cleanup) ----------------
async function duplicateSelectedObjects() {
  const c = fabricCanvasRef.current;
  if (!c) return;

  const active: any = c.getActiveObject();
  if (!active) return;
  if (active?.isEditing) return;
  if (isSystemObjectLive(active)) return;

  const OFFSET = 40;

  const isSectionLike = (o: any) =>
    o?.role === "section" || !!o?.sectionType || !!o?.isSectionRoot;

  const cloneWithOffset = async (src: any) => {
    const br = src.getBoundingRect(true, true);

    let cloned: any = await cloneObjectSafe(src);
    if (!cloned.uid) cloned.uid = newUid();

    // ✅ IMPORTANT: base section detection on the SOURCE (src),
    // because Fabric clone may drop custom props like role/sectionType.
    if (isSectionLike(src)) {
      // Force section metadata back onto clone
      cloned.role = "section";
      cloned.sectionType = src.sectionType || cloned.sectionType;
      cloned.sectionId = newSectionId();
      cloned.isSectionRoot = true;

      // Keep group hit-testing
      cloned.subTargetCheck = true;
      cloned.interactive = true;
      cloned.lockRotation = true;

      // Re-tag children + normalize behavior
      const kids = cloned.getObjects?.() || cloned._objects || [];
      kids.forEach((k: any) => {
        if (!k.uid) k.uid = newUid();
        k.role = k.role || "sectionItem";
        k.sectionId = cloned.sectionId;
      });

      normalizeSectionGroup(cloned);
    }

    cloned.set({ left: br.left + OFFSET, top: br.top + OFFSET });
    cloned.setCoords?.();
    clampToSafeAreaLive(cloned);
    return cloned;
  };

  if (isActiveSelection(active)) {
    const originals = getSelectionObjects(active);
    if (!originals.length) return;

    const clones: any[] = [];
    for (const obj of originals) {
      if (isSystemObjectLive(obj) || obj?.selectable === false) continue;
      const cloned = await cloneWithOffset(obj);
      c.add(cloned);
      clones.push(cloned);
    }

    if (!clones.length) return;

    c.discardActiveObject();
    const sel = new ActiveSelection(clones, { canvas: c } as any);
    c.setActiveObject(sel);

    c.requestRenderAll();
    pushHistory("duplicate:multi");
    return;
  }

  if (active?.selectable === false) return;

  const cloned = await cloneWithOffset(active);
  c.add(cloned);
  c.setActiveObject(cloned);

  c.requestRenderAll();
  pushHistory("duplicate:single");
}

  function lockSelectedObjects() {
    const c = fabricCanvasRef.current;
    if (!c) return;

    const active: any = c.getActiveObject();
    if (!active) return;
    if (active?.isEditing) return;

    if (isActiveSelection(active)) {
      const objs = getSelectionObjects(active);
      const lockable = objs.filter(
        (o: any) => !isSystemObjectLive(o) && o?.selectable !== false
      );
      if (!lockable.length) return;

      lockable.forEach((o: any) => lockObject(o));
      c.discardActiveObject();
      c.requestRenderAll();
      pushHistory("lock:multi");
      return;
    }

    if (isSystemObjectLive(active)) return;
    if (active?.selectable === false) return;

    lockObject(active);
    c.discardActiveObject();
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
        const unlockable = objs.filter((o: any) => !isSystemObjectLive(o));
        if (!unlockable.length) return;

        unlockable.forEach((o: any) => unlockObject(o));
        c.discardActiveObject();
        c.requestRenderAll();
        pushHistory("unlock:multi");
        return;
      }

      if (!isSystemObjectLive(active)) {
        unlockObject(active);
        c.discardActiveObject();
        c.requestRenderAll();
        pushHistory("unlock:single");
        return;
      }
    }

    let changed = false;
    c.getObjects().forEach((o: any) => {
      if (isSystemObjectLive(o)) return;
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
// ==========================================================
// ✅ STEP 10 — FONT & STYLE CONTROLS (Selection-based)
// ==========================================================

const FONT_FAMILIES = [
  "Arial",
  "Times New Roman",
  "Georgia",
  "Verdana",
  "Tahoma",
  "Trebuchet MS",
  "Courier New",
];

function getSelectedTextboxes(): any[] {
  const c = fabricCanvasRef.current;
  if (!c) return [];

  const active: any = c.getActiveObject();
  if (!active) return [];

  const isTextbox = (o: any) => String(o?.type || "").toLowerCase() === "textbox";
  const isGroup = (o: any) => String(o?.type || "").toLowerCase() === "group";
  const isActiveSel =
    active instanceof ActiveSelection ||
    String(active?.type || "").toLowerCase() === "activeselection";

  // 1) single textbox
  if (isTextbox(active)) return [active];

  // 2) group selected => apply to all textboxes inside
  if (isGroup(active)) {
    const kids = active.getObjects?.() || active._objects || [];
    return kids.filter(isTextbox);
  }

  // 3) multi-select => apply to any selected textboxes + group textboxes
  if (isActiveSel) {
    const objs = active.getObjects?.() || active._objects || [];
    const out: any[] = [];
    objs.forEach((o: any) => {
      if (isTextbox(o)) out.push(o);
      else if (isGroup(o)) {
        const kids = o.getObjects?.() || o._objects || [];
        out.push(...kids.filter(isTextbox));
      }
    });
    // remove duplicates
    return Array.from(new Set(out));
  }

  return [];
}

function applyTextStyle(patch: Partial<any>, reason = "style:update") {
  const c = fabricCanvasRef.current;
  if (!c) return;

  const tbs = getSelectedTextboxes();
  if (!tbs.length) return;

  // don’t apply while editing to avoid cursor glitches
  const anyEditing = tbs.some((t: any) => t?.isEditing);
  if (anyEditing) return;

  tbs.forEach((t: any) => {
    t.set({ ...patch });
    t.setCoords?.();
  });

  c.requestRenderAll();
  pushHistory(reason);
}


function applyFontWeight(w: "normal" | "500" | "600" | "bold") {
  setFontWeight(w);
  // Fabric accepts string weights; keep it consistent
  applyTextStyle({ fontWeight: w }, "style:fontWeight");
}


function normalizeColor(input: any) {
  const s = String(input || "").trim().toLowerCase();
  if (!s) return "";

  if (s.startsWith("#")) return s;

  const m = s.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (m) {
    const r = Number(m[1]).toString(16).padStart(2, "0");
    const g = Number(m[2]).toString(16).padStart(2, "0");
    const b = Number(m[3]).toString(16).padStart(2, "0");
    return `#${r}${g}${b}`;
  }

  if (s === "black") return "#000000";
  if (s === "white") return "#ffffff";
  return s;
}

function applyTheme(nextThemeId: ThemeId, opts?: { silent?: boolean; noState?: boolean }) {
  const c = fabricCanvasRef.current;
  if (!c) return;

  const next = THEMES[nextThemeId] || THEMES.classic;
  const prev = THEMES[(themeIdRef.current as ThemeId) || "classic"] || THEMES.classic;

  themeIdRef.current = nextThemeId;
if (!opts?.noState) setThemeId(nextThemeId);

  // 1) Canvas background (v6-safe)
  (c as any).backgroundColor = next.pageBg;
  c.requestRenderAll();

  // 2) Update objects
  c.getObjects().forEach((o: any) => {
    const type = String(o?.type || "").toLowerCase();
    const isText = type === "textbox" || type === "i-text" || type === "text";

    if (o?.role === "sidebar") {
      o.set({ fill: next.sidebarBg });
      return;
    }
    if (o?.role === "safeGuide") {
      o.set({ stroke: next.safeGuideStroke });
      return;
    }

    if (isText) {
  const currentFill = normalizeColor(o.fill);

  // ✅ if current fill matches ANY theme's text color, treat as theme-managed text
  const allThemeTextColors = Object.values(THEMES).map((t: any) =>
    normalizeColor(t?.text)
  );
  const isThemeText = allThemeTextColors.includes(currentFill);

  const isDefaultBlack = currentFill === "#000000";

  if (!o.fill || isDefaultBlack || isThemeText) {
    o.set({ fill: next.text });
  }
}

    if (o?.role === "section") {
      const kids = o.getObjects?.() || o._objects || [];
      kids.forEach((k: any) => {
        if (
          String(k?.type || "").toLowerCase() === "rect" &&
          Number(k?.height) === 6
        ) {
          k.set({ fill: next.divider });
        }
      });
    }
  });

  c.requestRenderAll();
  if (!opts?.silent) pushHistory("theme:apply");
}
function syncToolbarFromSelection() {
  const c = fabricCanvasRef.current;
  if (!c) return;

  const tbs = getSelectedTextboxes();
  if (!tbs.length) return;

  // Use the first textbox as the “source”
  const t: any = tbs[0];

 // Font weight (variants-aware)
const fw = String(t.fontWeight || "normal").toLowerCase();

if (fw === "bold") setFontWeight("bold");
else if (fw === "600" || fw === "semibold") setFontWeight("600");
else if (fw === "500" || fw === "medium") setFontWeight("500");
else setFontWeight("normal");

// keep legacy bold toggle in sync (optional)
setIsBold(fw === "bold");

  // Align
  const ta = (t.textAlign || "left") as any;
  setTextAlign(ta);

  // Line height
  const lh = typeof t.lineHeight === "number" ? t.lineHeight : 1.6;
  setLineHeight(lh);

  // Char spacing
  const cs = typeof t.charSpacing === "number" ? t.charSpacing : 0;
  setCharSpacing(cs);

  // Font family + size (so Step 10 controls also sync)
  if (t.fontFamily) setFontFamily(t.fontFamily);
  if (typeof t.fontSize === "number") setFontSize(t.fontSize);
}
// ---------------- APPLY SNAPSHOT ----------------
async function applySnapshot(snapshot: Snapshot) {
  const c = fabricCanvasRef.current;
  if (!c) return;
  if (!isMountedRef.current) return;
  if (!(c as any).lowerCanvasEl) return;

  // ✅ TOP: read theme from snapshot (or fallback)
  const snapTheme = (snapshot?.themeId || "classic") as ThemeId;
  // ✅ hard-sync theme ref BEFORE any rendering/theme logic
themeIdRef.current = snapTheme;

  isApplyingHistoryRef.current = true;

  // ✅ keep React state synced
  setThemeId(snapTheme);

  const systemObjects = systemObjectsJsonRef.current || [];
  const merged = {
    objects: [...systemObjects, ...(snapshot?.objects || [])],
    backgroundColor: snapshot?.backgroundColor || "#ffffff",
  };

  await (c as any).loadFromJSON(merged);
  if (!isMountedRef.current) return;
  if (!fabricCanvasRef.current) return;
  if (!(fabricCanvasRef.current as any)?.lowerCanvasEl) return;

  // ✅ background
  (c as any).backgroundColor = merged.backgroundColor || "#ffffff";

  // ✅ IMPORTANT: apply theme to system layers + divider/text rules
  // (pushHistory won't run because isApplyingHistoryRef.current = true)
  applyTheme(snapTheme, { silent: true, noState: true });

  c.getObjects().forEach((o: any) => {
    if (isSystemObjectLive(o)) {
      o.selectable = false;
      o.evented = false;
      o.hasControls = false;
    } else {
      if (!o.uid) o.uid = newUid();

      // restore group interactivity after load
      if (String(o?.type || "").toLowerCase() === "group") {
        if (o?.role === "section") normalizeSectionGroup(o);
        else {
          o.subTargetCheck = true;
          o.interactive = true;
        }
      }

      if (o?.isLocked) lockObject(o);
      else {
        o.selectable = true;
        o.evented = true;
        o.hasControls = true;
      }
    }
    o.setCoords?.();
  });

  c.renderAll();

  // keep zoom consistent
  // ✅ guard: canvas can be disposed during route changes / fast renders
if (!isMountedRef.current) {
  isApplyingHistoryRef.current = false;
  return;
}
if (!((c as any)?.lowerCanvasEl)) {
  isApplyingHistoryRef.current = false;
  return;
}
  c.setZoom(zoomScale);
  c.setWidth(baseWRef.current * zoomScale);
  c.setHeight(baseHRef.current * zoomScale);
  c.calcOffset();
  c.requestRenderAll();

  // refresh per-page lastStr
  const ph = getPH(pageIndexRef.current);
  ph.lastStr = JSON.stringify(serializeUserSnapshot(c));

  isApplyingHistoryRef.current = false;
}

  async function undo() {
    const c = fabricCanvasRef.current;
    if (!c) return;

    const active = c.getActiveObject() as any;
    if (active?.isEditing) return;

    const ph = getPH(pageIndexRef.current);
    if (ph.undo.length <= 1) return;

    const current = ph.undo.pop();
    if (current) ph.redo.push(current);

    const prev = ph.undo[ph.undo.length - 1];
    if (!prev) return;

    await applySnapshot(prev);
    pagesRef.current[pageIndexRef.current] = prev;
  }

  async function redo() {
    const c = fabricCanvasRef.current;
    if (!c) return;

    const active = c.getActiveObject() as any;
    if (active?.isEditing) return;

    const ph = getPH(pageIndexRef.current);
    if (ph.redo.length === 0) return;

    const next = ph.redo.pop();
    if (!next) return;

    ph.undo.push(next);
    await applySnapshot(next);
    pagesRef.current[pageIndexRef.current] = next;
  }

  // ✅ Step 8.3 — page operations
  function saveCurrentPageSnapshot() {
    const c = fabricCanvasRef.current;
    if (!c) return;
    const snap = serializeUserSnapshot(c);
    pagesRef.current[pageIndexRef.current] = snap;
    // ✅ Persist draft using current pageIndexRef (prevents stale state pageIndex)
persistDraft({ pageIndex: pageIndexRef.current });

    const ph = getPH(pageIndexRef.current);
    const str = JSON.stringify(snap);

    if (ph.undo.length === 0) ph.undo = [snap];
    ph.lastStr = str;
  }

  function manualSaveDraftNow() {
  if (typeof window === "undefined") return;
  setIsSavingDraft(true);

  try {
    // ✅ Updates pagesRef + persists exactly once
    saveCurrentPageSnapshot();

    // If you want manual save to always bump time even if nothing changed:
    // persistDraft({ pageIndex: pageIndexRef.current, now: Date.now() });
  } catch (e) {
    console.error("Manual save failed:", e);
  } finally {
    setIsSavingDraft(false);
  }
}

  async function switchToPage(nextIndex: number) {
  const c = fabricCanvasRef.current;
  if (!c) return;

  if (nextIndex < 0 || nextIndex >= pagesRef.current.length) return;

  isSwitchingPageRef.current = true;

  // Save current page snapshot + persist pages
  saveCurrentPageSnapshot();

  // ✅ Persist pageIndex change ONCE (no double autosave)
  persistDraft({ pageIndex: nextIndex });

  setPageIndex(nextIndex);

  const targetSnap = pagesRef.current[nextIndex];
  await applySnapshot(targetSnap);

  isSwitchingPageRef.current = false;
}

  function addPage() {
    saveCurrentPageSnapshot();

    const newSnap: Snapshot = {
  objects: [],
  backgroundColor: (fabricCanvasRef.current as any)?.backgroundColor || "#ffffff",
  themeId: (themeId || safeDefaultTheme) as ThemeId,
};
    pagesRef.current.splice(pageIndex + 1, 0, newSnap);
    pageHistoryRef.current.splice(pageIndex + 1, 0, {
      undo: [newSnap],
      redo: [],
      lastStr: JSON.stringify(newSnap),
    });

    setPageCount(pagesRef.current.length);
    switchToPage(pageIndex + 1);
    
  }
  function duplicatePage() {
    saveCurrentPageSnapshot();

    const snap = pagesRef.current[pageIndex] || { objects: [] };
    const cloned: Snapshot = JSON.parse(JSON.stringify(snap));

    cloned.themeId = (cloned.themeId || themeId || safeDefaultTheme) as ThemeId;

    pagesRef.current.splice(pageIndex + 1, 0, cloned);
    pageHistoryRef.current.splice(pageIndex + 1, 0, {
      undo: [cloned],
      redo: [],
      lastStr: JSON.stringify(cloned),
    });

    setPageCount(pagesRef.current.length);
    switchToPage(pageIndex + 1);
    
  }

  function deletePage() {
    if (pagesRef.current.length <= 1) return;

    pagesRef.current.splice(pageIndex, 1);
    pageHistoryRef.current.splice(pageIndex, 1);

    const newCount = pagesRef.current.length;
    setPageCount(newCount);

    const next = Math.min(pageIndex, newCount - 1);
    switchToPage(next);
    
  }

  function movePageLeft() {
    if (pageIndex <= 0) return;
    saveCurrentPageSnapshot();

    const p = pagesRef.current;
    const h = pageHistoryRef.current;

    [p[pageIndex - 1], p[pageIndex]] = [p[pageIndex], p[pageIndex - 1]];
    [h[pageIndex - 1], h[pageIndex]] = [h[pageIndex], h[pageIndex - 1]];

    setPageIndex((i) => i - 1);
  }

  function movePageRight() {
    if (pageIndex >= pagesRef.current.length - 1) return;
    saveCurrentPageSnapshot();

    const p = pagesRef.current;
    const h = pageHistoryRef.current;

    [p[pageIndex + 1], p[pageIndex]] = [p[pageIndex], p[pageIndex + 1]];
    [h[pageIndex + 1], h[pageIndex]] = [h[pageIndex], h[pageIndex + 1]];

    setPageIndex((i) => i + 1);
  }

  // ==========================================================
  // ✅ exportAllPagesPdf() — kept stable + restores section normalize
  // ==========================================================
function exportCurrentPagePdf() {
  const c = fabricCanvasRef.current;
  if (!c) return;

  saveCurrentPageSnapshot();

  const originalZoom = zoomScale;
  const originalIndex = pageIndex;
  const originalSnap = pagesRef.current[originalIndex];

  setShowAd(true);

  pendingDownloadRef.current = () => {
    void (async () => {
      setIsExporting(true);

      const renderSnapshot = async (snap: Snapshot) => {
        isApplyingHistoryRef.current = true;

        const systemObjects = systemObjectsJsonRef.current || [];
        const merged = {
  objects: [...systemObjects, ...(snap?.objects || [])],
  backgroundColor: snap?.backgroundColor || "#ffffff",
};

        await (c as any).loadFromJSON(merged);
        const snapTheme = (snap?.themeId || themeId || safeDefaultTheme) as ThemeId;
applyTheme(snapTheme, { silent: true, noState: true });

        c.getObjects().forEach((o: any) => {
          if (isSystemObjectLive(o)) {
            o.selectable = false;
            o.evented = false;
            o.hasControls = false;
          } else {
            if (!o.uid) o.uid = newUid();

            if (String(o?.type || "").toLowerCase() === "group") {
              if (o?.role === "section") normalizeSectionGroup(o);
              else {
                o.subTargetCheck = true;
                o.interactive = true;
              }
            }

            if (o?.isLocked) lockObject(o);
            else {
              o.selectable = true;
              o.evented = true;
              o.hasControls = true;
            }
          }
          o.setCoords?.();
        });

        c.renderAll();
        isApplyingHistoryRef.current = false;
      };

      try {
        const pdf = new jsPDF("p", "mm", "a4");

        const pageW = 210;
        const marginX = 12;
        const marginTop = 18;
        const marginBottom = 16;

        const printableW = pageW - marginX * 2;
        const printableH = 297 - marginTop - marginBottom;

        // ✅ Step 5 settings
        const multiplier = exportMode === "high" ? 3 : 2;
        const imgFormat = exportMode === "high" ? "png" : "jpeg";
        const jpegQuality = exportMode === "high" ? 1.0 : 0.82; // tweak if needed

        c.setZoom(1);
        c.setWidth(baseWRef.current);
        c.setHeight(baseHRef.current);
        c.calcOffset();
        c.requestRenderAll();

        setExportProgress({ current: 1, total: 1 });
        await renderSnapshot(pagesRef.current[pageIndex]);

        const imgData = c.toDataURL({
          format: imgFormat as any,
          multiplier,
          quality: imgFormat === "jpeg" ? jpegQuality : undefined,
        } as any);

        const aspect = c.getWidth() / c.getHeight();
        let imgW = printableW;
        let imgH = imgW / aspect;

        if (imgH > printableH) {
          imgH = printableH;
          imgW = imgH * aspect;
        }

        const x = (pageW - imgW) / 2;
        const y = marginTop;

        pdf.addImage(
          imgData,
          imgFormat === "jpeg" ? "JPEG" : "PNG",
          x,
          y,
          imgW,
          imgH,
          undefined,
          "FAST"
        );

        // Page number
        pdf.setFontSize(10);
        pdf.text(
          `Page ${pageIndex + 1} / ${pagesRef.current.length}`,
          pageW - marginX,
          297 - 8,
          { align: "right" }
        );

        pdf.save(`studiosislab-${templateId}-p${pageIndex + 1}.pdf`);
        // ✅ Track guest download (single page)

      } catch (err) {
        console.error("Single-page export failed:", err);
        alert("Export failed. Check console for the error.");
      } finally {
        await renderSnapshot(originalSnap);

        c.setZoom(originalZoom);
        c.setWidth(baseWRef.current * originalZoom);
        c.setHeight(baseHRef.current * originalZoom);
        c.calcOffset();
        c.requestRenderAll();

        setPageIndex(originalIndex);

        // ✅ close + reset modal after export finishes
        setIsExporting(false);
        setShowAd(false);
        setExportProgress({ current: 0, total: 0 });
      }
    })();
  };
}

function exportAllPagesPdf() {
  const c = fabricCanvasRef.current;
  if (!c) return;
  if (!pagesRef.current || pagesRef.current.length === 0) {
  alert("❌ No pages found to export.");
  return;
}
  console.log("🔥 exportAllPagesPdf clicked");
  console.log("pages:", pagesRef.current.length);

  saveCurrentPageSnapshot();

  const originalZoom = zoomScale;
  const originalIndex = pageIndex;
  const originalSnap = pagesRef.current[originalIndex];

  void (async () => {
    setIsExporting(true);

    const renderSnapshot = async (snap: Snapshot) => {
      isApplyingHistoryRef.current = true;

      const systemObjects = systemObjectsJsonRef.current || [];
      const merged = {
        objects: [...systemObjects, ...(snap?.objects || [])],
        backgroundColor: snap?.backgroundColor || "#ffffff",
      };

      await (c as any).loadFromJSON(merged);

      const snapTheme = (snap?.themeId || themeId || safeDefaultTheme) as ThemeId;
      applyTheme(snapTheme, { silent: true, noState: true });

      c.getObjects().forEach((o: any) => {
        if (isSystemObjectLive(o)) {
          o.selectable = false;
          o.evented = false;
          o.hasControls = false;
        } else {
          if (!o.uid) o.uid = newUid();

          if (String(o?.type || "").toLowerCase() === "group") {
            if (o?.role === "section") normalizeSectionGroup(o);
            else {
              o.subTargetCheck = true;
              o.interactive = true;
            }
          }

          if (o?.isLocked) lockObject(o);
          else {
            o.selectable = true;
            o.evented = true;
            o.hasControls = true;
          }
        }
        o.setCoords?.();
      });

      c.renderAll();
      isApplyingHistoryRef.current = false;
    };

    try {
      const pdf = new jsPDF("p", "mm", "a4");

      const pageW = 210;
      const marginX = 12;
      const marginTop = 18;
      const marginBottom = 16;

      const printableW = pageW - marginX * 2;
      const printableH = 297 - marginTop - marginBottom;

      const multiplier = exportMode === "high" ? 3 : 2;
      const imgFormat = exportMode === "high" ? "png" : "jpeg";
      const jpegQuality = exportMode === "high" ? 1.0 : 0.82;

      c.setZoom(1);
      c.setWidth(baseWRef.current);
      c.setHeight(baseHRef.current);
      c.calcOffset();
      c.requestRenderAll();

      for (let i = 0; i < pagesRef.current.length; i++) {
        setExportProgress({ current: i + 1, total: pagesRef.current.length });
        await renderSnapshot(pagesRef.current[i]);

        const imgData = c.toDataURL({
          format: imgFormat as any,
          multiplier,
          quality: imgFormat === "jpeg" ? jpegQuality : undefined,
        } as any);

        const aspect = c.getWidth() / c.getHeight();
        let imgW = printableW;
        let imgH = imgW / aspect;

        if (imgH > printableH) {
          imgH = printableH;
          imgW = imgH * aspect;
        }

        const x = (pageW - imgW) / 2;
        const y = marginTop;

        if (i > 0) pdf.addPage();

        pdf.addImage(
          imgData,
          imgFormat === "jpeg" ? "JPEG" : "PNG",
          x,
          y,
          imgW,
          imgH,
          undefined,
          "FAST"
        );

        pdf.setFontSize(10);
        pdf.text(
          `Page ${i + 1} / ${pagesRef.current.length}`,
          pageW - marginX,
          297 - 8,
          { align: "right" }
        );
      }

      const pdfBase64 = pdf.output("datauristring").split(",")[1];
      (window as any).lastPdfBase64 = pdfBase64;
      localStorage.setItem("lastPdfBase64", pdfBase64);

      console.log("✅ PDF base64 saved:", pdfBase64.length);
      alert("✅ PDF is ready. Next step: send to DocuSign envelope API.");
    } catch (err) {
      console.error("Multi-page export failed:", err);
      alert("Export failed. Check console for the error.");
    } finally {
      await renderSnapshot(originalSnap);

      c.setZoom(originalZoom);
      c.setWidth(baseWRef.current * originalZoom);
      c.setHeight(baseHRef.current * originalZoom);
      c.calcOffset();
      c.requestRenderAll();

      setPageIndex(originalIndex);

      setIsExporting(false);
      setExportProgress({ current: 0, total: 0 });
    }
  })();
}

  // ==========================================================
  // ✅ UPDATE #2: dblclick helper (remove selectable-false block)
  // ==========================================================
  function enableGroupTextEditing(canvas: Canvas) {
    canvas.on("mouse:dblclick", (e: any) => {
      const subTargets: any[] = e?.subTargets || [];
      const innerTextbox = subTargets.find(
        (o) => String(o?.type || "").toLowerCase() === "textbox"
      );

      const target: any = innerTextbox || e?.target;
      if (!target) return;

      if (String(target?.type || "").toLowerCase() !== "textbox") return;
      if (target.role === "sidebar" || target.role === "safeGuide") return;
      // ✅ removed: if (target.selectable === false) return;

      canvas.setActiveObject(target);
      target.enterEditing?.();
      target.selectAll?.();
      canvas.requestRenderAll();

      if (!(target as any).__reselectBound) {
        (target as any).__reselectBound = true;
        target.on?.("editing:exited", () => {
          const parent = (target as any).group;
          if (parent) {
            canvas.setActiveObject(parent);
            canvas.requestRenderAll();
          }
        });
      }
    });
  }

  // ---------------- CANVAS SETUP ----------------
  useEffect(() => {
    if (!canvasElRef.current) return;
    isMountedRef.current = true;

    const A4_WIDTH = 2480;
    const A4_HEIGHT = 3508;

    baseWRef.current = A4_WIDTH;
    baseHRef.current = A4_HEIGHT;

    const SAFE_MARGIN = 120;

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

    // -------- SYSTEM LAYERS --------
    if (editorConfig.hasSidebar) {
      const sidebarObj = new Rect({
        left: 0,
        top: 0,
        width: SIDEBAR_W,
        height: A4_HEIGHT,
        fill: "#f3f4f6",
        selectable: false,
        evented: false,
        excludeFromExport: false,
      }) as any;
      sidebarObj.role = "sidebar";
      sidebarObj.hasControls = false;
      sidebarObj.uid = "system_sidebar";
      canvas.add(sidebarObj);
    }

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
    safeGuide.hasControls = false;
    safeGuide.uid = "system_safeGuide";
    canvas.add(safeGuide);

    // -------- USER OBJECTS --------
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
    title.isLocked = false;

    const body = new Textbox("Click to edit text.\nThis is the resume body.", {
      left: SAFE_LEFT,
      top: 340,
      width: SAFE_W,
      fontSize: editorConfig.bodyFontSize,
      lineHeight: 1.6,
      textAlign: "left",
    }) as any;
    body.uid = newUid();
    body.isLocked = false;
    // ✅ Make initial text readable for the template’s default theme
    const initialTheme = safeDefaultTheme;
    const tTheme = THEMES[initialTheme] || THEMES.classic;

    title.set({ fill: tTheme.text });
    body.set({ fill: tTheme.text });

    canvas.add(title, body);
    canvas.setActiveObject(title);
    canvas.renderAll();
    // ✅ Apply default theme immediately (template-specific)
setThemeId(initialTheme);
applyTheme(initialTheme, { silent: true });

    // Capture SYSTEM JSON
    {
      const full = getFullJson(canvas);
      systemObjectsJsonRef.current = (full.objects || []).filter((o: any) =>
        isSystemObjectJson(o)
      );
    }

    // SAFE AREA CLAMP
    function clampToSafeArea(obj: FabricObject) {
      const o: any = obj;
      if (!obj.selectable) return;
      if (o.role === "sidebar" || o.role === "safeGuide") return;

      const br = obj.getBoundingRect();

      if (br.width > SAFE_W) {
        const ratio = SAFE_W / br.width;
        obj.scaleX = (obj.scaleX || 1) * ratio;
        obj.scaleY = (obj.scaleY || 1) * ratio;
      }

      const br2 = obj.getBoundingRect();
      if (br2.height > SAFE_H) {
        const ratio = SAFE_H / br2.height;
        obj.scaleX = (obj.scaleX || 1) * ratio;
        obj.scaleY = (obj.scaleY || 1) * ratio;
      }

      const br3 = obj.getBoundingRect();
      let dx = 0;
      let dy = 0;

      if (br3.left < SAFE_LEFT) dx = SAFE_LEFT - br3.left;
      if (br3.top < SAFE_TOP) dy = SAFE_TOP - br3.top;

      const right = br3.left + br3.width;
      const bottom = br3.top + br3.height;

      if (right > SAFE_RIGHT) dx = SAFE_RIGHT - right;
      if (bottom > SAFE_BOTTOM) dy = SAFE_BOTTOM - bottom;

      if (dx !== 0 || dy !== 0) {
        obj.left = (obj.left || 0) + dx;
        obj.top = (obj.top || 0) + dy;
        obj.setCoords();
      }
    }

    const onMoving = (e: any) => {
      if (!e?.target) return;
      clampToSafeArea(e.target);
      canvas.requestRenderAll();
    };
    const onScaling = (e: any) => {
      if (!e?.target) return;
      clampToSafeArea(e.target);
      canvas.requestRenderAll();
    };
    const onModifiedClamp = (e: any) => {
      if (!e?.target) return;
      clampToSafeArea(e.target);
      canvas.requestRenderAll();
    };

    canvas.on("object:moving", onMoving);
    canvas.on("object:scaling", onScaling);
    canvas.on("object:modified", onModifiedClamp);

    // ✅ Init multi-page (load draft if exists)
let loaded = false;

try {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    const parsed = JSON.parse(raw);

    if (
      parsed?.templateId === templateId &&
      Array.isArray(parsed?.pages) &&
      parsed.pages.length
    ) {
      pagesRef.current = parsed.pages;
      pageHistoryRef.current = parsed.pages.map((p: Snapshot) => ({
        undo: [p],
        redo: [],
        lastStr: JSON.stringify(p),
      }));
      setLastSavedAt(
  typeof parsed.updatedAt === "number" ? parsed.updatedAt : null
);

      const startIndex =
        typeof parsed.pageIndex === "number"
          ? Math.min(Math.max(0, parsed.pageIndex), parsed.pages.length - 1)
          : 0;

      setPageCount(parsed.pages.length);
      setPageIndex(startIndex);

      // render the loaded page
      void applySnapshot(parsed.pages[startIndex]);

      loaded = true;
    }
  }
} catch {}

if (!loaded) {
  const baseline = serializeUserSnapshot(canvas);

  pagesRef.current = [baseline];
  pageHistoryRef.current = [
    { undo: [baseline], redo: [], lastStr: JSON.stringify(baseline) },
  ];

  setPageIndex(0);
  setPageCount(1);

 // ✅ Save first-time baseline (ONLY when no draft exists)
try {
  const now = Date.now();
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      templateId,
      pages: pagesRef.current,
      pageIndex: 0,
      updatedAt: now,
    })
  );
  upsertDraftIndex({ key: STORAGE_KEY, templateId, updatedAt: now });
  setLastSavedAt(now);
} catch {}
}
    isApplyingHistoryRef.current = false;
    isInitialBuildRef.current = false;

    // HISTORY EVENTS
    const onObjectModified = (e: any) => {
      const t: any = e?.target;
      if (!t) return;
      if (isSystemObjectLive(t)) return;
      if (isApplyingHistoryRef.current || isInitialBuildRef.current) return;

      const hasTransform =
        !!e?.transform?.action || typeof e?.action === "string";
      if (!hasTransform) return;

      pushHistory("object:modified");
    };

    const onTextChanged = (e: any) => {
      const t: any = e?.target;
      if (!t) return;
      if (isSystemObjectLive(t)) return;
      if (isApplyingHistoryRef.current || isInitialBuildRef.current) return;
      scheduleHistoryPush("text:changed", 300);
    };

    const onEditingExited = (e: any) => {
      const t: any = e?.target;
      if (!t) return;
      if (isSystemObjectLive(t)) return;
      if (isApplyingHistoryRef.current || isInitialBuildRef.current) return;
      pushHistory("editing:exited");
    };

    canvas.on("object:modified", onObjectModified);
    canvas.on("text:changed", onTextChanged); 
    canvas.on("text:editing:exited", onEditingExited);
   

    /* ✅ STEP 11.3 — Selection → Toolbar sync */
const onSelectionUpdated = () => {
  if (isApplyingHistoryRef.current) return;
  if (isSwitchingPageRef.current) return;
  syncToolbarFromSelection();
};

const DEFAULT_FONT_FAMILY = "Arial";
const DEFAULT_FONT_SIZE = 38;

const onSelectionCleared = () => {
  setFontFamily(DEFAULT_FONT_FAMILY);
  setFontSize(DEFAULT_FONT_SIZE);
  setFontWeight("normal");
  setIsBold(false); // optional if you keep bold toggle

  // add more resets if you have them (optional)
  // setIsBold(false);
  // setTextAlign("left");
};

canvas.on("selection:created", onSelectionUpdated);
canvas.on("selection:updated", onSelectionUpdated);
canvas.on("selection:cleared", onSelectionCleared);

    return () => {
      isMountedRef.current = false;
      if (historyDebounceRef.current) {
        window.clearTimeout(historyDebounceRef.current);
        historyDebounceRef.current = null;
      }

      canvas.off("object:moving", onMoving);
      canvas.off("object:scaling", onScaling);
      canvas.off("object:modified", onModifiedClamp);

      canvas.off("object:modified", onObjectModified);
      canvas.off("text:changed", onTextChanged);
      canvas.off("text:editing:exited", onEditingExited);

      canvas.off("selection:created", onSelectionUpdated);
      canvas.off("selection:updated", onSelectionUpdated);
      canvas.off("selection:cleared", onSelectionCleared);

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

  // REAL ZOOM FIX
  useEffect(() => {
    const c = fabricCanvasRef.current;
    const el = canvasElRef.current;
    if (!c || !el) return;

    c.setZoom(zoomScale);
    c.setWidth(baseWRef.current * zoomScale);
    c.setHeight(baseHRef.current * zoomScale);
    c.calcOffset();
    c.requestRenderAll();
  }, [zoomScale]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const c = fabricCanvasRef.current;
      if (!c) return;

      const active = c.getActiveObject() as any;
      if (active?.isEditing) return;

      if (e.key === "Delete" || e.key === "Backspace") {
        if (isTypingInInput(e)) return;
        e.preventDefault();
        deleteSelectedObjects();
        return;
      }

      const isMac = navigator.platform.toLowerCase().includes("mac");
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (!mod) return;

      const key = e.key.toLowerCase();

      if (key === "d") {
        if (isTypingInInput(e)) return;
        e.preventDefault();
        duplicateSelectedObjects();
        return;
      }

      // lock/unlock
      if (key === "l" && !e.shiftKey) {
        if (isTypingInInput(e)) return;
        e.preventDefault();
        lockSelectedObjects();
        return;
      }

      if (key === "l" && e.shiftKey) {
        if (isTypingInInput(e)) return;
        e.preventDefault();
        unlockSelectedOrAllLocked();
        return;
      }

      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }

      if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [zoomScale, pageIndex]);

  // AD COUNTDOWN
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
  // If ad gate is ON and timer not finished, just do nothing.
  // (User already sees the countdown on screen.)
  if (showAd && secondsLeft > 0) return;

  if (envelopeStatus !== "completed") {
    alert(`✍️ Signature not completed yet. Current: ${envelopeStatus}`);
    return;
  }

  const envelopeId =
    envelopeIdResolved ||
    lastEnvelopeId ||
    (window as any).lastEnvelopeId ||
    localStorage.getItem("lastEnvelopeId");

  if (!envelopeId) {
    alert("❌ Missing envelopeId");
    return;
  }

 const url = `/api/document/file?envelopeId=${encodeURIComponent(envelopeId)}&download=1`;
window.location.href = url;
  cancelAdGate();
}
  function cancelAdGate() {
  setShowAd(false);
  setIsExporting(false);
  setExportProgress({ current: 0, total: 0 });
  pendingDownloadRef.current = null;
}
  function openDraftsModal() {
  try {
    const raw = localStorage.getItem(DRAFTS_INDEX_KEY);
    const list: DraftIndexItem[] = raw ? JSON.parse(raw) : [];
    setDrafts(Array.isArray(list) ? list : []);
  } catch {
    setDrafts([]);
  }
  setShowDrafts(true);
}

function closeDraftsModal() {
  setShowDrafts(false);
}

function deleteDraft(key: string) {
  try {
    localStorage.removeItem(key);
    removeDraftFromIndex(key);
  } catch {}

  // refresh list
  openDraftsModal();
}

function openDraft(templateIdToOpen: string) {
  // adjust route if your editor path differs
  router.push(`/app/editor/${templateIdToOpen}`);
  setShowDrafts(false);
}
const FONT_SIZE_MIN = 10;
const FONT_SIZE_MAX = 80;

function getTextboxFromSelection(): any | null {
  const c = fabricCanvasRef.current;
  if (!c) return null;

  const active: any = c.getActiveObject();
  if (!active) return null;

  // if textbox is directly selected
  if (String(active?.type || "").toLowerCase() === "textbox") return active;

  // if a group is selected (like your section group), pick the textbox under it
  if (String(active?.type || "").toLowerCase() === "group") {
    const kids = active.getObjects?.() || active._objects || [];
    const tb = kids.find((k: any) => String(k?.type || "").toLowerCase() === "textbox");
    return tb || null;
  }

  // if selection is multi-select, apply later (we’ll handle in applyTextStyle)
  return null;
}


  // UI
  return (
    <main className="p-6">

     <div className="flex gap-2 items-center">
  <button
    onClick={() => router.push("/app/drafts")}
    className="border px-3 py-1 rounded"
  >
    My Drafts
  </button>

  <button
    onClick={() => router.back()}
    className="border px-3 py-1 rounded"
  >
    Back
  </button>
</div> 
        
        

        <div className="flex gap-2 flex-wrap items-center">
          <button
  onClick={exportAllPagesPdf}
  className="px-3 py-1 rounded text-white bg-black cursor-pointer"
  title="Download PDF (All Pages)"
>
  Download PDF (All Pages)
</button>

<button
  disabled={isSendingForSignature}
  onClick={async () => {
    setIsSendingForSignature(true);

    try {
      console.log("🚀 Sending document for signature...");

      const pdfBase64 =
        (window as any).lastPdfBase64 ||
        localStorage.getItem("lastPdfBase64");

      if (!pdfBase64) {
        alert("❌ No PDF found. Please export PDF first.");
        return;
      }

      const res = await fetch("/api/docusign/envelope", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
  pdfBase64,
  signerEmail: "stephenpereira750@gmail.com",
  signerName: "Stephen Pereira",
}),
      });

      const json = await res.json();
      console.log("📨 Envelope API response:", json);

      if (!json.ok) {
        alert("❌ Envelope creation failed. Check console.");
        return;
      }

      const envelopeId = json.data.envelopeId;

     // 🔐 store globally for status + download
localStorage.setItem("lastEnvelopeId", envelopeId);
(window as any).lastEnvelopeId = envelopeId;
setLastEnvelopeId(envelopeId);

      console.log("✅ Envelope created:", envelopeId);
      alert("✅ Sent for signature!\nEnvelope ID:\n" + envelopeId);

    } catch (err) {
      console.error("❌ Send for signature failed:", err);
      alert("Unexpected error. Check console.");
    } finally {
      setIsSendingForSignature(false);
    }
  }}
>
  {isSendingForSignature ? "Sending…" : "Send for Signature (TEST)"}
</button>

{lastEnvelopeId && (
  <span
    style={{
      marginLeft: 10,
      fontSize: 12,
      fontWeight: 500,
      color:
        envelopeStatus === "completed"
          ? "green"
          : envelopeStatus === "sent"
          ? "orange"
          : "gray",
    }}
  >
    Status: {envelopeStatus || "checking..."}
  </span>
)}

<button
  onClick={checkEnvelopeStatus}
  className="border px-3 py-1 rounded ml-2"
  title="Check DocuSign envelope status"
>
  Check Signature Status
</button>

{envelopeStatus === "completed" && (
  <button
    onClick={() => setShowAd(true)}   // ✅ open ad-gate modal
    style={{ background: "#22c55e", color: "#000" }}
  >
    Download Signed PDF
  </button>
)}

{lastEnvelopeId && (
  <button
    onClick={() => {
      window.open(
        `https://demo.docusign.net/Member/EnvelopeDetails.aspx?envelopeId=${lastEnvelopeId}`,
        "_blank"
      );
    }}
    className="border px-3 py-1 rounded"
  >
    View Envelope
  </button>
)}

<button
  onClick={openDraftsModal}
  className="border px-3 py-1 rounded"
  title="Open saved drafts"
>
  My Drafts
</button>

<button
  onClick={manualSaveDraftNow}
  className="border px-3 py-1 rounded"
  title="Manually save your draft right now"
>
  {isSavingDraft ? "Saving..." : "Save Draft"}
</button>

<button
  onClick={exportCurrentPagePdf}
  className="border px-3 py-1 rounded"
  title="Exports only this page to PDF"
>
  Download PDF (This Page)
</button>
<div className="flex items-center gap-2 border rounded px-2 py-1 bg-white">
  <span className="text-sm text-zinc-600">Export:</span>

  <button
    onClick={() => setExportMode("fast")}
    className={`border px-2 py-1 rounded ${exportMode === "fast" ? "bg-black text-white" : ""}`}
    title="Smaller file size (JPEG + lower resolution)"
  >
    Fast
  </button>

  <button
    onClick={() => setExportMode("high")}
    className={`border px-2 py-1 rounded ${exportMode === "high" ? "bg-black text-white" : ""}`}
    title="Sharper text (PNG + higher resolution)"
  >
    High
  </button>
</div>
{/* ✅ Step 10.1 — Font Family */}
<div className="flex items-center gap-2 border rounded px-2 py-1 bg-white">
  <span className="text-sm text-zinc-600">Font:</span>
  <select
    className="border px-2 py-1 rounded"
    value={fontFamily}
    onChange={(e) => {
      const v = e.target.value;
      setFontFamily(v);
      applyTextStyle({ fontFamily: v }, "style:fontFamily");
    }}
    title="Applies to selected text / section text"
  >
    {FONT_FAMILIES.map((f) => (
      <option key={f} value={f}>
        {f}
      </option>
    ))}
  </select>
</div>
<div className="flex items-center gap-2 border rounded px-2 py-1 bg-white">
  <span className="text-sm text-zinc-600">Theme:</span>

  <select
    className="border px-2 py-1 rounded"
    value={themeId}
    onChange={(e) => {
  const next = e.target.value as ThemeId;
  if (!allowedThemes.includes(next)) return; // ✅ block invalid
  applyTheme(next);
  saveCurrentPageSnapshot();
}}
    title="Theme"
  >
    {allowedThemes.map((id) => (
      <option key={id} value={id}>
        {THEME_PRESETS.find((t) => t.id === id)?.name ?? id}
      </option>
    ))}
  </select>
</div>
{/* ✅ Step 10.2 — Font Size */}
<div className="flex items-center gap-2 border rounded px-2 py-1 bg-white">
  <span className="text-sm text-zinc-600">Size:</span>

  <button
    className="border px-2 py-1 rounded"
    onClick={() => {
      const next = Math.max(FONT_SIZE_MIN, fontSize - 2);
      setFontSize(next);
      applyTextStyle({ fontSize: next }, "style:fontSize");
    }}
    title="Decrease font size"
  >
    –
  </button>

  <span className="text-sm w-8 text-center">{fontSize}</span>

  <button
    className="border px-2 py-1 rounded"
    onClick={() => {
      const next = Math.min(FONT_SIZE_MAX, fontSize + 2);
      setFontSize(next);
      applyTextStyle({ fontSize: next }, "style:fontSize");
    }}
    title="Increase font size"
  >
    +
  </button>
</div>
{/* ✅ Bold */}
<div className="flex items-center gap-2 border rounded px-2 py-1 bg-white">
  <span className="text-sm text-zinc-600">Weight:</span>
  <select
    className="border px-2 py-1 rounded"
    value={fontWeight}
    onChange={(e) => applyFontWeight(e.target.value as any)}
    title="Font weight for selected text"
  >
    <option value="normal">Regular</option>
    <option value="500">Medium</option>
    <option value="600">SemiBold</option>
    <option value="bold">Bold</option>
  </select>
</div>

{/* ✅ Align */}
<div className="flex items-center gap-2 border rounded px-2 py-1 bg-white">
  <span className="text-sm text-zinc-600">Align:</span>

  <button
    className={`border px-2 py-1 rounded ${textAlign === "left" ? "bg-black text-white" : ""}`}
    onClick={() => {
      setTextAlign("left");
      applyTextStyle({ textAlign: "left" }, "style:align");
    }}
  >
    L
  </button>

  <button
    className={`border px-2 py-1 rounded ${textAlign === "center" ? "bg-black text-white" : ""}`}
    onClick={() => {
      setTextAlign("center");
      applyTextStyle({ textAlign: "center" }, "style:align");
    }}
  >
    C
  </button>

  <button
    className={`border px-2 py-1 rounded ${textAlign === "right" ? "bg-black text-white" : ""}`}
    onClick={() => {
      setTextAlign("right");
      applyTextStyle({ textAlign: "right" }, "style:align");
    }}
  >
    R
  </button>
</div>



<div className="flex items-center gap-2 border rounded px-2 py-1 bg-white">
  <span className="text-sm text-zinc-600">Line:</span>

  <button
    className="border px-2 py-1 rounded"
    onClick={() => {
      const next = Math.max(1.0, Number((lineHeight - 0.1).toFixed(2)));
      setLineHeight(next);
      applyTextStyle({ lineHeight: next }, "style:lineHeight");
    }}
    title="Decrease line height"
  >
    –
  </button>

  <span className="text-sm w-12 text-center">{lineHeight.toFixed(2)}</span>

  <button
    className="border px-2 py-1 rounded"
    onClick={() => {
      const next = Math.min(2.5, Number((lineHeight + 0.1).toFixed(2)));
      setLineHeight(next);
      applyTextStyle({ lineHeight: next }, "style:lineHeight");
    }}
    title="Increase line height"
  >
    +
  </button>
</div>

<div className="flex items-center gap-2 border rounded px-2 py-1 bg-white">
  <span className="text-sm text-zinc-600">Space:</span>

  <button
    className="border px-2 py-1 rounded"
    onClick={() => {
      const next = Math.max(0, charSpacing - 20);
      setCharSpacing(next);
      applyTextStyle({ charSpacing: next }, "style:charSpacing");
    }}
    title="Decrease letter spacing"
  >
    –
  </button>

  <span className="text-sm w-10 text-center">{charSpacing}</span>

  <button
    className="border px-2 py-1 rounded"
    onClick={() => {
      const next = Math.min(500, charSpacing + 20);
      setCharSpacing(next);
      applyTextStyle({ charSpacing: next }, "style:charSpacing");
    }}
    title="Increase letter spacing"
  >
    +
  </button>
</div>
          {/* ✅ Step 9 Section Buttons */}
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

{/* ✅ Remove selected section */}
<button
  className="border px-2 py-1 rounded"
  onClick={removeSelectedSection}
  title="Remove selected section"
>
  Remove Section
</button>
</div>

          <button
            onClick={undo}
            className="border px-3 py-1 rounded"
            title="Undo (Cmd/Ctrl+Z)"
          >
            Undo
          </button>
          <button
            onClick={redo}
            className="border px-3 py-1 rounded"
            title="Redo (Cmd+Shift+Z / Ctrl+Y)"
          >
            Redo
          </button>

          <button
            onClick={() => setZoom((z) => Math.max(zoomMin, z - zoomStep))}
            className="border px-3 py-1 rounded"
          >
            – Zoom
          </button>
          <button onClick={() => setZoom(25)} className="border px-3 py-1 rounded">
            Reset
          </button>
          <button
            onClick={() => setZoom((z) => Math.min(zoomMax, z + zoomStep))}
            className="border px-3 py-1 rounded"
          >
            + Zoom
          </button>
          <span className="text-sm text-zinc-700">{zoom}%</span>

          {/* ✅ Page controls */}
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

            <button className="border px-2 py-1 rounded" onClick={addPage} title="Add page">
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

        <div className="text-sm text-zinc-600">Template ID: {templateId}</div>
        <div className="text-xs text-zinc-500">
  {lastSavedAt ? `Last saved: ${new Date(lastSavedAt).toLocaleTimeString()}` : "Not saved yet"}
</div>

      <div className="flex justify-center overflow-auto border rounded-lg bg-zinc-100 p-4">
        <div
          style={{
            width: baseWRef.current * zoomScale,
            height: baseHRef.current * zoomScale,
            background: "white",
            boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
          }}
        >
          <canvas ref={canvasElRef} />
        </div>
      </div>
      
      {showDrafts &&
  createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 16,
      }}
    >
      <div
        style={{
          background: "white",
          borderRadius: 16,
          padding: 20,
          width: "100%",
          maxWidth: 640,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontWeight: 700, fontSize: 18 }}>My Drafts</h2>
          <button
            onClick={closeDraftsModal}
            className="border px-3 py-1 rounded"
          >
            Close
          </button>
        </div>

        <div style={{ marginTop: 12 }}>
          {drafts.length === 0 ? (
            <p style={{ fontSize: 14, color: "#52525b" }}>No drafts saved yet.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {drafts.map((d) => (
                <div
                  key={d.key}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    padding: 12,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700 }}>Template: {d.templateId}</div>
                    <div style={{ fontSize: 12, color: "#52525b" }}>
                      Updated: {new Date(d.updatedAt).toLocaleString()}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      className="border px-3 py-1 rounded"
                      onClick={() => openDraft(d.templateId)}
                    >
                      Open
                    </button>
                    <button
                      className="border px-3 py-1 rounded"
                      onClick={() => deleteDraft(d.key)}
                      title="Delete draft"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )}

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
        padding: 16,
      }}
    >
      <div
        style={{
          background: "white",
          borderRadius: 16,
          padding: 24,
          width: "100%",
          maxWidth: 520,
        }}
      >
        <h2 style={{ fontWeight: 700, fontSize: 18 }}>Almost there…</h2>
        <p style={{ marginTop: 8, fontSize: 14 }}>
          Watch this short ad to unlock download.
        </p>

         <AdSenseSlot
  client="ca-pub-TESTING_PLACEHOLDER"
  slot="TESTING_PLACEHOLDER"
/>
{envelopeIdResolved && (
  <div style={{ marginTop: 16, border: "1px solid #ddd", borderRadius: 12, overflow: "hidden" }}>
    <div style={{ padding: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 14 }}>Signed PDF Preview</span>

     <button
  style={{
    fontSize: 14,
    textDecoration: "underline",
    background: "none",
    border: "none",
    padding: 0,
    cursor: "pointer",
    color: "#2563eb",
  }}
  onClick={() => {
    const url = `/api/document/file?envelopeId=${encodeURIComponent(
      envelopeIdResolved
    )}&download=1`;
    window.location.href = url;
  }}
>
  Open / Download
</button>
    </div>

    <iframe
  src={`/api/document/file?envelopeId=${encodeURIComponent(envelopeIdResolved)}&download=0`}
  style={{ width: "100%", height: 700, border: 0 }}
  title="Signed PDF Preview"
/>
  </div>
)}
    
      <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 16,
          }}
        >
          <span style={{ fontSize: 14 }}>
            {secondsLeft > 0 ? `Unlocking in ${secondsLeft}s` : "Unlocked ✅"}
          </span>

          <button
  disabled={secondsLeft > 0 || envelopeStatus !== "completed"}
  onClick={confirmDownload}
  style={{
    background: "black",
    color: "white",
    border: 0,
    padding: "10px 16px",
    borderRadius: 10,
    cursor:
      secondsLeft > 0 || envelopeStatus !== "completed"
        ? "not-allowed"
        : "pointer",
    opacity:
      secondsLeft > 0 || envelopeStatus !== "completed"
        ? 0.5
        : 1,
  }}
>
  {envelopeStatus === "completed"
    ? "Download Signed PDF"
    : "Waiting for signature…"}
</button>
        </div>

        <button
  onClick={() => {
    if (secondsLeft > 0) return;
    cancelAdGate();
  }}
  style={{
    marginTop: 12,
    fontSize: 14,
    textDecoration: "underline",
    background: "transparent",
    border: 0,
    padding: 0,
    cursor: secondsLeft > 0 ? "not-allowed" : "pointer",
    opacity: secondsLeft > 0 ? 0.5 : 1,
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