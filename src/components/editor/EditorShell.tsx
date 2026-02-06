"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useFabricEditor } from "@/components/editor/useFabricEditor";

type EditorShellProps = {
  initialTemplateId?: string | null;
  mode: "template" | "new";
};

export default function EditorShell({ initialTemplateId, mode }: EditorShellProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const canvasWrapRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [filename, setFilename] = useState("Untitled Resume");
  const [tool, setTool] = useState<
    "select" | "text" | "shape" | "line" | "image" | "templates"
  >("select");

  const editor = useFabricEditor({ mode, initialTemplateId });

  const zoomPercent =
    editor.getZoomPercent?.() ?? Math.round((editor.zoom ?? 1) * 100);
  const zoomLabel = `${zoomPercent}%`;
  const pageSizePx = editor.getPageSizePx();
  const [customUnit, setCustomUnit] = useState<"mm" | "cm" | "in" | "px" | "pt">(
    "mm"
  );
  const [customWidth, setCustomWidth] = useState("");
  const [customHeight, setCustomHeight] = useState("");

  const toPx = useCallback((value: number, unit: typeof customUnit) => {
    if (!Number.isFinite(value)) return 0;
    switch (unit) {
      case "mm":
        return (value / 25.4) * 96;
      case "cm":
        return (value / 2.54) * 96;
      case "in":
        return value * 96;
      case "pt":
        return (value / 72) * 96;
      case "px":
      default:
        return value;
    }
  }, []);

  const fromPx = useCallback((value: number, unit: typeof customUnit) => {
    if (!Number.isFinite(value)) return 0;
    switch (unit) {
      case "mm":
        return (value / 96) * 25.4;
      case "cm":
        return (value / 96) * 2.54;
      case "in":
        return value / 96;
      case "pt":
        return (value / 96) * 72;
      case "px":
      default:
        return value;
    }
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toLowerCase().includes("mac");
      const mod = isMac ? e.metaKey : e.ctrlKey;

      if ((e.key === "Delete" || e.key === "Backspace") && !mod) {
        e.preventDefault();
        editor.deleteSelected();
      }

      if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        editor.undo();
      }

      if (mod && (e.key.toLowerCase() === "z" && e.shiftKey)) {
        e.preventDefault();
        editor.redo();
      }

      if (mod && e.key.toLowerCase() === "c") {
        e.preventDefault();
        editor.copy();
      }

      if (mod && e.key.toLowerCase() === "v") {
        e.preventDefault();
        editor.paste();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editor]);

  useEffect(() => {
    const el = canvasWrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    if (editor.pageSize === "Custom") return;
    const w = fromPx(pageSizePx.w, customUnit);
    const h = fromPx(pageSizePx.h, customUnit);
    setCustomWidth(w.toFixed(2).replace(/\.00$/, ""));
    setCustomHeight(h.toFixed(2).replace(/\.00$/, ""));
  }, [customUnit, editor.pageSize, pageSizePx.h, pageSizePx.w]);

  useEffect(() => {
    if (editor.pageSize !== "Custom") return;
    const id = window.setTimeout(() => {
      const w = Number(customWidth);
      const h = Number(customHeight);
      if (!Number.isFinite(w) || !Number.isFinite(h)) return;
      const wPx = toPx(w, customUnit);
      const hPx = toPx(h, customUnit);
      if (wPx > 0 && hPx > 0) {
        editor.setPageSizePx(wPx, hPx);
      }
    }, 200);
    return () => window.clearTimeout(id);
  }, [customHeight, customUnit, customWidth, editor, toPx]);

  const toolButtonBase =
    "h-11 w-11 rounded-xl border shadow-sm flex items-center justify-center transition-all duration-150 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400";
  const toolButtonActive =
    "bg-indigo-50 border-indigo-300 text-indigo-700 shadow-md";
  const toolButtonIdle =
    "bg-white border-zinc-200 text-zinc-700 hover:-translate-y-0.5 hover:shadow-md hover:border-zinc-300";

  return (
    <div className="h-screen flex flex-col">
      {/* Top Bar */}
      <div className="h-14 shrink-0 sticky top-0 z-50 border-b bg-white">
        <div className="h-full flex items-center justify-between px-4">
          <button
            onClick={() => router.back()}
            className="rounded border px-3 py-1 text-sm"
          >
            Back
          </button>

          <input
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            className="w-64 rounded border px-2 py-1 text-sm text-center"
            aria-label="Filename"
          />

          <div className="flex items-center gap-2">
            <button onClick={editor.undo} className="rounded border px-2 py-1 text-sm">
              Undo
            </button>
            <button onClick={editor.redo} className="rounded border px-2 py-1 text-sm">
              Redo
            </button>
            <div className="text-sm text-zinc-600">{zoomLabel}</div>
            <button
              className="rounded border px-2 py-1 text-sm"
              onClick={() => editor.setZoomPercent(zoomPercent - 10)}
            >
              –
            </button>
            <button
              className="rounded border px-2 py-1 text-sm"
              onClick={() => editor.setZoomPercent(zoomPercent + 10)}
            >
              +
            </button>
            <button
              onClick={() => {
                editor.exportPNG();
                editor.exportPDF();
              }}
              className="rounded bg-black px-3 py-1 text-sm text-white"
            >
              Download
            </button>
            <button
              onClick={() => {
                console.log("SAVE", filename);
              }}
              className="rounded border px-3 py-1 text-sm"
            >
              Save
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Left Toolbar */}
        <aside className="w-[72px] shrink-0 border-r bg-white flex flex-col items-center gap-3 py-4">
          <button
            type="button"
            title="Select"
            aria-label="Select tool"
            onClick={() => setTool("select")}
            className={`${toolButtonBase} ${
              tool === "select" ? toolButtonActive : toolButtonIdle
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 3l7 17 2-6 6-2L4 3z" />
            </svg>
          </button>
          <button
            type="button"
            title="Text"
            aria-label="Text tool"
            onClick={() => {
              setTool("text");
              editor.addText();
            }}
            className={`${toolButtonBase} ${
              tool === "text" ? toolButtonActive : toolButtonIdle
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M5 6h14M12 6v12M8 18h8" />
            </svg>
          </button>
          <button
            type="button"
            title="Shapes"
            aria-label="Shapes tool"
            onClick={() => {
              setTool("shape");
              editor.addRect();
            }}
            className={`${toolButtonBase} ${
              tool === "shape" ? toolButtonActive : toolButtonIdle
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="5" y="5" width="14" height="14" rx="2" />
            </svg>
          </button>
          <button
            type="button"
            title="Line"
            aria-label="Line tool"
            onClick={() => {
              setTool("line");
              editor.addLine();
            }}
            className={`${toolButtonBase} ${
              tool === "line" ? toolButtonActive : toolButtonIdle
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M5 19L19 5" />
            </svg>
          </button>
          <button
            type="button"
            title="Image"
            aria-label="Image tool"
            onClick={() => {
              setTool("image");
              fileInputRef.current?.click();
            }}
            className={`${toolButtonBase} ${
              tool === "image" ? toolButtonActive : toolButtonIdle
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="4" y="5" width="16" height="14" rx="2" />
              <circle cx="9" cy="10" r="1.8" />
              <path d="M4 17l5-5 4 4 3-3 4 4" />
            </svg>
          </button>
          <button
            type="button"
            title="Templates"
            aria-label="Templates"
            onClick={() => {
              setTool("templates");
              router.push("/resume");
            }}
            className={`${toolButtonBase} ${
              tool === "templates" ? toolButtonActive : toolButtonIdle
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="4" y="4" width="7" height="7" rx="1" />
              <rect x="13" y="4" width="7" height="7" rx="1" />
              <rect x="4" y="13" width="7" height="7" rx="1" />
              <rect x="13" y="13" width="7" height="7" rx="1" />
            </svg>
          </button>
        </aside>

        {/* Center Canvas */}
        <div className="flex-1 min-h-0 min-w-0 relative flex overflow-hidden" ref={canvasWrapRef}>
          <div
            ref={viewportRef}
            data-editor-viewport="1"
            className="flex-1 min-h-0 min-w-0 overflow-hidden bg-neutral-100"
          >
            <div className="relative min-h-full min-w-full">
              <canvas ref={editor.canvasElRef} className="block" />
            </div>
          </div>
        </div>

        {/* Right Panel */}
        <aside className="w-[300px] shrink-0 h-full overflow-y-auto border-l bg-white p-4 space-y-6">
          {editor.selectionType === "text" && (
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase text-zinc-500">
                Text
              </div>
              <select
                className="w-full rounded border px-2 py-1 text-sm"
                value={editor.textProps.fontFamily}
                onChange={(e) => editor.updateActiveObject({ fontFamily: e.target.value })}
              >
                {["Poppins", "Inter", "Montserrat", "Roboto"].map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={8}
                max={96}
                className="w-full rounded border px-2 py-1 text-sm"
                value={editor.textProps.fontSize}
                onChange={(e) =>
                  editor.updateActiveObject({ fontSize: Number(e.target.value) })
                }
              />
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    editor.updateActiveObject({
                      fontWeight:
                        editor.textProps.fontWeight === "bold" ? "normal" : "bold",
                    })
                  }
                  className="rounded border px-2 py-1 text-sm"
                >
                  B
                </button>
                <button
                  onClick={() =>
                    editor.updateActiveObject({
                      fontStyle:
                        editor.textProps.fontStyle === "italic" ? "normal" : "italic",
                    })
                  }
                  className="rounded border px-2 py-1 text-sm"
                >
                  I
                </button>
                <button
                  onClick={() =>
                    editor.updateActiveObject({
                      underline: !editor.textProps.underline,
                    })
                  }
                  className="rounded border px-2 py-1 text-sm"
                >
                  U
                </button>
              </div>
              <input
                type="color"
                value={editor.textProps.fill}
                onChange={(e) => editor.updateActiveObject({ fill: e.target.value })}
                className="h-10 w-full rounded border"
              />
              <select
                className="w-full rounded border px-2 py-1 text-sm"
                value={editor.textProps.textAlign}
                onChange={(e) =>
                  editor.updateActiveObject({ textAlign: e.target.value as any })
                }
              >
                {["left", "center", "right", "justify"].map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
              <select
                className="w-full rounded border px-2 py-1 text-sm"
                value={editor.textProps.lineHeight}
                onChange={(e) =>
                  editor.updateActiveObject({ lineHeight: Number(e.target.value) })
                }
              >
                {[1.0, 1.15, 1.3, 1.5, 1.8, 2.0].map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          )}

          {editor.selectionType === "shape" && (
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase text-zinc-500">
                Shape
              </div>
              <input
                type="color"
                value={editor.shapeProps.fill}
                onChange={(e) => editor.updateActiveObject({ fill: e.target.value })}
                className="h-10 w-full rounded border"
              />
              <input
                type="color"
                value={editor.shapeProps.stroke}
                onChange={(e) => editor.updateActiveObject({ stroke: e.target.value })}
                className="h-10 w-full rounded border"
              />
              <input
                type="number"
                min={0}
                max={20}
                value={editor.shapeProps.strokeWidth}
                onChange={(e) =>
                  editor.updateActiveObject({ strokeWidth: Number(e.target.value) })
                }
                className="w-full rounded border px-2 py-1 text-sm"
              />
              <input
                type="number"
                min={0}
                max={60}
                value={editor.shapeProps.cornerRadius}
                onChange={(e) =>
                  editor.updateActiveObject({
                    rx: Number(e.target.value),
                    ry: Number(e.target.value),
                  })
                }
                className="w-full rounded border px-2 py-1 text-sm"
              />
              <input
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={editor.shapeProps.opacity}
                onChange={(e) =>
                  editor.updateActiveObject({ opacity: Number(e.target.value) })
                }
                className="w-full rounded border px-2 py-1 text-sm"
              />
            </div>
          )}

          {editor.selectionType === "none" && (
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase text-zinc-500">
                Page
              </div>
              <select
                className="w-full rounded border px-2 py-1 text-sm"
                value={editor.pageSize}
                onChange={(e) => {
                  const next = e.target.value as any;
                  editor.setPageSize(next);
                  if (next === "Custom") {
                    if (!customWidth || !customHeight) {
                      const w = fromPx(pageSizePx.w, customUnit);
                      const h = fromPx(pageSizePx.h, customUnit);
                      setCustomWidth(w.toFixed(2).replace(/\.00$/, ""));
                      setCustomHeight(h.toFixed(2).replace(/\.00$/, ""));
                    }
                  }
                }}
              >
                {["A4", "Letter", "Custom"].map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              {editor.pageSize === "Custom" && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      min={1}
                      step={0.1}
                      value={customWidth}
                      onChange={(e) => setCustomWidth(e.target.value)}
                      placeholder="Width"
                      className="w-full rounded border px-2 py-1 text-sm"
                    />
                    <input
                      type="number"
                      min={1}
                      step={0.1}
                      value={customHeight}
                      onChange={(e) => setCustomHeight(e.target.value)}
                      placeholder="Height"
                      className="w-full rounded border px-2 py-1 text-sm"
                    />
                  </div>
                  <select
                    className="w-full rounded border px-2 py-1 text-sm"
                    value={customUnit}
                    onChange={(e) =>
                      setCustomUnit(e.target.value as "mm" | "cm" | "in" | "px" | "pt")
                    }
                  >
                    {["mm", "cm", "in", "px", "pt"].map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <input
                type="color"
                value={editor.bgColor}
                onChange={(e) => {
                  editor.setPageBackground(e.target.value);
                }}
                className="h-10 w-full rounded border"
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editor.gridEnabled}
                  onChange={(e) => {
                    editor.setGridEnabled(e.target.checked);
                    editor.applyGrid(e.target.checked);
                  }}
                />
                Grid
              </label>
            </div>
          )}

          {editor.selectionType === "image" && (
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase text-zinc-500">
                Image
              </div>
              <input
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={editor.imageProps.opacity}
                onChange={(e) =>
                  editor.updateActiveObject({ opacity: Number(e.target.value) })
                }
                className="w-full rounded border px-2 py-1 text-sm"
              />
            </div>
          )}

          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-zinc-500">
              Layers
            </div>
            <div className="space-y-2">
              {editor.layers.map((layer, idx) => (
                <div
                  key={layer.id}
                  onClick={() => editor.selectLayerById(layer.id)}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", String(idx));
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const from = Number(e.dataTransfer.getData("text/plain"));
                    if (Number.isFinite(from)) {
                      editor.reorderLayer(from, idx);
                    }
                  }}
                  className={`flex items-center justify-between rounded px-2 py-1 text-xs ${
                    editor.selectedLayerId === layer.id
                      ? "bg-zinc-200 text-zinc-900"
                      : "hover:bg-zinc-100"
                  }`}
                >
                  <span className="truncate">{layer.name}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        editor.layerBringToFront(layer.id);
                      }}
                      className="rounded border px-1.5 py-0.5"
                      title="Bring to front"
                      aria-label="Bring to front"
                    >
                      ⬆️
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        editor.layerSendToBack(layer.id);
                      }}
                      className="rounded border px-1.5 py-0.5"
                      title="Send to back"
                      aria-label="Send to back"
                    >
                      ⬇️
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        editor.layerBringForward(layer.id);
                      }}
                      className="rounded border px-1.5 py-0.5"
                      title="Bring forward"
                      aria-label="Bring forward"
                    >
                      ↑
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        editor.layerSendBackward(layer.id);
                      }}
                      className="rounded border px-1.5 py-0.5"
                      title="Send backward"
                      aria-label="Send backward"
                    >
                      ↓
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        editor.setLayerVisible(layer.id, !layer.visible);
                      }}
                      className="rounded border px-2 py-0.5"
                    >
                      {layer.visible ? "👁" : "🚫"}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        editor.setLayerLocked(layer.id, !layer.locked);
                      }}
                      className="rounded border px-2 py-0.5"
                    >
                      {layer.locked ? "🔒" : "🔓"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) editor.addImage(file);
        }}
      />
    </div>
  );
}
