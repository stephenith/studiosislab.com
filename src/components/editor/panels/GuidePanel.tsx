"use client";

import { useState } from "react";

type GuidePanelProps = {
  onClose: () => void;
};

type GuideSection = {
  id:
    | "quickStart"
    | "editingText"
    | "workingWithPhotos"
    | "colorsAndShapes"
    | "layersAndPositioning"
    | "pages"
    | "downloadAndExport"
    | "tips"
    | "advancedTools";
  title: string;
  steps: string[];
  note?: string;
};

const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: "quickStart",
    title: "Quick Start",
    steps: [
      "Use the left toolbar to add content: Text, Shapes, Images, Upload, and more.",
      "Click any object on the canvas to open matching controls in the right properties panel.",
      "Use Undo/Redo in the top bar as you edit, then click Download when ready to export.",
    ],
    note: "Tip: Use arrow keys for precise movement. Hold Shift for larger nudges.",
  },
  {
    id: "editingText",
    title: "Editing Text",
    steps: [
      "Open Text and add a Heading, Subheading, or Body Text block.",
      "Select the text object, then use the right Text panel to change font, style, size, and color.",
      "Use alignment, bullet/numbered list, spacing, and opacity controls to finalize readability.",
    ],
    note: "Shortcuts: Cmd/Ctrl+Z undo, Cmd/Ctrl+Shift+Z redo, Cmd/Ctrl+C and Cmd/Ctrl+V copy/paste.",
  },
  {
    id: "workingWithPhotos",
    title: "Working with Photos",
    steps: [
      "Use Upload to import your images and re-use them from Asset Library.",
      "Use Images to search stock photos and Graphics to insert icon-style visuals.",
      "Select an image to edit adjustments, border/corners, crop, flip, rotation, and opacity.",
      "Use Frames to add square/circle image frames, then drag or place images onto frames.",
    ],
    note: "In crop mode: press Enter to apply or Escape to cancel.",
  },
  {
    id: "colorsAndShapes",
    title: "Colors & Shapes",
    steps: [
      "Open Shapes and insert rectangle, circle, line, and other available shapes.",
      "Select a shape to control fill, border style/color/weight, and corner radius (when supported).",
      "Adjust shape opacity and rotation from the right Shape panel.",
      "Use Lock in the Shape panel to prevent accidental movement or resizing.",
    ],
  },
  {
    id: "layersAndPositioning",
    title: "Layers & Positioning",
    steps: [
      "Select one or multiple objects, then use Position controls to align left/center/right/top/middle/bottom.",
      "Use distribute controls to create even horizontal or vertical spacing between multiple objects.",
      "Open Layers and use up/down controls to reorder the visual stack.",
      "Use the floating toolbar for group, ungroup, duplicate, and delete actions.",
    ],
    note: "Nudge precision: Arrow keys move by 1px, Shift+Arrow moves by 10px.",
  },
  {
    id: "pages",
    title: "Pages",
    steps: [
      "Use page controls to add a page, duplicate a page, delete a page, or move pages up/down.",
      "Use Page Grid for a quick overview and fast page-level actions.",
      "In the right Page section, set page size (A4/Letter) and page background color.",
      "Toggle Grid in the right panel when you need visual alignment helpers.",
    ],
  },
  {
    id: "downloadAndExport",
    title: "Download & Export",
    steps: [
      "Click Download in the top bar to open export options.",
      "Choose format: PDF or PNG.",
      "Choose one or more pages, then continue to start export.",
      "PDF exports selected pages in one file; PNG exports selected pages as page images.",
    ],
  },
  {
    id: "tips",
    title: "Tips",
    steps: [
      "Set your document structure first (sections/pages), then polish spacing and typography.",
      "Use alignment and distribution tools before final export for consistent visual rhythm.",
      "Use Undo/Redo frequently while experimenting with layout changes.",
      "Use frame + crop for profile photos to keep portraits clean and consistent.",
    ],
  },
  {
    id: "advancedTools",
    title: "Advanced Tools",
    steps: [
      "Templates: apply a system template to the current page.",
      "Tables: insert a table by selecting rows × columns, then edit border settings.",
      "QR Code: generate a QR object from URL/text and place it anywhere on the page.",
      "Draw: use Pencil, Highlighter, or Eraser modes with adjustable thickness and colors.",
    ],
    note: "Use draw mode sparingly for resumes; it is best for annotations and accents.",
  },
];

export function GuidePanel({ onClose }: GuidePanelProps) {
  const [openSectionId, setOpenSectionId] = useState<GuideSection["id"] | null>(null);

  return (
    <>
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-200 bg-white">
        <span className="text-sm font-medium text-zinc-800">Guide</span>
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
        <p className="text-xs text-zinc-500 mb-3">
          Learn the current editor workflow. Expand any section below.
        </p>

        <div className="space-y-2">
          {GUIDE_SECTIONS.map((section) => {
            const isOpen = openSectionId === section.id;
            return (
              <section key={section.id} className="rounded-lg border border-zinc-200 bg-white">
                <button
                  type="button"
                  onClick={() => setOpenSectionId((prev) => (prev === section.id ? null : section.id))}
                  className="w-full px-3 py-2.5 flex items-center justify-between text-left"
                  aria-expanded={isOpen}
                >
                  <span className="text-sm font-medium text-zinc-800">{section.title}</span>
                  <svg
                    viewBox="0 0 24 24"
                    className={`w-4 h-4 text-zinc-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                  </svg>
                </button>

                {isOpen && (
                  <div className="px-3 pb-3 border-t border-zinc-100">
                    <ol className="mt-2 space-y-1.5 text-sm text-zinc-700 list-decimal list-inside">
                      {section.steps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                    {section.note && <p className="mt-2 text-xs text-zinc-500">{section.note}</p>}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </>
  );
}
