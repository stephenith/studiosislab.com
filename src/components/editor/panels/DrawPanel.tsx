"use client";

import type { ReactNode } from "react";
import { SidebarSection } from "../sidebar/SidebarSection";
import type { EditorSidebarApi } from "../sidebar/EditorSidebar";

type DrawPanelProps = {
  onClose: () => void;
  editor?: EditorSidebarApi | null;
};

const HIGH_LIGHTER_COLORS = [
  { name: "Neon Green", value: "rgba(57,255,20,0.3)" },
  { name: "Yellow", value: "rgba(255,235,59,0.3)" },
  { name: "Pink", value: "rgba(255,64,129,0.3)" },
  { name: "Light Blue", value: "rgba(79,195,247,0.3)" },
  { name: "Blue", value: "rgba(66,133,244,0.3)" },
];

function ToolButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-lg border px-3 py-2.5 text-left text-sm flex items-center gap-2 transition-colors ${
        active
          ? "border-blue-300 bg-blue-50 text-blue-700"
          : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
      }`}
    >
      {children}
      {label}
    </button>
  );
}

export function DrawPanel({ onClose, editor }: DrawPanelProps) {
  const activeTool = editor?.activeDrawTool ?? "none";

  const switchTool = (tool: "pencil" | "highlighter" | "eraser") => {
    editor?.setDrawTool?.(tool);
  };

  return (
    <>
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-200 bg-white">
        <span className="text-sm font-medium text-zinc-800">Draw</span>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded hover:bg-zinc-100 text-zinc-500 hover:text-zinc-700"
          aria-label="Close panel"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="p-3 overflow-y-auto">
        <SidebarSection title="Drawing tools">
          <div className="flex flex-col gap-2">
            <ToolButton label="Pencil" active={activeTool === "pencil"} onClick={() => switchTool("pencil")}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </ToolButton>
            <ToolButton
              label="Highlighter"
              active={activeTool === "highlighter"}
              onClick={() => switchTool("highlighter")}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21L3 17l12-12 4 4L7 21z" />
              </svg>
            </ToolButton>
            <ToolButton label="Eraser" active={activeTool === "eraser"} onClick={() => switchTool("eraser")}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </ToolButton>
          </div>
        </SidebarSection>

        {activeTool === "pencil" && (
          <SidebarSection title="Pencil settings">
            <div className="space-y-3">
              <label className="text-xs text-zinc-500 block">
                Color
                <input
                  type="color"
                  value={editor?.pencilColor ?? "#111827"}
                  onChange={(e) => editor?.setPencilColor?.(e.target.value)}
                  className="mt-1 h-10 w-full rounded border border-zinc-200 bg-white"
                />
              </label>
              <label className="text-xs text-zinc-500 block">
                Thickness: {editor?.pencilThickness ?? 3}px
                <input
                  type="range"
                  min={1}
                  max={32}
                  step={1}
                  value={editor?.pencilThickness ?? 3}
                  onChange={(e) => editor?.setPencilThickness?.(Number(e.target.value))}
                  className="mt-1 w-full"
                />
              </label>
            </div>
          </SidebarSection>
        )}

        {activeTool === "highlighter" && (
          <SidebarSection title="Highlighter settings">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {HIGH_LIGHTER_COLORS.map((color) => {
                  const selected = (editor?.highlighterColor ?? HIGH_LIGHTER_COLORS[0].value) === color.value;
                  return (
                    <button
                      key={color.value}
                      type="button"
                      title={color.name}
                      onClick={() => editor?.setHighlighterColor?.(color.value)}
                      className={`h-7 w-7 rounded-full border-2 ${
                        selected ? "border-zinc-800" : "border-zinc-200"
                      }`}
                      style={{ backgroundColor: color.value }}
                    />
                  );
                })}
              </div>
              <label className="text-xs text-zinc-500 block">
                Thickness: {editor?.highlighterThickness ?? 16}px
                <input
                  type="range"
                  min={8}
                  max={40}
                  step={1}
                  value={editor?.highlighterThickness ?? 16}
                  onChange={(e) => editor?.setHighlighterThickness?.(Number(e.target.value))}
                  className="mt-1 w-full"
                />
              </label>
            </div>
          </SidebarSection>
        )}

        {activeTool === "eraser" && (
          <SidebarSection title="Eraser settings">
            <label className="text-xs text-zinc-500 block">
              Size: {editor?.eraserSize ?? 20}px
              <input
                type="range"
                min={4}
                max={64}
                step={1}
                value={editor?.eraserSize ?? 20}
                onChange={(e) => editor?.setEraserSize?.(Number(e.target.value))}
                className="mt-1 w-full"
              />
            </label>
          </SidebarSection>
        )}

        {activeTool !== "none" && (
          <button
            type="button"
            onClick={() => editor?.setDrawTool?.("none")}
            className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50"
          >
            Exit draw mode
          </button>
        )}
      </div>
    </>
  );
}
