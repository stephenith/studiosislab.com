"use client";

import { SidebarSection } from "../sidebar/SidebarSection";
import { shapeCatalog } from "@/data/shapes/catalog";

export type ShapesEditorApi = {
  addShape?: (shapeId: string) => void;
  addRect?: () => void;
  addCircle?: () => void;
  addLine?: () => void;
};

type ShapesPanelProps = {
  onClose: () => void;
  editor: ShapesEditorApi | null;
};

export function ShapesPanel({ onClose, editor }: ShapesPanelProps) {
  const renderShapeIcon = (shapeId: string) => {
    if (shapeId === "rectangle") {
      return <span className="inline-block w-6 h-4 border-2 border-current rounded" />;
    }
    if (shapeId === "circle") {
      return <span className="inline-block w-5 h-5 border-2 border-current rounded-full" />;
    }
    if (shapeId === "line") {
      return <span className="inline-block w-6 border-t-2 border-current" />;
    }
    if (shapeId === "triangle") {
      return (
        <span className="inline-block w-0 h-0 border-l-[10px] border-r-[10px] border-b-[16px] border-l-transparent border-r-transparent border-b-current" />
      );
    }
    if (shapeId === "polygon-5") {
      return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 3l8 6-3 10H7L4 9l8-6z" />
        </svg>
      );
    }
    if (shapeId === "star-5") {
      return <span className="inline-block text-lg leading-none">★</span>;
    }
    return <span className="inline-block w-5 h-5 border-2 border-current rounded" />;
  };

  return (
    <>
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-200 bg-white">
        <span className="text-sm font-medium text-zinc-800">Shapes</span>
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
        <SidebarSection title="Add shape">
          <div className="flex flex-col gap-2">
            {shapeCatalog.map((shape) => (
              <button
                key={shape.id}
                type="button"
                onClick={() => {
                  if (editor?.addShape) {
                    editor.addShape(shape.id);
                    return;
                  }
                  if (shape.id === "rectangle") editor?.addRect?.();
                  else if (shape.id === "circle") editor?.addCircle?.();
                  else if (shape.id === "line") editor?.addLine?.();
                }}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-left text-sm text-zinc-700 hover:bg-zinc-50 flex items-center gap-2"
              >
                {renderShapeIcon(shape.id)}
                {shape.label}
              </button>
            ))}
          </div>
        </SidebarSection>
      </div>
    </>
  );
}
