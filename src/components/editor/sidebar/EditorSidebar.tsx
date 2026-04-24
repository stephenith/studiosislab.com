"use client";

import { useState } from "react";
import { SidebarIcon } from "./SidebarIcon";
import { TemplatesPanel } from "../panels/TemplatesPanel";
import { TextPanel } from "../panels/TextPanel";
import { ShapesPanel } from "../panels/ShapesPanel";
import { TablesPanel } from "../panels/TablesPanel";
import { FramesPanel } from "../panels/FramesPanel";
import { ImagesPanel } from "../panels/ImagesPanel";
import { GraphicsPanel } from "../panels/GraphicsPanel";
import { QRPanel } from "../panels/QRPanel";
import { DrawPanel } from "../panels/DrawPanel";
import { UploadPanel } from "../panels/UploadPanel";

export type PanelId =
  | "templates"
  | "text"
  | "shapes"
  | "tables"
  | "frames"
  | "images"
  | "graphics"
  | "qr"
  | "draw"
  | "upload"
  | null;

export type EditorSidebarApi = {
  addText?: () => void;
  setTextProp?: (patch: Record<string, unknown>) => void;
  addTable?: (rows: number, cols: number) => void;
  addShape?: (shapeId: string) => void;
  addRect?: () => void;
  addCircle?: () => void;
  addLine?: () => void;
  addImageFrame?: (type: "square" | "circle") => void;
  addImage?: (file: File) => void;
  addImageFromUrl?: (url: string) => Promise<void> | void;
  addGraphicFromUrl?: (url: string) => Promise<void> | void;
  addQrCode?: (content: string) => Promise<void> | void;
  applyTemplateToCurrentPage?: (templateId: string) => Promise<void> | void;
  activeDrawTool?: "none" | "pencil" | "highlighter" | "eraser";
  pencilColor?: string;
  pencilThickness?: number;
  highlighterColor?: string;
  highlighterThickness?: number;
  eraserSize?: number;
  setDrawTool?: (tool: "none" | "pencil" | "highlighter" | "eraser") => void;
  setPencilColor?: (value: string) => void;
  setPencilThickness?: (value: number) => void;
  setHighlighterColor?: (value: string) => void;
  setHighlighterThickness?: (value: number) => void;
  setEraserSize?: (value: number) => void;
};

const PANEL_WIDTH = 280;

type EditorSidebarProps = {
  editor: EditorSidebarApi | null;
};

export function EditorSidebar({ editor }: EditorSidebarProps) {
  const [openPanel, setOpenPanel] = useState<PanelId>(null);

  const toggle = (id: PanelId) => {
    setOpenPanel((prev) => (prev === id ? null : id));
  };

  const closePanel = () => setOpenPanel(null);

  const iconClass = "h-[22px] w-[22px]";

  return (
    <div className="flex h-full shrink-0 bg-white border-r border-zinc-200">
      {/* Vertical icon strip — LidoJS style */}
      <div className="editor-left-toolbar flex flex-col items-center w-[90px] py-6 gap-6 shrink-0 border-r border-zinc-100">
        <SidebarIcon
          icon={
            <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="4" y="4" width="7" height="7" rx="1" />
              <rect x="13" y="4" width="7" height="7" rx="1" />
              <rect x="4" y="13" width="7" height="7" rx="1" />
              <rect x="13" y="13" width="7" height="7" rx="1" />
            </svg>
          }
          label="Templates"
          active={openPanel === "templates"}
          onClick={() => toggle("templates")}
        />
        <SidebarIcon
          icon={
            <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M5 6h14M12 6v12M8 18h8" />
            </svg>
          }
          label="Text"
          active={openPanel === "text"}
          onClick={() => toggle("text")}
        />
        <SidebarIcon
          icon={
            <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="5" y="5" width="14" height="14" rx="2" />
            </svg>
          }
          label="Shapes"
          active={openPanel === "shapes"}
          onClick={() => toggle("shapes")}
        />
        <SidebarIcon
          icon={
            <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M3 6h18M3 12h18M3 18h18" />
              <path d="M3 6v12h18V6H3z" fill="none" strokeWidth="1.5" />
            </svg>
          }
          label="Tables"
          active={openPanel === "tables"}
          onClick={() => toggle("tables")}
        />
        <SidebarIcon
          icon={
            <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="5" y="5" width="14" height="14" rx="2" />
              <rect x="8" y="8" width="8" height="8" rx="1" strokeDasharray="2 2" fill="none" />
            </svg>
          }
          label="Frames"
          active={openPanel === "frames"}
          onClick={() => toggle("frames")}
        />
        <SidebarIcon
          icon={
            <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="4" y="5" width="16" height="14" rx="2" />
              <circle cx="9" cy="10" r="1.8" />
              <path d="M4 17l5-5 4 4 3-3 4 4" />
            </svg>
          }
          label="Images"
          active={openPanel === "images"}
          onClick={() => toggle("images")}
        />
        <SidebarIcon
          icon={
            <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 4l6 6m0-6l6 6M4 20l6-6m0 6l6-6" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          }
          label="Graphics"
          active={openPanel === "graphics"}
          onClick={() => toggle("graphics")}
        />
        <SidebarIcon
          icon={
            <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 4v1m0 14v1M4 12h1m14 0h1m-2.5-8.5l.7.7M6.8 17.2l.7.7m10.2-10.2l.7.7M6.8 6.8l.7.7" />
              <rect x="5" y="5" width="14" height="14" rx="2" />
              <path d="M9 9h2v2H9zm4 0h2v2h-2zm-4 4h2v2H9zm4 0h2v2h-2z" fill="currentColor" />
            </svg>
          }
          label="QR Code"
          active={openPanel === "qr"}
          onClick={() => toggle("qr")}
        />
        <SidebarIcon
          icon={
            <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          }
          label="Draw"
          active={openPanel === "draw"}
          onClick={() => toggle("draw")}
        />
        <SidebarIcon
          icon={
            <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          }
          label="Upload"
          active={openPanel === "upload"}
          onClick={() => toggle("upload")}
        />
      </div>

      {/* Sliding panel */}
      {openPanel && (
        <div
          className="shrink-0 flex flex-col h-full border-l border-zinc-100 bg-white overflow-hidden transition-[width] duration-200"
          style={{ width: PANEL_WIDTH }}
        >
          {openPanel === "templates" && <TemplatesPanel onClose={closePanel} editor={editor} />}
          {openPanel === "text" && <TextPanel onClose={closePanel} editor={editor} />}
          {openPanel === "shapes" && <ShapesPanel onClose={closePanel} editor={editor} />}
          {openPanel === "tables" && <TablesPanel onClose={closePanel} editor={editor} />}
          {openPanel === "frames" && <FramesPanel onClose={closePanel} editor={editor} />}
          {openPanel === "images" && <ImagesPanel onClose={closePanel} editor={editor} />}
          {openPanel === "graphics" && <GraphicsPanel onClose={closePanel} editor={editor} />}
          {openPanel === "qr" && <QRPanel onClose={closePanel} editor={editor} />}
          {openPanel === "draw" && <DrawPanel onClose={closePanel} editor={editor} />}
          {openPanel === "upload" && <UploadPanel onClose={closePanel} editor={editor} />}
        </div>
      )}
    </div>
  );
}
